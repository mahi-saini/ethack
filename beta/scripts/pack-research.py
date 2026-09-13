"""Build immutable, compressed, on-demand research assets from audited source packages.
No source files are changed. Re-run for a new release when more data arrives.
"""
import argparse, collections, gzip, hashlib, json, pathlib, re

def encode(v): return json.dumps(v,ensure_ascii=False,separators=(',',':'),allow_nan=False).encode()
def digest(v): return hashlib.sha256(v).hexdigest()
def first(r,*keys):
    for k in keys:
        v=r.get(k)
        if v is not None and v!='': return v
    return None
def cik(v):
    s=str(v or '').upper().replace('CIK:','')
    return 'CIK:'+s.zfill(10) if s.isdigit() and len(s)<=10 else None
def meta(r):
    keys=set()
    for k in ['cik','companyId','inputCompanyId','entityId','entity_id','target_match_cik','company_id','parent_entity_id','child_entity_id']:
        if v:=r.get(k): keys.add((cik(v) if k in ['cik','target_match_cik'] or str(v).lower().startswith('cik:') else None) or str(v))
    for k in ['candidateCompanyIds','candidate_ciks']:
        values=r.get(k) or []
        if isinstance(values,list): keys.update(cik(v) or str(v) for v in values)
    symbol=first(r,'ticker','requested_symbol','tickerHint','ticker_preferred','ticker_reported','ticker_at_snapshot')
    if symbol: keys.add('TICKER:'+str(symbol))
    for k in ['assetId','entityId','parentEntityId','immediateOwnerId','operatorId','facility_id','parent_entity_id','child_entity_id','facilityId','childEntityId']:
        if r.get(k): keys.add(str(r[k]))
    dates=r.get('dates') or {}
    available=first(r,'availableDate','available_date_conservative','source_publication_date','publishedDate') or dates.get('publicationDate')
    # SEC acceptance/filing metadata establish a conservative day-after availability.
    if not available and r.get('filing_date') and r.get('accession_number'):
        import datetime
        try: available=(datetime.date.fromisoformat(r['filing_date'][:10])+datetime.timedelta(days=1)).isoformat()
        except ValueError: pass
    if available: available=str(available)[:10]
    if not available or not re.fullmatch(r'\d{4}-\d{2}-\d{2}',available): available=None
    period=first(r,'periodEnd','period_end','fiscalPeriod','filing_period','period','holdings_date','snapshotDate','month','assessmentMonth','reportingYear','reporting_year','year','report_date') or dates.get('snapshotDate')
    label=first(r,'metric','fieldPath','title','companyName','company_name','name','entity_name','security_name','requested_symbol','ticker','form','id') or 'Source record'
    value=first(r,'valueText','numericValue','value','totalReturn','total_return','weight_fraction','targetYear','share','value_usd','ownershipFraction','emissions','co2e_100yr')
    if isinstance(value,(dict,list)): value=json.dumps(value,ensure_ascii=False)[:180]
    anomalies=bool(r.get('period_end_after_filing_flag') or r.get('period_end_after_retrieval_flag'))
    return {'keys':sorted(keys),'label':str(label)[:260],'period':str(period) if period is not None else None,'availableDate':available,'value':value,'unit':r.get('unit') or ('USD' if 'value_usd' in r else None),'basis':first(r,'basis','measureType','mappingStatus','identity_status','kind') or 'source record','eligible':r.get('eligibleForCompanyJoin',r.get('companyId') is not None),'dateAnomaly':anomalies,'sourceId':first(r,'sourceId','source_id'),'url':first(r,'sourceUrl','source_url','primary_document_url','url')}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('stage');ap.add_argument('--site',default='.');ap.add_argument('--only-new',action='store_true');ap.add_argument('--refresh-prefix',default='');args=ap.parse_args()
    stage=pathlib.Path(args.stage).resolve();site=pathlib.Path(args.site).resolve();out=site/'public/research-data';out.mkdir(parents=True,exist_ok=True)
    catalogue=[];integrity=[];company_map={};revision='research-2026-09-13'
    if args.only_new and (out/'manifest.json').exists():
        catalogue=json.loads((out/'manifest.json').read_text())['collections']
        integrity=json.loads((out/'integrity.json').read_text())
        if args.refresh_prefix:
            catalogue=[c for c in catalogue if not c['id'].startswith(args.refresh_prefix)]
            integrity=[c for c in integrity if not c['collection'].startswith(args.refresh_prefix)]
    def write(path,value,compressed=False):
        path.parent.mkdir(parents=True,exist_ok=True);b=encode(value);path.write_bytes(gzip.compress(b,mtime=0) if compressed else b);return len(b)
    def ingest(id,label,group,rows,notes):
        if any(c['id']==id for c in catalogue):return
        parts=[];batch=[];size=2;count=0;company_counts=collections.Counter()
        def flush():
            nonlocal batch,size
            if not batch:return
            n=len(parts);filename=f'{id}/{n:04}.json.gz';raw=encode(batch);blob=gzip.compress(raw,mtime=0);(out/id).mkdir(exist_ok=True);(out/filename).write_bytes(blob)
            keys=sorted({k for r in batch for k in r['keys']})
            parts.append({'path':filename,'count':len(batch),'keys':keys,'bytes':len(blob),'decodedBytes':len(raw),'sha256':digest(blob)})
            batch=[];size=2
        for raw in rows:
            m=meta(raw)
            if id.startswith('fin-cdu') and raw.get('company_id') is not None:
                native=str(raw['company_id']);m['keys']=[k for k in m['keys'] if k not in [native,cik(native)]]+['CDU:'+native]
            m['recordId']=str(first(raw,'recordId','id','record_id') or digest(encode(raw))[:24]);m['record']=raw;b=encode(m)
            if batch and (size+len(b)>1800000 or len(batch)>=1200):flush()
            batch.append(m);size+=len(b)+1;count+=1
            company_counts.update(k for k in m['keys'] if k.startswith('CIK:'))
        flush()
        index={'id':id,'parts':parts,'companyCounts':dict(company_counts)};write(out/f'{id}/index.json',index)
        catalogue.append({'id':id,'label':label,'group':group,'count':count,'parts':len(parts),'bytes':sum(x['bytes'] for x in parts),'notes':notes,'index':f'{id}/index.json'})
        integrity.append({'collection':id,'count':count,'parts':len(parts),'sha256':digest(encode(index))})
        print(id,count,flush=True)
    def rows_from(p,ds):
        for part in ds.get('parts',[]):
            file=p/part['path'];blob=file.read_bytes()
            if part.get('sha256') and digest(blob)!=part['sha256']:raise ValueError(f'Hash mismatch {file}')
            text=(gzip.decompress(blob) if file.suffix=='.gz' else blob).decode()
            if '.ndjson' in file.name or '.jsonl' in file.name:rows=(json.loads(x) for x in text.splitlines() if x)
            else:
                data=json.loads(text);rows=data[ds['field']] if ds.get('field') else data
            n=0
            for r in rows:n+=1;yield r
            if n!=part.get('rows',n):raise ValueError(f'Count mismatch {file}')
    p=stage/'financial';fm=json.loads((p/'manifest.json').read_text())
    for ds in fm['datasets']:
        ingest('fin-'+ds['id'],ds['id'].replace('-',' ').capitalize(),'Financial & SEC',rows_from(p,ds),ds.get('notes',[]))
    cp=stage/'climate-ca100';cm=json.loads((cp/'manifest.json').read_text())
    for id,ds in cm['datasets'].items():
        def rows(ds=ds):
            for file in ds['files']:yield from json.loads((cp/file).read_text())
        ingest('climate-'+id,id.replace('-',' ').replace('ct ','Climate TRACE ').replace('ca100 ','CA100 ').capitalize(),'Climate TRACE & CA100',rows(),[ds['description']])
    np=stage/'netzero-tracker/normalized';nm=json.loads((np/'manifest.json').read_text())
    for id,ds in nm['partitions'].items():
        ingest('nzt-'+id,'Net Zero Tracker · '+re.sub(r'([A-Z])',r' \1',id).lower(),'Net Zero Tracker',rows_from(np,ds),['Targets and snapshot comparisons, not achieved emissions reductions. Current CC BY-NC 4.0; legacy CC BY 4.0. Original publication dates unknown. Company links may be quarantined.'])
    for folder,prefix,group in [('server-supplement','server','Ownership & EPA pilot'),('bocc','bocc','Banking on Climate Chaos')]:
        sp=stage/folder/'normalized'
        if not (sp/'manifest.json').exists():continue
        sm=json.loads((sp/'manifest.json').read_text())
        for id,ds in sm['partitions'].items():
            ingest(prefix+'-'+id,group+' · '+re.sub(r'([A-Z])',r' \1',id).lower(),group,rows_from(sp,ds),sm.get('limitations',[]) or ['Source research records; inspect original mapping, date, and attribution limits.'])
    # Compact identity search is separate from evidence and is not an official index universe.
    for r in json.loads((cp/'companies-001.json').read_text()):
        company_map[r['id']]={'id':r['id'],'cik':r['cik'],'name':r['name'],'tickers':r.get('currentTickers') or ([r['tickerHint']] if r.get('tickerHint') else []),'firstQuarter':r['firstObservedQuarter'],'lastQuarter':r['lastObservedQuarter'],'inLatestSnapshot':r['inLatestHoldingsSnapshot']}
    for r in json.loads((np/'companyIndex.part-001.json').read_text()):
        if r['companyId'] in company_map:company_map[r['companyId']]['netZeroMapping']=r['match']['integrationStatus']
    write(out/'companies.json',sorted(company_map.values(),key=lambda c:c['name']))
    # Latest actual holdings snapshot for the working company explorer. No scores fabricated.
    latest=next(d for d in fm['datasets'] if d['id']=='latest-universe-snapshot');lr=list(rows_from(p,latest))
    profiles=[];seen=set()
    for r in lr:
        t=first(r,'ticker','ticker_preferred','tickerHint');name=first(r,'name','security_name','companyName');ci=cik(first(r,'cik','entityId','companyId'))
        if not t or not name or not ci or t in seen:continue
        seen.add(t);profiles.append({'ticker':t,'name':name,'cik':ci[4:],'sector':first(r,'sector','sector_from_ivv_same_quarter') or 'Unclassified','scores':[None]*4,'intensity':None,'reduction':None,'coverage':0,'target':'Unknown','year':2026,'availableDate':'2026-09-13','source':'Gathered ETF holdings snapshot 2026-06-30; identity and evidence require review'})
    bundle={'schemaVersion':'1.0','label':'Gathered research · June 2026 ETF snapshot','companies':profiles,**{k:[] for k in ['observations','monthlyReturns','factors','holdings','facilities','ownership','scenarios','documents']}}
    write(out/'workspace.json',bundle)
    write(site/'lib/research/baseline.json',bundle)
    manifest={'id':revision,'label':'HyperGreen gathered research','collectedAt':'2026-09-13','collections':catalogue,'totalRecords':sum(x['count'] for x in catalogue),'companies':len(company_map),'workspaceCompanies':len(profiles),'limitations':fm['gaps']+cm['limitations']+['BOCC annual, total, client, parent and superseded views overlap and must not be summed together. The 331 invalid original totals remain in audit views; use the corrected annual and publisher-period collections.','Ownership/EPA pilot covers 11 companies, with incomplete facility and stake coverage. Supplier-customer data and the complete EPA panel are still unavailable.'],'sources':[{'name':'SEC EDGAR','url':'https://www.sec.gov/search-filings/edgar-application-programming-interfaces','terms':'Source facts and filing provenance retained.'},{'name':'Kenneth French Data Library','url':'https://mba.tuck.dartmouth.edu/pages/faculty/ken.french/data_library.html','terms':'FF5 + Momentum, monthly decimal returns.'},{'name':'Climate TRACE','url':'https://climatetrace.org/data','terms':'Estimated emissions and ownership evidence; boundaries retained.'},{'name':'Climate Action 100+','url':'https://www.climateaction100.org/net-zero-company-benchmark/','terms':'Categorical assessments; round-specific definitions retained.'},{'name':'Net Zero Tracker','url':'https://zerotracker.net/data-terms-of-use','terms':'Current data CC BY-NC 4.0. Legacy data CC BY 4.0. Third-party documents have separate rights.'},{'name':'Climate Disclosure Utility','url':'https://climatedatautility.org/','terms':'Native disclosures and missing-data states retained.'},{'name':'Banking on Climate Chaos','url':'https://www.bankingonclimatechaos.org/methodology-2026','terms':'Nominal USD financing commitments; overlapping report editions. No affirmative reuse license verified for aggregate CSVs. Rights and methodology details are preserved in source records.'}],'archives':[{'label':'SEC full filing document corpus','status':'Source links and metadata searchable; full text remains in the original archive.','documents':fm['secCorpus']['documents']},{'label':'Net Zero Tracker extracted text','status':'Retained on OpenClaw server; document metadata is searchable here. Full text is not indexed in this release.'}]}
    # Avoid machine-specific source paths in prominent catalogue metadata; raw provenance is retained per record.
    write(out/'manifest.json',manifest);write(site/'lib/research/manifest.json',manifest);write(out/'integrity.json',integrity)
    print('TOTAL',manifest['totalRecords'],'compressed bytes',sum(c['bytes'] for c in catalogue),'profiles',len(profiles))
if __name__=='__main__':main()

import json,gzip,math
from pathlib import Path
m=json.load(open('lib/research/manifest.json')); base=json.load(open('lib/research/baseline.json')); scores=json.load(open('lib/research/draft-scores.json'))
def rows(cid):
 c=next(c for c in m['collections'] if c['id']==cid);i=json.load(open('public/research-data/'+c['index']))
 for pi,p in enumerate(i['parts']):
  for ri,r in enumerate(json.load(gzip.open('public/research-data/'+p['path']))):r['_loc']={'collection':cid,'part':pi,'index':ri};yield r
# explicit ticker -> CIK from matched CDU coverage
cdu={}
for r in rows('fin-cdu-2024-coverage'):
 x=r['record'];
 if x.get('match_status')=='matched' and x.get('ticker') and x.get('company_id'):cdu[x['ticker']]=x['company_id']
em={}
for r in rows('fin-cdu-2024-emissions-observations'):
 x=r['record'];
 if x.get('metric')=='total_s1_emissions_ghg' and isinstance(x.get('value'),(int,float)) and x['value']>=0:em[r['keys'][-1].split(':',1)[1]]=r
rev={}
for r in rows('fin-financial-latest-observations'):
 if r['label'].startswith('revenue:') and r['unit']=='USD' and r['value'] and r['value']>0 and not r['dateAnomaly']:
  for k in r['keys']:
   if k.startswith('CIK:') and k[4:] not in rev:rev[k[4:]]=r
vals={}
for c in base['companies']:
 cid=cdu.get(c['ticker']); e=em.get(cid); rs=rev.get(c['cik'])
 if e and rs:
  intensity=e['value']/(rs['value']/1e6)
  if math.isfinite(intensity) and 0<=intensity<1e7:vals[c['cik']]={'value':round(intensity,2),'emissions':e,'revenue':rs}
# sector-relative lower intensity scores
for c in base['companies']:
 d=scores[c['cik']]; v=vals.get(c['cik']);
 if not v:continue
 peers=[vals[x['cik']]['value'] for x in base['companies'] if x['sector']==c['sector'] and x['cik'] in vals]
 if len(peers)>=3:
  pct=sum(x>v['value'] for x in peers)+.5*sum(x==v['value'] for x in peers); footprint=round(100*pct/len(peers))
  d['scores'][0]=footprint;d['observedScores'][0]=footprint;d['coverage']+=30;d['confidence']='Moderate' if d['coverage']>=70 else d['confidence'];d['intensity']=v['value'];d['intensityUnit']='tCO2e / $M revenue';d['inputs'].append({'pillar':0,'label':'Scope 1 emissions intensity (CDU reported emissions / latest SEC revenue)','value':v['value'],'unit':'tCO2e / $M revenue','sectorPeers':len(peers),'recordId':v['emissions']['recordId'],'period':v['emissions']['period'],'availableDate':v['emissions']['availableDate'],'sourceId':v['emissions']['sourceId'],'location':v['emissions']['_loc'],'revenueRecordId':v['revenue']['recordId'],'revenuePeriod':v['revenue']['period'],'revenueAvailableDate':v['revenue']['availableDate']})
 d['limitations'][1]='Scope 1 intensity is calculated only where CDU reported emissions and SEC revenue have a matched issuer; it excludes Scope 2 and Scope 3 and is not a full footprint.'
for c in base['companies']:
 d=scores[c['cik']];d['scoreLabel']='HyperGreen score';d['version']='0.2'
Path('lib/research/draft-scores.json').write_text(json.dumps(scores,separators=(',',':')))
print({'intensityCompanies':len(vals),'scoredIntensity':sum('intensity' in d for d in scores.values()),'coverage70plus':sum(d['coverage']>=70 for d in scores.values())})

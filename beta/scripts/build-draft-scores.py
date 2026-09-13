import json,gzip,math
from pathlib import Path
root=Path('.'); manifest=json.load(open('lib/research/manifest.json')); baseline=json.load(open('lib/research/baseline.json'))
def rows(cid):
 c=next(c for c in manifest['collections'] if c['id']==cid); idx=json.load(open('public/research-data/'+c['index']))
 for pi,p in enumerate(idx['parts']):
  for ri,r in enumerate(json.load(gzip.open('public/research-data/'+p['path']))):
   r['location']={'collection':cid,'part':pi,'index':ri};yield r
def ref(r):return {'recordId':r['recordId'],'period':r['period'],'availableDate':r['availableDate'],'sourceId':r['sourceId'],'location':r['location']}
financial={}
for r in rows('fin-financial-latest-observations'):
 if r['dateAnomaly'] or r['unit']!='USD' or not r['period'] or r['period']<'2024-01-01' or not r['availableDate'] or r['availableDate']>'2026-09-13':continue
 if r['label'] not in ['assets:Assets','equity:StockholdersEquity','equity:StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest']:continue
 for k in r['keys']:
  if k.startswith('CIK:'):financial.setdefault(k[4:],{})[r['label']]=r
nzt={}
for r in rows('nzt-currentRecords'):
 if not r['record'].get('eligibleForCompanyJoin'):continue
 for k in r['keys']:
  if k.startswith('CIK:'):nzt[k[4:]]=r
ratios={}
for c in baseline['companies']:
 f=financial.get(c['cik'],{});a=f.get('assets:Assets');e=f.get('equity:StockholdersEquity') or f.get('equity:StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest')
 if a and e and a['period']==e['period'] and a['value']>0 and math.isfinite(e['value']):ratios[c['cik']]={'value':e['value']/a['value'],'refs':[ref(a),ref(e)]}
out={}
for c in baseline['companies']:
 observed=[None,None,None,None];inputs=[];target='No matched assessment';r=nzt.get(c['cik'])
 if r:
  d=r['record'];ts=d.get('targets',[]);t=next((t for t in ts if t.get('kind')=='end'),None)
  if t and t.get('disclosureState') in ['source_disclosure','explicit_no_target']:
   if t['disclosureState']=='explicit_no_target':observed[1]=0;target='No target disclosed'
   else:
    year=t.get('targetYear');scope=t.get('scopeCoverage') or {};observed[1]=min(100,25+25*bool(isinstance(year,(float,int)) and 2026<=year<=2050)+15*(scope.get('1')=='Yes')+15*(scope.get('2')=='Yes')+20*(scope.get('3')=='Yes'));target='Target disclosed'
   inputs.append({'pillar':1,'label':'Target disclosure rubric (not achieved reductions)','value':observed[1],'details':{'type':t.get('typeRaw'),'year':t.get('targetYear'),'scopeCoverage':t.get('scopeCoverage')},**ref(r)})
  plan=d.get('plan') or {};known=[]
  for k in ['has_plan','accountability']:
   if plan.get(k) in ['Yes','No']:known.append(100 if plan[k]=='Yes' else 0)
  reporting=plan.get('reporting_mechanism')
  if reporting=='Annual reporting':known.append(100)
  elif reporting in ['No reporting mechanism','No']:known.append(0)
  if len(known)>=2:
   observed[3]=round(sum(known)/len(known));inputs.append({'pillar':3,'label':'Climate plan, accountability and reporting disclosure (not social performance)','value':observed[3],'details':{k:plan.get(k) for k in ['has_plan','accountability','reporting_mechanism']},**ref(r)})
 ratio=ratios.get(c['cik']);peers=[ratios[x['cik']]['value'] for x in baseline['companies'] if x['sector']==c['sector'] and x['cik'] in ratios]
 if ratio and len(peers)>=5:
  v=ratio['value'];observed[2]=round(100*(sum(x<v for x in peers)+.5*sum(x==v for x in peers))/len(peers));inputs.append({'pillar':2,'label':'Sector percentile of equity / assets (balance-sheet proxy only)','value':v,'peers':len(peers),'sector':c['sector'],'records':ratio['refs']})
 coverage=sum(w for w,s in zip([30,30,20,20],observed) if s is not None)
 out[c['cik']]={'version':'draft-0.1','asOf':'2026-09-13','scores':[s if s is not None else 50 for s in observed],'observedScores':observed,'coverage':coverage,'target':target,'confidence':'Moderate' if coverage>=70 else 'Low','inputs':inputs,'limitations':['Missing pillars use a neutral modelling assumption of 50; this is not observed performance.','Environmental footprint is currently unscored; no comparable emissions panel has been normalized.','Transition and stewardship use current disclosures, not verified outcomes or worker/social performance.','Financial resilience uses only a sector-relative equity/assets proxy.','Current snapshot only; not a point-in-time historical backtest score.']}
Path('lib/research/draft-scores.json').write_text(json.dumps(out,separators=(',',':')))
print(json.dumps({'companies':len(out),'observedTransition':sum(v['observedScores'][1] is not None for v in out.values()),'observedFinance':sum(v['observedScores'][2] is not None for v in out.values()),'observedGovernance':sum(v['observedScores'][3] is not None for v in out.values())}))
assert len(out)==len({c['cik'] for c in baseline['companies']})
assert all(len(v['scores'])==4 and all(0<=x<=100 for x in v['scores']) for v in out.values())

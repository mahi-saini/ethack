import {libraryManifest,libraryQuery,libraryQuerySchema,libraryCompanies,libraryRecord} from './library';
import {z} from 'zod';
import catalog from '@/lib/source-catalog.json';
import {demoCompanies,dimensions,score} from '@/lib/hypergreen';
import {DataBundle} from '@/lib/data-contract';
import {demoReturns,runReplay} from '@/lib/portfolio';
import {ResearchContext} from '@/lib/agent-contract';
export type ResearchData={id:string;bundle:DataBundle|null};
const filters={query:z.string().max(150).optional(),ticker:z.string().max(20).optional(),entityId:z.string().max(400).optional(),sourceId:z.string().max(400).optional(),asOf:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'Use a valid date').optional(),from:z.string().max(10).optional(),to:z.string().max(10).optional(),offset:z.number().int().min(0).max(100000).default(0),limit:z.number().int().min(1).max(40).default(15)};
const collections=['observations','monthlyReturns','factors','holdings','facilities','ownership','scenarios','documents'] as const;
const recordQuery=z.object({collection:z.enum(collections),...filters}).strict();
export const toolSpecs=[
 {name:'research_library',description:'Search/paginate gathered research collections using collectionQuery, or find a historical issuer by name, ticker, or CIK. Includes SEC all-vintage facts, holdings, monthly prices, FF factors, CA100, Climate TRACE, Net Zero Tracker, CDU, ownership and EPA pilot. Shared source evidence is separate from private imports. Always inspect collection caveats.',schema:z.object({companyQuery:z.string().max(120).optional(),collectionQuery:z.string().max(120).default(''),offset:z.number().int().min(0).max(1000).default(0),limit:z.number().int().min(1).max(40).default(20)}).strict()},
 {name:'research_records',description:'Search a bounded page of gathered source records. Obtain collection IDs from research_library. Use entityId CIK:##########, TICKER:AAPL or a native entity/asset ID. Candidate joins remain candidates. asOf excludes unknown availability and flagged date anomalies; follow next cursor to continue the search. Null is unknown. Returns summary and bounded original-field excerpt.',schema:libraryQuerySchema.extend({limit:z.number().int().min(1).max(10).default(5)})},
 {name:'research_record_detail',description:'Read original fields of one gathered record from the collection/part/index returned by research_records. Long records are excerpted; complete records are available in the website research library.',schema:z.object({collection:z.string().max(100),part:z.number().int().min(0).max(10000),index:z.number().int().min(0).max(1200)}).strict()},
 {name:'dataset_overview',description:'Read the active dataset identity, collection counts, evidence limitations and current scoring weights. Always start research here.',schema:z.object({}).strict()},
 {name:'search_companies',description:'Find companies by name, ticker, CIK or sector; return their scores and provenance. asOf, from and to filter company availableDate. sourceId matches the company source field exactly.',schema:z.object({...filters}).strict()},
 {name:'query_records',description:'Read PRIVATE NORMALIZED IMPORTS ONLY. Empty results do not mean the gathered archive is empty: use research_library then research_records for shared source data. Read a bounded page of dated facts, monthly returns, FF5 + Momentum, constituent snapshots, facilities, ownership, scenarios or document metadata. Documents are links, not extracted full text. asOf excludes facts not yet available and undated records. Returns decimal units.',schema:recordQuery},
 {name:'search_sources',description:'Search the 82-source research catalogue for fields, join keys, limitations and documentation links. Catalogue inclusion does not mean imported or connected.',schema:z.object({query:z.string().max(150).default(''),offset:z.number().int().min(0).max(1000).default(0),limit:z.number().int().min(1).max(10).default(5)}).strict()},
 {name:'explain_methodology',description:'Read exact pillar weights, missing-data rules and historical backtest limitations.',schema:z.object({}).strict()},
 {name:'inspect_portfolio',description:'Inspect the user current allocations and dataset. Reports concentration and optionally calculates the existing fixed-basket monthly replay, with synthetic data explicitly identified.',schema:z.object({replay:z.boolean().default(false)}).strict()},
];
const contains=(value:unknown,q:string)=>JSON.stringify(value).toLowerCase().includes(q.toLowerCase());
export function createResearchTools(data:ResearchData,context:ResearchContext){
 const demo=!data.bundle,companies=data.bundle?.companies??demoCompanies,label=data.bundle?.label??'Synthetic demonstration';
 const wrap=(value:unknown)=>({dataset:{id:data.id,label,demo},data:value});
 return {async call(name:string,input:unknown){
 const spec=toolSpecs.find(t=>t.name===name);if(!spec)throw new Error('Unknown research tool');
 if(name==='research_library'){const a=spec.schema.parse(input) as {companyQuery?:string;collectionQuery:string;offset:number;limit:number};const matches=libraryManifest.collections.filter(c=>contains([c.id,c.label,c.group],a.collectionQuery));return {dataset:{id:libraryManifest.id,label:libraryManifest.label,demo:false},data:a.companyQuery!==undefined?await libraryCompanies(a.companyQuery,15):{total:matches.length,rows:matches.slice(a.offset,a.offset+a.limit).map(c=>({id:c.id,label:c.label,records:c.count,note:c.notes[0]?.slice(0,220)})),nextOffset:a.offset+a.limit<matches.length?a.offset+a.limit:null,totalRecords:libraryManifest.totalRecords,archives:libraryManifest.archives}}}
 if(name==='research_records'){const page=await libraryQuery(spec.schema.parse(input));return {dataset:{id:libraryManifest.id,label:libraryManifest.label,demo:false},data:{...page,rows:page.rows.map(({record,...r})=>({...r,originalFieldsExcerpt:JSON.stringify(record).slice(0,1800),excerptMayBeTruncated:JSON.stringify(record).length>1800}))}}}
 if(name==='research_record_detail'){const a=spec.schema.parse(input) as {collection:string;part:number;index:number};const {record,...r}=await libraryRecord(a.collection,a.part,a.index);const text=JSON.stringify(record);return {dataset:{id:libraryManifest.id,label:libraryManifest.label,demo:false},data:{...r,originalFields:text.slice(0,15000),truncated:text.length>15000}}}
 const a=spec.schema.parse(input) as z.infer<typeof recordQuery> & {replay?:boolean};
 if(name==='dataset_overview')return wrap({countsScope:'Active normalized working bundle only; shared archive counts are reported separately below.',counts:{companies:companies.length,...Object.fromEntries(collections.map(k=>[k,data.bundle?.[k].length??0]))},weights:context.weights,gatheredResearch:{id:libraryManifest.id,records:libraryManifest.totalRecords,collections:libraryManifest.collections.length,access:'Use research_library and research_records for source data; private normalized bundles are separate.'},limitations:demo?['Company metrics, targets, scores and demo returns are synthetic, not factual claims about these companies.','Shared gathered research remains accessible through research_library and research_records. No live news feed is connected.']:['Imported evidence is unverified. A record is not independent proof.','The shared gathered archive is connected and queryable, alongside private normalized imports. Document bodies are not indexed.','Historical membership coverage and identifiers must be audited before investment backtests.']});
 if(name==='explain_methodology')return wrap({dimensions:dimensions.map((d,i)=>({...d,weight:context.weights[i]})),draftModel:companies.some(c=>'draft' in c)?{version:'draft-0.1',missingPillarAssumption:50,meaning:'Current disclosure and financial proxy model, not validated sustainability. Read each company draft.inputs, observedScores and limitations with search_companies.'}:null,scoring:'Weighted mean of non-null pillars, renormalized only if at least 70% of total weight is observed. Null is unknown, never zero. The component scores are provided in the bundle, not calculated from raw observations.',researchRules:['Keep absolute impacts, intensity, progress and evidence quality distinct.','Compare within sectors and align reporting boundaries and units.','Targets are not realized reductions.','Use availableDate and dated membership for historical research.','The replay is a fixed current basket rebalanced monthly, not a historical constituent-aware strategy.','The catalogue is a source plan, not 82 connected APIs.']});
 if(name==='search_companies'){
 const rows=companies.filter(c=>(!a.query||contains([c.name,c.ticker,c.cik,c.sector],a.query))&&(!a.ticker||c.ticker.toUpperCase()===a.ticker.toUpperCase())&&(!a.entityId||c.cik===a.entityId||c.ticker===a.entityId)&&(!a.asOf||c.availableDate<=a.asOf)&&(!a.from||c.availableDate>=a.from)&&(!a.to||c.availableDate<=a.to)&&(!a.sourceId||c.source===a.sourceId));
 return wrap({total:rows.length,offset:a.offset,rows:rows.slice(a.offset,a.offset+a.limit).map(c=>({...c,hypergreenScore:score(c,context.weights)}))});
 }
 if(name==='search_sources'){const rows=catalog.filter(c=>contains(c,a.query??''));return wrap({total:rows.length,rows:rows.slice(a.offset,a.offset+a.limit),note:'Source catalogue only. Check dataset records to establish actual coverage.'})}
 if(name==='query_records'){
 const rows=((data.bundle?.[a.collection as keyof DataBundle]??[]) as unknown as Record<string,unknown>[]).filter(r=>{
 if(a.query&&!contains(r,a.query))return false;
 if(a.ticker&&String(r.ticker??'').toUpperCase()!==a.ticker.toUpperCase())return false;
 if(a.entityId&&r.entityId!==a.entityId)return false;if(a.sourceId&&r.sourceId!==a.sourceId)return false;
 const date=String(r.availableDate??r.publishedDate??'');
 if(a.asOf&&(!date||date>a.asOf))return false;
 const period=String(r.periodEnd??r.month??r.snapshotDate??r.publishedDate??r.validFrom??r.year??'');
 return (!a.from||period>=a.from)&&(!a.to||period<=a.to);
 });return wrap({scope:'Private normalized bundle only. Query research_library and research_records for gathered data even when this result is empty.',sharedArchiveRecords:libraryManifest.totalRecords,collection:a.collection,total:rows.length,offset:a.offset,rows:rows.slice(a.offset,a.offset+a.limit),asOfRule:a.asOf?'Only records with known availableDate or publishedDate on or before cutoff. Undated availability is excluded.':null});
 }
 if(name==='inspect_portfolio'){
 const holdings=context.allocations.map(h=>({...h,company:companies.find(c=>c.ticker===h.ticker)?.name??null}));
 const total=holdings.reduce((n,h)=>n+h.weight,0), largest=holdings.length?Math.max(...holdings.map(h=>h.weight)):0;
 const result:Record<string,unknown>={holdings,totalWeight:total,largestWeight:largest,fundDollars:context.capital,positionCap:context.positionCap,unallocatedDollars:(100-total)/100*context.capital,issues:[...(Math.abs(total-100)>.01?['Weights do not sum to 100%.']:[]),...(largest>context.positionCap?['At least one holding exceeds the selected position limit.']:[]),...(new Set(holdings.map(h=>h.ticker)).size!==holdings.length?['Duplicate holdings.']:[]),...(holdings.some(h=>!h.company)?['Unknown company in holdings.']:[])]};
 if(a.replay){const source=data.bundle??demoReturns(companies.map(c=>c.ticker));const months=[...new Set(source.monthlyReturns.map(r=>r.month))].sort();if(months.length<2)throw new Error('At least two months of returns are needed.');const replay=runReplay(context.allocations,source.monthlyReturns,source.factors,months[0],months.at(-1)!,10);const {data:series,...stats}=replay;result.replay={...stats,start:months[0],end:months.at(-1),months:series.length};result.replayLimit='Fixed basket rebalanced monthly, with 10 bps cost on gross traded notional; not a historical membership strategy. Demo returns are synthetic.'}
 return wrap(result);
 }
 throw new Error('Unknown research tool');
 }};
}

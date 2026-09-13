import {env} from 'cloudflare:workers';
import {z} from 'zod';
import manifestData from '@/lib/research/manifest.json';
import {LibraryManifest,LibraryCompany,LibraryRow,LibraryPage} from '@/lib/research-contract';
import {HttpError} from './http';
export const libraryManifest=manifestData as LibraryManifest;
type Part={path:string;keys:string[];count:number;bytes:number;decodedBytes:number;sha256:string};
type Index={id:string;parts:Part[];companyCounts:Record<string,number>};
// Files are immutable research release assets, separate from private per-user imports.
async function asset(path:string){
 if(!env.ASSETS)throw new HttpError(503,'The research archive is temporarily unavailable.');
 const response=await env.ASSETS.fetch(new Request('https://research.invalid/research-data/'+path));
 if(!response.ok)throw new HttpError(503,'This research partition could not be loaded. Please retry.');
 return response;
}
async function read<T>(path:string):Promise<T>{return (await asset(path)).json<T>()}
async function partRows(part:Part){
 const response=await asset(part.path);const blob=await response.arrayBuffer();
 if(blob.byteLength!==part.bytes)throw new HttpError(503,'Research partition integrity check failed.');
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',blob)),x=>x.toString(16).padStart(2,'0')).join('');
 if(hash!==part.sha256)throw new HttpError(503,'Research partition integrity check failed.');
 const stream=new Blob([blob]).stream().pipeThrough(new DecompressionStream('gzip'));
 return await new Response(stream).json() as Omit<LibraryRow,'location'>[];
}
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v);
export const libraryQuerySchema=z.object({collection:z.string().max(100),entityId:z.string().max(120).optional(),query:z.string().max(120).default(''),asOf:date.optional(),from:z.string().regex(/^\d{4}(-\d{2})?(-\d{2})?$/).optional(),to:z.string().regex(/^\d{4}(-\d{2})?(-\d{2})?$/).optional(),cursor:z.string().regex(/^\d+:\d+$/).max(30).optional(),limit:z.number().int().min(1).max(40).default(20)}).strict();
export async function libraryCompanies(query='',limit=40){const rows=await read<LibraryCompany[]>('companies.json');const q=query.toLowerCase();const matches=rows.filter(c=>JSON.stringify([c.name,c.cik,c.tickers]).toLowerCase().includes(q));return {total:matches.length,rows:matches.slice(0,limit)}}
export async function libraryQuery(input:unknown):Promise<LibraryPage>{
 const a=libraryQuerySchema.parse(input),collection=libraryManifest.collections.find(c=>c.id===a.collection);
 if(!collection)throw new HttpError(404,'Choose a collection from the research library.');
 const index=await read<Index>(collection.index);
 let [p,i]=(a.cursor??'0:0').split(':').map(Number),loads=0,scanned=0;
 if(p>index.parts.length||i>1200)throw new HttpError(400,'This page cursor is invalid.');
 const rows:LibraryRow[]=[];
 while(p<index.parts.length&&rows.length<a.limit&&loads<4){
  const part=index.parts[p];
  if(a.entityId&&!part.keys.includes(a.entityId)){p++;i=0;continue;}
  const source=await partRows(part);loads++;
  while(i<source.length&&rows.length<a.limit){const position=i++,r=source[position];scanned++;
   if(a.entityId&&!r.keys.includes(a.entityId))continue;
   if(a.query&&!JSON.stringify(r.record).toLowerCase().includes(a.query.toLowerCase()))continue;
   if(a.asOf&&(!r.availableDate||r.availableDate>a.asOf||r.dateAnomaly))continue;
   if(a.from&&(!r.period||r.period<a.from))continue;
   if(a.to&&(!r.period||r.period.slice(0,a.to.length)>a.to))continue;
   rows.push({...r,location:{collection:a.collection,part:p,index:position}});
  }
  if(i>=source.length){p++;i=0;}
 }
 // Skip unrelated partitions without spending requests or returning misleading empty pages.
 while(p<index.parts.length&&a.entityId&&!index.parts[p].keys.includes(a.entityId)){p++;i=0;}
 return {collection,rows,next:p<index.parts.length?`${p}:${i}`:null,scanned,scopeCount:a.entityId?(index.companyCounts[a.entityId]??null):collection.count,note:'Matches and candidate links are both retained. Read mapping status before attribution. Pages scan a bounded part of the archive; continue to inspect more results. As-of excludes unknown availability and flagged date anomalies.'};
}
export async function libraryRecord(collection:string,part:number,index:number){
 const c=libraryManifest.collections.find(c=>c.id===collection);if(!c)throw new HttpError(404,'Collection not found.');
 const idx=await read<Index>(c.index),p=idx.parts[part];if(!p)throw new HttpError(404,'Partition not found.');
 const rows=await partRows(p),r=rows[index];if(!r)throw new HttpError(404,'Record not found.');return {...r,location:{collection,part,index}};
}
export async function replayData(tickers:string[]){
 const symbols=new Set([...tickers,'SPY']);if(symbols.size>101)throw new HttpError(400,'Select up to 100 companies.');
 async function collect(id:string,keys?:Set<string>){const c=libraryManifest.collections.find(c=>c.id===id)!;const idx=await read<Index>(c.index);const records:Record<string,unknown>[]=[];for(const p of idx.parts){if(keys&&!p.keys.some(k=>keys.has(k)))continue;const rows=await partRows(p);records.push(...rows.filter(r=>!keys||r.keys.some(k=>keys.has(k))).map(r=>r.record));}return records;}
 return {monthlyReturns:await collect('fin-monthly-returns-valid-candidates',new Set([...symbols].map(t=>'TICKER:'+t))),factors:await collect('fin-factors-monthly-full'),note:'Yahoo adjusted-close candidate symbol histories. Not a permanent-security or delisting-complete database. FF5 + Momentum monthly factors in decimal units.'};
}

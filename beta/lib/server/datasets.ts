import {DataBundle,parseBundle} from '@/lib/data-contract';
import draftScores from '@/lib/research/draft-scores.json';
import companyEvidence from '@/lib/research/company-evidence.json';
import baseline from '@/lib/research/baseline.json';
import {libraryManifest} from './library';
import {bucket,db,HttpError} from './http';
export type DatasetMeta={dataset_id:string;object_key:string;label:string;bytes:number;updated_at:string};
export async function metadata(owner:string){return db().prepare('SELECT dataset_id,object_key,label,bytes,updated_at FROM research_workspaces WHERE owner_id=?').bind(owner).first<DatasetMeta>()}
export async function loadDataset(owner:string){
 const meta=await metadata(owner);if(!meta)return {id:libraryManifest.id,bundle:{...baseline,companies:baseline.companies.map(c=>({...c,...((draftScores as Record<string,unknown>)[c.cik] as {intensity?:number;observedScores?:(number|null)[];scores?:number[]}),scores:((draftScores as Record<string,{scores?:number[]}>)[c.cik]?.scores??c.scores),intensity:(draftScores as Record<string,{intensity?:number}>)[c.cik]?.intensity??c.intensity,draft:(draftScores as Record<string,unknown>)[c.cik],evidence:(companyEvidence as Record<string,{records:number;collections:number}>)[c.cik]??{records:0,collections:0}}))} as DataBundle,updatedAt:libraryManifest.collectedAt};
 const object=await bucket().get(meta.object_key);if(!object)throw new HttpError(503,'Your saved dataset is temporarily unavailable. Please retry.');
 // Only normalized, validated bundles written by saveDataset are stored here.
 return {id:meta.dataset_id,bundle:await object.json<DataBundle>(),updatedAt:meta.updated_at};
}
export async function saveDataset(owner:string,value:unknown){
 const bundle=parseBundle(value),body=JSON.stringify(bundle),bytes=new TextEncoder().encode(body).length;
 if(bytes>10*1024*1024)throw new HttpError(413,'Please use a bundle smaller than 10 MB.');
 const previous=await metadata(owner),id=crypto.randomUUID(),key=`datasets/${id}.json`,updatedAt=new Date().toISOString();
 await bucket().put(key,body,{httpMetadata:{contentType:'application/json'}});
 try{await db().prepare('INSERT INTO research_workspaces (owner_id,dataset_id,object_key,label,bytes,updated_at) VALUES (?,?,?,?,?,?) ON CONFLICT(owner_id) DO UPDATE SET dataset_id=excluded.dataset_id,object_key=excluded.object_key,label=excluded.label,bytes=excluded.bytes,updated_at=excluded.updated_at').bind(owner,id,key,bundle.label,bytes,updatedAt).run()}
 catch(error){await bucket().delete(key).catch(()=>{});throw error}
 if(previous)await bucket().delete(previous.object_key).catch(()=>{});
 return {id,bundle,updatedAt};
}
export async function clearDataset(owner:string){const previous=await metadata(owner);if(previous){await db().prepare('DELETE FROM research_workspaces WHERE owner_id=? AND dataset_id=?').bind(owner,previous.dataset_id).run();await bucket().delete(previous.object_key).catch(()=>{})}}

import {z} from 'zod';
import catalog from '@/lib/source-catalog.json';
import {demoCompanies} from '@/lib/hypergreen';
import {flagSchema,reviewUpdateSchema,ReviewFlag,ReviewEvent} from '@/lib/personal-contract';
import {db,bucket,HttpError} from './http';
import {loadDataset} from './datasets';
import {libraryRecord,libraryManifest} from './library';
import {isReviewer} from './accounts';
type Row={id:string;reporter_id:string;dataset_id:string;dataset_label:string;target_type:string;target_key:string;target_label:string;snapshot_json:string;reason:string;details:string;suggestion:string;evidence_url:string;status:ReviewFlag['status'];version:number;created_at:string;updated_at:string};
const decode=(r:Row,owner:string):ReviewFlag=>({id:r.id,datasetId:r.dataset_id,datasetLabel:r.dataset_label,targetType:r.target_type,targetKey:r.target_key,targetLabel:r.target_label,snapshot:JSON.parse(r.snapshot_json)._snapshotObjectKey?{note:'Open this report to load the complete preserved source record.'}:JSON.parse(r.snapshot_json),reason:r.reason,details:r.details,suggestion:r.suggestion,evidenceUrl:r.evidence_url,status:r.status,version:r.version,createdAt:r.created_at,updatedAt:r.updated_at,mine:r.reporter_id===owner});
export async function submitReview(owner:string,input:z.infer<typeof flagSchema>){
 const old=await db().prepare('SELECT * FROM review_flags WHERE id=? AND reporter_id=?').bind(input.id,owner).first<Row>();if(old)return decode(old,owner);
 const data=input.target.type==='library_record'?{id:libraryManifest.id,bundle:null}:await loadDataset(owner);if(data.id!==input.datasetId)throw new HttpError(409,'Your dataset changed. Refresh before flagging this record.');
 const target=input.target;let snapshot:Record<string,unknown>,key:string,label:string;
 if(target.type==='library_record'){const r=await libraryRecord(target.collection,target.part,target.index);snapshot={...r};key=`${target.collection}:${target.part}:${target.index}`;label=r.label}
 else if(target.type==='company'){const c=(data.bundle?.companies??demoCompanies).find(c=>c.ticker===target.key);if(!c)throw new HttpError(404,'This company is not in the active dataset.');snapshot={...c};key=c.ticker;label=`${c.name} · ${c.ticker}`}
 else if(target.type==='source'){const source=catalog.find(s=>s.id===target.key);if(!source)throw new HttpError(404,'This source is not in the catalogue.');snapshot=source;key=source.id;label=source.name}
 else if(target.type==='record'){const r=data.bundle?.[target.collection][target.index];if(!r)throw new HttpError(404,'This record is not in the active dataset.');snapshot={...r};key=`${target.collection}:${target.index}`;label=String(snapshot.metric??snapshot.title??snapshot.ticker??snapshot.name??snapshot.variable??target.collection)}
 else {key=data.id;label=data.bundle?.label??'Synthetic demonstration';snapshot={label,collections:data.bundle?Object.fromEntries(Object.entries(data.bundle).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,(v as unknown[]).length])):{companies:24}}}
 const now=new Date().toISOString(),datasetLabel=target.type==='library_record'?libraryManifest.label:data.bundle?.label??'Synthetic demonstration';
 let snapshotBody=JSON.stringify(snapshot);const largeKey=new TextEncoder().encode(snapshotBody).length>100000?`review-snapshots/${crypto.randomUUID()}.json`:null;
 if(largeKey){await bucket().put(largeKey,snapshotBody,{httpMetadata:{contentType:'application/json'}});snapshotBody=JSON.stringify({_snapshotObjectKey:largeKey})}
 try{await db().batch([
  db().prepare('INSERT INTO review_flags (id,reporter_id,dataset_id,dataset_label,target_type,target_key,target_label,snapshot_json,reason,details,suggestion,evidence_url,status,version,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,\'open\',1,?,?)').bind(input.id,owner,data.id,datasetLabel,target.type,key,label,snapshotBody,input.reason,input.details,input.suggestion,input.evidenceUrl,now,now),
  db().prepare('INSERT INTO review_events (id,flag_id,actor_id,status,note,created_at) VALUES (?,?,?,\'open\',?,?)').bind(crypto.randomUUID(),input.id,owner,'Submitted for human review.',now),
 ]);}catch(error){if(largeKey)await bucket().delete(largeKey).catch(()=>{});throw error}
 return decode((await db().prepare('SELECT * FROM review_flags WHERE id=? AND reporter_id=?').bind(input.id,owner).first<Row>())!,owner);
}
export async function reviewDetail(owner:string,id:string){const reviewer=await isReviewer(owner);const row=await db().prepare(`SELECT * FROM review_flags WHERE id=?${reviewer?'':' AND reporter_id=?'}`).bind(...(reviewer?[id]:[id,owner])).first<Row>();if(!row)throw new HttpError(404,'This report is unavailable.');const events=await db().prepare('SELECT status,note,created_at FROM review_events WHERE flag_id=? ORDER BY created_at').bind(id).all<{status:ReviewFlag['status'];note:string;created_at:string}>();const flag=decode(row,owner),pointer=JSON.parse(row.snapshot_json);if(pointer._snapshotObjectKey){const obj=await bucket().get(pointer._snapshotObjectKey);if(!obj)throw new HttpError(503,'The preserved record is temporarily unavailable.');flag.snapshot=await obj.json<Record<string,unknown>>()}return {flag,reviewer,events:events.results.map(e=>({status:e.status,note:e.note,createdAt:e.created_at})) as ReviewEvent[]}}
export async function listReviews(owner:string,scope:string,status:string,offset:number){
 const reviewer=await isReviewer(owner);if(scope==='team'&&!reviewer)throw new HttpError(403,'The team queue is available to research reviewers.');
 const where=scope==='team'?'1=1':'reporter_id=?',args=scope==='team'?[]:[owner],filter=status==='all'?'':' AND status=?',filtered=status==='all'?args:[...args,status];
 const rows=await db().prepare(`SELECT * FROM review_flags WHERE ${where}${filter} ORDER BY updated_at DESC LIMIT 20 OFFSET ?`).bind(...filtered,offset).all<Row>();
 const total=await db().prepare(`SELECT count(*) AS count FROM review_flags WHERE ${where}${filter}`).bind(...filtered).first<{count:number}>();
 const counts=await db().prepare(`SELECT status,count(*) AS count FROM review_flags WHERE ${where} GROUP BY status`).bind(...args).all<{status:string;count:number}>();
 return {flags:rows.results.map(r=>decode(r,owner)),total:total?.count??0,counts:Object.fromEntries(counts.results.map(r=>[r.status,r.count])),reviewer,offset};
}
export async function updateReview(owner:string,input:z.infer<typeof reviewUpdateSchema>){
 if(!await isReviewer(owner))throw new HttpError(403,'Only a research reviewer can change report status.');
 const now=new Date().toISOString();
 // Both statements are one atomic D1 transaction. A stale revision writes neither an event nor a status change.
 const results=await db().batch([
  db().prepare('INSERT INTO review_events (id,flag_id,actor_id,status,note,created_at) SELECT ?,id,?,?,?,? FROM review_flags WHERE id=? AND version=?').bind(crypto.randomUUID(),owner,input.status,input.note,now,input.id,input.version),
  db().prepare('UPDATE review_flags SET status=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(input.status,now,input.id,input.version),
 ]);
 if(!results[1].meta.changes)throw new HttpError(409,'This report changed in another session. Reload its latest status before saving.');
 return reviewDetail(owner,input.id);
}

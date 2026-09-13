import {SavedSimulation,Simulation} from '@/lib/personal-contract';
import {demoCompanies} from '@/lib/hypergreen';
import {db,HttpError} from './http';
import {loadDataset} from './datasets';
type Row={id:string;name:string;dataset_id:string;dataset_label:string;config_json:string;version:number;created_at:string;updated_at:string};
const decode=(r:Row):SavedSimulation=>({...JSON.parse(r.config_json),id:r.id,name:r.name,datasetId:r.dataset_id,datasetLabel:r.dataset_label,version:r.version,createdAt:r.created_at,updatedAt:r.updated_at});
export async function listSimulations(owner:string){const rows=await db().prepare('SELECT * FROM saved_simulations WHERE owner_id=? ORDER BY updated_at DESC LIMIT 20').bind(owner).all<Row>();return rows.results.map(decode)}
async function validateDataset(owner:string,simulation:Simulation){const data=await loadDataset(owner);if(data.id!==simulation.datasetId)throw new HttpError(409,'Your dataset changed. Refresh the workspace before saving this simulation.');const tickers=new Set((data.bundle?.companies??demoCompanies).map(c=>c.ticker));if(simulation.allocations.some(a=>!tickers.has(a.ticker)))throw new HttpError(400,'Some portfolio companies are missing from your current dataset.');return data.bundle?.label??'Synthetic demonstration'}
export async function createSimulation(owner:string,id:string,simulation:Simulation){
 const existing=await db().prepare('SELECT * FROM saved_simulations WHERE id=? AND owner_id=?').bind(id,owner).first<Row>();if(existing)return decode(existing);
 const label=await validateDataset(owner,simulation),now=new Date().toISOString();
 const row=await db().prepare('INSERT INTO saved_simulations (id,owner_id,name,dataset_id,dataset_label,config_json,version,created_at,updated_at) SELECT ?,?,?,?,?,?,1,?,? WHERE (SELECT count(*) FROM saved_simulations WHERE owner_id=?) < 20 RETURNING *').bind(id,owner,simulation.name,simulation.datasetId,label,JSON.stringify(simulation),now,now,owner).first<Row>();
 if(!row)throw new HttpError(409,'You can save up to 20 simulations. Remove one before creating another.');return decode(row);
}
export async function updateSimulation(owner:string,id:string,version:number,simulation:Simulation){const label=await validateDataset(owner,simulation);const row=await db().prepare('UPDATE saved_simulations SET name=?,dataset_id=?,dataset_label=?,config_json=?,version=version+1,updated_at=? WHERE id=? AND owner_id=? AND version=? RETURNING *').bind(simulation.name,simulation.datasetId,label,JSON.stringify(simulation),new Date().toISOString(),id,owner,version).first<Row>();if(!row)throw new HttpError(409,'This simulation changed in another session or is unavailable. Reload it, or save your changes as a copy.');return decode(row)}

import {z} from 'zod';
import {actor,db,failure,json,quota,readJson,HttpError} from '@/lib/server/http';
import {createSimulationSchema,updateSimulationSchema} from '@/lib/personal-contract';
import {createSimulation,listSimulations,updateSimulation} from '@/lib/server/simulations';
export async function GET(request:Request){try{return json({simulations:await listSimulations(await actor(request))})}catch(e){return failure(e)}}
export async function POST(request:Request){try{const owner=await actor(request);await quota(owner,'simulation-write',60,3600);const b=createSimulationSchema.parse(await readJson(request,40000));return json({simulation:await createSimulation(owner,b.id,b.simulation)})}catch(e){return failure(e)}}
export async function PATCH(request:Request){try{const owner=await actor(request);await quota(owner,'simulation-write',60,3600);const b=updateSimulationSchema.parse(await readJson(request,40000));return json({simulation:await updateSimulation(owner,b.id,b.version,b.simulation)})}catch(e){return failure(e)}}
export async function DELETE(request:Request){try{const owner=await actor(request);const b=z.object({id:z.string().uuid(),version:z.number().int().min(1)}).strict().parse(await readJson(request,2000));const row=await db().prepare('DELETE FROM saved_simulations WHERE id=? AND owner_id=? AND version=? RETURNING id').bind(b.id,owner,b.version).first();if(!row)throw new HttpError(409,'This simulation changed or is unavailable. Refresh your list before deleting it.');return json({deleted:true})}catch(e){return failure(e)}}

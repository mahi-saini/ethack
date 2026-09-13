import {z} from 'zod';
import {actor,failure,json,quota,readJson,HttpError} from '@/lib/server/http';
import {inworld,voiceSession} from '@/lib/server/voice';
export async function POST(request:Request){try{const owner=await actor(request);await quota(owner,'voice-start',12,3600);const body=z.object({sdp:z.string().min(20).max(50000)}).strict().parse(await readJson(request,60000));const result=await(await inworld('/v1/realtime/calls',{sdp:body.sdp,session:voiceSession})).json() as {sdp?:string};if(!result.sdp)throw new HttpError(502,'Inworld did not return a voice connection. Please retry.');return json({sdp:result.sdp})}catch(e){return failure(e)}}

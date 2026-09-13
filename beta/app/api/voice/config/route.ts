import {actor,failure,json,quota} from '@/lib/server/http';
import {inworld} from '@/lib/server/voice';
export async function GET(request:Request){try{const owner=await actor(request);await quota(owner,'voice-config',10,60);const result=await (await inworld('/v1/realtime/ice-servers')).json() as {ice_servers?:unknown[]};return json({iceServers:result.ice_servers??[]})}catch(e){return failure(e)}}

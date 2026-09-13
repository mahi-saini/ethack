import {env} from 'cloudflare:workers';
import {actor,failure,json,quota,readJson} from '@/lib/server/http';
import {runAgent} from '@/lib/server/agent';
export async function GET(request:Request){try{await actor(request);return json({textConfigured:!!env.MINIMAX_API_KEY,voiceConfigured:!!env.INWORLD_API_KEY,model:env.MINIMAX_MODEL||'MiniMax-M2.7'})}catch(e){return failure(e)}}
export async function POST(request:Request){try{const owner=await actor(request);await quota(owner,'agent-minute',6,60);await quota(owner,'agent-day',100,86400);return json(await runAgent(owner,await readJson(request),request.signal))}catch(e){return failure(e)}}

import {z} from 'zod';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {actor,db,failure,json,readJson} from '@/lib/server/http';
import {accountFor} from '@/lib/server/accounts';
export async function GET(){try{const user=await getChatGPTUser();return json({account:user?await accountFor(user):null})}catch(e){return failure(e)}}
export async function POST(request:Request){try{const owner=await actor(request),user=(await getChatGPTUser())!;const body=z.object({displayName:z.string().trim().min(2).max(60)}).strict().parse(await readJson(request,4000));await accountFor(user);await db().prepare('UPDATE research_profiles SET display_name=?,updated_at=? WHERE user_id=?').bind(body.displayName,new Date().toISOString(),owner).run();return json({account:await accountFor(user)})}catch(e){return failure(e)}}

import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {ZodError} from 'zod';
export class HttpError extends Error {constructor(public status:number,message:string){super(message)}}
export function db(){if(!env.DB)throw new HttpError(503,'Private storage is unavailable. Please try again shortly.');return env.DB}
export function bucket(){if(!env.BUCKET)throw new HttpError(503,'Private file storage is unavailable.');return env.BUCKET}
export async function actor(request:Request){
 const origin=request.headers.get('origin');
 const expected=new URL(request.url).origin;
 if(origin&&origin!==expected)throw new HttpError(403,'This request must come from HyperGreen.');
 const user=await getChatGPTUser();
 if(!user)throw new HttpError(401,'Sign in to HyperGreen to use your research workspace.');
 return user.userId;
}
export function json(value:unknown,status=200){return Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}
export function failure(error:unknown){
 if(error instanceof HttpError)return json({error:error.message},error.status);
 if(error instanceof ZodError)return json({error:'Some fields are invalid. '+error.issues.slice(0,3).map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')},400);
 if(error instanceof SyntaxError)return json({error:'Please send valid JSON.'},400);
 console.error('HyperGreen request failed',error instanceof Error?error.name:'UnknownError');
 return json({error:'The request could not be completed. Your current data has been preserved. Please try again.'},500);
}
export async function readJson(request:Request,maxBytes=80000){
 if(!request.headers.get('content-type')?.includes('application/json'))throw new HttpError(415,'Use application/json.');
 if(Number(request.headers.get('content-length')??0)>maxBytes)throw new HttpError(413,'This request is too large.');
 const reader=request.body?.getReader();if(!reader)throw new HttpError(400,'A request body is required.');
 const chunks:Uint8Array[]=[];let size=0;
 while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes){await reader.cancel();throw new HttpError(413,'This request is too large.')}chunks.push(value)}
 const all=new Uint8Array(size);let offset=0;for(const c of chunks){all.set(c,offset);offset+=c.length}return JSON.parse(new TextDecoder().decode(all));
}
export async function quota(owner:string,kind:string,limit:number,seconds:number){
 const now=Math.floor(Date.now()/1000), window=Math.floor(now/seconds),key=`${kind}:${owner}:${window}`;
 const row=await db().prepare('INSERT INTO usage_windows (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(key,(window+1)*seconds).first<{count:number}>();
 if((row?.count??limit+1)>limit)throw new HttpError(429,'You have reached the current usage limit. Please wait before trying again.');
 // Bounded cleanup; never log prompts, records, audio, or credentials.
 await db().prepare('DELETE FROM usage_windows WHERE key IN (SELECT key FROM usage_windows WHERE expires_at < ? LIMIT 100)').bind(now-86400).run();
}

import {env} from 'cloudflare:workers';
import {HttpError} from './http';
export {voiceSession} from '@/lib/voice-session';
export async function inworld(path:string,body?:unknown){
 if(!env.INWORLD_API_KEY)throw new HttpError(503,'Voice is not configured yet.');
 let response:Response;
 try{response=await fetch('https://api.inworld.ai'+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${env.INWORLD_API_KEY}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(25000)})}catch{throw new HttpError(504,'The voice connection timed out. You can keep using text chat.');}
 if(!response.ok){console.error('Inworld upstream status',response.status);throw new HttpError(502,response.status===401||response.status===403?'Inworld rejected the configured credential or Realtime access. Text chat is still available.':response.status===429?'Inworld is at its current usage limit. Please try again shortly.':'Inworld could not establish voice chat. Text chat is still available.');}
 return response;
}

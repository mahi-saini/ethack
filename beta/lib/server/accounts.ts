import {env} from 'cloudflare:workers';
import {ChatGPTUser} from '@/app/chatgpt-auth';
import {Account} from '@/lib/personal-contract';
import {db} from './http';
export async function isReviewer(userId:string){return !!await db().prepare('SELECT user_id FROM research_reviewer_roles WHERE user_id=?').bind(userId).first()}
export async function accountFor(user:ChatGPTUser):Promise<Account>{
 const now=new Date().toISOString();
 await db().prepare('INSERT INTO research_profiles (user_id,display_name,created_at,updated_at) VALUES (?,?,?,?) ON CONFLICT(user_id) DO NOTHING').bind(user.userId,user.fullName?.slice(0,60)||user.email.split('@')[0],now,now).run();
 // Bootstrap only configured verified identities. Roles thereafter follow the stable site user ID.
 const email=user.email.toLowerCase();
 if((env.HYPERGREEN_REVIEWER_EMAILS??'').split(',').map(x=>x.trim().toLowerCase()).includes(email))await db().prepare('INSERT INTO research_reviewer_roles (user_id,bootstrap_email,created_at) VALUES (?,?,?) ON CONFLICT DO NOTHING').bind(user.userId,email,now).run();
 const profile=await db().prepare('SELECT display_name,created_at FROM research_profiles WHERE user_id=?').bind(user.userId).first<{display_name:string;created_at:string}>();
 return {id:user.userId,displayName:profile?.display_name??user.displayName,email:user.email,reviewer:await isReviewer(user.userId),createdAt:profile?.created_at??now};
}

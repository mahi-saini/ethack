import {z} from 'zod';
import {actor,failure,json,quota,readJson} from '@/lib/server/http';
import {flagSchema,reviewUpdateSchema,reviewStatuses} from '@/lib/personal-contract';
import {listReviews,reviewDetail,submitReview,updateReview} from '@/lib/server/reviews';
export async function GET(request:Request){try{const owner=await actor(request),p=new URL(request.url).searchParams,id=p.get('id');if(id)return json(await reviewDetail(owner,z.string().uuid().parse(id)));const scope=z.enum(['mine','team']).parse(p.get('scope')??'mine'),status=z.enum(['all',...reviewStatuses]).parse(p.get('status')??'all'),offset=z.coerce.number().int().min(0).max(10000).parse(p.get('offset')??0);return json(await listReviews(owner,scope,status,offset))}catch(e){return failure(e)}}
export async function POST(request:Request){try{const owner=await actor(request);await quota(owner,'review-submit',30,3600);return json({flag:await submitReview(owner,flagSchema.parse(await readJson(request,15000)))})}catch(e){return failure(e)}}
export async function PATCH(request:Request){try{const owner=await actor(request);await quota(owner,'review-update',100,3600);return json(await updateReview(owner,reviewUpdateSchema.parse(await readJson(request,6000))))}catch(e){return failure(e)}}

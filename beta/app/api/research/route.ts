import {actor,failure,json,quota} from '@/lib/server/http';
import {libraryManifest,libraryCompanies,libraryQuery,libraryRecord,replayData} from '@/lib/server/library';
export async function GET(request:Request){try{
 const owner=await actor(request),s=new URL(request.url).searchParams;await quota(owner,'library',300,60);
 if(s.get('mode')==='companies')return json(await libraryCompanies((s.get('query')??'').slice(0,120),80));
 if(s.get('mode')==='record'){const p=Number(s.get('part')),i=Number(s.get('index'));if(!Number.isSafeInteger(p)||p<0||!Number.isSafeInteger(i)||i<0)throw new Error('Invalid record');return json(await libraryRecord(s.get('collection')??'',p,i))}
 if(s.get('mode')==='replay')return json(await replayData((s.get('tickers')??'').split(',').filter(Boolean)));
 if(s.has('collection'))return json(await libraryQuery(Object.fromEntries([...s].filter(([k])=>k!=='mode').map(([k,v])=>[k,k==='limit'?Number(v):v]))));
 return json(libraryManifest);
}catch(e){return failure(e)}}

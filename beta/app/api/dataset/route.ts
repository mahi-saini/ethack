import {actor,failure,json,quota,readJson} from '@/lib/server/http';
import {loadDataset,saveDataset,clearDataset} from '@/lib/server/datasets';
export async function GET(request:Request){try{return json(await loadDataset(await actor(request)))}catch(e){return failure(e)}}
export async function POST(request:Request){try{const owner=await actor(request);await quota(owner,'import',10,3600);return json(await saveDataset(owner,await readJson(request,10*1024*1024)))}catch(e){return failure(e)}}
export async function DELETE(request:Request){try{const owner=await actor(request);await clearDataset(owner);return json(await loadDataset(owner))}catch(e){return failure(e)}}

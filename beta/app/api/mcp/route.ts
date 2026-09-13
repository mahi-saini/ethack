import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {WebStandardStreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import {actor,failure,quota,readJson} from '@/lib/server/http';
import {loadDataset} from '@/lib/server/datasets';
import {createResearchTools,toolSpecs} from '@/lib/server/research-tools';
export async function POST(request:Request){
 try{
  const owner=await actor(request);await quota(owner,'mcp',120,60);
  const data=await loadDataset(owner),research=createResearchTools(data,{datasetId:data.id,weights:[30,30,20,20],allocations:[],capital:1000000000,positionCap:20});
  const server=new McpServer({name:'hypergreen-research',version:'1.0.0'},{instructions:'Read-only sustainability research data. All demonstration measurements are synthetic. Imported evidence is unverified. Browser portfolio state is not available through this connection.'});
  // Portfolio is browser session context; do not expose a misleading empty portfolio remotely.
  for(const spec of toolSpecs.filter(t=>t.name!=='inspect_portfolio'))server.registerTool(spec.name,{description:spec.description,inputSchema:spec.schema,annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},async(args)=>{try{return {content:[{type:'text' as const,text:JSON.stringify(await research.call(spec.name,args))}]}}catch{return {isError:true,content:[{type:'text' as const,text:'The query is invalid or the records are unavailable. Check the tool schema and dataset.'}]}}});
  server.registerResource('dataset-summary','hypergreen://dataset/summary',{mimeType:'application/json',description:'Current signed-in user dataset identity, coverage and provenance limits.'},async(uri)=>({contents:[{uri:uri.href,mimeType:'application/json',text:JSON.stringify(await research.call('dataset_overview',{}))}]}));
  const transport=new WebStandardStreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
  await server.connect(transport);
  const response=await transport.handleRequest(request,{parsedBody:await readJson(request,60000)});
  response.headers.set('Cache-Control','no-store');
  return response;
 }catch(e){return failure(e)}
}
export async function GET(request:Request){try{await actor(request);return new Response(null,{status:405,headers:{Allow:'POST','Cache-Control':'no-store'}})}catch(e){return failure(e)}}

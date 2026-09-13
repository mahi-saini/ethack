import {z} from 'zod';
export const researchContextSchema=z.object({
 capital:z.number().finite().min(100).max(1e12).default(1000000000),
 positionCap:z.number().finite().min(1).max(100).default(20),
 datasetId:z.string().min(1).max(100).default('demo'),
 weights:z.array(z.number().finite().min(0).max(100)).length(4).default([30,30,20,20]),
 allocations:z.array(z.object({ticker:z.string().min(1).max(20),weight:z.number().finite().min(0).max(100)})).max(100).default([]),
}).strict();
export const chatRequestSchema=z.object({messages:z.array(z.object({role:z.enum(['user','assistant']),content:z.string().trim().min(1).max(8000)}).strict()).min(1).max(20),context:researchContextSchema}).strict().refine(x=>x.messages.at(-1)?.role==='user','End with a user question');
export type ResearchContext= z.infer<typeof researchContextSchema>;
export type Evidence={tool:string;label:string;records:number|null;sourceIds:string[]};
export type AgentReply={answer:string;checks:Evidence[];dataset:{id:string;label:string;demo:boolean};model:string;limited?:boolean};

export type SavedDataset={id:string;bundle:import('./data-contract').DataBundle|null;updatedAt?:string|null};
export type AgentStatus={textConfigured:boolean;voiceConfigured:boolean;model:string};

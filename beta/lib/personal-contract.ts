import {z} from 'zod';
export const recordCollections=['observations','monthlyReturns','factors','holdings','facilities','ownership','scenarios','documents'] as const;
export const flagReasons=['Incorrect value','Outdated information','Missing evidence','Wrong company mapping','Duplicate record','Other concern'] as const;
export const reviewStatuses=['open','in_review','resolved','dismissed'] as const;
export const statusLabels={open:'Open',in_review:'In review',resolved:'Resolved',dismissed:'Dismissed'};
export const flagTargetSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('company'),key:z.string().min(1).max(20)}).strict(),
 z.object({type:z.literal('source'),key:z.string().regex(/^source-\d+$/)}).strict(),
 z.object({type:z.literal('record'),collection:z.enum(recordCollections),index:z.number().int().min(0).max(100000)}).strict(),
 z.object({type:z.literal('dataset')}).strict(),
 z.object({type:z.literal('library_record'),collection:z.string().min(1).max(100),part:z.number().int().min(0).max(10000),index:z.number().int().min(0).max(1200)}).strict(),
]);
export const flagSchema=z.object({id:z.string().uuid(),datasetId:z.string().min(1).max(100),target:flagTargetSchema,reason:z.enum(flagReasons),details:z.string().trim().min(10).max(2000),suggestion:z.string().trim().max(1500).default(''),evidenceUrl:z.union([z.literal(''),z.string().max(2000).url().refine(v=>v.startsWith('https://'),'Use an HTTPS evidence link')]).default('')}).strict();
export const reviewUpdateSchema=z.object({id:z.string().uuid(),version:z.number().int().min(1),status:z.enum(reviewStatuses),note:z.string().trim().min(5).max(2000)}).strict();
export const simulationSchema=z.object({name:z.string().trim().min(1).max(80),datasetId:z.string().min(1).max(100),capital:z.number().finite().min(100).max(1e12),positionCap:z.number().finite().min(1).max(100).default(20),allocations:z.array(z.object({ticker:z.string().trim().min(1).max(20),weight:z.number().finite().min(0).max(100)}).strict()).max(100),weights:z.array(z.number().finite().min(0).max(100)).length(4)}).strict().refine(v=>new Set(v.allocations.map(a=>a.ticker)).size===v.allocations.length,'Company tickers must be unique');
export const createSimulationSchema=z.object({id:z.string().uuid(),simulation:simulationSchema}).strict();
export const updateSimulationSchema=z.object({id:z.string().uuid(),version:z.number().int().min(1),simulation:simulationSchema}).strict();
export type Simulation=z.infer<typeof simulationSchema>;
export type SavedSimulation=Simulation&{id:string;version:number;datasetLabel:string;updatedAt:string;createdAt:string};
export type Account={id:string;displayName:string;email:string;reviewer:boolean;createdAt:string};
export type AccountResponse={account:Account|null};
export type FlagTarget=z.infer<typeof flagTargetSchema>;
export type FlagDraft={target:FlagTarget;label:string;datasetId?:string};
export type ReviewFlag={id:string;datasetId:string;datasetLabel:string;targetType:string;targetKey:string;targetLabel:string;snapshot:Record<string,unknown>;reason:string;details:string;suggestion:string;evidenceUrl:string;status:typeof reviewStatuses[number];version:number;createdAt:string;updatedAt:string;mine:boolean};
export type ReviewEvent={status:ReviewFlag['status'];note:string;createdAt:string};
export type ReviewList={flags:ReviewFlag[];total:number;counts:Record<string,number>;reviewer:boolean;offset:number};

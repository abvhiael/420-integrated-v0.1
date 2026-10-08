import type { SqlExecutor420 } from './core-projections.js';
import { decodePositionCursor420, encodePositionCursor420, normalizeLimit420, type QueryDirection420, type QueryPage420 } from './query-layer.js';
import type { QueryRow420 } from './query-service.js';
import {
  computeJobState420, computeWorkerState420, computeVerifierState420,
  computeResearchProjectState420, computeRewardState420,
  type ComputeJobState420, type ComputeWorkerState420, type ComputeVerifierState420,
  type ComputeResearchProjectState420, type ComputeRewardState420
} from './compute-read-model.js';

export interface ComputeAppPageRequest420 { cursor?: string; limit?: number; direction?: QueryDirection420; }
export interface ComputeJobListRequest420 extends ComputeAppPageRequest420 { owner?: string; status?: string; }
export interface ComputeWorkerListRequest420 extends ComputeAppPageRequest420 { operator?: string; }
export interface ComputeVerifierListRequest420 extends ComputeAppPageRequest420 { authority?: string; }
export interface ComputeProjectListRequest420 extends ComputeAppPageRequest420 { owner?: string; }
export interface ComputeRewardListRequest420 extends ComputeAppPageRequest420 { beneficiary?: string; }
export interface ComputeContributionListRequest420 extends ComputeAppPageRequest420 { contributor?: string; }

interface Position420 { blockNumber:string; blockHash:string; transactionHash:string; transactionIndex:number; logIndex:number; }
export interface ComputeReputationReference420 extends Position420 {
  schemaVersion:'420-compute-app-read-v1'; chainId:string; referenceId:string; workerId:string; workerRevision:string;
  policyId:string; policyRevision:string; metricRevision:string; total:string; activeSignals:string; authoritative:false;
}
export interface ComputeContributionState420 extends Position420 {
  schemaVersion:'420-compute-app-read-v1'; chainId:string; contributionId:string; jobId:string; contributor:string; projectRef:string;
  policyId:string; policyRevision:string; metricKind:string; metricId:string; amount:string; gateId:string; authoritative:false;
}
export interface ComputeStakeReference420 extends Position420 {
  schemaVersion:'420-compute-app-read-v1'; chainId:string; referenceId:string; workerId:string; workerRevision:string;
  stakePolicyId:string; stakePolicyRevision:string; sourceBindingRevision:string; positionId:string; positionRevision:string; authoritative:false;
}

function rows(value:unknown):QueryRow420[]{if(!value||typeof value!=='object'||!Array.isArray((value as any).rows))throw new Error('Compute app query invalid');return (value as any).rows;}
function rowText(row:QueryRow420,name:string):string{const v=row[name];if(typeof v!=='string'||!v)throw new Error('Compute app provenance missing: '+name);return v;}
function rowInt(row:QueryRow420,name:string):number{const v=row[name];if(typeof v==='number'&&Number.isSafeInteger(v)&&v>=0)return v;if(typeof v==='string'&&/^\d+$/.test(v))return Number(v);throw new Error('Compute app position invalid: '+name);}
function safeFields(value:unknown):Record<string,unknown>{if(typeof value==='string')value=JSON.parse(value);if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Compute app fields invalid');return value as Record<string,unknown>;}
function text(value:unknown,name:string):string{if(typeof value!=='string'||!value)throw new Error('Compute app field missing: '+name);return value.toLowerCase();}
function uint(value:unknown,name:string):string{const s=String(value??'');if(!/^\d+$/.test(s))throw new Error('Compute app numeric field invalid: '+name);return s;}
function signed(value:unknown,name:string):string{const s=String(value??'');if(!/^-?\d+$/.test(s))throw new Error('Compute app signed field invalid: '+name);return s;}
function address(value:unknown,name:string):string{const s=text(value,name);if(!/^0x[0-9a-f]{40}$/.test(s))throw new Error('Compute app address invalid: '+name);return s;}
function bytes32(value:unknown,name:string):string{const s=text(value,name);if(!/^0x[0-9a-f]{64}$/.test(s))throw new Error('Compute app bytes32 invalid: '+name);return s;}
function optAddress(value:string|undefined,name:string){if(value===undefined)return undefined;return address(value,name);}
function pos(row:QueryRow420):Position420{return{blockNumber:rowText(row,'block_number'),blockHash:rowText(row,'block_hash'),transactionHash:rowText(row,'tx_hash'),transactionIndex:rowInt(row,'tx_index'),logIndex:rowInt(row,'log_index')};}

async function listIds420(db:SqlExecutor420,chainId:bigint,idField:string,eventNames:readonly string[],request:ComputeAppPageRequest420,filter?:{field:string;value:string}):Promise<{ids:string[];nextCursor:string|null}>{
  if(chainId<=0n)throw new Error('Compute app chain id invalid');
  const limit=normalizeLimit420(request.limit),direction=request.direction??'desc';
  const params:unknown[]=[chainId.toString(),idField,eventNames];
  const predicates=["chain_id=$1","protocol='420Compute'","event_name=any($3::text[])","fields ? $2"];
  if(filter){params.push(filter.field,filter.value);predicates.push(`fields->>$${params.length-1}=$${params.length}`);}
  let cursorWhere='';
  if(request.cursor){const c=decodePositionCursor420(request.cursor),cmp=direction==='asc'?'>':'<';params.push(c.blockNumber.toString(),c.txIndex,c.logIndex);cursorWhere=`where (block_number,tx_index,log_index) ${cmp} ($${params.length-2},$${params.length-1},$${params.length})`;}
  params.push(limit+1);
  const sql=`with latest as (
    select distinct on (fields->>$2) fields->>$2 as object_id,block_number,tx_index,log_index
    from idx_protocol_events where ${predicates.join(' and ')}
    order by fields->>$2,block_number desc,tx_index desc,log_index desc
  ) select * from latest ${cursorWhere} order by block_number ${direction},tx_index ${direction},log_index ${direction} limit $${params.length}`;
  const result=rows(await db.query(sql,params)),page=result.slice(0,limit),last=page.at(-1);
  const nextCursor=result.length>limit&&last?encodePositionCursor420({blockNumber:BigInt(rowText(last,'block_number')),txIndex:rowInt(last,'tx_index'),logIndex:rowInt(last,'log_index')}):null;
  return{ids:page.map(r=>bytes32(r.object_id,'object_id')),nextCursor};
}
async function states<T>(ids:string[],load:(id:string)=>Promise<T|null>,nextCursor:string|null,predicate?:(state:T)=>boolean):Promise<QueryPage420<T>>{
  const items:T[]=[];for(const id of ids){const s=await load(id);if(!s)throw new Error('Compute indexed object missing canonical creation event');if(!predicate||predicate(s))items.push(s);}return{items,nextCursor};
}

export async function computeJobs420(db:SqlExecutor420,chainId:bigint,request:ComputeJobListRequest420={}):Promise<QueryPage420<ComputeJobState420>>{
  const owner=optAddress(request.owner,'owner');
  const page=await listIds420(db,chainId,'jobId',['JobCreated','JobTransition','WorkerAssigned','ResultRecorded','VerifierDecision'],request,owner?{field:'owner',value:owner}:undefined);
  return states(page.ids,id=>computeJobState420(db,chainId,id),page.nextCursor,request.status?s=>s.status===request.status:undefined);
}
export async function computeWorkers420(db:SqlExecutor420,chainId:bigint,request:ComputeWorkerListRequest420={}):Promise<QueryPage420<ComputeWorkerState420>>{
  const operator=optAddress(request.operator,'operator');
  const page=await listIds420(db,chainId,'workerId',['WorkerRegistered','WorkerRevised'],request,operator?{field:'operator',value:operator}:undefined);
  return states(page.ids,id=>computeWorkerState420(db,chainId,id),page.nextCursor);
}
export async function computeVerifiers420(db:SqlExecutor420,chainId:bigint,request:ComputeVerifierListRequest420={}):Promise<QueryPage420<ComputeVerifierState420>>{
  const authority=optAddress(request.authority,'authority');
  const page=await listIds420(db,chainId,'verifierId',['VerifierRegistered','VerifierRevised'],request,authority?{field:'authority',value:authority}:undefined);
  return states(page.ids,id=>computeVerifierState420(db,chainId,id),page.nextCursor);
}
export async function computeResearchProjects420(db:SqlExecutor420,chainId:bigint,request:ComputeProjectListRequest420={}):Promise<QueryPage420<ComputeResearchProjectState420>>{
  const owner=optAddress(request.owner,'owner');
  const page=await listIds420(db,chainId,'projectId',['ResearchProjectRegistered','ResearchProjectRevised','ResearchProjectAcceptanceSet','ResearchProjectRetired'],request,owner?{field:'owner',value:owner}:undefined);
  return states(page.ids,id=>computeResearchProjectState420(db,chainId,id),page.nextCursor);
}
export async function computeRewards420(db:SqlExecutor420,chainId:bigint,request:ComputeRewardListRequest420={}):Promise<QueryPage420<ComputeRewardState420>>{
  const beneficiary=optAddress(request.beneficiary,'beneficiary');
  const page=await listIds420(db,chainId,'rewardId',['UsefulRewardAccounted'],request,beneficiary?{field:'beneficiary',value:beneficiary}:undefined);
  return states(page.ids,id=>computeRewardState420(db,chainId,id),page.nextCursor);
}

async function contributionState420(db:SqlExecutor420,chainId:bigint,id:string):Promise<ComputeContributionState420|null>{
  if(chainId<=0n)throw new Error('Compute app chain id invalid');const contributionId=bytes32(id,'contributionId');
  const rs=rows(await db.query("select * from idx_protocol_events where chain_id=$1 and protocol='420Compute' and event_name='ContributionRecorded' and fields->>'contributionId'=$2 order by block_number desc,tx_index desc,log_index desc limit 1",[chainId.toString(),contributionId]));
  const row=rs[0];if(!row)return null;const f=safeFields(row.fields);
  return{schemaVersion:'420-compute-app-read-v1',chainId:chainId.toString(),contributionId:bytes32(f.contributionId,'contributionId'),jobId:bytes32(f.jobId,'jobId'),contributor:address(f.contributor,'contributor'),projectRef:bytes32(f.projectRef,'projectRef'),policyId:bytes32(f.policyId,'policyId'),policyRevision:uint(f.policyRevision,'policyRevision'),metricKind:uint(f.metricKind,'metricKind'),metricId:bytes32(f.metricId,'metricId'),amount:uint(f.amount,'amount'),gateId:bytes32(f.gateId,'gateId'),...pos(row),authoritative:false};
}
export async function computeContributions420(db:SqlExecutor420,chainId:bigint,request:ComputeContributionListRequest420={}):Promise<QueryPage420<ComputeContributionState420>>{
  const contributor=optAddress(request.contributor,'contributor');
  const page=await listIds420(db,chainId,'contributionId',['ContributionRecorded'],request,contributor?{field:'contributor',value:contributor}:undefined);
  return states(page.ids,id=>contributionState420(db,chainId,id),page.nextCursor);
}

async function referenceEvent420(db:SqlExecutor420,chainId:bigint,id:string,eventName:string):Promise<QueryRow420|null>{
  if(chainId<=0n)throw new Error('Compute app chain id invalid');const ref=bytes32(id,'referenceId');
  const rs=rows(await db.query("select * from idx_protocol_events where chain_id=$1 and protocol='420Compute' and event_name=$2 and fields->>'referenceId'=$3 order by block_number desc,tx_index desc,log_index desc limit 1",[chainId.toString(),eventName,ref]));
  return rs[0]??null;
}
export async function computeReputationReference420(db:SqlExecutor420,chainId:bigint,id:string):Promise<ComputeReputationReference420|null>{
  const row=await referenceEvent420(db,chainId,id,'ReputationReferenceCaptured');if(!row)return null;const f=safeFields(row.fields);
  return{schemaVersion:'420-compute-app-read-v1',chainId:chainId.toString(),referenceId:bytes32(f.referenceId,'referenceId'),workerId:bytes32(f.workerId,'workerId'),workerRevision:uint(f.workerRevision,'workerRevision'),policyId:bytes32(f.policyId,'policyId'),policyRevision:uint(f.policyRevision,'policyRevision'),metricRevision:uint(f.metricRevision,'metricRevision'),total:signed(f.total,'total'),activeSignals:uint(f.activeSignals,'activeSignals'),...pos(row),authoritative:false};
}
export async function computeStakeReference420(db:SqlExecutor420,chainId:bigint,id:string):Promise<ComputeStakeReference420|null>{
  const row=await referenceEvent420(db,chainId,id,'StakeReferenceCaptured');if(!row)return null;const f=safeFields(row.fields);
  return{schemaVersion:'420-compute-app-read-v1',chainId:chainId.toString(),referenceId:bytes32(f.referenceId,'referenceId'),workerId:bytes32(f.workerId,'workerId'),workerRevision:uint(f.workerRevision,'workerRevision'),stakePolicyId:bytes32(f.stakePolicyId,'stakePolicyId'),stakePolicyRevision:uint(f.stakePolicyRevision,'stakePolicyRevision'),sourceBindingRevision:uint(f.sourceBindingRevision,'sourceBindingRevision'),positionId:bytes32(f.positionId,'positionId'),positionRevision:uint(f.positionRevision,'positionRevision'),...pos(row),authoritative:false};
}
export async function computeReputationReferences420(db:SqlExecutor420,chainId:bigint,workerId:string,request:ComputeAppPageRequest420={}):Promise<QueryPage420<ComputeReputationReference420>>{
  const wid=bytes32(workerId,'workerId');const page=await listIds420(db,chainId,'referenceId',['ReputationReferenceCaptured'],request,{field:'workerId',value:wid});
  return states(page.ids,id=>computeReputationReference420(db,chainId,id),page.nextCursor);
}
export async function computeStakeReferences420(db:SqlExecutor420,chainId:bigint,workerId:string,request:ComputeAppPageRequest420={}):Promise<QueryPage420<ComputeStakeReference420>>{
  const wid=bytes32(workerId,'workerId');const page=await listIds420(db,chainId,'referenceId',['StakeReferenceCaptured'],request,{field:'workerId',value:wid});
  return states(page.ids,id=>computeStakeReference420(db,chainId,id),page.nextCursor);
}

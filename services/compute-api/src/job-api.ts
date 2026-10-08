import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import {
  createComputeSdk420,
  type ComputeRequest420,
  type ComputeRequestPolicy420,
  type ComputeSdkHost420,
  type ComputeWriteIntent420,
  type Hex420
} from '@420/sdk';

export const COMPUTE_API_VERSION_420 = 'v1' as const;
export const COMPUTE_API_SCHEMA_420 = '420-compute-api-v1' as const;
const MAX_BODY_BYTES_420 = 256 * 1024;
const SENSITIVE_KEY_420 = /(private.?key|mnemonic|seed.?phrase|password|credential|secret|api.?key|access.?token)/i;

export interface ComputeJobProjection420 {
  readonly schemaVersion: typeof COMPUTE_API_SCHEMA_420;
  readonly chainId: string;
  readonly jobId: string;
  readonly requestId: string;
  readonly status: string;
  readonly finality: 'pending' | 'safe' | 'finalized';
  readonly authoritative: false;
}

export interface ComputeJobReadStore420 {
  job(chainId: bigint, jobId: string): Promise<ComputeJobProjection420 | null>;
}

export interface ComputeJobSubmission420 {
  readonly chainId: string;
  readonly operationId: string;
  readonly requestId: string;
  readonly request: unknown;
}

export interface ComputeJobSubmissionPlan420 {
  readonly schemaVersion: typeof COMPUTE_API_SCHEMA_420;
  readonly apiVersion: typeof COMPUTE_API_VERSION_420;
  readonly status: 'READY_FOR_WALLET_AUTHORIZATION';
  readonly chainId: string;
  readonly operationId: string;
  readonly requestId: Hex420;
  readonly intent: ComputeWriteIntent420;
  readonly canonicalState: false;
  readonly secretMaterialManaged: false;
}

export interface ComputeJobApi420 {
  submit(input: ComputeJobSubmission420): ComputeJobSubmissionPlan420;
  job(jobId: string): Promise<ComputeJobProjection420 | null>;
}

export interface ComputeApiResponse420 {
  readonly status: number;
  readonly body: unknown;
}

export class ComputeApiRequestError420 extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = 'ComputeApiRequestError420';
  }
}

function object420(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ComputeApiRequestError420(400, `${label} must be an object`);
  return value as Record<string, unknown>;
}
function string420(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value) throw new ComputeApiRequestError420(400, `${label} must be a non-empty string`);
  return value;
}
function hex420(value: unknown, bytes: number, label: string): Hex420 {
  const text=string420(value,label);
  if (!new RegExp(`^0x[0-9a-fA-F]{${bytes*2}}$`).test(text)) throw new ComputeApiRequestError420(400, `${label} has invalid hex length`);
  return text as Hex420;
}
function uint420(value: unknown, label: string): bigint {
  const text=typeof value === 'bigint' ? value.toString() : typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : typeof value === 'string' ? value : '';
  if (!/^\d+$/.test(text)) throw new ComputeApiRequestError420(400, `${label} must be an unsigned integer`);
  return BigInt(text);
}
function uint32Number420(value: unknown, label: string): number {
  const n=uint420(value,label);
  if (n<=0n || n>0xffffffffn) throw new ComputeApiRequestError420(400, `${label} must be a positive uint32`);
  return Number(n);
}
function policy420(value: unknown, label: string): ComputeRequestPolicy420 {
  const p=object420(value,label);
  return {id:hex420(p.id,32,`${label}.id`),version:uint32Number420(p.version,`${label}.version`),commitment:hex420(p.commitment,32,`${label}.commitment`)};
}
function rejectSensitive420(value: unknown, path='body'): void {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach((item,index)=>rejectSensitive420(item,`${path}[${index}]`)); return; }
  for (const [key,item] of Object.entries(value as Record<string,unknown>)) {
    if (SENSITIVE_KEY_420.test(key)) throw new ComputeApiRequestError420(400,`secret material is not accepted: ${path}.${key}`);
    rejectSensitive420(item,`${path}.${key}`);
  }
}
export function normalizeComputeRequest420(value: unknown): ComputeRequest420 {
  rejectSensitive420(value);
  const r=object420(value,'request'), t=object420(r.terms,'request.terms');
  return {
    owner:hex420(r.owner,20,'request.owner'),
    payer:hex420(r.payer,20,'request.payer'),
    signedRequestId:hex420(r.signedRequestId,32,'request.signedRequestId'),
    manifestHash:hex420(r.manifestHash,32,'request.manifestHash'),
    workloadType:hex420(r.workloadType,32,'request.workloadType'),
    inputCommitment:hex420(r.inputCommitment,32,'request.inputCommitment'),
    outputSchemaCommitment:hex420(r.outputSchemaCommitment,32,'request.outputSchemaCommitment'),
    terms:{
      resourceClass:hex420(t.resourceClass,32,'request.terms.resourceClass'),
      runtimeHash:hex420(t.runtimeHash,32,'request.terms.runtimeHash'),
      capabilityHash:hex420(t.capabilityHash,32,'request.terms.capabilityHash'),
      verification:policy420(t.verification,'request.terms.verification'),
      privacy:policy420(t.privacy,'request.terms.privacy'),
      jurisdictionHash:hex420(t.jurisdictionHash,32,'request.terms.jurisdictionHash'),
      dataAccessHash:hex420(t.dataAccessHash,32,'request.terms.dataAccessHash'),
      partitionPlanHash:hex420(t.partitionPlanHash,32,'request.terms.partitionPlanHash'),
      partitionCount:uint32Number420(t.partitionCount,'request.terms.partitionCount'),
      replicationFactor:uint32Number420(t.replicationFactor,'request.terms.replicationFactor'),
      capacityUnits:uint420(t.capacityUnits,'request.terms.capacityUnits'),
      pricing:policy420(t.pricing,'request.terms.pricing'),
      sla:policy420(t.sla,'request.terms.sla'),
      deadline:uint420(t.deadline,'request.terms.deadline'),
      expiresAt:uint420(t.expiresAt,'request.terms.expiresAt'),
      maximumPrice:uint420(t.maximumPrice,'request.terms.maximumPrice'),
      fundingReference:hex420(t.fundingReference,32,'request.terms.fundingReference')
    },
    createdAt:uint420(r.createdAt,'request.createdAt'),
    revision:uint420(r.revision,'request.revision'),
    predecessorCommitment:hex420(r.predecessorCommitment,32,'request.predecessorCommitment'),
    status:Number(uint420(r.status,'request.status'))
  };
}
function requireOperationId420(value: string): string {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new ComputeApiRequestError420(400,'operationId must be bytes32 hex');
  return value.toLowerCase();
}
function requireJobId420(value: string): string {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new ComputeApiRequestError420(400,'jobId must be bytes32 hex');
  return value.toLowerCase();
}

export function createComputeJobApi420(host: ComputeSdkHost420, store: ComputeJobReadStore420): ComputeJobApi420 {
  const sdk=createComputeSdk420(host);
  return Object.freeze({
    submit(input: ComputeJobSubmission420): ComputeJobSubmissionPlan420 {
      rejectSensitive420(input);
      if (input.chainId !== sdk.chainId) throw new ComputeApiRequestError420(409,'compute API chain identity mismatch');
      const operationId=requireOperationId420(input.operationId);
      const requestId=hex420(input.requestId,32,'requestId');
      const request=normalizeComputeRequest420(input.request);
      const intent=sdk.prepareJobSubmission(requestId,request);
      return Object.freeze({
        schemaVersion:COMPUTE_API_SCHEMA_420,
        apiVersion:COMPUTE_API_VERSION_420,
        status:'READY_FOR_WALLET_AUTHORIZATION',
        chainId:sdk.chainId,
        operationId,
        requestId,
        intent,
        canonicalState:false,
        secretMaterialManaged:false
      });
    },
    job(jobId: string) { return store.job(BigInt(sdk.chainId),requireJobId420(jobId)); }
  });
}

function error420(status:number,code:string,message:string):ComputeApiResponse420 {
  return {status,body:{apiVersion:COMPUTE_API_VERSION_420,error:{code,message}}};
}
function ok420(data:unknown,status=200):ComputeApiResponse420 {
  return {status,body:{apiVersion:COMPUTE_API_VERSION_420,data}};
}

export async function routeComputeJobApi420(api: ComputeJobApi420, method: string, path: string, body?: unknown): Promise<ComputeApiResponse420> {
  try {
    const verb=method.toUpperCase();
    if (path === '/v1/compute/jobs') {
      if (verb !== 'POST') return error420(405,'method_not_allowed','job submission requires POST');
      if (body === undefined) return error420(400,'invalid_request','request body is required');
      return ok420(api.submit(object420(body,'body') as unknown as ComputeJobSubmission420),202);
    }
    const match=/^\/v1\/compute\/jobs\/(0x[0-9a-fA-F]{64})$/.exec(path);
    if (match) {
      if (verb !== 'GET') return error420(405,'method_not_allowed','job reads require GET');
      const value=await api.job(match[1]!);
      return value ? ok420(value) : error420(404,'not_found','compute job not found');
    }
    return error420(404,'not_found','route not found');
  } catch (error) {
    if (error instanceof ComputeApiRequestError420) return error420(error.status,'invalid_request',error.message);
    const message=error instanceof Error ? error.message : String(error);
    if (/request |canonical Compute contract|bytes32|expired|maximum price|chain identity/i.test(message)) return error420(400,'invalid_request',message);
    return error420(500,'internal_error','internal server error');
  }
}

async function readJsonBody420(request:IncomingMessage):Promise<unknown>{
  const chunks:Buffer[]=[]; let size=0;
  for await (const chunk of request) {
    const buffer=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);
    size+=buffer.length;
    if(size>MAX_BODY_BYTES_420) throw new ComputeApiRequestError420(413,'request body too large');
    chunks.push(buffer);
  }
  if(!chunks.length) return undefined;
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new ComputeApiRequestError420(400,'request body must be valid JSON');}
}
function write420(response:ServerResponse,result:ComputeApiResponse420):void{
  response.writeHead(result.status,{'content-type':'application/json; charset=utf-8'});
  response.end(JSON.stringify(result.body,(_key,value)=>typeof value==='bigint'?value.toString():value));
}
export function createComputeJobHttpServer420(api:ComputeJobApi420):Server{
  return createServer(async(request,response)=>{
    try{
      const path=new URL(request.url??'/','http://compute-api.local').pathname;
      const body=request.method?.toUpperCase()==='POST'?await readJsonBody420(request):undefined;
      write420(response,await routeComputeJobApi420(api,request.method??'GET',path,body));
    }catch(error){
      if(error instanceof ComputeApiRequestError420) write420(response,error420(error.status,'invalid_request',error.message));
      else write420(response,error420(500,'internal_error','internal server error'));
    }
  });
}

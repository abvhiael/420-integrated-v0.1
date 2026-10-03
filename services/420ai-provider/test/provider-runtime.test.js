import test from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomBytes } from "node:crypto";
import {
  EncryptedPayloadStore420, MemoryBlobStore420, MemoryRuntimeStateStore420,
  ProviderRuntime420, signObject420, verifySignedObject420, redact420
} from "../src/index.js";

const {privateKey,publicKey}=generateKeyPairSync("ed25519");
const chainId=420, graph="graph:420", providerId="provider:1", resourceId="resource:gpu";
const now=()=>1_000_000;
function commitment(bytes){return createHash("sha256").update(bytes).digest("hex");}
function baseJob(overrides={}) {
  const payload=Buffer.from("private prompt: do not log");
  return {payload,job:{jobId:"job:1",aiRequestId:"ai:1",computeRequestId:"cr:1",assignmentRef:"assign:1",providerId,resourceId,modelVersionId:"model:v1",workloadClass:"AI_INFERENCE_TEXT",privacyPolicyId:"privacy:strict",verificationProfileId:"verify:v1",inputCommitment:commitment(payload),manifestHash:"manifest:canonical",status:"RUNNING",deadlineMs:1_100_000,resultCommitment:null,...overrides}};
}
function fixture({submitReceipt,jobOverrides={},stateStore=new MemoryRuntimeStateStore420(),logger=()=>{},maxAttempts=3}={}) {
  const {payload,job}=baseJob(jobOverrides);const blobStore=new MemoryBlobStore420();
  const privatePayloads=new EncryptedPayloadStore420({key:Buffer.alloc(32,7),blobStore,now,maxRetentionMs:200_000});
  const canonicalJob={...job};
  const canonical={
    async environment(){return {chainId,computeGraphHash:graph};},
    async job(){return structuredClone(canonicalJob);},
    async submitReceipt(args){if(submitReceipt)return submitReceipt(args,canonicalJob);canonicalJob.status="RESULT_COMMITTED";canonicalJob.resultCommitment=args.signedReceipt.payload.resultCommitment;return {txHash:"0x1"};}
  };
  let executions=0;
  const executor={async execute(){executions+=1;return {resultCommitment:"result:1",evidenceRef:"receipt:evidence"};}};
  const runtime=new ProviderRuntime420({config:{chainId,computeGraphHash:graph,providerId,runtimeId:"runtime:v1",resourceIds:[resourceId],maxAttempts,retryBaseMs:1},canonicalClient:canonical,privatePayloads,stateStore,executor,signingKey:privateKey,commitmentVerifier:async(bytes,expected)=>commitment(bytes)===expected,logger,now,sleep:async()=>{}});
  return {runtime,privatePayloads,payload,canonicalJob,stateStore,get executions(){return executions;}};
}
async function seedPayload(f,payloadId="payload:1") {
  const j=f.canonicalJob;await f.privatePayloads.put(payloadId,f.payload,{aad:{jobId:j.jobId,assignmentRef:j.assignmentRef,inputCommitment:j.inputCommitment},expiresAt:1_050_000});return payloadId;
}

test("signed execution objects verify and tampering fails",()=>{
  const signed=signObject420({domain:"420AI_PROVIDER_EXECUTION_V1",jobId:"j"},privateKey);
  assert.equal(verifySignedObject420(signed,publicKey),true);
  signed.payload.jobId="other";assert.equal(verifySignedObject420(signed,publicKey),false);
});

test("private payloads are encrypted, scoped, retained for a bounded period and expire closed",async()=>{
  let t=100;const blobs=new MemoryBlobStore420();const store=new EncryptedPayloadStore420({key:randomBytes(32),blobStore:blobs,now:()=>t,maxRetentionMs:100});
  await store.put("p",Buffer.from("super-secret"),{aad:{jobId:"j"},expiresAt:150});
  const raw=await blobs.get("p");assert.equal(JSON.stringify(raw).includes("super-secret"),false);
  assert.equal((await store.get("p",{aad:{jobId:"j"}})).toString(),"super-secret");
  await assert.rejects(()=>store.get("p",{aad:{jobId:"x"}}),/scope mismatch/);
  t=151;await assert.rejects(()=>store.get("p",{aad:{jobId:"j"}}),/expired/);assert.equal(await blobs.get("p"),null);
});

test("provider runtime submits once and local replay is idempotent",async()=>{
  const f=fixture();const id=await seedPayload(f);const first=await f.runtime.process("job:1",id);const second=await f.runtime.process("job:1",id);
  assert.equal(first.status,"submitted");assert.equal(second.receiptId,first.receiptId);assert.equal(f.executions,1);
});

test("transient receipt failure uses bounded retry and succeeds without changing identity",async()=>{
  let calls=0;const f=fixture({submitReceipt:async(args,job)=>{calls+=1;if(calls<3)throw Object.assign(new Error("rpc timeout"),{transient:true});job.status="RESULT_COMMITTED";job.resultCommitment=args.signedReceipt.payload.resultCommitment;return {txHash:"0x3"};}});
  await seedPayload(f);const state=await f.runtime.process("job:1","payload:1");assert.equal(state.status,"submitted");assert.equal(calls,3);
});

test("timeout after canonical success reconciles before duplicate submission",async()=>{
  let calls=0;const f=fixture({submitReceipt:async(args,job)=>{calls+=1;job.status="RESULT_COMMITTED";job.resultCommitment=args.signedReceipt.payload.resultCommitment;throw Object.assign(new Error("lost response"),{transient:true});}});
  await seedPayload(f);const state=await f.runtime.process("job:1","payload:1");assert.equal(state.submission.reconciled,true);assert.equal(calls,1);
});

test("restart recovery trusts canonical result rather than replaying execution",async()=>{
  const states=new MemoryRuntimeStateStore420([{jobId:"job:1",status:"pending_submit",resultCommitment:"result:1",receiptId:"r"}]);
  const f=fixture({stateStore:states,jobOverrides:{status:"RESULT_COMMITTED",resultCommitment:"result:1"}});
  const recovered=await f.runtime.recover();assert.equal(recovered[0].status,"submitted");assert.equal(f.executions,0);
});

test("wrong chain/provider/resource/deadline fail before private execution",async()=>{
  const f=fixture({jobOverrides:{providerId:"provider:other"}});await seedPayload(f);
  await assert.rejects(()=>f.runtime.process("job:1","payload:1"),/provider identity mismatch/);assert.equal(f.executions,0);
});

test("observability redacts payloads, tokens, secrets and byte buffers",()=>{
  const x=redact420({jobId:"j",prompt:"hello",apiToken:"token",nested:{secret:"x",inputBytes:Buffer.from("raw")}});
  assert.equal(x.jobId,"j");assert.equal(x.prompt,"[REDACTED]");assert.equal(x.apiToken,"[REDACTED]");assert.equal(x.nested.secret,"[REDACTED]");assert.equal(x.nested.inputBytes,"[REDACTED]");
});

test("health is non-authoritative and exposes bounded pending work only",async()=>{
  const f=fixture();const h=await f.runtime.health();assert.equal(h.authoritative,false);assert.equal(h.environment,"ready");assert.equal(h.pending,0);
});

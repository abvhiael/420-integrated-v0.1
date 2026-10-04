import { digestObject420, signObject420 } from "./canonical-json.js";
import { withBoundedRetry420 } from "./retry.js";
import { createObserver420 } from "./observability.js";

const SUCCESS_STATES=new Set(["RESULT_COMMITTED","VERIFIED","SETTLED","DISPUTED"]);
const TERMINAL_STATES=new Set(["SETTLED","REFUNDED","FAILED","EXPIRED","CANCELLED"]);
function req(v,n){if(v===undefined||v===null||v==="")throw new Error(`missing ${n}`);return v;}

export class ProviderRuntime420 {
  constructor({config,canonicalClient,privatePayloads,stateStore,executor,signingKey,commitmentVerifier,logger=()=>{},now=()=>Date.now(),sleep}={}) {
    for (const [n,v] of Object.entries({config,canonicalClient,privatePayloads,stateStore,executor,signingKey,commitmentVerifier})) req(v,n);
    for (const m of ["environment","job","submitReceipt"]) if(typeof canonicalClient[m]!=="function") throw new Error(`canonicalClient.${m} required`);
    if(typeof executor.execute!=="function") throw new Error("executor.execute required");
    if(typeof commitmentVerifier!=="function") throw new Error("commitmentVerifier required");
    this.config={chainId:req(config.chainId,"config.chainId"),computeGraphHash:req(config.computeGraphHash,"config.computeGraphHash"),providerId:req(config.providerId,"config.providerId"),runtimeId:req(config.runtimeId,"config.runtimeId"),manifestTtlMs:config.manifestTtlMs??15*60_000,maxAttempts:config.maxAttempts??3,retryBaseMs:config.retryBaseMs??25,resourceIds:new Set(config.resourceIds??[])};
    this.canonical=canonicalClient;this.privatePayloads=privatePayloads;this.stateStore=stateStore;this.executor=executor;this.signingKey=signingKey;this.commitmentVerifier=commitmentVerifier;this.now=now;this.sleep=sleep;this.observe=createObserver420(logger);
  }
  async _environment() {
    const e=await this.canonical.environment();
    if(e?.chainId!==this.config.chainId) throw new Error("canonical chain mismatch");
    if(e?.computeGraphHash!==this.config.computeGraphHash) throw new Error("ComputeMarket graph mismatch");
    return e;
  }
  _validateJob(job) {
    req(job,"canonical job");req(job.jobId,"jobId");req(job.assignmentRef,"assignmentRef");req(job.inputCommitment,"inputCommitment");req(job.manifestHash,"manifestHash");
    if(job.providerId!==this.config.providerId) throw new Error("provider identity mismatch");
    if(this.config.resourceIds.size && !this.config.resourceIds.has(job.resourceId)) throw new Error("resource not allowed");
    if(job.status!=="RUNNING") throw new Error("job not executable");
    if(!Number.isSafeInteger(job.deadlineMs)||job.deadlineMs<=this.now()) throw new Error("job deadline expired");
  }
  _manifest(job) {
    const issuedAt=this.now(), expiresAt=Math.min(job.deadlineMs,issuedAt+this.config.manifestTtlMs);
    return {
      domain:"420AI_PROVIDER_EXECUTION_V1",version:1,chainId:this.config.chainId,computeGraphHash:this.config.computeGraphHash,
      jobId:job.jobId,aiRequestId:req(job.aiRequestId,"aiRequestId"),computeRequestId:req(job.computeRequestId,"computeRequestId"),
      assignmentRef:job.assignmentRef,providerId:job.providerId,resourceId:req(job.resourceId,"resourceId"),
      modelVersionId:req(job.modelVersionId,"modelVersionId"),workloadClass:req(job.workloadClass,"workloadClass"),
      privacyPolicyId:req(job.privacyPolicyId,"privacyPolicyId"),verificationProfileId:req(job.verificationProfileId,"verificationProfileId"),
      inputCommitment:job.inputCommitment,canonicalManifestHash:job.manifestHash,runtimeId:this.config.runtimeId,issuedAt,expiresAt
    };
  }
  async _canonicalAlreadyHas(jobId,resultCommitment) {
    const j=await this.canonical.job(jobId);
    return SUCCESS_STATES.has(j?.status)&&j?.resultCommitment===resultCommitment;
  }
  _validatePersistedSubmission(state) {
    const m=state?.signedManifest?.payload, r=state?.signedReceipt?.payload;
    if(!m||!r||state.receiptId!==digestObject420(r)) throw new Error("persisted receipt state invalid");
    if(m.jobId!==state.jobId||r.jobId!==state.jobId||m.assignmentRef!==state.assignmentRef||r.assignmentRef!==state.assignmentRef) throw new Error("persisted receipt scope mismatch");
    if(r.manifestDigest!==state.signedManifest.digest||r.resultCommitment!==state.resultCommitment) throw new Error("persisted receipt commitment mismatch");
    if(m.providerId!==this.config.providerId||r.providerId!==this.config.providerId) throw new Error("persisted provider mismatch");
  }
  async _submitPending(state) {
    this._validatePersistedSubmission(state);
    const {jobId,resultCommitment,signedManifest,signedReceipt,receiptId}=state;
    const deadlineMs=signedManifest.payload.expiresAt;
    const submission=await withBoundedRetry420(async ({attempt})=>{
      if(await this._canonicalAlreadyHas(jobId,resultCommitment)) return {reconciled:true,attempt};
      const current=await this.canonical.job(jobId);
      if(TERMINAL_STATES.has(current?.status)&&current?.resultCommitment!==resultCommitment) throw new Error("canonical job became terminal");
      if(current?.status!=="RUNNING") throw new Error("canonical job no longer submit-eligible");
      if(current.assignmentRef!==state.assignmentRef||current.providerId!==this.config.providerId||current.resourceId!==signedReceipt.payload.resourceId) throw new Error("canonical assignment changed");
      try { return await this.canonical.submitReceipt({jobId,signedManifest,signedReceipt,receiptId,idempotencyKey:receiptId}); }
      catch(error) {
        if(await this._canonicalAlreadyHas(jobId,resultCommitment)) return {reconciled:true,attempt};
        throw error;
      }
    },{maxAttempts:this.config.maxAttempts,baseDelayMs:this.config.retryBaseMs,deadlineMs:Math.min(deadlineMs,this.now()+30_000),sleep:this.sleep,now:this.now});
    const next={...state,status:"submitted",submission,updatedAt:this.now()};
    await this.stateStore.put(next);
    this.observe("info","receipt_submitted",{jobId,receiptId,resultCommitment});
    return next;
  }
  async process(jobId,payloadId,{allowReexecute=false}={}) {
    const existing=await this.stateStore.get(jobId);
    if(existing?.status==="submitted") return existing;
    await this._environment();
    if(existing?.status==="pending_submit") return this._submitPending(existing);
    if(existing?.status==="terminal") throw new Error("canonical job already terminal");
    if((existing?.status==="executing"||existing?.status==="recoverable")&&!allowReexecute) throw new Error("interrupted execution requires explicit reexecution");

    const job=await this.canonical.job(jobId);this._validateJob(job);
    const aad={jobId:job.jobId,assignmentRef:job.assignmentRef,inputCommitment:job.inputCommitment};
    const payload=await this.privatePayloads.get(payloadId,{aad});
    try {
      if(!(await this.commitmentVerifier(payload,job.inputCommitment))) throw new Error("private payload commitment mismatch");
      const signedManifest=signObject420(this._manifest(job),this.signingKey);
      await this.stateStore.put({jobId,status:"executing",payloadId,manifestDigest:signedManifest.digest,signedManifest,assignmentRef:job.assignmentRef,updatedAt:this.now()});
      this.observe("info","execution_started",{jobId,assignmentRef:job.assignmentRef,manifestDigest:signedManifest.digest});
      const result=await this.executor.execute({job:structuredClone(job),payload,manifest:signedManifest});
      req(result?.resultCommitment,"resultCommitment");
      const receipt={
        domain:"420AI_PROVIDER_RECEIPT_V1",version:1,chainId:this.config.chainId,computeGraphHash:this.config.computeGraphHash,
        jobId,assignmentRef:job.assignmentRef,providerId:job.providerId,resourceId:job.resourceId,
        manifestDigest:signedManifest.digest,resultCommitment:result.resultCommitment,
        evidenceRef:result.evidenceRef??null,completedAt:this.now()
      };
      const signedReceipt=signObject420(receipt,this.signingKey), receiptId=digestObject420(signedReceipt.payload);
      const state={jobId,status:"pending_submit",payloadId,assignmentRef:job.assignmentRef,manifestDigest:signedManifest.digest,signedManifest,signedReceipt,receiptId,resultCommitment:result.resultCommitment,updatedAt:this.now()};
      await this.stateStore.put(state);
      return this._submitPending(state);
    } finally {
      if(Buffer.isBuffer(payload)) payload.fill(0);
    }
  }
  async retryExecution(jobId,payloadId) {
    return this.process(jobId,payloadId,{allowReexecute:true});
  }
  async resumeSubmission(jobId) {
    await this._environment();
    const state=await this.stateStore.get(jobId);
    if(state?.status==="submitted") return state;
    if(state?.status!=="pending_submit") throw new Error("no pending receipt submission");
    return this._submitPending(state);
  }
  async recover() {
    await this._environment();
    const recovered=[];
    for(const state of await this.stateStore.list()) {
      if(state.status==="submitted"||state.status==="terminal") continue;
      const job=await this.canonical.job(state.jobId);
      if(state.resultCommitment&&SUCCESS_STATES.has(job?.status)&&job.resultCommitment===state.resultCommitment) {
        const next={...state,status:"submitted",submission:{reconciled:true,restart:true},updatedAt:this.now()};await this.stateStore.put(next);recovered.push(next);continue;
      }
      if(TERMINAL_STATES.has(job?.status)) {
        const next={...state,status:"terminal",terminalStatus:job.status,updatedAt:this.now()};await this.stateStore.put(next);recovered.push(next);continue;
      }
      if(state.status==="pending_submit") {
        this._validatePersistedSubmission(state);
        const next={...state,recovery:"submission_pending",updatedAt:this.now()};await this.stateStore.put(next);recovered.push(next);continue;
      }
      const next={...state,status:"recoverable",recovery:"explicit_reexecution_required",updatedAt:this.now()};await this.stateStore.put(next);recovered.push(next);
    }
    this.observe("info","recovery_complete",{recovered:recovered.length});
    return recovered;
  }
  async health() {
    let environment="unknown";try{await this._environment();environment="ready";}catch{environment="degraded";}
    const states=await this.stateStore.list();
    return {authoritative:false,environment,jobs:states.length,pending:states.filter((x)=>!["submitted","terminal"].includes(x.status)).length,runtimeId:this.config.runtimeId};
  }
}

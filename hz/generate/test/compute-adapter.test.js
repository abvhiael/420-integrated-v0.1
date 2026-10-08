import test from "node:test";
import assert from "node:assert/strict";
import {
  ComputeMarketGenerationProvider420,
  DeterministicDevelopmentComputeClient420,
  GenerationJobManager420,
  selectComputeCandidate420
} from "../src/index.js";

const request=(overrides={})=>({
  prompt:"dark grunge song about static at dawn",
  lyrics:"radio snow / motel glow",
  controls:{genres:["grunge"],styles:["lo-fi"],moods:["melancholy"],instrumentation:["guitar","bass","drums"]},
  durationSec:180,mode:"VOCAL",...overrides
});
const candidate=(overrides={})=>({
  computeProviderId:"cmp:p1",workerId:"worker:1",resourceId:"gpu:1",modelId:"mock:music",modelVersion:"1.0.0",
  maxDurationSec:600,modes:["VOCAL","INSTRUMENTAL"],supportsLyrics:true,supportsReferenceAudio:true,
  referenceAudioPaths:["AUTHORIZED_STORAGE_REF"],outputKinds:["MIX","STEM","LYRICS_TIMING","ARTWORK"],
  availableCapacityUnits:"2",queueDepth:0,estimatedStartMs:0,quotedPrice:"420",quoteAsset:"$420",
  reputationScore:50,slaScore:50,finality:"safe",authoritative:false,...overrides
});
const auth=async(plan)=>"wallet-auth:"+plan.operationId;

test("capacity-aware selection prefers lower price before reputation and SLA",()=>{
  const selected=selectComputeCandidate420([
    candidate({computeProviderId:"expensive",quotedPrice:"500",reputationScore:100,slaScore:100}),
    candidate({computeProviderId:"cheap",quotedPrice:"400",availableCapacityUnits:"1",reputationScore:10,slaScore:10})
  ],request(),{modelId:"mock:music",modelVersion:"1.0.0",maximumPrice:"450"});
  assert.equal(selected.computeProviderId,"cheap");
});

test("capacity-aware selection rejects unavailable and over-budget workers",()=>{
  assert.throws(()=>selectComputeCandidate420([
    candidate({availableCapacityUnits:"0"}),candidate({computeProviderId:"over",quotedPrice:"421"})
  ],request(),{modelId:"mock:music",modelVersion:"1.0.0",maximumPrice:"420"}),e=>e.code==="NO_CAPACITY");
});

test("reputation and SLA are non-authoritative tie breakers only",()=>{
  const selected=selectComputeCandidate420([
    candidate({computeProviderId:"low",reputationScore:1,slaScore:1}),
    candidate({computeProviderId:"high",reputationScore:99,slaScore:99})
  ],request(),{modelId:"mock:music",modelVersion:"1.0.0"});
  assert.equal(selected.computeProviderId,"high");
  assert.throws(()=>selectComputeCandidate420([
    candidate({authoritative:true})
  ],request(),{modelId:"mock:music",modelVersion:"1.0.0"}),e=>e.code==="UNSUPPORTED_CAPABILITY");
});

test("development adapter uses the same GenerationJobManager lifecycle end to end",async()=>{
  let now=1000;
  const compute=new DeterministicDevelopmentComputeClient420({now:()=>now});
  const provider=new ComputeMarketGenerationProvider420({
    computeClient:compute,authorizeIntent:auth,chainId:"420",computeGraphHash:"dev:compute-graph:v1",maximumPrice:"500",now:()=>now
  });
  const manager=new GenerationJobManager420({now:()=>now});
  const draft=manager.create(request(),{timeoutMs:120000});
  const quoted=await manager.quote(draft.jobId,provider,{modelId:"mock:music",modelVersion:"1.0.0"});
  assert.equal(quoted.state,"QUOTED");
  assert.equal(quoted.quote.amount,"420");
  const submitted=await manager.submit(draft.jobId,provider);
  assert.equal(submitted.state,"SUBMITTED");
  assert.equal((await manager.poll(draft.jobId,provider)).state,"RUNNING");
  const succeeded=await manager.poll(draft.jobId,provider);
  assert.equal(succeeded.state,"SUCCEEDED");
  assert.deepEqual([...new Set(succeeded.outputManifest.artifacts.map(x=>x.kind))].sort(),["ARTWORK","LYRICS_TIMING","MIX","STEM"]);
  const execution=await provider.execution(submitted.providerJobRef);
  assert.equal(execution.status,"SETTLED");
  assert.equal(execution.verificationVerdict,"PASS");
  assert.ok(execution.verificationRef);
  assert.ok(execution.entitlementRef);
  assert.ok(execution.settlementRef);
});

test("submission requires an unsigned authorization plan before canonical submission",async()=>{
  const compute=new DeterministicDevelopmentComputeClient420();
  let seen=null;
  const provider=new ComputeMarketGenerationProvider420({
    computeClient:compute,authorizeIntent:async(plan)=>{seen=plan;return "wallet-auth:1";},
    chainId:"420",computeGraphHash:"dev:compute-graph:v1"
  });
  const manager=new GenerationJobManager420();
  const job=manager.create(request());
  await manager.quote(job.jobId,provider,{modelId:"mock:music",modelVersion:"1.0.0"});
  await manager.submit(job.jobId,provider);
  assert.equal(seen.requiresWalletAuthorization,true);
  assert.equal(seen.canonicalAuthority,false);
  assert.equal(seen.secretMaterialManaged,false);
});

test("missing authorization fails before Compute submission",async()=>{
  const compute=new DeterministicDevelopmentComputeClient420();
  const provider=new ComputeMarketGenerationProvider420({
    computeClient:compute,authorizeIntent:async()=>null,chainId:"420",computeGraphHash:"dev:compute-graph:v1"
  });
  const manager=new GenerationJobManager420();
  const job=manager.create(request());
  await manager.quote(job.jobId,provider,{modelId:"mock:music",modelVersion:"1.0.0"});
  await assert.rejects(()=>manager.submit(job.jobId,provider),e=>e.code==="PROVIDER_REJECTED");
  assert.equal(compute.jobs.size,0);
});

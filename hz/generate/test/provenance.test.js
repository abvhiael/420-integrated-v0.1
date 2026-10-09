import test from "node:test";
import assert from "node:assert/strict";
import {
  GenerationJobManager420,
  DeterministicMockGenerationProvider420,
  buildGenerationProvenance420,
  finalizeGenerationProvenance420,
  provenanceFromSucceededJob420,
  validateGenerationProvenance420
} from "../src/index.js";

const baseInput=(overrides={})=>({
  provenanceRecordId:"hzprov:1",
  creatorAccountRef:"wallet:creator:1",
  createdAt:1000,
  generationManifestHash:"manifest:1",
  provider:{providerId:"provider:1",providerRevision:"rev:1",modelId:"model:music",modelVersion:"1"},
  requestCommitment:"request:1",
  resultCommitment:"result:1",
  resultManifestHash:"result-manifest:1",
  verificationRef:"verify:1",
  aiDisclosureClass:"AI_GENERATED",
  declarationCommitment:"disclosure:1",
  source:{workIds:[],recordingIds:[],licenseIds:[],authorizationRefs:[],transformationAuthorizationRefs:[],trainingAuthorizationRefs:[]},
  syntheticVoiceClaim:false,
  voiceConsent:null,
  artifactCommitments:["sha256:mix"],
  ...overrides
});

test("builds public provenance without private prompt or lyric plaintext",()=>{
  const p=buildGenerationProvenance420(baseInput());
  assert.equal(p.schemaVersion,1);
  assert.equal(p.privateInputPolicy.promptPlaintextOffChain,true);
  assert.equal(p.privateInputPolicy.lyricsPlaintextOffChain,true);
  assert.equal(JSON.stringify(p).includes("private lyric"),false);
});

test("private prompt and lyrics keys are rejected from public provenance",()=>{
  assert.throws(()=>buildGenerationProvenance420({...baseInput(),prompt:"secret prompt"}),/cannot appear in public provenance/);
  assert.throws(()=>buildGenerationProvenance420({...baseInput(),nested:{lyrics:"secret lyrics"}}),/cannot appear in public provenance/);
});

test("AI_DERIVATIVE requires source identity, canonical source authorization and transformation permission",()=>{
  assert.throws(()=>buildGenerationProvenance420(baseInput({
    aiDisclosureClass:"AI_DERIVATIVE",
    source:{workIds:["work:1"],recordingIds:["recording:1"],licenseIds:["license:1"],authorizationRefs:["creative-auth:1"],transformationAuthorizationRefs:[],trainingAuthorizationRefs:["training:1"]}
  })),/requires transformation authorization/);

  const p=buildGenerationProvenance420(baseInput({
    aiDisclosureClass:"AI_DERIVATIVE",
    source:{workIds:["work:1"],recordingIds:["recording:1"],licenseIds:["license:1"],authorizationRefs:["creative-auth:1"],transformationAuthorizationRefs:["creative-transform:1"],trainingAuthorizationRefs:[]}
  }));
  assert.deepEqual(p.source.transformationAuthorizationRefs,["creative-transform:1"]);
  assert.deepEqual(p.source.trainingAuthorizationRefs,[]);
});

test("training permission never substitutes for Creative transformation authorization",()=>{
  assert.throws(()=>buildGenerationProvenance420(baseInput({
    aiDisclosureClass:"AI_DERIVATIVE",
    source:{workIds:["work:1"],recordingIds:[],licenseIds:[],authorizationRefs:["source-auth:1"],transformationAuthorizationRefs:[],trainingAuthorizationRefs:["ai-training-grant:1"]}
  })),/transformation authorization/);
});

test("synthetic voice/persona claims require active scoped consent evidence",()=>{
  assert.throws(()=>buildGenerationProvenance420(baseInput({syntheticVoiceClaim:true})),/requires explicit qualified consent evidence/);
  assert.throws(()=>buildGenerationProvenance420(baseInput({
    syntheticVoiceClaim:true,
    voiceConsent:{subjectRef:"performer:1",controllerRef:"controller:1",scopeCommitment:"scope:1",evidenceRef:"consent:1",status:"REVOKED",effectiveAt:800,checkedAt:900}
  })),/must be ACTIVE/);

  const p=buildGenerationProvenance420(baseInput({
    syntheticVoiceClaim:true,
    voiceConsent:{subjectRef:"performer:1",controllerRef:"controller:1",scopeCommitment:"scope:1",evidenceRef:"consent:1",status:"ACTIVE",effectiveAt:800,checkedAt:900,expiresAt:1200}
  }));
  assert.equal(p.voiceConsent.evidenceRef,"consent:1");
});

test("expired voice consent fails closed",()=>{
  assert.throws(()=>buildGenerationProvenance420(baseInput({
    syntheticVoiceClaim:true,
    voiceConsent:{subjectRef:"performer:1",controllerRef:"controller:1",scopeCommitment:"scope:1",evidenceRef:"consent:1",status:"ACTIVE",effectiveAt:800,checkedAt:1000,expiresAt:999}
  })),/expired/);
});

test("creator may publish explicit prompt/lyrics references without embedding private plaintext",()=>{
  const p=buildGenerationProvenance420(baseInput({
    creatorPublishedInputRefs:{promptRef:"public://prompt/1",lyricsRef:"public://lyrics/1"}
  }));
  assert.equal(p.creatorPublishedInputRefs.promptRef,"public://prompt/1");
  assert.equal("prompt" in p,false);
  assert.equal("lyrics" in p,false);
});

test("publication finalizes exact immutable provenance version and Creative linkage",()=>{
  const draft=buildGenerationProvenance420(baseInput());
  const published=finalizeGenerationProvenance420(draft,{
    creatorProfileId:"creator:1",
    workId:"work:published:1",
    recordingId:"recording:published:1",
    creativeProvenanceCommitment:"creative-prov:1",
    authorizationManifestCommitment:"auth-manifest:1",
    publishedAt:1100
  });
  assert.ok(published.publication.publishedProvenanceCommitment);
  assert.equal(published.provenanceVersion,1);
  assert.equal(published.publication.recordingId,"recording:published:1");
  assert.throws(()=>finalizeGenerationProvenance420(published,{
    creatorProfileId:"creator:1",workId:"work:2",recordingId:"recording:2",creativeProvenanceCommitment:"x",authorizationManifestCommitment:"y",publishedAt:1200
  }),/unpublished provenance cannot carry publication state|published provenance is immutable/);
});

test("tampering with a published provenance snapshot fails commitment validation",()=>{
  const published=finalizeGenerationProvenance420(buildGenerationProvenance420(baseInput()),{
    creatorProfileId:"creator:1",workId:"work:1",recordingId:"recording:1",creativeProvenanceCommitment:"creative:1",authorizationManifestCommitment:"auth:1",publishedAt:1100
  });
  const tampered=structuredClone(published);
  tampered.resultCommitment="result:tampered";
  assert.throws(()=>validateGenerationProvenance420(tampered,{published:true}),/published provenance commitment mismatch/);
});

test("SUCCEEDED generation job yields provenance bound to provider/model/request/result/artifacts",async()=>{
  let now=1000;
  const provider=new DeterministicMockGenerationProvider420({now:()=>now,providerId:"mock:420hz",providerRevision:"rev:1",modelId:"mock:music",modelVersion:"1.0.0"});
  const manager=new GenerationJobManager420({now:()=>now});
  const job=manager.create({prompt:"private generation prompt",lyrics:"private lyric draft",durationSec:180,mode:"VOCAL",controls:{}});
  await manager.quote(job.jobId,provider,{modelId:"mock:music",modelVersion:"1.0.0"});
  await manager.submit(job.jobId,provider);
  now=1100;
  const done=await manager.poll(job.jobId,provider);
  assert.equal(done.state,"SUCCEEDED");
  assert.ok(done.executionEvidence.resultCommitment);
  const p=provenanceFromSucceededJob420(done,{
    creatorAccountRef:"wallet:creator:1",
    createdAt:1100,
    aiDisclosureClass:"AI_GENERATED",
    declarationCommitment:"disclosure:generated:1"
  });
  assert.equal(p.provider.providerId,"mock:420hz");
  assert.equal(p.provider.modelVersion,"1.0.0");
  assert.equal(p.requestCommitment,done.requestDigest);
  assert.equal(p.resultCommitment,done.executionEvidence.resultCommitment);
  assert.equal(p.verificationRef,done.executionEvidence.verificationRef);
  assert.equal(p.artifactCommitments.length,4);
  const encoded=JSON.stringify(p);
  assert.equal(encoded.includes("private generation prompt"),false);
  assert.equal(encoded.includes("private lyric draft"),false);
});

test("provenance cannot be created from unfinished generation",()=>{
  const manager=new GenerationJobManager420({now:()=>1000});
  const job=manager.create({prompt:"x",durationSec:180,mode:"INSTRUMENTAL",controls:{}});
  assert.throws(()=>provenanceFromSucceededJob420(job,{creatorAccountRef:"wallet:1",aiDisclosureClass:"AI_GENERATED",declarationCommitment:"d"}),/SUCCEEDED generation job/);
});

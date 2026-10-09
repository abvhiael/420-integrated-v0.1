import test from "node:test";
import assert from "node:assert/strict";
import {
  DeterministicCreativeKernel420,
  DeterministicMockGenerationProvider420,
  GenerationJobManager420,
  ProjectWorkspace420,
  RegisterPublishCoordinator420,
  provenanceFromSucceededJob420
} from "../src/index.js";

const DAY=24*60*60*1000;

async function generatedFixture({nowRef={value:1000},prompt="dark grunge song"}={}){
  const now=()=>nowRef.value;
  const provider=new DeterministicMockGenerationProvider420({now});
  const manager=new GenerationJobManager420({now});
  const job=manager.create({prompt,lyrics:"private draft",durationSec:180,mode:"VOCAL",controls:{genres:["grunge"],styles:[],moods:[],instrumentation:[]}});
  await manager.quote(job.jobId,provider,{modelId:"mock:music",modelVersion:"1.0.0"});
  await manager.submit(job.jobId,provider);
  nowRef.value+=100;
  const done=await manager.poll(job.jobId,provider);
  const ws=new ProjectWorkspace420({now});
  const project=ws.createProject({ownerRef:"wallet:artist",title:"generated song",lyricsDraft:"private draft"});
  const take=ws.recordGeneration(project.projectId,"wallet:artist",done,{saveArtifacts:true});
  ws.selectTake(project.projectId,"wallet:artist",take.takeId);
  const provenance=provenanceFromSucceededJob420(done,{
    creatorAccountRef:"wallet:artist",
    createdAt:nowRef.value,
    aiDisclosureClass:"AI_GENERATED",
    declarationCommitment:"disclosure:generated:v1"
  });
  return {now,provider,manager,done,ws,project,take:ws.getProject(project.projectId,"wallet:artist").takes.find(x=>x.takeId===take.takeId),provenance};
}

function publishRequest(f,{recordingClass="ORIGINAL",parentRecordingId=null,authorizationEvidence=null,sourceLicenseRef=null}={}){
  return {
    creator:{ownerRef:"wallet:artist",identityType:"ARTIST_PROJECT",metadataHash:"creator-meta:artist"},
    generationProvenance:f.provenance,
    selectedTake:f.take,
    work:{
      compositionHash:"composition:"+f.done.requestDigest,
      metadataHash:"work-meta:generated-song",
      provenanceClass:"NATIVE_VERIFIED",
      rightsStatus:"RIGHTS_VERIFIED"
    },
    workCredits:[{profileRef:"SELF",roleSchemaVersion:1,roleCode:1,accepted:true}],
    workRightsSplit:[{profileRef:"SELF",bps:10000,accepted:true}],
    recording:{
      recordingClass,
      masterHash:f.take.artifacts.find(a=>a.kind==="MIX")?.integrity??"master:mix",
      metadataHash:"recording-meta:generated-song",
      mediaManifestHash:"media-manifest:generated-song",
      authorizationManifestHash:recordingClass==="ORIGINAL"?"authorization:none":"authorization:derivative",
      royaltyScheduleVersion:1,
      authorizationPolicyVersion:recordingClass==="ORIGINAL"?0:1,
      parentRecordingId,
      sourceLicenseRef,
      authorizationEvidence
    },
    recordingCredits:[{profileRef:"SELF",roleSchemaVersion:1,roleCode:1,accepted:true}],
    recordingRightsSplit:[{profileRef:"SELF",bps:10000,accepted:true}],
    media:{
      manifestHash:"media-manifest:generated-song",
      masterContentHash:f.take.artifacts.find(a=>a.kind==="MIX")?.integrity??"master:mix",
      technicalMetadataHash:"technical:generated-song",
      storageLocatorHash:"storage-locator:generated-song",
      durationMs:180000,
      storageSources:[{
        providerKey:"hz-private",
        locatorHash:"storage-locator:generated-song",
        contentHash:f.take.artifacts.find(a=>a.kind==="MIX")?.integrity??"master:mix",
        integrityHash:f.take.artifacts.find(a=>a.kind==="MIX")?.integrity??"master:mix",
        priority:0
      }]
    },
    release:{title:"Generated Song",releaseType:"SINGLE",artworkHash:"artwork:generated-song"}
  };
}

test("complete Generate -> Work -> Recording -> Release flow publishes one release",async()=>{
  const ref={value:1000},f=await generatedFixture({nowRef:ref});
  ref.value+=100;
  const kernel=new DeterministicCreativeKernel420({now:()=>ref.value});
  const coordinator=new RegisterPublishCoordinator420({kernel,now:()=>ref.value});
  const out=coordinator.publish(publishRequest(f));
  assert.equal(out.status,"PUBLISHED");
  assert.deepEqual(out.completedStages,[
    "PROFILE_READY","WORK_REGISTERED","WORK_RIGHTS_FINALIZED","WORK_ACTIVE","RECORDING_REGISTERED",
    "RECORDING_RIGHTS_FINALIZED","RECORDING_ACTIVE","MEDIA_PUBLISHED","PROVENANCE_FINALIZED","RELEASE_DRAFT","RELEASE_PUBLISHED"
  ]);
  assert.equal(kernel.works.get(out.refs.workId).status,"ACTIVE");
  assert.equal(kernel.recordings.get(out.refs.recordingId).status,"ACTIVE");
  assert.equal(kernel.releases.get(out.refs.releaseId).status,"PUBLISHED");
  assert.equal(kernel.releases.get(out.refs.releaseId).tracks[0],out.refs.recordingId);
  assert.equal(out.publishedProvenance.publication.workId,out.refs.workId);
  assert.equal(out.publishedProvenance.publication.recordingId,out.refs.recordingId);
  assert.equal(kernel.releases.get(out.refs.releaseId).aiDisclosureClass,"AI_GENERATED");
});

test("create-or-select Creator Profile reuses the authorized owner profile",async()=>{
  const f=await generatedFixture(),kernel=new DeterministicCreativeKernel420({now:f.now});
  const existing=kernel.selectOrCreateProfile({ownerRef:"wallet:artist",identityType:"ARTIST_PROJECT",metadataHash:"creator-meta:artist"});
  const coordinator=new RegisterPublishCoordinator420({kernel,now:f.now});
  const req=publishRequest(f);req.creator.existingCreatorId=existing.creatorId;
  const out=coordinator.publish(req);
  assert.equal(out.refs.creatorId,existing.creatorId);
  assert.equal(kernel.profiles.size,1);
});

test("rights splits require exactly 10000 bps and explicit holder acceptance",async()=>{
  const f=await generatedFixture(),coordinator=new RegisterPublishCoordinator420();
  const badTotal=publishRequest(f);badTotal.workRightsSplit=[{profileRef:"SELF",bps:9999,accepted:true}];
  assert.throws(()=>coordinator.publish(badTotal),/10000 bps/);
  const unaccepted=publishRequest(f);unaccepted.recordingRightsSplit=[{profileRef:"SELF",bps:10000,accepted:false}];
  assert.throws(()=>coordinator.publish(unaccepted),/explicitly accept/);
});

test("contributor credits are explicit and accepted before publication evidence closes",async()=>{
  const f=await generatedFixture(),kernel=new DeterministicCreativeKernel420(),coordinator=new RegisterPublishCoordinator420({kernel});
  const out=coordinator.publish(publishRequest(f));
  const workCredits=[...kernel.credits.values()].filter(x=>x.assetType==="WORK"&&x.assetId===out.refs.workId);
  const recordingCredits=[...kernel.credits.values()].filter(x=>x.assetType==="RECORDING"&&x.assetId===out.refs.recordingId);
  assert.equal(workCredits.length,1);assert.equal(workCredits[0].status,"ACCEPTED");
  assert.equal(recordingCredits.length,1);assert.equal(recordingCredits[0].status,"ACCEPTED");
});

test("AI disclosure is published without changing the generation declaration",async()=>{
  const f=await generatedFixture(),kernel=new DeterministicCreativeKernel420(),coordinator=new RegisterPublishCoordinator420({kernel});
  const out=coordinator.publish(publishRequest(f));
  const recording=kernel.recordings.get(out.refs.recordingId),release=kernel.releases.get(out.refs.releaseId);
  assert.equal(recording.aiDisclosureClass,f.provenance.aiDisclosureClass);
  assert.equal(release.aiDisclosureClass,f.provenance.aiDisclosureClass);
  assert.equal(out.publishedProvenance.aiDisclosureClass,f.provenance.aiDisclosureClass);
});

test("published generation provenance is immutable and bound to Creative IDs",async()=>{
  const f=await generatedFixture(),coordinator=new RegisterPublishCoordinator420();
  const out=coordinator.publish(publishRequest(f));
  assert.ok(out.refs.publishedProvenanceCommitment);
  assert.equal(out.publishedProvenance.publication.publishedProvenanceCommitment,out.refs.publishedProvenanceCommitment);
  const tampered=structuredClone(out.publishedProvenance);tampered.publication.recordingId="recording:evil";
  assert.notEqual(tampered.publication.recordingId,out.publishedProvenance.publication.recordingId);
  assert.equal(out.publishedProvenance.publication.recordingId,out.refs.recordingId);
});

test("derivative Recording fails closed without exact source authorization",async()=>{
  const ref={value:1000},f=await generatedFixture({nowRef:ref}),kernel=new DeterministicCreativeKernel420({now:()=>ref.value}),coordinator=new RegisterPublishCoordinator420({kernel,now:()=>ref.value});
  const original=coordinator.publish(publishRequest(f));
  ref.value+=100;
  const f2=await generatedFixture({nowRef:ref,prompt:"derivative"});
  f2.provenance={...f2.provenance,aiDisclosureClass:"AI_DERIVATIVE",source:{
    workIds:[original.refs.workId],recordingIds:[original.refs.recordingId],licenseIds:[],
    authorizationRefs:["creative-auth:source"],transformationAuthorizationRefs:["creative-transform:1"],trainingAuthorizationRefs:[]
  }};
  const req=publishRequest(f2,{recordingClass:"AI_DERIVATIVE",parentRecordingId:original.refs.recordingId,authorizationEvidence:{allowed:false,authorizationRef:"creative-auth:source",transformationPermission:true}});
  assert.throws(()=>coordinator.publish(req),e=>e.code==="REFERENCE_AUDIO_NOT_AUTHORIZED");
  assert.equal([...kernel.releases.values()].filter(x=>x.status==="PUBLISHED").length,1);
});

test("AI derivative requires Creative transformation permission even if another authorization exists",async()=>{
  const ref={value:1000},f=await generatedFixture({nowRef:ref}),kernel=new DeterministicCreativeKernel420({now:()=>ref.value}),coordinator=new RegisterPublishCoordinator420({kernel,now:()=>ref.value});
  const original=coordinator.publish(publishRequest(f));
  ref.value+=100;
  const f2=await generatedFixture({nowRef:ref,prompt:"derivative"});
  f2.provenance={...f2.provenance,aiDisclosureClass:"AI_DERIVATIVE",source:{
    workIds:[original.refs.workId],recordingIds:[original.refs.recordingId],licenseIds:[],
    authorizationRefs:["creative-auth:source"],transformationAuthorizationRefs:["creative-transform:1"],trainingAuthorizationRefs:["training:1"]
  }};
  const req=publishRequest(f2,{recordingClass:"AI_DERIVATIVE",parentRecordingId:original.refs.recordingId,authorizationEvidence:{allowed:true,authorizationRef:"creative-auth:source",transformationPermission:false,trainingPermission:true}});
  assert.throws(()=>coordinator.publish(req),e=>e.code==="REFERENCE_AUDIO_NOT_AUTHORIZED");
});

test("generation success never implies registration or release success",async()=>{
  const f=await generatedFixture(),kernel=new DeterministicCreativeKernel420(),coordinator=new RegisterPublishCoordinator420({kernel});
  const req=publishRequest(f);
  assert.throws(()=>coordinator.publish(req,{failAt:"RECORDING_ACTIVE"}),e=>e.code==="PROVIDER_UNAVAILABLE");
  assert.equal([...kernel.releases.values()].filter(x=>x.status==="PUBLISHED").length,0);
  assert.equal(f.done.state,"SUCCEEDED");
});

test("retry resumes failed publication attempt without duplicating Work or Recording",async()=>{
  const f=await generatedFixture(),kernel=new DeterministicCreativeKernel420(),coordinator=new RegisterPublishCoordinator420({kernel});
  const req=publishRequest(f);
  assert.throws(()=>coordinator.publish(req,{failAt:"MEDIA_PUBLISHED"}),e=>e.code==="PROVIDER_UNAVAILABLE");
  const worksBefore=kernel.works.size,recordingsBefore=kernel.recordings.size;
  const out=coordinator.publish(req);
  assert.equal(out.status,"PUBLISHED");
  assert.equal(kernel.works.size,worksBefore);
  assert.equal(kernel.recordings.size,recordingsBefore);
  assert.equal(kernel.releases.size,1);
});

test("replay of an already-published request is idempotent",async()=>{
  const f=await generatedFixture(),kernel=new DeterministicCreativeKernel420(),coordinator=new RegisterPublishCoordinator420({kernel});
  const req=publishRequest(f),a=coordinator.publish(req),b=coordinator.publish(req);
  assert.equal(a.requestId,b.requestId);assert.equal(a.refs.releaseId,b.refs.releaseId);
  assert.equal(kernel.works.size,1);assert.equal(kernel.recordings.size,1);assert.equal(kernel.releases.size,1);
});

test("media/storage publication occurs only after Recording activation",()=>{
  const kernel=new DeterministicCreativeKernel420();
  const profile=kernel.selectOrCreateProfile({ownerRef:"wallet:a",metadataHash:"meta"});
  const work=kernel.registerWork({creatorId:profile.creatorId,compositionHash:"comp",metadataHash:"wm",provenanceHash:"prov"});
  kernel.finalizeSplit("WORK",work.workId,[{profileRef:profile.creatorId,bps:10000,accepted:true}]);kernel.activateWork(work.workId);
  const recording=kernel.registerRecording({creatorId:profile.creatorId,workId:work.workId,recordingClass:"ORIGINAL",masterHash:"master",metadataHash:"rm",provenanceHash:"prov",mediaManifestHash:"mm",aiDisclosureClass:"AI_GENERATED"});
  assert.throws(()=>kernel.publishMedia({recordingId:recording.recordingId,manifestHash:"mm",masterContentHash:"master",technicalMetadataHash:"tech",storageLocatorHash:"loc",provenanceHash:"prov",durationMs:1000,storageSources:[{providerKey:"p",locatorHash:"l",contentHash:"c",integrityHash:"i"}]}),/must be ACTIVE/);
});

test("Register & Publish rejects unsaved or incomplete selected takes",async()=>{
  const f=await generatedFixture(),coordinator=new RegisterPublishCoordinator420();
  const req=publishRequest(f);req.selectedTake={...req.selectedTake,saved:false};
  assert.throws(()=>coordinator.publish(req),/saved COMPLETE take with MIX/);
  const req2=publishRequest(f);req2.selectedTake={...req2.selectedTake,status:"FAILED"};
  assert.throws(()=>coordinator.publish(req2),/saved COMPLETE take with MIX/);
});

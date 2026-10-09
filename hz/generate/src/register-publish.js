import { digest420 } from "./schema.js";
import { GenerationError420 } from "./errors.js";
import { finalizeGenerationProvenance420, validateGenerationProvenance420 } from "./provenance.js";

export const CREATIVE_RECORDING_CLASSES_420=Object.freeze(["ORIGINAL","COVER","REMIX","STEM_REMIX","SAMPLE_DERIVATIVE","AI_DERIVATIVE","LIVE","ACOUSTIC","REMASTER","RADIO_EDIT","CLEAN_EDIT","SPATIAL","RESTORATION","OTHER"]);
export const PUBLICATION_STAGES_420=Object.freeze(["PROFILE_READY","WORK_REGISTERED","WORK_RIGHTS_FINALIZED","WORK_ACTIVE","RECORDING_REGISTERED","RECORDING_RIGHTS_FINALIZED","RECORDING_ACTIVE","MEDIA_PUBLISHED","PROVENANCE_FINALIZED","RELEASE_DRAFT","RELEASE_PUBLISHED"]);
const DERIVATIVE=new Set(["COVER","REMIX","STEM_REMIX","SAMPLE_DERIVATIVE","AI_DERIVATIVE"]);
const SOURCE_REQUIRED=new Set(["REMIX","STEM_REMIX","SAMPLE_DERIVATIVE","AI_DERIVATIVE"]);
const clone=v=>structuredClone(v);
const req=(v,n)=>{if(v===undefined||v===null||v==="")throw new GenerationError420("INVALID_REQUEST",n+" is required");return v;};
const arr=(v,n)=>{if(!Array.isArray(v)||!v.length)throw new GenerationError420("INVALID_REQUEST",n+" must be a non-empty array");return v;};
const id=(prefix,obj)=>prefix+":"+digest420(obj);

function normalizeSplit(split,name){
  const x=arr(split,name).map((h,i)=>({
    profileRef:String(req(h.profileRef,`${name}[${i}].profileRef`)),
    bps:Number(h.bps),
    accepted:Boolean(h.accepted)
  }));
  if(x.some(h=>!Number.isInteger(h.bps)||h.bps<=0||h.bps>10000))throw new GenerationError420("INVALID_REQUEST",name+" contains invalid bps");
  if(new Set(x.map(h=>h.profileRef)).size!==x.length)throw new GenerationError420("INVALID_REQUEST",name+" contains duplicate holder");
  const total=x.reduce((n,h)=>n+h.bps,0);if(total!==10000)throw new GenerationError420("INVALID_REQUEST",name+" must total 10000 bps");
  return x;
}
function normalizeCredits(credits,name){
  return arr(credits,name).map((c,i)=>({
    profileRef:String(req(c.profileRef,`${name}[${i}].profileRef`)),
    roleSchemaVersion:Number(c.roleSchemaVersion??1),
    roleCode:Number(req(c.roleCode,`${name}[${i}].roleCode`)),
    accepted:Boolean(c.accepted)
  }));
}
function authorizationRequired(recordingClass){return DERIVATIVE.has(recordingClass);}
function sourceRequired(recordingClass){return SOURCE_REQUIRED.has(recordingClass);}

export class DeterministicCreativeKernel420 {
  constructor({now=()=>Date.now()}={}){
    this.now=now;this.profiles=new Map();this.profileByOwner=new Map();this.works=new Map();this.recordings=new Map();
    this.credits=new Map();this.splits=new Map();this.media=new Map();this.storageSources=new Map();this.releases=new Map();
  }
  selectOrCreateProfile({ownerRef,existingCreatorId=null,identityType="ARTIST_PROJECT",metadataHash}){
    const owner=String(req(ownerRef,"ownerRef"));
    if(existingCreatorId){
      const p=this.profiles.get(String(existingCreatorId));
      if(!p||p.ownerRef!==owner||p.status!=="ACTIVE")throw new GenerationError420("PROVIDER_REJECTED","Creator Profile selection is unauthorized");
      return clone(p);
    }
    const prior=this.profileByOwner.get(owner);if(prior)return clone(this.profiles.get(prior));
    const creatorId=id("creator",{owner,identityType,metadataHash:String(req(metadataHash,"creator metadataHash"))});
    const p=Object.freeze({creatorId,ownerRef:owner,identityType,metadataHash,status:"ACTIVE",createdAt:this.now()});
    this.profiles.set(creatorId,p);this.profileByOwner.set(owner,creatorId);return clone(p);
  }
  registerWork({creatorId,compositionHash,metadataHash,provenanceHash,provenanceClass="NATIVE_VERIFIED",rightsStatus="RIGHTS_VERIFIED"}){
    this.#profile(creatorId);req(compositionHash,"compositionHash");req(provenanceHash,"provenanceHash");
    const workId=id("work",{creatorId,compositionHash,metadataHash,provenanceHash});
    if(!this.works.has(workId))this.works.set(workId,{workId,creatorId,compositionHash,metadataHash,provenanceHash,provenanceClass,rightsStatus,status:"PROVISIONAL",createdAt:this.now()});
    return clone(this.works.get(workId));
  }
  proposeCredits(assetType,assetId,credits){
    const out=[];for(const c of normalizeCredits(credits,"credits")){
      this.#profile(c.profileRef);
      const creditId=id("credit",{assetType,assetId,...c});
      const credit={creditId,assetType,assetId,...c,status:c.accepted?"ACCEPTED":"PROPOSED"};
      this.credits.set(creditId,credit);out.push(clone(credit));
    }return out;
  }
  finalizeSplit(assetType,assetId,split){
    const holders=normalizeSplit(split,"rightsSplit");
    if(holders.some(h=>!h.accepted))throw new GenerationError420("PROVIDER_REJECTED","every rights holder must explicitly accept before finalization");
    for(const h of holders)this.#profile(h.profileRef);
    const key=assetType+":"+assetId;
    const prior=this.splits.get(key);if(prior?.status==="FINALIZED")return clone(prior);
    const state=Object.freeze({assetType,assetId,status:"FINALIZED",rightsVersion:1,splitHash:id("split",{assetType,assetId,holders}),holders});
    this.splits.set(key,state);return clone(state);
  }
  activateWork(workId){
    const w=this.#work(workId);if(!this.#splitFinal("WORK",workId))throw new GenerationError420("PROVIDER_REJECTED","Work rights split is not finalized");
    w.status="ACTIVE";return clone(w);
  }
  registerRecording({creatorId,workId,recordingClass,masterHash,metadataHash,provenanceHash,mediaManifestHash,authorizationManifestHash=null,royaltyScheduleVersion=1,authorizationPolicyVersion=0,parentRecordingId=null,sourceLicenseRef=null,authorizationEvidence=null,aiDisclosureClass}){
    this.#profile(creatorId);const w=this.#work(workId);if(w.status!=="ACTIVE")throw new GenerationError420("PROVIDER_REJECTED","Work must be ACTIVE before Recording registration");
    if(!CREATIVE_RECORDING_CLASSES_420.includes(recordingClass))throw new GenerationError420("INVALID_REQUEST","unknown recordingClass");
    if(recordingClass==="ORIGINAL"&&parentRecordingId)throw new GenerationError420("INVALID_REQUEST","ORIGINAL cannot have source Recording");
    if(sourceRequired(recordingClass)&&!parentRecordingId)throw new GenerationError420("REFERENCE_AUDIO_NOT_AUTHORIZED","derivative Recording requires source Recording");
    if(parentRecordingId)this.#recording(parentRecordingId);
    if(authorizationRequired(recordingClass)){
      if(!authorizationEvidence?.allowed||!authorizationEvidence?.authorizationRef)throw new GenerationError420("REFERENCE_AUDIO_NOT_AUTHORIZED","derivative/source authorization failed");
      if(recordingClass==="AI_DERIVATIVE"&&!authorizationEvidence.transformationPermission)throw new GenerationError420("REFERENCE_AUDIO_NOT_AUTHORIZED","AI derivative requires Creative transformation permission");
    }
    const recordingId=id("recording",{creatorId,workId,recordingClass,masterHash,metadataHash,provenanceHash,mediaManifestHash,authorizationManifestHash,parentRecordingId});
    if(!this.recordings.has(recordingId))this.recordings.set(recordingId,{
      recordingId,creatorId,workId,recordingClass,masterHash:req(masterHash,"masterHash"),metadataHash,
      provenanceHash:req(provenanceHash,"provenanceHash"),mediaManifestHash:req(mediaManifestHash,"mediaManifestHash"),
      authorizationManifestHash,royaltyScheduleVersion,authorizationPolicyVersion,parentRecordingId,sourceLicenseRef,
      authorizationEvidence:authorizationEvidence?clone(authorizationEvidence):null,aiDisclosureClass,status:"PROVISIONAL",createdAt:this.now()
    });
    return clone(this.recordings.get(recordingId));
  }
  activateRecording(recordingId){
    const r=this.#recording(recordingId);if(!this.#splitFinal("RECORDING",recordingId))throw new GenerationError420("PROVIDER_REJECTED","Recording rights split is not finalized");
    if(authorizationRequired(r.recordingClass)&&!r.authorizationEvidence?.allowed)throw new GenerationError420("REFERENCE_AUDIO_NOT_AUTHORIZED","Recording activation lacks derivative authorization");
    r.status="ACTIVE";return clone(r);
  }
  publishMedia({recordingId,manifestHash,masterContentHash,technicalMetadataHash,storageLocatorHash,provenanceHash,durationMs,storageSources}){
    const r=this.#recording(recordingId);if(r.status!=="ACTIVE")throw new GenerationError420("PROVIDER_REJECTED","Recording must be ACTIVE before media publication");
    if(!Number.isInteger(durationMs)||durationMs<=0)throw new GenerationError420("INVALID_REQUEST","durationMs invalid");
    const media=Object.freeze({recordingId,manifestHash:req(manifestHash,"manifestHash"),masterContentHash:req(masterContentHash,"masterContentHash"),technicalMetadataHash:req(technicalMetadataHash,"technicalMetadataHash"),storageLocatorHash:req(storageLocatorHash,"storageLocatorHash"),provenanceHash:req(provenanceHash,"provenanceHash"),durationMs,revision:1});
    this.media.set(recordingId,media);
    const sources=arr(storageSources,"storageSources").map((s,i)=>Object.freeze({
      sourceId:i+1,providerKey:String(req(s.providerKey,`storageSources[${i}].providerKey`)),
      locatorHash:String(req(s.locatorHash,`storageSources[${i}].locatorHash`)),contentHash:String(req(s.contentHash,`storageSources[${i}].contentHash`)),
      integrityHash:String(req(s.integrityHash,`storageSources[${i}].integrityHash`)),priority:Number(s.priority??i),state:"ACTIVE"
    }));
    this.storageSources.set(recordingId,sources);return {media:clone(media),storageSources:clone(sources)};
  }
  createRelease({creatorId,releaseType="SINGLE",metadataHash,artworkHash,aiDisclosureClass,publishedProvenanceCommitment}){
    this.#profile(creatorId);const releaseId=id("release",{creatorId,releaseType,metadataHash,artworkHash,publishedProvenanceCommitment});
    if(!this.releases.has(releaseId))this.releases.set(releaseId,{releaseId,creatorId,releaseType,metadataHash:req(metadataHash,"release metadataHash"),artworkHash:req(artworkHash,"artworkHash"),aiDisclosureClass,publishedProvenanceCommitment,status:"DRAFT",tracks:[],createdAt:this.now(),publishedAt:null});
    return clone(this.releases.get(releaseId));
  }
  addTrack(releaseId,recordingId){
    const rel=this.#release(releaseId),r=this.#recording(recordingId);if(rel.status!=="DRAFT"||r.status!=="ACTIVE")throw new GenerationError420("PROVIDER_REJECTED","release track requires DRAFT release and ACTIVE Recording");
    if(!rel.tracks.includes(recordingId))rel.tracks.push(recordingId);return clone(rel);
  }
  publishRelease(releaseId){
    const rel=this.#release(releaseId);if(rel.status!=="DRAFT"||!rel.tracks.length)throw new GenerationError420("PROVIDER_REJECTED","release is not publishable");
    for(const rid of rel.tracks)if(this.#recording(rid).status!=="ACTIVE"||!this.media.has(rid))throw new GenerationError420("PROVIDER_REJECTED","all release tracks require active Recording and media manifest");
    rel.status="PUBLISHED";rel.publishedAt=this.now();return clone(rel);
  }
  #profile(id_){const x=this.profiles.get(String(id_));if(!x)throw new GenerationError420("PROVIDER_REJECTED","Creator Profile not found");return x;}
  #work(id_){const x=this.works.get(String(id_));if(!x)throw new GenerationError420("PROVIDER_REJECTED","Work not found");return x;}
  #recording(id_){const x=this.recordings.get(String(id_));if(!x)throw new GenerationError420("PROVIDER_REJECTED","Recording not found");return x;}
  #release(id_){const x=this.releases.get(String(id_));if(!x)throw new GenerationError420("PROVIDER_REJECTED","Release not found");return x;}
  #splitFinal(t,id_){return this.splits.get(t+":"+id_)?.status==="FINALIZED";}
}

export class RegisterPublishCoordinator420 {
  constructor({kernel=new DeterministicCreativeKernel420(),now=()=>Date.now(),verifyCreativeRights=null,production=false}={}){if(production&&typeof verifyCreativeRights!=="function")throw new GenerationError420("INVALID_REQUEST","Creative rights verifier required");this.kernel=kernel;this.now=now;this.verifyCreativeRights=verifyCreativeRights;this.production=production;this.attempts=new Map();}
  publish(input,{failAt=null}={}){
    const request=this.#normalize(input),requestId="hzpublish:"+digest420(request);
    if(this.production&&this.verifyCreativeRights({creator:request.creator,recording:request.recording,provenance:request.generationProvenance,at:this.now(),action:"PUBLISH"})!==true)throw new GenerationError420("REFERENCE_AUDIO_NOT_AUTHORIZED","Creative rights revoked, expired or unverified");
    let a=this.attempts.get(requestId);
    if(a?.status==="PUBLISHED")return clone(a);
    if(!a)a={requestId,status:"RUNNING",completedStages:[],refs:{},error:null,startedAt:this.now(),updatedAt:this.now()};
    else {a.status="RUNNING";a.error=null;a.updatedAt=this.now();}
    const stage=(name,fn)=>{
      if(a.completedStages.includes(name))return;
      if(failAt===name)throw new GenerationError420("PROVIDER_UNAVAILABLE","injected publication-stage failure",{retryable:true,details:{stage:name}});
      const value=fn();a.completedStages.push(name);a.updatedAt=this.now();return value;
    };
    try{
      let profile;
      stage("PROFILE_READY",()=>{profile=this.kernel.selectOrCreateProfile(request.creator);a.refs.creatorId=profile.creatorId;});
      if(!profile)profile=this.kernel.profiles.get(a.refs.creatorId);

      const resolveSelf=list=>list.map(x=>({...x,profileRef:x.profileRef==="SELF"?a.refs.creatorId:x.profileRef}));
      stage("WORK_REGISTERED",()=>{const w=this.kernel.registerWork({...request.work,creatorId:a.refs.creatorId,provenanceHash:request.generationProvenanceCommitment});a.refs.workId=w.workId;this.kernel.proposeCredits("WORK",w.workId,resolveSelf(request.workCredits));});
      stage("WORK_RIGHTS_FINALIZED",()=>this.kernel.finalizeSplit("WORK",a.refs.workId,resolveSelf(request.workRightsSplit)));
      stage("WORK_ACTIVE",()=>this.kernel.activateWork(a.refs.workId));

      stage("RECORDING_REGISTERED",()=>{const r=this.kernel.registerRecording({...request.recording,creatorId:a.refs.creatorId,workId:a.refs.workId,provenanceHash:request.generationProvenanceCommitment,aiDisclosureClass:request.generationProvenance.aiDisclosureClass});a.refs.recordingId=r.recordingId;this.kernel.proposeCredits("RECORDING",r.recordingId,resolveSelf(request.recordingCredits));});
      stage("RECORDING_RIGHTS_FINALIZED",()=>this.kernel.finalizeSplit("RECORDING",a.refs.recordingId,resolveSelf(request.recordingRightsSplit)));
      stage("RECORDING_ACTIVE",()=>this.kernel.activateRecording(a.refs.recordingId));
      stage("MEDIA_PUBLISHED",()=>{const m=this.kernel.publishMedia({...request.media,recordingId:a.refs.recordingId,provenanceHash:request.generationProvenanceCommitment});a.refs.mediaManifestHash=m.media.manifestHash;a.refs.storageSourceIds=m.storageSources.map(x=>x.sourceId);});

      stage("PROVENANCE_FINALIZED",()=>{
        const p=finalizeGenerationProvenance420(request.generationProvenance,{
          creatorProfileId:a.refs.creatorId,workId:a.refs.workId,recordingId:a.refs.recordingId,
          creativeProvenanceCommitment:request.generationProvenanceCommitment,
          authorizationManifestCommitment:request.recording.authorizationManifestHash??"authorization:none",
          publishedAt:this.now()
        });
        a.refs.publishedProvenanceCommitment=p.publication.publishedProvenanceCommitment;a.publishedProvenance=p;
      });
      stage("RELEASE_DRAFT",()=>{
        const metadataHash=id("release-meta",{title:request.release.title,aiDisclosureClass:request.generationProvenance.aiDisclosureClass,publishedProvenanceCommitment:a.refs.publishedProvenanceCommitment});
        const rel=this.kernel.createRelease({creatorId:a.refs.creatorId,releaseType:request.release.releaseType,metadataHash,artworkHash:request.release.artworkHash,aiDisclosureClass:request.generationProvenance.aiDisclosureClass,publishedProvenanceCommitment:a.refs.publishedProvenanceCommitment});
        a.refs.releaseId=rel.releaseId;this.kernel.addTrack(rel.releaseId,a.refs.recordingId);
      });
      stage("RELEASE_PUBLISHED",()=>this.kernel.publishRelease(a.refs.releaseId));
      a.status="PUBLISHED";a.error=null;a.updatedAt=this.now();a.completedAt=this.now();this.attempts.set(requestId,a);return clone(a);
    }catch(error){
      const e=error instanceof GenerationError420?error:new GenerationError420("INTERNAL_ERROR","publication orchestration failed",{cause:error});
      a.status="FAILED";a.error={code:e.code,retryable:Boolean(e.retryable),message:e.message,stage:e.details?.stage??this.#nextStage(a.completedStages)};a.updatedAt=this.now();
      this.attempts.set(requestId,a);throw e;
    }
  }
  getAttempt(requestId){const a=this.attempts.get(requestId);return a?clone(a):null;}
  #nextStage(done){return PUBLICATION_STAGES_420.find(x=>!done.includes(x))??null;}
  #normalize(input){
    if(!input||typeof input!=="object")throw new GenerationError420("INVALID_REQUEST","publication request required");
    const provenance=validateGenerationProvenance420(input.generationProvenance);
    const selectedTake=req(input.selectedTake,"selectedTake");
    if(selectedTake.status!=="COMPLETE"||!selectedTake.saved||!selectedTake.artifacts?.some(a=>a.kind==="MIX"))throw new GenerationError420("INVALID_REQUEST","Register & Publish requires a saved COMPLETE take with MIX");
    const recordingClass=String(input.recording?.recordingClass??"ORIGINAL");
    if(provenance.aiDisclosureClass==="AI_DERIVATIVE"&&recordingClass!=="AI_DERIVATIVE")throw new GenerationError420("INVALID_REQUEST","AI_DERIVATIVE disclosure requires AI_DERIVATIVE Recording class");
    const normalized={
      creator:{ownerRef:String(req(input.creator?.ownerRef,"creator.ownerRef")),existingCreatorId:input.creator?.existingCreatorId??null,identityType:input.creator?.identityType??"ARTIST_PROJECT",metadataHash:String(req(input.creator?.metadataHash,"creator.metadataHash"))},
      generationProvenance:provenance,
      generationProvenanceCommitment:digest420(provenance),
      selectedTake:clone(selectedTake),
      work:{compositionHash:String(req(input.work?.compositionHash,"work.compositionHash")),metadataHash:String(req(input.work?.metadataHash,"work.metadataHash")),provenanceClass:input.work?.provenanceClass??"NATIVE_VERIFIED",rightsStatus:input.work?.rightsStatus??"RIGHTS_VERIFIED"},
      workCredits:normalizeCredits(input.workCredits,"workCredits"),
      workRightsSplit:normalizeSplit(input.workRightsSplit,"workRightsSplit"),
      recording:{recordingClass,masterHash:String(req(input.recording?.masterHash,"recording.masterHash")),metadataHash:String(req(input.recording?.metadataHash,"recording.metadataHash")),mediaManifestHash:String(req(input.recording?.mediaManifestHash,"recording.mediaManifestHash")),authorizationManifestHash:input.recording?.authorizationManifestHash??null,royaltyScheduleVersion:Number(input.recording?.royaltyScheduleVersion??1),authorizationPolicyVersion:Number(input.recording?.authorizationPolicyVersion??0),parentRecordingId:input.recording?.parentRecordingId??null,sourceLicenseRef:input.recording?.sourceLicenseRef??null,authorizationEvidence:input.recording?.authorizationEvidence??null},
      recordingCredits:normalizeCredits(input.recordingCredits,"recordingCredits"),
      recordingRightsSplit:normalizeSplit(input.recordingRightsSplit,"recordingRightsSplit"),
      media:{manifestHash:String(req(input.media?.manifestHash,"media.manifestHash")),masterContentHash:String(req(input.media?.masterContentHash,"media.masterContentHash")),technicalMetadataHash:String(req(input.media?.technicalMetadataHash,"media.technicalMetadataHash")),storageLocatorHash:String(req(input.media?.storageLocatorHash,"media.storageLocatorHash")),durationMs:Number(req(input.media?.durationMs,"media.durationMs")),storageSources:arr(input.media?.storageSources,"media.storageSources").map(clone)},
      release:{title:String(req(input.release?.title,"release.title")),releaseType:input.release?.releaseType??"SINGLE",artworkHash:String(req(input.release?.artworkHash,"release.artworkHash"))}
    };
    return normalized;
  }
}

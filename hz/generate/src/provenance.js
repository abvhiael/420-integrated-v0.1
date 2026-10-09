import { digest420 } from "./schema.js";
import { GenerationError420 } from "./errors.js";

export const AI_DISCLOSURE_CLASSES_420 = Object.freeze([
  "HUMAN","AI_ASSISTED","AI_GENERATED","AI_DERIVATIVE"
]);

const FORBIDDEN_PUBLIC_KEYS = new Set([
  "prompt","lyrics","rawReferenceAudio","referenceAudioBytes","privateAudio","audioBytes",
  "privateKey","mnemonic","seedPhrase","apiKey","accessToken"
]);

const isObj=(v)=>Boolean(v)&&typeof v==="object"&&!Array.isArray(v);
const clone=(v)=>structuredClone(v);
function fail(message){throw new GenerationError420("INVALID_REQUEST",message);}
function str(v,n,{required=true,max=512}={}) {
  if(v===undefined||v===null||v===""){if(required)fail(n+" is required");return null;}
  if(typeof v!=="string")fail(n+" must be a string");
  const x=v.trim();if(!x&&required)fail(n+" is required");if(x.length>max)fail(n+" is too long");return x||null;
}
function strs(v,n,{required=false,maxItems=64}={}) {
  if(v===undefined||v===null){if(required)fail(n+" is required");return [];}
  if(!Array.isArray(v)||v.length>maxItems)fail(n+" must be a bounded array");
  const out=[...new Set(v.map((x,i)=>str(x,n+"["+i+"]",{required:true,max:512})))];
  if(required&&!out.length)fail(n+" is required");
  return out;
}
function positiveInt(v,n){if(!Number.isSafeInteger(v)||v<=0)fail(n+" must be a positive integer");return v;}
function timestamp(v,n){if(!Number.isSafeInteger(v)||v<=0)fail(n+" must be a positive millisecond timestamp");return v;}
function rejectPlaintext(value,path="provenance") {
  if(Array.isArray(value)){value.forEach((x,i)=>rejectPlaintext(x,path+"["+i+"]"));return;}
  if(!isObj(value))return;
  for(const [k,x] of Object.entries(value)){
    if(FORBIDDEN_PUBLIC_KEYS.has(k)) fail(path+"."+k+" cannot appear in public provenance");
    rejectPlaintext(x,path+"."+k);
  }
}
function normalizePublishedRefs(v){
  if(v===undefined||v===null)return null;
  if(!isObj(v))fail("creatorPublishedInputRefs must be an object");
  const promptRef=str(v.promptRef,"creatorPublishedInputRefs.promptRef",{required:false});
  const lyricsRef=str(v.lyricsRef,"creatorPublishedInputRefs.lyricsRef",{required:false});
  if(!promptRef&&!lyricsRef)fail("creatorPublishedInputRefs must contain an explicit public reference");
  return Object.freeze({promptRef,lyricsRef});
}
function normalizeVoice(v,createdAt){
  if(v===undefined||v===null)return null;
  if(!isObj(v))fail("voiceConsent must be an object");
  const status=str(v.status,"voiceConsent.status");
  if(status!=="ACTIVE")fail("synthetic voice/persona consent must be ACTIVE");
  const effectiveAt=timestamp(v.effectiveAt,"voiceConsent.effectiveAt");
  const checkedAt=timestamp(v.checkedAt,"voiceConsent.checkedAt");
  const expiresAt=v.expiresAt===null||v.expiresAt===undefined?null:timestamp(v.expiresAt,"voiceConsent.expiresAt");
  if(effectiveAt>checkedAt)fail("voice consent is not yet effective");
  if(expiresAt!==null&&expiresAt<=checkedAt)fail("voice consent is expired");
  if(checkedAt>createdAt)fail("voice consent check cannot be after provenance creation");
  return Object.freeze({
    subjectRef:str(v.subjectRef,"voiceConsent.subjectRef"),
    controllerRef:str(v.controllerRef,"voiceConsent.controllerRef"),
    scopeCommitment:str(v.scopeCommitment,"voiceConsent.scopeCommitment"),
    evidenceRef:str(v.evidenceRef,"voiceConsent.evidenceRef"),
    status,effectiveAt,expiresAt,checkedAt
  });
}

export function validateGenerationProvenance420(input,{published=false}={}) {
  if(!isObj(input))fail("provenance must be an object");
  rejectPlaintext(input);
  if(input.schemaVersion!==1)fail("schemaVersion must be 1");
  const policyVersion=positiveInt(input.policyVersion,"policyVersion");
  const provenanceVersion=positiveInt(input.provenanceVersion,"provenanceVersion");
  const createdAt=timestamp(input.createdAt,"createdAt");
  const disclosure=str(input.aiDisclosureClass,"aiDisclosureClass");
  if(!AI_DISCLOSURE_CLASSES_420.includes(disclosure))fail("invalid aiDisclosureClass");

  if(!isObj(input.provider))fail("provider is required");
  const provider=Object.freeze({
    providerId:str(input.provider.providerId,"provider.providerId"),
    providerRevision:str(input.provider.providerRevision,"provider.providerRevision"),
    modelId:str(input.provider.modelId,"provider.modelId"),
    modelVersion:str(input.provider.modelVersion,"provider.modelVersion")
  });

  const source=Object.freeze({
    workIds:Object.freeze(strs(input.source?.workIds,"source.workIds")),
    recordingIds:Object.freeze(strs(input.source?.recordingIds,"source.recordingIds")),
    licenseIds:Object.freeze(strs(input.source?.licenseIds,"source.licenseIds")),
    authorizationRefs:Object.freeze(strs(input.source?.authorizationRefs,"source.authorizationRefs")),
    transformationAuthorizationRefs:Object.freeze(strs(input.source?.transformationAuthorizationRefs,"source.transformationAuthorizationRefs")),
    trainingAuthorizationRefs:Object.freeze(strs(input.source?.trainingAuthorizationRefs,"source.trainingAuthorizationRefs"))
  });

  if(disclosure==="AI_DERIVATIVE"){
    if(!source.workIds.length&&!source.recordingIds.length)fail("AI_DERIVATIVE requires source Work/Recording provenance");
    if(!source.authorizationRefs.length)fail("AI_DERIVATIVE requires source authorization references");
    if(!source.transformationAuthorizationRefs.length)fail("AI_DERIVATIVE requires transformation authorization");
  }

  const syntheticVoiceClaim=Boolean(input.syntheticVoiceClaim);
  const voiceConsent=normalizeVoice(input.voiceConsent,createdAt);
  if(syntheticVoiceClaim&&!voiceConsent)fail("synthetic voice/persona claim requires explicit qualified consent evidence");
  if(!syntheticVoiceClaim&&voiceConsent)fail("voiceConsent requires syntheticVoiceClaim=true");

  const artifactCommitments=Object.freeze(strs(input.artifactCommitments,"artifactCommitments",{required:true}));
  const creatorPublishedInputRefs=normalizePublishedRefs(input.creatorPublishedInputRefs);

  const normalized={
    schemaVersion:1,
    policyVersion,
    provenanceVersion,
    provenanceRecordId:str(input.provenanceRecordId,"provenanceRecordId"),
    supersedesProvenanceCommitment:str(input.supersedesProvenanceCommitment,"supersedesProvenanceCommitment",{required:false}),
    generationManifestHash:str(input.generationManifestHash,"generationManifestHash"),
    creatorAccountRef:str(input.creatorAccountRef,"creatorAccountRef"),
    createdAt,
    provider,
    requestCommitment:str(input.requestCommitment,"requestCommitment"),
    resultCommitment:str(input.resultCommitment,"resultCommitment"),
    resultManifestHash:str(input.resultManifestHash,"resultManifestHash"),
    verificationRef:str(input.verificationRef,"verificationRef",{required:false}),
    aiDisclosureClass:disclosure,
    declarationCommitment:str(input.declarationCommitment,"declarationCommitment"),
    source,
    syntheticVoiceClaim,
    voiceConsent,
    artifactCommitments,
    creatorPublishedInputRefs,
    privateInputPolicy:Object.freeze({
      promptPlaintextOffChain:true,
      lyricsPlaintextOffChain:true,
      referenceAudioPlaintextOffChain:true,
      publicationRequiresExplicitCreatorAction:true
    }),
    publication:null
  };

  if(published){
    if(!isObj(input.publication))fail("publication snapshot is required");
    normalized.publication=Object.freeze({
      creatorProfileId:str(input.publication.creatorProfileId,"publication.creatorProfileId"),
      workId:str(input.publication.workId,"publication.workId"),
      recordingId:str(input.publication.recordingId,"publication.recordingId"),
      creativeProvenanceCommitment:str(input.publication.creativeProvenanceCommitment,"publication.creativeProvenanceCommitment"),
      authorizationManifestCommitment:str(input.publication.authorizationManifestCommitment,"publication.authorizationManifestCommitment"),
      publishedAt:timestamp(input.publication.publishedAt,"publication.publishedAt"),
      publishedProvenanceCommitment:str(input.publication.publishedProvenanceCommitment,"publication.publishedProvenanceCommitment")
    });
    if(normalized.publication.publishedAt<createdAt)fail("publishedAt cannot precede provenance creation");
    const expected=digest420({...normalized,publication:{...normalized.publication,publishedProvenanceCommitment:null}});
    if(normalized.publication.publishedProvenanceCommitment!==expected)fail("published provenance commitment mismatch");
  } else if(input.publication!==undefined&&input.publication!==null) {
    fail("unpublished provenance cannot carry publication state");
  }

  return Object.freeze(normalized);
}

export function buildGenerationProvenance420(input) {
  return validateGenerationProvenance420({
    schemaVersion:1,
    policyVersion:1,
    provenanceVersion:input?.provenanceVersion??1,
    ...clone(input),
    publication:null
  });
}

export function finalizeGenerationProvenance420(record,publication) {
  const base=validateGenerationProvenance420(record);
  if(base.publication)fail("published provenance is immutable");
  const pub={
    creatorProfileId:str(publication?.creatorProfileId,"publication.creatorProfileId"),
    workId:str(publication?.workId,"publication.workId"),
    recordingId:str(publication?.recordingId,"publication.recordingId"),
    creativeProvenanceCommitment:str(publication?.creativeProvenanceCommitment,"publication.creativeProvenanceCommitment"),
    authorizationManifestCommitment:str(publication?.authorizationManifestCommitment,"publication.authorizationManifestCommitment"),
    publishedAt:timestamp(publication?.publishedAt,"publication.publishedAt"),
    publishedProvenanceCommitment:null
  };
  const candidate={...clone(base),publication:pub};
  pub.publishedProvenanceCommitment=digest420(candidate);
  candidate.publication=pub;
  return validateGenerationProvenance420(candidate,{published:true});
}

export function provenanceFromSucceededJob420(job,input={}) {
  if(!job||job.state!=="SUCCEEDED"||!job.outputManifest)fail("provenance requires a SUCCEEDED generation job");
  const resultCommitment=input.resultCommitment??job.executionEvidence?.resultCommitment;
  const verificationRef=input.verificationRef??job.executionEvidence?.verificationRef??null;
  if(!resultCommitment)fail("canonical resultCommitment is required");
  return buildGenerationProvenance420({
    provenanceRecordId:input.provenanceRecordId??("hzprov:"+digest420({jobId:job.jobId,requestDigest:job.requestDigest,resultCommitment})),
    provenanceVersion:input.provenanceVersion??1,
    supersedesProvenanceCommitment:input.supersedesProvenanceCommitment??null,
    generationManifestHash:input.generationManifestHash??digest420({request:job.requestDigest,provider:job.provider,quoteId:job.quote?.quoteId,providerJobRef:job.providerJobRef}),
    creatorAccountRef:input.creatorAccountRef,
    createdAt:input.createdAt??job.updatedAt,
    provider:{
      providerId:job.provider?.providerId,
      providerRevision:job.provider?.providerRevision,
      modelId:job.provider?.modelId,
      modelVersion:job.provider?.modelVersion
    },
    requestCommitment:input.requestCommitment??job.requestDigest,
    resultCommitment,
    resultManifestHash:digest420(job.outputManifest),
    verificationRef,
    aiDisclosureClass:input.aiDisclosureClass,
    declarationCommitment:input.declarationCommitment,
    source:input.source??{},
    syntheticVoiceClaim:Boolean(input.syntheticVoiceClaim),
    voiceConsent:input.voiceConsent??null,
    artifactCommitments:job.outputManifest.artifacts.map(a=>a.integrity),
    creatorPublishedInputRefs:input.creatorPublishedInputRefs??null
  });
}

import { GenerationProvider420 } from "./provider.js";
import { buildGenerationRequest420, digest420, validateOutputManifest420 } from "./schema.js";
import { GenerationError420, normalizeProviderError420 } from "./errors.js";

const RUNNING=new Set(["CREATED","FUNDED","MATCHED","ACCEPTED","RUNNING","RESULT_COMMITTED","DISPUTED"]);
const SUCCESS=new Set(["VERIFIED","SETTLED"]);
const FAILED=new Set(["FAILED","EXPIRED","REFUNDED"]);
const clone=(v)=>structuredClone(v);
const wire=(v)=>typeof v==="bigint"?v.toString():Array.isArray(v)?v.map(wire):(v&&typeof v==="object"?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,wire(x)])):v);
const req=(v,n)=>{if(v===undefined||v===null||v==="")throw new GenerationError420("INVALID_REQUEST",n+" is required");return v;};
const u=(v,n)=>{try{const x=BigInt(v);if(x<0n)throw 0;return x;}catch{throw new GenerationError420("INVALID_REQUEST",n+" must be unsigned");}};

function normCandidate(x){
  if(!x||typeof x!=="object"||x.authoritative!==false)throw new GenerationError420("UNSUPPORTED_CAPABILITY","invalid/non-derived Compute candidate");
  return Object.freeze({
    computeProviderId:String(req(x.computeProviderId,"computeProviderId")),workerId:String(req(x.workerId,"workerId")),
    resourceId:String(req(x.resourceId,"resourceId")),modelId:String(req(x.modelId,"modelId")),modelVersion:String(req(x.modelVersion,"modelVersion")),
    maxDurationSec:Number(x.maxDurationSec),modes:[...new Set(x.modes??[])],supportsLyrics:Boolean(x.supportsLyrics),
    supportsReferenceAudio:Boolean(x.supportsReferenceAudio),referenceAudioPaths:[...new Set(x.referenceAudioPaths??[])],
    outputKinds:[...new Set(x.outputKinds??[])],availableCapacityUnits:u(x.availableCapacityUnits,"availableCapacityUnits"),
    queueDepth:Number(x.queueDepth??0),estimatedStartMs:Number(x.estimatedStartMs??0),quotedPrice:u(x.quotedPrice,"quotedPrice"),
    quoteAsset:String(req(x.quoteAsset,"quoteAsset")),reputationScore:Number(x.reputationScore??0),slaScore:Number(x.slaScore??0),
    finality:x.finality??"safe",authoritative:false
  });
}
function supports(c,r){return c.availableCapacityUnits>0n&&Number.isInteger(c.maxDurationSec)&&r.durationSec<=c.maxDurationSec&&c.modes.includes(r.mode)&&(!r.lyrics||c.supportsLyrics)&&(!r.referenceAudio||(c.supportsReferenceAudio&&c.referenceAudioPaths.includes(r.referenceAudio.path)));}
export function selectComputeCandidate420(candidates,request,{modelId,modelVersion,maximumPrice=null}={}){
  const r=buildGenerationRequest420(request,{expectedClientRequestId:request.clientRequestId??null}),max=maximumPrice===null?null:u(maximumPrice,"maximumPrice");
  const a=candidates.map(normCandidate).filter(c=>c.modelId===modelId&&c.modelVersion===modelVersion&&supports(c,r)&&(max===null||c.quotedPrice<=max));
  if(!a.length)throw new GenerationError420("NO_CAPACITY","no compatible Compute Market capacity");
  a.sort((x,y)=>x.quotedPrice!==y.quotedPrice?(x.quotedPrice<y.quotedPrice?-1:1):x.availableCapacityUnits!==y.availableCapacityUnits?(x.availableCapacityUnits>y.availableCapacityUnits?-1:1):x.reputationScore!==y.reputationScore?y.reputationScore-x.reputationScore:x.slaScore!==y.slaScore?y.slaScore-x.slaScore:(x.computeProviderId+"|"+x.resourceId).localeCompare(y.computeProviderId+"|"+y.resourceId));
  return a[0];
}
function methods(c){for(const m of ["environment","discoverMusicGenerationCandidates","prepareSubmission","submitAuthorized","job","prepareCancellation","cancelAuthorized"])if(typeof c?.[m]!=="function")throw new GenerationError420("INVALID_REQUEST","computeClient."+m+" is required");}

export class ComputeMarketGenerationProvider420 extends GenerationProvider420 {
  constructor({computeClient,authorizeIntent,chainId,computeGraphHash,adapterRevision="hz-gca-3-v1",maximumPrice=null,quoteTtlMs=60000,now=()=>Date.now()}){
    super();methods(computeClient);if(typeof authorizeIntent!=="function")throw new GenerationError420("INVALID_REQUEST","authorizeIntent is required");
    Object.assign(this,{compute:computeClient,authorizeIntent,chainId:String(chainId),computeGraphHash,adapterRevision,maximumPrice:maximumPrice===null?null:u(maximumPrice,"maximumPrice"),quoteTtlMs,now});
    this.quotes=new Map();this.bindings=new Map();this.cachedDescriptor=null;
  }
  async env(){const e=await this.compute.environment();if(String(e?.chainId)!==this.chainId||e?.computeGraphHash!==this.computeGraphHash)throw new GenerationError420("PROVIDER_UNAVAILABLE","Compute environment mismatch",{retryable:false});return e;}
  async descriptor(){
    await this.env();if(this.cachedDescriptor)return clone(this.cachedDescriptor);
    const cs=(await this.compute.discoverMusicGenerationCandidates()).map(normCandidate),models=new Map();let cap=0n,q=0,start=0;
    for(const c of cs){cap+=c.availableCapacityUnits;q+=c.queueDepth;start=Math.max(start,c.estimatedStartMs);const k=c.modelId+"|"+c.modelVersion;if(!models.has(k))models.set(k,{modelId:c.modelId,modelVersion:c.modelVersion,maxDurationSec:c.maxDurationSec,modes:c.modes,supportsLyrics:c.supportsLyrics,supportsReferenceAudio:c.supportsReferenceAudio,referenceAudioPaths:c.referenceAudioPaths,outputKinds:c.outputKinds});}
    if(!models.size)throw new GenerationError420("NO_CAPACITY","no music models discovered");
    this.cachedDescriptor=Object.freeze({schemaVersion:1,providerId:"420ai-compute-market",providerRevision:this.adapterRevision+":"+this.computeGraphHash,models:Object.freeze([...models.values()].map(Object.freeze)),capacity:Object.freeze({availableSlots:Number(cap>9007199254740991n?9007199254740991n:cap),queueDepth:q,estimatedStartMs:start})});
    return clone(this.cachedDescriptor);
  }
  async quote({request,modelId,modelVersion}){
    try{await this.env();const r=buildGenerationRequest420(request,{expectedClientRequestId:request.clientRequestId??null});
      const selected=selectComputeCandidate420(await this.compute.discoverMusicGenerationCandidates({workloadClass:"MUSIC_GENERATION",modelId,modelVersion}),r,{modelId,modelVersion,maximumPrice:this.maximumPrice});
      const issuedAt=this.now(),expiresAt=issuedAt+this.quoteTtlMs,core={providerId:"420ai-compute-market",providerRevision:this.adapterRevision+":"+this.computeGraphHash,modelId,modelVersion,clientRequestId:r.clientRequestId,requestDigest:digest420(r),amount:selected.quotedPrice.toString(),asset:selected.quoteAsset,capacity:{availableSlots:Number(selected.availableCapacityUnits),queueDepth:selected.queueDepth,estimatedStartMs:selected.estimatedStartMs},issuedAt,expiresAt};
      const quoteId="cmpq:"+digest420({...core,computeProviderId:selected.computeProviderId,workerId:selected.workerId,resourceId:selected.resourceId});this.quotes.set(quoteId,{selected,requestDigest:core.requestDigest,clientRequestId:core.clientRequestId,expiresAt});return Object.freeze({schemaVersion:1,quoteId,...core});
    }catch(e){throw normalizeProviderError420(e);}
  }
  async submit({request,quote,idempotencyKey}){
    try{await this.env();const q=this.quotes.get(quote?.quoteId);if(!q)throw new GenerationError420("QUOTE_MISMATCH","Compute quote missing");if(q.expiresAt<=this.now())throw new GenerationError420("QUOTE_EXPIRED","Compute quote expired");
      const r=buildGenerationRequest420(request,{expectedClientRequestId:request.clientRequestId??null});if(q.clientRequestId!==r.clientRequestId||q.requestDigest!==digest420(r)||quote.amount!==q.selected.quotedPrice.toString())throw new GenerationError420("QUOTE_MISMATCH","Compute quote binding mismatch");
      const plan=await this.compute.prepareSubmission({workloadClass:"MUSIC_GENERATION",request:clone(r),requestDigest:q.requestDigest,clientRequestId:q.clientRequestId,selectedCandidate:clone(q.selected),maximumPrice:(this.maximumPrice??q.selected.quotedPrice).toString(),quotedPrice:q.selected.quotedPrice.toString(),quoteAsset:q.selected.quoteAsset,idempotencyKey,expiresAt:q.expiresAt});
      if(plan?.requiresWalletAuthorization!==true||plan?.canonicalAuthority!==false||plan?.secretMaterialManaged!==false)throw new GenerationError420("PROVIDER_REJECTED","Compute plan authority boundary violation");
      const authorizationRef=await this.authorizeIntent(clone(plan));if(!authorizationRef)throw new GenerationError420("PROVIDER_REJECTED","Wallet authorization missing");
      const a=await this.compute.submitAuthorized({plan:clone(plan),authorizationRef,idempotencyKey});
      for(const k of ["computeProviderId","workerId","resourceId"])if(a?.[k]!==q.selected[k])throw new GenerationError420("INTEGRITY_MISMATCH","accepted "+k+" changed");
      if(String(a?.acceptedPrice)!==q.selected.quotedPrice.toString())throw new GenerationError420("INTEGRITY_MISMATCH","accepted price changed");
      for(const k of ["computeRequestId","computeJobId","acceptedMatchRef","fundingRef"])req(a?.[k],k);
      const ref=String(a.computeJobId);this.bindings.set(ref,{computeRequestId:a.computeRequestId,computeJobId:a.computeJobId,acceptedMatchRef:a.acceptedMatchRef,fundingRef:a.fundingRef,computeProviderId:a.computeProviderId,workerId:a.workerId,resourceId:a.resourceId,acceptedPrice:String(a.acceptedPrice),modelId:quote.modelId,modelVersion:quote.modelVersion,idempotencyKey});
      return Object.freeze({providerJobRef:ref,providerId:"420ai-compute-market",providerRevision:this.adapterRevision+":"+this.computeGraphHash,modelId:quote.modelId,modelVersion:quote.modelVersion,acceptedAt:a.acceptedAt??this.now()});
    }catch(e){throw normalizeProviderError420(e);}
  }
  async poll({providerJobRef}){
    try{await this.env();const b=this.bindings.get(providerJobRef);if(!b)throw new GenerationError420("PROVIDER_REJECTED","unknown Compute job");const s=await this.compute.job(b.computeJobId);if(!s)throw new GenerationError420("PROVIDER_UNAVAILABLE","Compute job unavailable");
      if(s.computeRequestId!==b.computeRequestId||s.computeProviderId!==b.computeProviderId||s.workerId!==b.workerId||s.resourceId!==b.resourceId||String(s.acceptedPrice)!==b.acceptedPrice)throw new GenerationError420("INTEGRITY_MISMATCH","Compute canonical binding changed");
      if(s.status==="CANCELLED")return {status:"CANCELLED"};if(FAILED.has(s.status))return {status:"FAILED",providerCode:s.status,retryable:s.status==="EXPIRED"};if(RUNNING.has(s.status))return {status:"RUNNING",phase:s.status};if(!SUCCESS.has(s.status))throw new GenerationError420("MALFORMED_RESULT","unknown Compute state");
      if(s.verificationVerdict!=="PASS"||!s.verificationRef||!s.resultCommitment)throw new GenerationError420("MALFORMED_RESULT","Compute result not positively verified");
      const out=validateOutputManifest420({...clone(req(s.outputManifest,"outputManifest")),providerId:"420ai-compute-market",providerRevision:this.adapterRevision+":"+this.computeGraphHash,modelId:b.modelId,modelVersion:b.modelVersion,providerJobRef},{providerId:"420ai-compute-market",providerRevision:this.adapterRevision+":"+this.computeGraphHash,modelId:b.modelId,modelVersion:b.modelVersion,providerJobRef});
      return {status:"SUCCEEDED",outputManifest:out,resultCommitment:s.resultCommitment,verificationRef:s.verificationRef,settlementRef:s.settlementRef??null,entitlementRef:s.entitlementRef??null};
    }catch(e){throw normalizeProviderError420(e);}
  }
  async cancel({providerJobRef}){
    try{await this.env();const b=this.bindings.get(providerJobRef);if(!b)throw new GenerationError420("PROVIDER_REJECTED","unknown Compute job");const key="cancel:"+b.idempotencyKey,plan=await this.compute.prepareCancellation({computeJobId:b.computeJobId,computeRequestId:b.computeRequestId,idempotencyKey:key});
      if(plan?.requiresWalletAuthorization!==true||plan?.canonicalAuthority!==false||plan?.secretMaterialManaged!==false)throw new GenerationError420("PROVIDER_REJECTED","Compute cancellation boundary violation");
      const authorizationRef=await this.authorizeIntent(clone(plan));if(!authorizationRef)throw new GenerationError420("PROVIDER_REJECTED","Wallet cancellation authorization missing");
      const r=await this.compute.cancelAuthorized({plan:clone(plan),authorizationRef,idempotencyKey:key});if(r?.status!=="CANCELLED")throw new GenerationError420("PROVIDER_REJECTED","Compute cancellation not confirmed");return {status:"CANCELLED",providerJobRef,refundRef:r.refundRef??null};
    }catch(e){throw normalizeProviderError420(e);}
  }
  async execution(providerJobRef){const b=this.bindings.get(providerJobRef);if(!b)return null;const s=await this.compute.job(b.computeJobId);return Object.freeze({...clone(b),status:s?.status??null,resultCommitment:s?.resultCommitment??null,verificationRef:s?.verificationRef??null,verificationVerdict:s?.verificationVerdict??null,entitlementRef:s?.entitlementRef??null,settlementRef:s?.settlementRef??null,refundRef:s?.refundRef??null,authoritative:s?.authoritative===true});}
}

export class DeterministicDevelopmentComputeClient420 {
  constructor({chainId="420",computeGraphHash="dev:compute-graph:v1",candidates=null,now=()=>Date.now(),settleOnVerified=true}={}){
    this.chainId=String(chainId);this.computeGraphHash=computeGraphHash;this.now=now;this.settleOnVerified=settleOnVerified;
    this.candidates=candidates??[{computeProviderId:"cmp-provider:dev-a",workerId:"worker:dev-a",resourceId:"gpu:dev-a",modelId:"mock:music",modelVersion:"1.0.0",maxDurationSec:600,modes:["VOCAL","INSTRUMENTAL"],supportsLyrics:true,supportsReferenceAudio:true,referenceAudioPaths:["AUTHORIZED_STORAGE_REF"],outputKinds:["MIX","STEM","LYRICS_TIMING","ARTWORK"],availableCapacityUnits:"2",queueDepth:0,estimatedStartMs:0,quotedPrice:"420",quoteAsset:"$420",reputationScore:80,slaScore:90,finality:"safe",authoritative:false}];
    this.jobs=new Map();this.byKey=new Map();this.cancels=new Map();
  }
  async environment(){return {chainId:this.chainId,computeGraphHash:this.computeGraphHash};}
  async discoverMusicGenerationCandidates(){return clone(this.candidates);}
  async prepareSubmission(input){return Object.freeze({schemaVersion:"hz-compute-development-plan-v1",action:"SUBMIT_MUSIC_GENERATION",chainId:this.chainId,operationId:"op:"+digest420(wire(input)),requestId:"cmpreq:"+digest420({clientRequestId:input.clientRequestId,requestDigest:input.requestDigest}),input:clone(input),canonicalAuthority:false,requiresWalletAuthorization:true,secretMaterialManaged:false});}
  async submitAuthorized({plan,authorizationRef,idempotencyKey}){
    req(authorizationRef,"authorizationRef");if(this.byKey.has(idempotencyKey))return clone(this.byKey.get(idempotencyKey));if(plan?.action!=="SUBMIT_MUSIC_GENERATION")throw new GenerationError420("PROVIDER_REJECTED","invalid development plan");
    const c=normCandidate(plan.input.selectedCandidate),computeRequestId=plan.requestId,computeJobId="cmpjob:"+digest420({computeRequestId,idempotencyKey}),a={computeRequestId,computeJobId,acceptedMatchRef:"cmpmatch:"+digest420({computeJobId}),fundingRef:"cmpfund:"+digest420({computeJobId,amount:c.quotedPrice.toString()}),computeProviderId:c.computeProviderId,workerId:c.workerId,resourceId:c.resourceId,acceptedPrice:c.quotedPrice.toString(),acceptedAt:this.now()};
    this.byKey.set(idempotencyKey,a);this.jobs.set(computeJobId,{...a,status:"RUNNING",polls:0,resultCommitment:null,verificationRef:null,verificationVerdict:null,entitlementRef:null,settlementRef:null,refundRef:null,authoritative:true});return clone(a);
  }
  async job(id){const j=this.jobs.get(id);if(!j)return null;if(j.status==="RUNNING"&&++j.polls>=2){j.status=this.settleOnVerified?"SETTLED":"VERIFIED";j.resultCommitment="cmpresult:"+digest420({id});j.verificationRef="cmpverify:"+digest420({id});j.verificationVerdict="PASS";j.entitlementRef="cmpentitlement:"+digest420({id});if(this.settleOnVerified)j.settlementRef="cmpsettlement:"+digest420({id});j.outputManifest={artifacts:[{kind:"MIX",storageRef:"dev://mix/"+id,integrity:"sha256:"+digest420({id,kind:"MIX"}),label:"mix"},{kind:"STEM",storageRef:"dev://stem/"+id,integrity:"sha256:"+digest420({id,kind:"STEM"}),label:"vocals"},{kind:"LYRICS_TIMING",storageRef:"dev://lyrics/"+id,integrity:"sha256:"+digest420({id,kind:"LYRICS_TIMING"}),label:"lyrics timing"},{kind:"ARTWORK",storageRef:"dev://artwork/"+id,integrity:"sha256:"+digest420({id,kind:"ARTWORK"}),label:"artwork"}]};}return clone(j);}
  async prepareCancellation({computeJobId,computeRequestId,idempotencyKey}){return Object.freeze({schemaVersion:"hz-compute-development-plan-v1",action:"CANCEL_MUSIC_GENERATION",chainId:this.chainId,operationId:"op:"+digest420({computeJobId,computeRequestId,idempotencyKey}),computeJobId,computeRequestId,canonicalAuthority:false,requiresWalletAuthorization:true,secretMaterialManaged:false});}
  async cancelAuthorized({plan,authorizationRef,idempotencyKey}){req(authorizationRef,"authorizationRef");if(this.cancels.has(idempotencyKey))return clone(this.cancels.get(idempotencyKey));const j=this.jobs.get(plan.computeJobId);if(!j)throw new GenerationError420("PROVIDER_REJECTED","development Compute job not found");if(SUCCESS.has(j.status))throw new GenerationError420("PROVIDER_REJECTED","verified/settled job cannot cancel");j.status="CANCELLED";j.refundRef="cmprefund:"+digest420({id:plan.computeJobId});const r={status:"CANCELLED",refundRef:j.refundRef};this.cancels.set(idempotencyKey,r);return clone(r);}
}

// Production composition is deliberately fail-closed. Adapters must be backed by canonical
// services and an atomic shared store; this module never treats client assertions as proof.
import {GenerationJobManager420} from "./jobs.js";
import {HzSecurityGate420} from "./security-gate.js";
const fn=(value,name)=>{if(typeof value!=="function")throw Error(name+"_REQUIRED");return value;};
export function createProductionSecurity420({wallet,creative,provider,identity,replayStore,rateStore,clock=()=>Date.now()}={}){
 const authorize=fn(wallet?.verifySession,"WALLET_SESSION_VERIFIER");
 const verifyRights=fn(creative?.verifyAuthorization,"CREATIVE_AUTHORITY");
 const verifyProvider=fn(provider?.verifyResult,"PROVIDER_AUTHORITY");
 fn(identity?.verifyEligibility,"IDENTITY_AUTHORITY");
 const consume=fn(replayStore?.consumeOnce,"ATOMIC_REPLAY_STORE");
 const charge=fn(rateStore?.consumeQuota,"ATOMIC_QUOTA_STORE");
 // Nonce use must be atomic and shared across every replica. Store adapters are responsible
 // for transaction semantics, retention and backing persistence.
 const guard=({actor,scope,id,nonce,expiry,resource,proof,rightsProof,quota=1})=>{
  if(!actor||!scope||!id||!nonce||!resource||!Number.isSafeInteger(expiry)||expiry<=clock())throw Error("INVALID_SECURITY_REQUEST");
  if(authorize({actor,scope,resource,proof,expiry,audience:"420hz",at:clock()})!==true)throw Error("UNAUTHORIZED");
  if(verifyRights({actor,scope,resource,proof:rightsProof,at:clock()})!==true)throw Error("RIGHTS_UNVERIFIED");
  if(charge({actor,scope,quota,at:clock()})!==true)throw Error("QUOTA_EXCEEDED");
  if(consume({key:JSON.stringify(["420hz",actor,scope,nonce]),expiresAt:expiry})!==true)throw Error("REPLAY");
  return Object.freeze({actor,scope,resource,authorized:true});
 };
 const createJobManager=(options={})=>new GenerationJobManager420({...options,requireCanonicalResult:true,
  verifyProviderResult:e=>verifyProvider({...e,audience:"420hz",at:clock()})===true});
 return Object.freeze({guard,createJobManager,
  verifyIdentity:request=>identity.verifyEligibility({...request,audience:"420hz-awards",at:clock()}),
  verifyCreative:request=>verifyRights({...request,at:clock()})===true});
}

import {createHash} from 'node:crypto';
export class BindingError extends Error {constructor(code){super(code);this.code=code}}
const fail=c=>{throw new BindingError(c)};
const hash=s=>createHash('sha256').update(s).digest('hex');
const word=s=>typeof s==='string'&&/^[0-9a-f]{64}$/.test(s);
const nonempty=s=>typeof s==='string'&&/^[a-zA-Z0-9_.:-]{1,100}$/.test(s);
export function makeBindingLedger({chainId,attestationReader,claimReader}){
 if(!nonempty(chainId)||typeof attestationReader!=='function'||typeof claimReader!=='function')fail('CONFIGURATION');
 const sourceBindings=new Map(),resultBindings=new Map(),proofBindings=new Map(),history=[],pending=new Map();
 return {
  async observe(input){
   if(!input||input.chainId!==chainId||!nonempty(input.provider)||!nonempty(input.project)||!word(input.sourceBinding)||!word(input.resultCommitment)||!word(input.evidenceBinding)||!word(input.canonicalWorkCommitment)||!word(input.attestationId)||!word(input.sourceReceiptHash))fail('INVALID_RECORD');
   if(input.provider!=='BOINC'&&input.provider!=='FOLDING_AT_HOME')fail('PROVIDER');
   if(input.sourceVerified!==true||input.identityVerified!==true)fail('UNVERIFIED_EXTERNAL');
   const att=await attestationReader(input.attestationId);
   if(!att||att.chainId!==chainId||att.trusted!==true||att.revoked===true||att.expired===true||att.sourceBinding!==input.sourceBinding||att.resultCommitment!==input.resultCommitment||att.evidenceBinding!==input.evidenceBinding||att.canonicalWorkCommitment!==input.canonicalWorkCommitment)fail('UNTRUSTED_ATTESTATION');
   const pairs=[[sourceBindings,input.sourceBinding],[resultBindings,input.sourceBinding+':'+input.resultCommitment],[proofBindings,input.evidenceBinding]];
   for(const [map,key] of pairs)if(map.has(key)&&map.get(key)!==input.canonicalWorkCommitment)fail('CONFLICTING_MAPPING');
   const key=chainId+':'+input.canonicalWorkCommitment;
   const previous=pending.get(key);
   if(previous&&previous.attestationId===input.attestationId&&previous.sourceReceiptHash===input.sourceReceiptHash)return {...previous};
   const consumed=await claimReader(input.canonicalWorkCommitment);
   if(consumed!==true&&consumed!==false)fail('CLAIM_STATE_UNAVAILABLE');
   if(consumed)fail('ALREADY_CONSUMED');
   for(const [map,k] of pairs)map.set(k,input.canonicalWorkCommitment);
   const entry={recordId:hash(key+'|'+input.attestationId+'|'+input.sourceReceiptHash),chainId,canonicalWorkCommitment:input.canonicalWorkCommitment,attestationId:input.attestationId,sourceReceiptHash:input.sourceReceiptHash,sourceBinding:input.sourceBinding,provider:input.provider,project:input.project,consumed:false,rewardEligible:false,authoritative:false};
   pending.set(key,entry);history.push({...entry});
   return {...entry};
  },
  async claimStatus(canonicalWorkCommitment){
   if(!word(canonicalWorkCommitment))fail('INVALID_RECORD');
   const v=await claimReader(canonicalWorkCommitment);if(v!==true&&v!==false)fail('CLAIM_STATE_UNAVAILABLE');
   return {canonicalWorkCommitment,consumed:v,canConsume:false,rewardEligible:false};
  },
  audit(){return history.map(e=>({...e}));}
 };
}

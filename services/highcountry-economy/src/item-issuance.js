// HC-ECON-02: ordinary-game durable item issuance. Not a canonical-chain mint.
// Independent finalized receipt/entropy validation is supplied by an authoritative
// adapter; this service never trusts browser purchase, issuer, or randomness flags.
import {createHash} from 'node:crypto';
import {resolveCertifiedPolicy,validateModifierOutcome} from './object-taxonomy.js';
export const ITEM_SCHEMA='HC.ECON.ITEMS.V1';
const fail=m=>{throw new Error('hc-econ-02:'+m);};
const ident=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
const integer=x=>Number.isSafeInteger(x)&&x>0;
const digest=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const copy=x=>structuredClone(x);
function state(s){for(const key of ['econDesigns','econItemIntents','econItems','econTransferReceipts','econConsumedSources'])s[key]??=new Map();}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function boundHash(entropy,request,context,index,counter,bound){
 const value=BigInt('0x'+digest(['HC.ECON.ITEM.RNG.V1',entropy,request,context,index,counter]));
 const range=1n<<256n,mod=BigInt(bound);
 return value<range-range%mod?Number(value%mod):null;
}
export function unbiasedTicket(entropy,request,context,index,bound){
 if(!/^0x[0-9a-f]{64}$/i.test(entropy)||!ident(request)||!/^([0-9a-f]{64})$/.test(context)||!Number.isSafeInteger(bound)||bound<1||bound>1000000||!Number.isSafeInteger(index)||index<0)fail('invalid-draw');
 for(let counter=0;counter<1024;counter++){
  const v=boundHash(entropy,request,context,index,counter,bound);
  if(v!==null)return v;
 }
 fail('draw-exhausted');
}
export function rollModifiers(policy,entropy,request,context){
 if(policy.origin!=='creator'&&policy.origin!=='quest')fail('nonrandom-origin');
 const available=policy.effects.map(x=>({...x}));
 const effects=[];
 for(let i=0;i<policy.maxModifiers;i++){
  const total=available.reduce((n,e)=>n+e.weight,0);
  let ticket=unbiasedTicket(entropy,request,context,i*2,total);
  let chosen=-1;
  for(let j=0;j<available.length;j++){ticket-=available[j].weight;if(ticket<0){chosen=j;break;}}
  if(chosen<0)fail('selection-overflow');
  const effect=available.splice(chosen,1)[0];
  const amount=effect.minBps+unbiasedTicket(entropy,request,context,i*2+1,effect.maxBps-effect.minBps+1);
  effects.push({effectId:effect.effectId,bps:amount});
 }
 return {effects};
}
export function verifyItemProof(catalog,receipt){
 if(receipt?.schemaVersion!==ITEM_SCHEMA||!ident(receipt.designId)||!ident(receipt.itemId)||!ident(receipt.owner)||!ident(receipt.originalOwner)||!ident(receipt.requestId)||!/^0x[0-9a-f]{64}$/i.test(receipt.entropy))fail('proof-shape');
 const resolved=resolveCertifiedPolicy(catalog,{typeId:receipt.typeId,policyId:receipt.policyId,revision:receipt.policyRevision});
 const context=digest(['HC.ECON.ITEM.INTENT.V1',receipt.designId,receipt.itemId,receipt.originalOwner,receipt.sourceId,receipt.policyId,receipt.policyRevision,receipt.catalogSha256,receipt.intentNonce]);
 if(receipt.catalogSha256!==resolved.catalogSha256||receipt.context!==context||receipt.origin!==resolved.policy.origin)fail('proof-context');
 const expectedRequest=digest(['HC.ECON.ITEM.REQUEST.V1',context]);
 if(receipt.randomnessRequestId!==expectedRequest||(receipt.origin!=='developer'&&receipt.requestId!==expectedRequest))fail('proof-request-binding');
 const expected=resolved.policy.origin==='developer'?{effects:resolved.policy.effects.map(e=>({effectId:e.effectId,bps:e.minBps}))}:rollModifiers(resolved.policy,receipt.entropy,receipt.requestId,context);
 validateModifierOutcome(resolved,expected);
 if(!same(expected.effects,receipt.effects))fail('proof-outcome');
 if(receipt.proofHash!==digest(['HC.ECON.ITEM.PROOF.V1',receipt.context,receipt.requestId,receipt.entropy,receipt.anchor,receipt.effects]))fail('proof-hash');
 return true;
}
// Replaying deterministic selection alone is not a finality proof. A full
// verifier must re-check the independently authenticated randomness and source.
export async function verifyFinalizedItemProof(catalog,receipt,{entropyReader,sourceReader}){
 if(verifyItemProof(catalog,receipt)!==true||typeof entropyReader?.verifyFinalized!=='function'||typeof sourceReader?.verifySource!=='function')fail('proof-verifiers-required');
 const intent={schemaVersion:ITEM_SCHEMA,designId:receipt.designId,itemId:receipt.itemId,owner:receipt.originalOwner,sourceId:receipt.sourceId,intentNonce:receipt.intentNonce,context:receipt.context,randomnessRequestId:receipt.randomnessRequestId};
 const design={designId:receipt.designId,typeId:receipt.typeId,policyId:receipt.policyId,policyRevision:receipt.policyRevision,origin:receipt.origin,catalogSha256:receipt.catalogSha256};
 if(await sourceReader.verifySource(intent,design,receipt)!==true)fail('proof-source-unverified');
 if(receipt.origin!=='developer'){
  const v=await entropyReader.verifyFinalized(intent,design,receipt.randomnessEvidence);
  if(v?.verified!==true||v.context!==receipt.context||v.entropy!==receipt.entropy||v.requestId!==receipt.requestId||v.anchor!==receipt.anchor)fail('proof-randomness-unverified');
 }
 return true;
}
export function expectedCreatorModifierBps(policy){
 if(policy?.origin!=='creator')fail('expected-origin');
 const visit=(remaining,count)=>{
  if(count===0)return 0;
  const total=remaining.reduce((a,e)=>a+e.weight,0);
  if(total<=0)fail('expected-pool');
  return remaining.reduce((average,e,i)=>average+e.weight/total*((e.minBps+e.maxBps)/2+visit([...remaining.slice(0,i),...remaining.slice(i+1)],count-1)),0);
 };
 return visit(policy.effects,policy.maxModifiers);
}
export class ItemIssuance {
 constructor({store,catalog,authority,entropyReader,clock=()=>Date.now()}){
  if(typeof store?.transact!=='function'||typeof authority?.principal!=='function'||typeof authority?.issuer!=='function'||typeof authority?.verifyPurchase!=='function'||typeof authority?.verifyQuest!=='function'||typeof authority?.guardState!=='function'||typeof authority?.verifyTransfer!=='function'||typeof authority?.verifyCancellation!=='function'||typeof entropyReader?.verifyFinalized!=='function'||!catalog?.sha256)fail('authoritative-dependencies-required');
  Object.assign(this,{store,catalog,authority,entropyReader,clock});
 }
 async publish(session,design){
  if(!design||Object.keys(design).length!==8||!['designId','typeId','policyId','policyRevision','editionCap','certificationRef','creator','origin'].every(k=>Object.hasOwn(design,k))||!ident(design?.designId)||!ident(design?.typeId)||!ident(design?.policyId)||!integer(design?.policyRevision)||!integer(design?.editionCap)||design.editionCap>420||!ident(design?.certificationRef)||!ident(design?.creator))fail('design-invalid');
  const policy=resolveCertifiedPolicy(this.catalog,{typeId:design.typeId,policyId:design.policyId,revision:design.policyRevision});
  if(!policy.policy.qualified||(design.origin==='creator'&&(expectedCreatorModifierBps(policy.policy)<200||expectedCreatorModifierBps(policy.policy)>300))||policy.policy.origin!==design.origin||!['creator','developer','quest'].includes(design.origin))fail('design-policy');
  if(await this.authority.issuer(session,'publish',design)!==true)fail('publisher-denied');
  return this.store.transact(s=>{
   state(s);if(this.authority.guardState(s,session,'publish',design)!==true)fail('issuer-revoked');if(s.econDesigns.has(design.designId))fail('design-already-published');
   const record={...copy(design),catalogSha256:this.catalog.sha256,issuedEver:0,createdAt:this.clock()};
   s.econDesigns.set(design.designId,record);return copy(record);
  });
 }
 // Reservation must precede purchase; no item or randomness is exposed here.
 async reserve(session,{designId,itemId,sourceId,intentNonce}){
  if(![designId,itemId,sourceId,intentNonce].every(ident))fail('reservation-identity');
  const owner=await this.authority.principal(session);
  if(!ident(owner))fail('owner');
  return this.store.transact(s=>{
   state(s);if(this.authority.guardState(s,session,'reserve',owner)!==true)fail('session-revoked');const d=s.econDesigns.get(designId);
   if(!d||d.catalogSha256!==this.catalog.sha256||d.issuedEver>=d.editionCap)fail('edition-unavailable');
   if(s.econItemIntents.has(itemId)||s.econItems.has(itemId)||s.econConsumedSources.has(sourceId)||[...s.econItemIntents.values()].some(v=>v.sourceId===sourceId))fail('replay');
   // Count pending reservations to prevent optimistic cap oversubscription.
   const held=[...s.econItemIntents.values()].filter(v=>v.designId===designId&&v.status==='pending').length;
   if(d.issuedEver+held>=d.editionCap)fail('edition-reserved');
   const context=digest(['HC.ECON.ITEM.INTENT.V1',designId,itemId,owner,sourceId,d.policyId,d.policyRevision,d.catalogSha256,intentNonce]);
   const intent={schemaVersion:ITEM_SCHEMA,designId,itemId,owner,sourceId,intentNonce,context,randomnessRequestId:digest(['HC.ECON.ITEM.REQUEST.V1',context]),status:'pending',createdAt:this.clock()};
   s.econItemIntents.set(itemId,intent);return copy(intent);
  });
 }
 async issue(session,{itemId,evidence}){
  if(!ident(itemId)||!evidence||typeof evidence!=='object')fail('issuance-input');
  const owner=await this.authority.principal(session);
  const pre=await this.store.transact(s=>{state(s);const intent=s.econItemIntents.get(itemId),item=s.econItems.get(itemId);if(item){if(item.originalOwner!==owner)fail('replay-owner-denied');return {item:copy(item)};}if(!intent||intent.status!=='pending'||intent.owner!==owner)fail('intent-not-owned');const design=s.econDesigns.get(intent.designId);if(!design)fail('missing-design');return {intent:copy(intent),design:copy(design)};});
  if(pre.item)return pre.item;
  const {intent,design}=pre;
  const resolved=resolveCertifiedPolicy(this.catalog,{typeId:design.typeId,policyId:design.policyId,revision:design.policyRevision});
  const origin=resolved.policy.origin;
  // Independently verify source settlement, seller authorization or quest entitlement.
  const sourceProof=origin==='quest'?await this.authority.verifyQuest(session,intent,design,evidence.source):await this.authority.verifyPurchase(session,intent,design,evidence.source);
  if(sourceProof!==true)fail('source-not-finalized');
  let entropy,requestId,anchor;
  if(origin==='developer'){
   // Fixed publisher policy, no random request or reroll.
   if(evidence.randomness!==null)fail('developer-randomness-denied');
   entropy='0x'+'0'.repeat(64);requestId='developer-fixed';anchor='fixed-policy';
  }else{
   const verified=await this.entropyReader.verifyFinalized(intent,design,evidence.randomness);
   if(!verified||verified.verified!==true||verified.context!==intent.context||!/^0x[0-9a-f]{64}$/i.test(verified.entropy)||verified.requestId!==intent.randomnessRequestId||!ident(verified.anchor))fail('randomness-unverified');
   ({entropy,requestId,anchor}=verified);
  }
  const effects=origin==='developer'?{effects:resolved.policy.effects.map(e=>({effectId:e.effectId,bps:e.minBps}))}:rollModifiers(resolved.policy,entropy,requestId,intent.context);
  validateModifierOutcome(resolved,effects);
  const issued={schemaVersion:ITEM_SCHEMA,designId:design.designId,itemId,owner,originalOwner:owner,sourceId:intent.sourceId,intentNonce:intent.intentNonce,typeId:design.typeId,policyId:design.policyId,policyRevision:design.policyRevision,catalogSha256:design.catalogSha256,origin,context:intent.context,randomnessRequestId:intent.randomnessRequestId,requestId,entropy,anchor,randomnessEvidence:origin==='developer'?null:copy(evidence.randomness),effects:effects.effects,proofHash:digest(['HC.ECON.ITEM.PROOF.V1',intent.context,requestId,entropy,anchor,effects.effects]),state:'owned',transferable:origin!=='quest',issuedAt:this.clock()};
  return this.store.transact(s=>{
   state(s);if(this.authority.guardState(s,session,'issue',owner)!==true)fail('session-revoked');const existing=s.econItems.get(itemId);if(existing){if(existing.context!==intent.context)fail('item-conflict');return copy(existing);}
   const current=s.econItemIntents.get(itemId),d=s.econDesigns.get(design.designId);
   if(!same(current,intent)||!same(d,design)||s.econConsumedSources.has(intent.sourceId)||d.issuedEver>=d.editionCap)fail('issuance-race-or-replay');
   d.issuedEver++;current.status='issued';
   s.econConsumedSources.set(intent.sourceId,itemId);s.econItems.set(itemId,issued);
   return copy(issued);
  });
 }
 async cancel(session,itemId,cancellationEvidence){
  if(!ident(itemId))fail('cancel-id');const owner=await this.authority.principal(session);
  const intent=await this.store.transact(s=>{state(s);const i=s.econItemIntents.get(itemId);if(!i||i.owner!==owner||i.status!=='pending')fail('cancel-unavailable');return copy(i);});
  if(await this.authority.verifyCancellation(session,intent,cancellationEvidence)!==true)fail('cancel-unverified');
  return this.store.transact(s=>{state(s);if(this.authority.guardState(s,session,'cancel',owner)!==true)fail('session-revoked');const i=s.econItemIntents.get(itemId);
   if(!same(i,intent)||i.status!=='pending'||s.econConsumedSources.has(i.sourceId))fail('cancel-race');
   i.status='cancelled';i.cancelledAt=this.clock();s.econConsumedSources.set(i.sourceId,itemId+':cancelled');return copy(i);
  });
 }
 async burn(session,itemId){
  if(!ident(itemId))fail('burn-id');const principal=await this.authority.principal(session);
  return this.store.transact(s=>{state(s);if(this.authority.guardState(s,session,'burn',principal)!==true)fail('session-revoked');const i=s.econItems.get(itemId);
   if(!i||i.owner!==principal||i.state!=='owned')fail('burn-denied');
   i.state='burned';i.burnedAt=this.clock();return copy(i);
  });
 }
 async transfer(session,itemId,to,transferEvidence){
  if(!ident(itemId)||!ident(to)||!ident(transferEvidence?.receiptId))fail('transfer-id');const owner=await this.authority.principal(session);
  if(await this.authority.verifyTransfer(session,{itemId,owner,to},transferEvidence)!==true)fail('transfer-unverified');
  return this.store.transact(s=>{state(s);if(this.authority.guardState(s,session,'transfer',owner)!==true)fail('session-revoked');if(s.econTransferReceipts.has(transferEvidence.receiptId))fail('transfer-replay');const i=s.econItems.get(itemId);
   if(!i||i.owner!==owner||i.state!=='owned'||!i.transferable||i.origin==='quest'||to===owner)fail('transfer-denied');
   i.owner=to;s.econTransferReceipts.set(transferEvidence.receiptId,itemId);return copy(i);
  });
 }
 async proof(session,itemId){
  if(!ident(itemId))fail('proof-id');const owner=await this.authority.principal(session);
  return this.store.transact(s=>{state(s);if(this.authority.guardState(s,session,'proof',owner)!==true)fail('session-revoked');const i=s.econItems.get(itemId);
   if(!i||i.owner!==owner)fail('proof-denied');return copy(i);
  });
 }
}
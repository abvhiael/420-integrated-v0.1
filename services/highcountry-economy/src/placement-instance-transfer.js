// HC-PLACE-03-C: consent-based, zero-fee transfer of STORED instances only.
// Never permits a client owner string or transfer of active/escrowed placement.
import {auditCustody,custodyState} from './custody-records.js';
const fail=x=>{throw Error('hc-place-transfer:'+x)};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
const assetKey=(p,a)=>JSON.stringify([p,a]);
export class HighCountryStoredInstanceTransfer {
 constructor({store,authority}={}){
  if(typeof store?.transact!=='function'||typeof authority?.registeredPrincipal!=='function'
    ||typeof authority?.verifyTransferConsent!=='function'||typeof authority?.verifyAtCommit!=='function')fail('trusted-dependencies-required');
  Object.assign(this,{store,authority});
 }
 async transfer(senderSession,recipientSession,{operation,instanceId,expectedRevision,consent}={}){
  const from=await this.authority.registeredPrincipal(senderSession),to=await this.authority.registeredPrincipal(recipientSession);
  if(!id(from)||!id(to)||from===to||!id(operation)||!id(instanceId)||!Number.isSafeInteger(expectedRevision)||expectedRevision<1)fail('invalid-request');
  const envelope={operation,instanceId,expectedRevision,from,to};
  if(await this.authority.verifyTransferConsent({consent,envelope,senderSession,recipientSession})!==true)fail('consent-denied');
  return this.store.transact(s=>{
   custodyState(s);
   if(!(s.placementInstances instanceof Map)||!(s.placementOperations instanceof Map)||!(s.assetSources instanceof Map))fail('unprovisioned-state');
   if(this.authority.verifyAtCommit({senderSession,recipientSession,from,to,state:s,consent,envelope})!==true)fail('revoked-or-expired-authority');
   const key=assetKey(from,operation),oldOp=s.placementOperations.get(key);
   if(oldOp)fail('transfer-operation-replayed');
   const obj=s.placementInstances.get(instanceId);
   if(!obj||obj.state!=='stored'||obj.ownerPrincipal!==from||obj.revision!==expectedRevision)fail('not-owned-stored-instance');
   if([...s.placementInstances.values()].some(v=>v.parentInstanceId===instanceId&&v.state==='placed'))fail('instance-has-live-children');
   const ids=[...s.placementOperations.values()].filter(v=>v.result?.instance?.instanceId===instanceId&&v.result?.custody?.unitId).map(v=>v.result.custody.unitId);
   if(!ids.length||new Set(ids).size!==1)fail('ambiguous-custody-provenance');
   const unit=s.custodyUnits.get(ids[0]);
   if(!unit||unit.owner!==from||unit.state!=='available'||unit.assetId!==obj.assetId||s.custodyReservations.has(unit.unitId))fail('custody-unavailable');
   const senderKey=assetKey(from,obj.assetId),recipientKey=assetKey(to,obj.assetId);
   const sender=s.assets.get(senderKey),recipient=s.assets.get(recipientKey)??{available:0,reserved:0};
   if(!sender||!Number.isSafeInteger(sender.available)||sender.available<1||!Number.isSafeInteger(recipient.available)||recipient.available>=Number.MAX_SAFE_INTEGER)fail('balance-invalid');
   const source=s.assetSources.get(senderKey),targetSource=s.assetSources.get(recipientKey);
   if(!source||source!==unit.receiptId||(targetSource&&targetSource!==source))fail('provenance-conflict');
   // Multiple source receipts with the same asset may be present through resale;
   // the record for the exact unit remains the authoritative provenance.
   s.assets.set(senderKey,{...sender,available:sender.available-1});
   s.assets.set(recipientKey,{...recipient,available:recipient.available+1});
   s.assetSources.set(recipientKey,source);
   s.custodyUnits.set(unit.unitId,{...unit,owner:to,revision:unit.revision+1});
   const next={...obj,ownerPrincipal:to,revision:obj.revision+1,updatedAt:Math.max(obj.updatedAt+1,Date.now()),history:[...obj.history,operation]};
   s.placementInstances.set(instanceId,next);
   const result={instance:structuredClone(next),custodyUnitId:unit.unitId,from,to};
   s.placementOperations.set(key,{payload:'stored-transfer',result});
   auditCustody(s,{strictAggregate:true});
   return structuredClone(result);
  });
 }
}

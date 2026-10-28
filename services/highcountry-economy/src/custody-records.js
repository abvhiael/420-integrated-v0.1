// HC-PLACE-03-B.1: verified, deterministic individual-unit custody records.
// Deliberately NOT wired to placement or marketplace mutation paths until B.2/B.3.
import {createHash} from 'node:crypto';
const token=v=>typeof v==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(v);
const count=v=>Number.isSafeInteger(v)&&v>0&&v<=10000;
const reject=s=>{throw new Error('hc-custody:'+s)};
const key=(owner,asset)=>JSON.stringify([owner,asset]);
const clone=x=>structuredClone(x);
export const CUSTODY_SCHEMA='highcountry-custody-v1';
export const CUSTODY_STATES=Object.freeze(['available','listed','placed','other_reserved','exited']);
export function custodyUnitId(receiptId,index){
 if(!token(receiptId)||!Number.isSafeInteger(index)||index<0)reject('invalid-unit-source');
 return 'hcu_'+createHash('sha256').update(JSON.stringify([CUSTODY_SCHEMA,receiptId,index])).digest('hex');
}
export function custodyState(s){
 if(!(s?.custodyUnits instanceof Map)||!(s.custodyReceipts instanceof Map)||!(s.custodyReservations instanceof Map)||!(s.assets instanceof Map)||!(s.importedAssets instanceof Set))reject('unprovisioned-state');
 return s;
}
export function auditCustody(s,{strictAggregate=false}={}){
 custodyState(s);
 const seen=new Set(),totals=new Map(),active=new Map();
 for(const [uid,u] of s.custodyUnits){
  if(!token(uid)||uid!==custodyUnitId(u.receiptId,u.unitIndex)||u.schemaVersion!==CUSTODY_SCHEMA||!token(u.owner)||!token(u.assetId)||!token(u.receiptId)||!Number.isSafeInteger(u.unitIndex)||u.unitIndex<0||!Number.isSafeInteger(u.revision)||u.revision<1||!CUSTODY_STATES.includes(u.state))reject('invalid-unit');
  const rec=s.custodyReceipts.get(u.receiptId);
  if(!rec||rec.assetId!==u.assetId||!count(rec.quantity)||u.unitIndex>=rec.quantity||!s.importedAssets.has(u.receiptId))reject('unbacked-unit');
  if(seen.has(uid))reject('duplicate-unit');
  seen.add(uid);
  const reservation=s.custodyReservations.get(uid);
  if(u.state==='available'||u.state==='exited'){
   if(reservation!==undefined||u.reservationId!==null)reject('available-unit-reserved');
  }else{
   if(!reservation||reservation.unitId!==uid||reservation.owner!==u.owner||reservation.assetId!==u.assetId||reservation.kind!==u.state||!token(reservation.reservationId)||reservation.reservationId!==u.reservationId)reject('invalid-reservation');
   if(active.has(reservation.reservationId))reject('reused-reservation');
   active.set(reservation.reservationId,uid);
  }
  const k=key(u.owner,u.assetId),t=totals.get(k)??{available:0,reserved:0};
  if(u.state==='exited')continue;
  if(u.state==='available')t.available++;else t.reserved++;
  totals.set(k,t);
 }
 for(const [receiptId,receipt] of s.custodyReceipts){
  if(!token(receiptId)||!token(receipt.owner)||!token(receipt.assetId)||!count(receipt.quantity)||!s.importedAssets.has(receiptId))reject('invalid-receipt');
  for(let i=0;i<receipt.quantity;i++)if(!seen.has(custodyUnitId(receiptId,i)))reject('missing-unit');
 }
 for(const [uid] of s.custodyReservations)if(!seen.has(uid))reject('orphan-reservation');
 if(strictAggregate)for(const [k,t] of totals){
  const a=s.assets.get(k);
  if(!a||a.available!==t.available||a.reserved!==t.reserved)reject('aggregate-divergence');
 }
 return {units:seen.size,receipts:s.custodyReceipts.size,reservations:active.size,totals};
}

/** Internal-only synchronous mutation helpers; caller MUST hold PostgresBudsStore's locked transaction. */
export function reservePlacementUnit(s,{owner,assetId,instanceId}){
 custodyState(s);
 if(!token(owner)||!token(assetId)||!token(instanceId))reject('invalid-placement-reference');
 // Legacy balances are not source-backed units. Never allocate them implicitly.
 const ids=[...s.custodyUnits.values()].filter(u=>u.owner===owner&&u.assetId===assetId&&u.state==='available')
   .sort((a,b)=>a.unitId.localeCompare(b.unitId,'en'));
 if(!ids.length)reject('verified-unit-unavailable');
 const keyName=key(owner,assetId),balance=s.assets.get(keyName);
 if(!balance||!Number.isSafeInteger(balance.available)||balance.available<1||!Number.isSafeInteger(balance.reserved)||balance.reserved<0||balance.reserved===Number.MAX_SAFE_INTEGER)reject('inventory-unavailable');
 const reservationId='place:'+instanceId;
 if([...s.custodyReservations.values()].some(r=>r.reservationId===reservationId))reject('duplicate-instance-reservation');
 const u=ids[0];
 if(s.custodyReservations.has(u.unitId))reject('unit-already-reserved');
 s.custodyUnits.set(u.unitId,{...u,state:'placed',reservationId,revision:u.revision+1});
 s.custodyReservations.set(u.unitId,{unitId:u.unitId,owner,assetId,kind:'placed',reservationId,instanceId});
 s.assets.set(keyName,{...balance,available:balance.available-1,reserved:balance.reserved+1});
 auditCustody(s);
 return {unitId:u.unitId,reservationId};
}
export function releasePlacementUnit(s,{owner,assetId,instanceId}){
 custodyState(s);
 if(!token(owner)||!token(assetId)||!token(instanceId))reject('invalid-placement-reference');
 const reservationId='place:'+instanceId;
 const reservations=[...s.custodyReservations.values()].filter(r=>r.reservationId===reservationId);
 if(reservations.length!==1)reject('placement-reservation-missing');
 const reservation=reservations[0],u=s.custodyUnits.get(reservation.unitId);
 if(!u||u.owner!==owner||u.assetId!==assetId||u.state!=='placed'||u.reservationId!==reservationId||reservation.owner!==owner||reservation.assetId!==assetId||reservation.kind!=='placed'||reservation.instanceId!==instanceId)reject('placement-reservation-corrupt');
 const keyName=key(owner,assetId),balance=s.assets.get(keyName);
 if(!balance||!Number.isSafeInteger(balance.available)||balance.available<0||balance.available===Number.MAX_SAFE_INTEGER||!Number.isSafeInteger(balance.reserved)||balance.reserved<1)reject('inventory-reservation-corrupt');
 s.custodyReservations.delete(u.unitId);
 s.custodyUnits.set(u.unitId,{...u,state:'available',reservationId:null,revision:u.revision+1});
 s.assets.set(keyName,{...balance,available:balance.available+1,reserved:balance.reserved-1});
 auditCustody(s);
 return {unitId:u.unitId,reservationId};
}


/** Locked, deterministic marketplace unit selection and exact escrow accounting. */
export function reserveListedUnits(s,{owner,assetId,listingId,quantity}){
 custodyState(s);
 if(!token(owner)||!token(assetId)||!token(listingId)||!count(quantity))reject('invalid-listing');
 const eligible=[...s.custodyUnits.values()].filter(u=>u.owner===owner&&u.assetId===assetId&&u.state==='available').sort((a,b)=>a.unitId.localeCompare(b.unitId,'en'));
 if(eligible.length<quantity)reject('verified-units-unavailable');
 const k=key(owner,assetId),balance=s.assets.get(k);
 if(!balance||balance.available<quantity||balance.reserved>Number.MAX_SAFE_INTEGER-quantity)reject('inventory-unavailable');
 const reservationId='list:'+listingId;
 if([...s.custodyReservations.values()].some(v=>v.reservationId===reservationId))reject('reused-listing-reservation');
 const selected=eligible.slice(0,quantity);
 for(const u of selected){
  if(s.custodyReservations.has(u.unitId))reject('reservation-conflict');
  s.custodyUnits.set(u.unitId,{...u,state:'listed',reservationId,revision:u.revision+1});
  s.custodyReservations.set(u.unitId,{unitId:u.unitId,owner,assetId,kind:'listed',reservationId,listingId});
 }
 s.assets.set(k,{...balance,available:balance.available-quantity,reserved:balance.reserved+quantity});
 auditCustody(s);
 return selected.map(u=>u.unitId);
}
export function settleListedUnits(s,{listing,buyer=null,exit=false}){
 custodyState(s);
 if(!listing||!token(listing.seller)||!token(listing.asset)||!token(listing.listingId)||!count(listing.quantity)||!Array.isArray(listing.unitIds)||listing.unitIds.length!==listing.quantity)reject('invalid-listing-binding');
 const reservationId='list:'+listing.listingId;
 if(new Set(listing.unitIds).size!==listing.quantity)reject('duplicate-listing-unit');
 const units=listing.unitIds.map(uid=>{
  const u=s.custodyUnits.get(uid),r=s.custodyReservations.get(uid);
  if(!u||u.owner!==listing.seller||u.assetId!==listing.asset||u.state!=='listed'||u.reservationId!==reservationId||!r||r.reservationId!==reservationId||r.listingId!==listing.listingId||r.owner!==listing.seller||r.kind!=='listed')reject('listing-custody-corrupt');
  return u;
 });
 const senderKey=key(listing.seller,listing.asset),from=s.assets.get(senderKey);
 if(!from||from.reserved<units.length)reject('listing-balance-corrupt');
 const toKey=buyer===null?senderKey:key(buyer,listing.asset),to=s.assets.get(toKey)??{available:0,reserved:0};
 if(to.available>Number.MAX_SAFE_INTEGER-units.length)reject('recipient-overflow');
 for(const u of units){
  s.custodyReservations.delete(u.unitId);
  s.custodyUnits.set(u.unitId,{...u,owner:buyer??u.owner,state:exit?'exited':'available',reservationId:null,revision:u.revision+1});
 }
 s.assets.set(senderKey,{...from,available:buyer===null&&!exit?from.available+units.length:from.available,reserved:from.reserved-units.length});
 if(buyer!==null&&!exit)s.assets.set(toKey,{...to,available:to.available+units.length});
 auditCustody(s);
 return listing.unitIds;
}
export class HighCountryCustodyRegistry {
 constructor(store,authority){
  if(typeof store?.transact!=='function'||typeof authority?.requireAssetIssuer!=='function'||typeof authority?.verifyAssetReceipt!=='function')reject('trusted-dependencies-required');
  this.store=store;this.authority=authority;
 }
 // A verified receipt is the only way to instantiate deterministic custody units.
 // Returns no entitlement until the receipt and every unit are committed together.
 async admit(session,receipt){
  await this.authority.requireAssetIssuer(session);
  if(!receipt||!token(receipt.receiptId)||!token(receipt.owner)||!token(receipt.asset)||!count(receipt.quantity))reject('malformed-receipt');
  if(await this.authority.verifyAssetReceipt(receipt)!==true)reject('unverified-receipt');
  const input=clone(receipt);
  return this.store.transact(s=>{
   custodyState(s);
   if(s.importedAssets.has(input.receiptId)||s.custodyReceipts.has(input.receiptId))reject('duplicate-receipt');
   const k=key(input.owner,input.asset),balance=s.assets.get(k)??{available:0,reserved:0};
   if(!Number.isSafeInteger(balance.available)||balance.available<0||!Number.isSafeInteger(balance.reserved)||balance.reserved<0||balance.available>Number.MAX_SAFE_INTEGER-input.quantity)reject('invalid-balance');
   const lineage=s.assetSources.get(k);
   if(lineage&&lineage!==input.receiptId)reject('mixed-provenance-requires-migration');
   const units=[];
   for(let i=0;i<input.quantity;i++){
    const unitId=custodyUnitId(input.receiptId,i);
    if(s.custodyUnits.has(unitId)||s.custodyReservations.has(unitId))reject('unit-already-issued');
    units.push([unitId,{schemaVersion:CUSTODY_SCHEMA,unitId,receiptId:input.receiptId,unitIndex:i,owner:input.owner,assetId:input.asset,state:'available',reservationId:null,revision:1}]);
   }
   s.custodyReceipts.set(input.receiptId,{owner:input.owner,assetId:input.asset,quantity:input.quantity,schemaVersion:CUSTODY_SCHEMA});
   for(const [unitId,unit] of units)s.custodyUnits.set(unitId,unit);
   s.importedAssets.add(input.receiptId);
   s.assetSources.set(k,input.receiptId);
   s.assets.set(k,{available:balance.available+input.quantity,reserved:balance.reserved});
   auditCustody(s);
   return {receiptId:input.receiptId,unitIds:units.map(([id])=>id)};
  });
 }
 // No guest-controlled allocate/reserve/release API in B.1. Transactional
 // exclusive reservation transitions require B.2/B.3 integration.
 async readOwned(session,principal){
  if(typeof this.authority.registeredPrincipal!=='function')reject('principal-authority-required');
  const who=await this.authority.registeredPrincipal(session);
  if(!token(who)||who!==principal)reject('unauthorized-read');
  return this.store.transact(s=>{custodyState(s);return [...s.custodyUnits.values()].filter(u=>u.owner===who).map(clone);});
 }
}

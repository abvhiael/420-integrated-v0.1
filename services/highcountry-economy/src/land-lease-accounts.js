// HC-NEXT-6.1: canonical parcel occupancy read model and durable rent obligations.
// This is game-land entitlement accounting, never a statutory deed or a payment receipt.
import {SettlementError} from './buds-ledger.js';
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
const safe=x=>Number.isSafeInteger(x)&&x>=0;
export class LandLeaseAccounts {
 constructor({store,identity,canonical,clock=()=>Date.now()}){
  if(typeof store?.transact!=='function'||typeof identity?.registeredPrincipal!=='function'
   ||typeof canonical?.parcel!=='function'||typeof canonical?.plantCount!=='function'
   ||typeof canonical?.lease!=='function'||typeof clock!=='function')
   throw new SettlementError('canonical land/lease/plant sources required');
  Object.assign(this,{store,identity,canonical,clock});
 }
 _state(s){s.landRentAccounts??=new Map();s.landRentEvents??=new Set();s.landRentAudit??=new Map();}
 async _player(token){const principal=await this.identity.registeredPrincipal(token);if(!valid(principal))throw new SettlementError('registered player required');return principal;}
 async rights(token,parcelId){
  const principal=await this._player(token),parcel=await this.canonical.parcel(parcelId);
  if(!parcel?.exists||!safe(parcel.id)||parcel.id!==parcelId)throw new SettlementError('unknown parcel');
  const activePlants=await this.canonical.plantCount(parcelId);
  if(!safe(activePlants)||activePlants>parcel.growCapacity)throw new SettlementError('invalid canonical plant count');
  const lease=parcel.occupancyKind==='LEASE'?await this.canonical.lease(parcel.occupancyRef):null;
  const matched=!!lease&&lease.parcelId===parcelId&&lease.lessor===parcel.owner
   &&lease.tenant===parcel.occupant&&lease.id===parcel.occupancyRef;
  const time=this.clock();
  const eligible=principal===parcel.owner||principal===parcel.occupant;
  if(!eligible)throw new SettlementError('parcel rights not available');
  const live=!!matched&&lease.state==='Active'&&!lease.exitPending
    &&lease.starts<=time&&time<lease.ends&&((lease.scopes&1)===1);
  return {parcelId,owner:parcel.owner,occupant:parcel.occupant,occupancyKind:parcel.occupancyKind,
   leaseId:matched?lease.id:null,activePlants,canCultivate:principal===parcel.owner
    ?parcel.occupancyKind==='NONE':principal===parcel.occupant&&live,
   canTerminatePlants:activePlants>0&&eligible,
   canReassign:parcel.occupancyKind==='NONE'&&activePlants===0,
   exitPending:activePlants>0&&!live&&parcel.occupancyKind==='LEASE',
   expiresAt:matched?lease.ends:null,leaseState:matched?lease.state:null};
 }
 async recordRent(token,{operation,parcelId,leaseId,period,amount,sourceReceipt}){
  const principal=await this._player(token);
  if(!valid(operation)||!valid(leaseId)||!valid(period)||!valid(sourceReceipt)
   ||!safe(amount)||amount===0||!safe(parcelId))
   throw new SettlementError('invalid rent accounting evidence');
  const [parcel,lease]=await Promise.all([this.canonical.parcel(parcelId),this.canonical.lease(leaseId)]);
  if(!parcel?.exists||parcel.owner!==principal||parcel.occupancyRef!==leaseId
   ||parcel.occupancyKind!=='LEASE'||lease?.id!==leaseId||lease.parcelId!==parcelId
   ||lease.lessor!==principal||lease.tenant!==parcel.occupant)
   throw new SettlementError('stale or unauthorized lease rent');
  const verified=await this.canonical.rentReceipt({parcelId,leaseId,period,amount,sourceReceipt,tenant:lease.tenant,lessor:principal});
  if(verified!==true)throw new SettlementError('rent receipt not independently settled');
  return this.store.transact(s=>{
   this._state(s);
   if(s.operations.has(operation)||s.landRentEvents.has(sourceReceipt))throw new SettlementError('replayed rent receipt');
   const key=leaseId+':'+period;
   if(s.landRentAccounts.has(key))throw new SettlementError('rent period already recorded');
   const record={parcelId,leaseId,period,amount,sourceReceipt,lessor:principal,tenant:lease.tenant,recordedAt:this.clock()};
   s.landRentAccounts.set(key,record);s.landRentEvents.add(sourceReceipt);s.operations.add(operation);
   const audit=s.landRentAudit.get(leaseId)??[];audit.push({operation,...record});s.landRentAudit.set(leaseId,audit);
   return {...record,status:'settled'};
  });
 }
 async rentHistory(token,leaseId){
  const principal=await this._player(token);
  const lease=await this.canonical.lease(leaseId);
  if(!lease||principal!==lease.lessor&&principal!==lease.tenant)throw new SettlementError('rent account unauthorized');
  return this.store.transact(s=>{this._state(s);return (s.landRentAudit.get(leaseId)??[]).map(x=>({...x}));});
 }
}

// HC-PLACE-03-D: read-only reconstruction and verification under the durable lock.
import {definePlacedObject,rotatedCells} from './placement-contract.js';
import {auditCustody} from './custody-records.js';
const fail=s=>{throw Error('hc-place-03-recovery:'+s);};
const scene=r=>JSON.stringify([r.regionId,r.parcelId,r.buildingId,r.roomId]);
export function validatePlacementRecoveryState(s,{assetIds,geometryRegistry}={}){
 if(!(s?.placementInstances instanceof Map)||!(s.placementOperations instanceof Map)||
    !(s.placementScenes instanceof Map)||!(s.custodyReservations instanceof Map)||
    !(s.custodyUnits instanceof Map)||!(assetIds instanceof Set)||
    !(geometryRegistry instanceof Map))fail('missing-authoritative-state');
 auditCustody(s,{strictAggregate:true});
 const tiles=new Set(),slots=new Set(),active=new Map();
 for(const [instanceId,instance] of s.placementInstances){
  if(instanceId!==instance?.instanceId)fail('instance-key-mismatch');
  const geometry=geometryRegistry.get(instance.assetId);
  if(!geometry)fail('unknown-geometry');
  definePlacedObject(instance,{assetIds,geometry});
  const location=scene(instance),revision=s.placementScenes.get(location);
  if(!Number.isSafeInteger(revision)||revision<1)fail('missing-scene-revision');
  const visited=new Set([instanceId]);let ancestor=instance;
  while(ancestor.parentInstanceId!==null){
   const parent=s.placementInstances.get(ancestor.parentInstanceId);
   if(!parent||visited.has(parent.instanceId)||parent.ownerPrincipal!==instance.ownerPrincipal||
      scene(parent)!==location)fail('invalid-parent-chain');
   if(instance.state==='placed'&&parent.state!=='placed')fail('inactive-support');
   visited.add(parent.instanceId);ancestor=parent;
  }
  if(instance.state!=='placed')continue;
  if(instance.parentInstanceId!==null){
   const slot=JSON.stringify([instance.parentInstanceId,instance.slotId]);
   if(slots.has(slot))fail('duplicate-slot');
   slots.add(slot);
  }
  for(const cell of rotatedCells(geometry,instance.orientation)){
   const tile=JSON.stringify([location,cell.x+instance.gridX,cell.y+instance.gridY]);
   if(tiles.has(tile))fail('overlapping-occupancy');
   tiles.add(tile);
  }
  const reservations=[...s.custodyReservations.values()].filter(r=>r.reservationId==='place:'+instanceId);
  if(reservations.length!==1)fail('placement-custody-missing');
  const r=reservations[0],u=s.custodyUnits.get(r.unitId);
  if(r.kind!=='placed'||r.instanceId!==instanceId||r.owner!==instance.ownerPrincipal||
     r.assetId!==instance.assetId||!u||u.state!=='placed'||u.owner!==instance.ownerPrincipal||
     u.assetId!==instance.assetId)fail('placement-custody-diverged');
  active.set(instanceId,r.unitId);
 }
 for(const r of s.custodyReservations.values())
  if(r.kind==='placed'&&active.get(r.instanceId)!==r.unitId)fail('orphan-placement-custody');
 for(const [k,revision] of s.placementScenes)
  if(typeof k!=='string'||!Number.isSafeInteger(revision)||revision<0)fail('invalid-scene-revision');
 for(const [k,receipt] of s.placementOperations)
  if(typeof k!=='string'||typeof receipt?.payload!=='string'||
     !/^[a-f0-9]{64}$/.test(receipt.payload)||!receipt.result?.instance||
     !Number.isSafeInteger(receipt.result.sceneRevision))fail('invalid-operation-receipt');
 return Object.freeze({validated:true,placed:active.size,occupiedTiles:tiles.size,occupiedSlots:slots.size});
}

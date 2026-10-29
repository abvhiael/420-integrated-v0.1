// HC-PLACE-03: server-only durable world transactions. No HTTP exposure or gameplay enablement.
import {createHash} from 'node:crypto';
import {definePlacedObject,rotatedCells} from './placement-contract.js';
import {reservePlacementUnit,releasePlacementUnit} from './custody-records.js';
const fail=s=>{throw Error('hc-place-03:'+s);};
const id=v=>typeof v==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(v);
const valid=v=>Number.isSafeInteger(v)&&v>=0;
const key=(p,a)=>JSON.stringify([p,a]);
const sceneKey=r=>JSON.stringify([r.regionId,r.parcelId,r.buildingId,r.roomId]);
const digest=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex');
const snapshot=s=>({instances:[...s.placementInstances.values()].map(structuredClone),scenes:[...s.placementScenes.entries()].map(([scene,revision])=>({scene,revision}))});
const map=s=>{if(!(s.placementInstances instanceof Map)||!(s.placementOperations instanceof Map)||!(s.placementScenes instanceof Map)||!(s.assets instanceof Map))fail('missing-durable-state');};
export class HighCountryPlacementTransactions {
 constructor({store,authority,resolveGeometry,resolveAssets,clock=()=>Date.now()}={}){
  if(typeof store?.transact!=='function'||typeof authority?.registeredPrincipal!=='function'||typeof authority?.canPlaceOnParcel!=='function'||typeof authority?.validateWorld!=='function'||typeof authority?.verifyAtCommit!=='function'||typeof resolveGeometry!=='function'||typeof resolveAssets!=='function')fail('trusted-dependencies-required');
  this.store=store;this.auth=authority;this.geometry=resolveGeometry;this.assets=resolveAssets;this.clock=clock;
 }
 async snapshot(session){
  const who=await this.auth.registeredPrincipal(session);if(!id(who))fail('unauthenticated');
  return this.store.transact(s=>{map(s);return {instances:[...s.placementInstances.values()].filter(x=>x.ownerPrincipal===who).map(structuredClone)};});
 }
 async execute(session,command){
  const who=await this.auth.registeredPrincipal(session);
  if(!id(who)||!command||!id(command.operation)||!['place','move','rotate','remove','restore','attach','detach'].includes(command.action)||!id(command.instanceId)||!valid(command.expectedRevision)||!valid(command.expectedSceneRevision))fail('invalid-request');
  // Authenticated admission and trusted geometry obtained before database transaction.
  const permitted=await this.auth.canPlaceOnParcel(who,command);
  if(permitted!==true)fail('parcel-authority-denied');
  const world=await this.auth.validateWorld(who,command);
  if(world?.qualified!==true||!id(world.evidenceId)||!Number.isSafeInteger(world.revision)||world.revision<1||!id(world.geometryQualificationId))fail('world-evidence-unqualified');
  const assetIds=await this.assets();
  if(!(assetIds instanceof Set))fail('catalogue-unavailable');
  const geometry=await this.geometry(command.assetId);
  if(!geometry)fail('geometry-unavailable');
  const geometryRegistry=new Map();
  // Resolve every potentially colliding geometry BEFORE the locked transaction, then pin snapshots.
  // No stale result may authorize collision: production must supply immutable registry revisions.
  if(typeof this.auth.qualifiedGeometrySnapshot!=='function')fail('trusted-geometry-snapshot-required');
  const snapshotData=await this.auth.qualifiedGeometrySnapshot(who,command);
  if(!(snapshotData instanceof Map))fail('invalid-geometry-snapshot');
  for(const [asset,g] of snapshotData)geometryRegistry.set(asset,structuredClone(g));
  if(!geometryRegistry.has(command.assetId))fail('geometry-not-in-snapshot');
  // Exact geometry identity is pinned to the qualified server snapshot, not a mutable catalogue lookup.
  const pinned=geometryRegistry.get(command.assetId);
  if(JSON.stringify(pinned)!==JSON.stringify(geometry))fail('geometry-snapshot-mismatch');
  const input=structuredClone(command),payload=digest({who,input});
  return this.store.transact(s=>{
   map(s);
   // Fail closed under the SAME serializable row lock as inventory, object and scene writes.
   // This callback must be synchronous, and must validate current authoritative state,
   // including principal, parcel, scene/world revision, and qualified geometry digest.
   if(!(s.placementAuthorityRevisions instanceof Map))fail('missing-authority-revisions');
   const currentAuthority=s.placementAuthorityRevisions.get(command.record?.parcelId??s.placementInstances.get(command.instanceId)?.parcelId);
   if(!currentAuthority||currentAuthority.revoked===true||!Number.isSafeInteger(currentAuthority.revision)||currentAuthority.revision<1||!id(currentAuthority.evidenceId)||!id(currentAuthority.geometryQualificationId))fail('authority-not-provisioned');
   if(currentAuthority.revision!==world.revision||currentAuthority.evidenceId!==world.evidenceId||currentAuthority.geometryQualificationId!==world.geometryQualificationId||pinned.qualificationRef!==world.geometryQualificationId)fail('authority-changed-or-denied');
   const commitProof=this.auth.verifyAtCommit({principal:who,session,command:input,world,geometry:pinned,geometryRegistry,assetIds,authoritative:structuredClone(currentAuthority),state:s});
   if(commitProof?.then)fail('async-authority-forbidden');
   if(commitProof!==true)fail('authority-changed-or-denied');
   const opKey=key(who,command.operation),previous=s.placementOperations.get(opKey);
   if(previous){if(previous.payload!==payload)fail('replay-payload-conflict');return structuredClone(previous.result);}
   const old=s.placementInstances.get(command.instanceId);
   const creating=command.action==='place';
   if(creating===Boolean(old))fail('instance-exists-or-missing');
   if(old&&old.ownerPrincipal!==who)fail('owner-denied');
   if(old&&old.revision!==command.expectedRevision)fail('stale-instance');
   if(creating&&command.expectedRevision!==0)fail('expected-zero-revision');
   if(command.action==='restore'?old.state!=='stored':command.action!=='place'&&old.state!=='placed')fail('invalid-instance-state');
   if(old&&command.record!==undefined)fail('existing-instance-record-override');
   const source=old&&sceneKey(old);
   const next={...old,...command.record};
   if(!creating){
    if(command.action==='remove')next.state='stored';
    if(command.action==='restore')next.state='placed';
    if(command.action==='rotate')next.orientation=command.orientation;
    if(command.action==='move'){next.gridX=command.gridX;next.gridY=command.gridY;}
    if(command.action==='attach'){next.surface=command.surface;next.layer=command.layer;next.parentInstanceId=command.parentInstanceId;next.slotId=command.slotId;}
    if(command.action==='detach'){
     // The only HC-PLACE-03 detach target is durable storage. HC-PLACE-05/06
     // own geometric reparenting, and must qualify any future detach-to-floor.
     if(command.detachTarget!=='storage'||old.parentInstanceId===null)fail('detach-target-unsupported');
     next.state='stored';
    }
    next.revision=old.revision+1;next.updatedAt=this.clock();
    next.history=[...old.history,command.operation];
   }
   if(creating){if(!command.record||command.record.instanceId!==command.instanceId||command.record.ownerPrincipal!==who||command.record.state!=='placed'||command.record.revision!==1)fail('invalid-new-instance');Object.assign(next,command.record);}
   if(next.ownerPrincipal!==who||next.instanceId!==command.instanceId||next.assetId!==command.assetId)fail('immutable-identity');
   const checked=definePlacedObject(next,{assetIds,geometry});
   const target=sceneKey(checked);
   const currentScene=s.placementScenes.get(target)??0;
   if(currentScene!==command.expectedSceneRevision)fail('stale-scene');
   if(source&&source!==target)fail('cross-scene-migration-unsupported');
   // Parent/child graph admission is evaluated under the same locked write as custody.
   // Stored attachments retain their immutable support identity for verified restore.
   if(checked.parentInstanceId!==null){
    if(checked.parentInstanceId===checked.instanceId)fail('parent-cycle');
    const parent=s.placementInstances.get(checked.parentInstanceId);
    if(!parent||parent.ownerPrincipal!==who||sceneKey(parent)!==target)fail('parent-authority-or-scene');
    if(checked.state==='placed'&&parent.state!=='placed')fail('parent-not-placed');
    const visited=new Set([checked.instanceId]);let cursor=parent;
    while(cursor){
     if(visited.has(cursor.instanceId))fail('parent-cycle');
     visited.add(cursor.instanceId);
     if(cursor.parentInstanceId===null)break;
     cursor=s.placementInstances.get(cursor.parentInstanceId);
     if(!cursor)fail('parent-chain-corrupt');
    }
   }
   const children=[...s.placementInstances.values()].filter(x=>x.parentInstanceId===checked.instanceId);
   // A support cannot be stored, moved, rotated or structurally mutated while
   // active descendants depend on its transform or physical support.
   if(children.some(x=>x.state==='placed')&&['move','rotate','remove','detach','attach'].includes(command.action))fail('support-has-children');
   if(checked.state==='placed'&&checked.parentInstanceId!==null){
    for(const sibling of s.placementInstances.values()){
     if(sibling.instanceId!==checked.instanceId&&sibling.state==='placed'&&sibling.parentInstanceId===checked.parentInstanceId&&sibling.slotId===checked.slotId)fail('slot-occupied');
    }
   }
   if(command.action==='detach'&&checked.state!=='stored')fail('detach-state');
   const tiles=checked.state==='placed'?rotatedCells(geometry,checked.orientation).map(p=>[p.x+checked.gridX,p.y+checked.gridY].join(':')):[];
   for(const other of s.placementInstances.values()){
    if(other.instanceId===checked.instanceId||other.state!=='placed'||sceneKey(other)!==target)continue;
    if(checked.parentInstanceId!==null&&other.parentInstanceId===checked.parentInstanceId&&other.slotId===checked.slotId)fail('slot-occupied');
    if(tiles.length){
     const mask=geometryRegistry.get(other.assetId);if(!mask)fail('unqualified-existing-object');
     const overlap=rotatedCells(mask,other.orientation).some(p=>tiles.includes([p.x+other.gridX,p.y+other.gridY].join(':')));
     if(overlap)fail('occupied');
    }
   }
   // Reserve/release the *specific* canonical unit under the same SERIALIZABLE lock.
   // Unsourced aggregate balances may not authorize new placement.
   let custody=null;
   if(creating)custody=reservePlacementUnit(s,{owner:who,assetId:checked.assetId,instanceId:checked.instanceId});
   if(command.action==='restore'){
    // A stored instance may only reclaim its ORIGINAL exact custody unit. A later
    // sale or reservation of that unit invalidates restoration, even if fungible
    // inventory of the same asset remains available.
    const bindings=[...s.placementOperations.values()].filter(v=>v.result?.instance?.instanceId===checked.instanceId&&v.result?.custody?.unitId).map(v=>v.result.custody.unitId);
    if(!bindings.length||new Set(bindings).size!==1)fail('missing-or-ambiguous-instance-custody');
    custody=reservePlacementUnit(s,{owner:who,assetId:checked.assetId,instanceId:checked.instanceId,unitId:bindings[0]});
   }
   if(command.action==='remove')custody=releasePlacementUnit(s,{owner:who,assetId:checked.assetId,instanceId:checked.instanceId});
   s.placementInstances.set(checked.instanceId,checked);
   s.placementScenes.set(target,currentScene+1);
   const result={instance:structuredClone(checked),sceneRevision:currentScene+1,...(custody?{custody}: {})};
   s.placementOperations.set(opKey,{payload,result});
   return structuredClone(result);
  });
 }
}

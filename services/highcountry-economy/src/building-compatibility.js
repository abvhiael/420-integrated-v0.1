// HC-ECON-03: reviewed building functions, exact equipment compatibility.
// A pure policy boundary: HC-PLACE owns geometry, custody and authoritative mutations.
import {createHash} from 'node:crypto';
import {defineObjectType,defineTaxonomyCatalog,resolveCertifiedPolicy,validateModifierOutcome,FUNCTIONAL_ROLES,EFFECT_ROLES,ROLE_STACK_CAP_BPS} from './object-taxonomy.js';
import {defineGeometry,definePlacedObject,SURFACES,LAYERS} from './placement-contract.js';
export const BUILDING_COMPAT_VERSION='HC.ECON.BUILDING.COMPAT.V1';
const fail=m=>{throw new TypeError('hc-econ-03:'+m);};
const id=v=>typeof v==='string'&&/^[a-z][a-z0-9_-]{1,63}$/.test(v);
const plain=v=>v!==null&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype;
const shape=(v,ks)=>plain(v)&&Object.keys(v).length===ks.length&&ks.every(k=>Object.hasOwn(v,k));
const uniq=a=>Array.isArray(a)&&a.length===new Set(a).size;
const integer=n=>Number.isSafeInteger(n);
const freeze=o=>{if(o&&typeof o==='object'){for(const v of Object.values(o))freeze(v);Object.freeze(o);}return o;};
const clone=o=>structuredClone(o);
const hash=o=>createHash('sha256').update(JSON.stringify(o)).digest('hex');
const sorted=a=>[...a].sort();
export function defineBuildingFunction(raw,catalog){
 if(!shape(raw,['schemaVersion','buildingTypeId','revision','functions','slots','qualified','qualificationRef']))fail('building-shape');
 if(raw.schemaVersion!==BUILDING_COMPAT_VERSION||!id(raw.buildingTypeId)||!integer(raw.revision)||raw.revision<1||raw.qualified!==true||!id(raw.qualificationRef))fail('building-unqualified');
 if(!uniq(raw.functions)||!raw.functions.length||!raw.functions.every(r=>FUNCTIONAL_ROLES.includes(r)))fail('building-functions');
 if(!Array.isArray(raw.slots)||raw.slots.length>128||!uniq(raw.slots.map(s=>s?.slotId)))fail('building-slots');
 for(const s of raw.slots){
  if(!shape(s,['slotId','function','surface','layer','typeIds','capacity'])||!id(s.slotId)||!raw.functions.includes(s.function)||
  !SURFACES.includes(s.surface)||!LAYERS.includes(s.layer)||!integer(s.capacity)||s.capacity<1||s.capacity>420||
  !uniq(s.typeIds)||!s.typeIds.length)fail('slot-schema');
  for(const tid of s.typeIds){
   const t=catalog.types.find(x=>x.typeId===tid);
   if(!t||!t.qualified||!t.roles.includes(s.function)||!t.surfaces.includes(s.surface)||!t.layers.includes(s.layer))fail('slot-incompatible-type');
  }
 }
 return freeze(clone({...raw,functions:sorted(raw.functions),slots:sorted(raw.slots).sort((a,b)=>a.slotId.localeCompare(b.slotId)).map(s=>({...s,typeIds:sorted(s.typeIds)}))}));
}
export function defineBuildingCompatibilityRegistry({catalog,buildings}={}){
 if(!catalog||!Array.isArray(catalog.types)||!Array.isArray(catalog.policies)||!Array.isArray(buildings))fail('registry-schema');
 // Authenticate taxonomy integrity using the HC-ECON-01 canonical builder.
 const canonical=defineTaxonomyCatalog({types:catalog.types,policies:catalog.policies});
 if(catalog.sha256!==canonical.sha256)fail('taxonomy-tampered');
 const entries=buildings.map(b=>defineBuildingFunction(b,canonical));
 const keys=entries.map(x=>x.buildingTypeId+':'+x.revision);
 if(!uniq(keys))fail('duplicate-building-revision');
 const ordered=[...entries].sort((a,b)=>a.buildingTypeId.localeCompare(b.buildingTypeId)||a.revision-b.revision);
 return freeze({schemaVersion:BUILDING_COMPAT_VERSION,taxonomySha256:canonical.sha256,buildings:ordered,sha256:hash([BUILDING_COMPAT_VERSION,canonical.sha256,ordered])});
}
function verifyRegistry(reg){
 if(!reg||!Array.isArray(reg.buildings)||typeof reg.taxonomySha256!=='string'||reg.sha256!==hash([BUILDING_COMPAT_VERSION,reg.taxonomySha256,reg.buildings]))fail('registry-tampered');
}
export function resolveBuildingCompatibility(reg,{buildingTypeId,revision}={}){
 verifyRegistry(reg);
 if(!id(buildingTypeId)||!integer(revision)||revision<1)fail('building-reference');
 const b=reg.buildings.find(x=>x.buildingTypeId===buildingTypeId&&x.revision===revision);
 if(!b||b.qualified!==true)fail('building-not-certified');
 return freeze(clone({...b,registrySha256:reg.sha256}));
}
export function checkBuildingEquipment({registry,catalog,buildingTypeId,revision,placements,geometries,items,assignedSlots,buildingId,parcelId,ownerPrincipal}={}){
 const b=resolveBuildingCompatibility(registry,{buildingTypeId,revision});
 if(!catalog||defineTaxonomyCatalog({types:catalog.types,policies:catalog.policies}).sha256!==registry.taxonomySha256||!id(buildingId)||!id(parcelId)||!id(ownerPrincipal)||
 !Array.isArray(placements)||!Array.isArray(geometries)||!Array.isArray(items)||!Array.isArray(assignedSlots)||
 placements.length!==items.length||placements.length!==geometries.length||placements.length!==assignedSlots.length||placements.length>420)fail('placement-input');
 const seen=new Set(),counts=new Map(),benefits=[];
 for(let k=0;k<placements.length;k++){
  const p=placements[k],item=items[k],g=geometries[k];
  if(!plain(p)||!plain(item)||!plain(g)||!id(item.itemId)||seen.has(item.itemId)||p.instanceId!==item.itemId)fail('item-identity');
  seen.add(item.itemId);
  if(item.state!=='owned'||item.owner!==ownerPrincipal)fail('item-not-owned');
  if(p.ownerPrincipal!==ownerPrincipal||p.buildingId!==buildingId||p.parcelId!==parcelId||p.state!=='placed')fail('placement-owner');
  definePlacedObject(p,{geometry:g,assetIds:new Set([p.assetId])});
  if(item.designId!==p.assetId||g.assetId!==p.assetId)fail('asset-design-mismatch');
  const t=catalog.types.find(x=>x.typeId===item.typeId);
  if(!t||!t.qualified)fail('unregistered-type');
  const assignedSlot=assignedSlots[k];
  if(!id(assignedSlot))fail('missing-assignment');
  const slot=b.slots.find(s=>s.slotId===assignedSlot&&s.typeIds.includes(item.typeId)&&s.surface===p.surface&&s.layer===p.layer);
  if(!slot||!t.roles.includes(slot.function))fail('equipment-incompatible');
  const used=(counts.get(assignedSlot)??0)+1;
  if(used>slot.capacity)fail('slot-capacity');
  counts.set(slot.slotId,used);
  if(item.origin==='quest'&&item.transferable!==false)fail('quest-transferable');
  if(!Array.isArray(item.effects)||!['developer','creator','quest'].includes(item.origin))fail('modifier-missing');
  const certified=resolveCertifiedPolicy(catalog,{typeId:item.typeId,policyId:item.policyId,revision:item.policyRevision});
  if(certified.policy.origin!==item.origin||item.catalogSha256!==catalog.sha256)fail('item-policy-mismatch');
  validateModifierOutcome(certified,{effects:item.effects});
  benefits.push({origin:item.origin,effects:item.effects});
 }
 // Only roles belonging to the building may produce benefits. Developer effects
 // cannot stack with another source affecting that same functional role.
 const totals=Object.fromEntries(b.functions.map(r=>[r,0]));
 const questTotals=Object.fromEntries(b.functions.map(r=>[r,0]));
 const occupied=new Map(),developerRoles=new Set();
 for(const benefit of benefits)for(const effect of benefit.effects){
  const roles=EFFECT_ROLES[effect.effectId];
  if(!roles||!integer(effect.bps)||effect.bps<0)fail('unregistered-effect');
  for(const role of roles.filter(r=>b.functions.includes(r))){
   occupied.set(role,(occupied.get(role)??0)+1);
   if(benefit.origin==='developer')developerRoles.add(role);
   if(benefit.origin==='quest')questTotals[role]+=effect.bps;
   else totals[role]+=effect.bps;
  }
 }
 if([...developerRoles].some(role=>(occupied.get(role)??0)>1))fail('developer-role-nonstackable');
 const functions=Object.fromEntries(b.functions.map(role=>[role,{
  ordinaryBps:Math.min(totals[role],ROLE_STACK_CAP_BPS[role]),
  questBps:questTotals[role],
  effectiveBps:Math.min(totals[role],ROLE_STACK_CAP_BPS[role])+questTotals[role]
 }]));
 return freeze({buildingId,buildingTypeId,revision,registrySha256:registry.sha256,equipped:sorted([...seen]),slotOccupancy:Object.fromEntries([...counts].sort(([a],[b])=>a.localeCompare(b))),functions});
}

/**
 * Server-only read adapter. Placement authorization, revocation, property rights,
 * item finality and canonical custody remain with the independently supplied
 * HC-PLACE/HC-ECON-02 readers. No browser snapshot is an authority.
 */
export class BuildingCompatibilityService {
 constructor({registry,catalog,reader}={}){
  verifyRegistry(registry);
  if(!reader||typeof reader.readAuthorizedBuilding!=='function'||
    typeof reader.verifyPlacedEquipment!=='function')fail('authoritative-reader-required');
  this.registry=registry;this.catalog=catalog;this.reader=reader;
 }
 async compatibility(session,buildingId){
  if(!id(buildingId)||!session)fail('read-identity');
  const snapshot=await this.reader.readAuthorizedBuilding(session,buildingId);
  if(!snapshot||snapshot.buildingId!==buildingId||!id(snapshot.ownerPrincipal))fail('unauthorized-building');
  if(await this.reader.verifyPlacedEquipment(session,snapshot)!==true)fail('equipment-authority-unverified');
  return checkBuildingEquipment({...snapshot,registry:this.registry,catalog:this.catalog});
 }
}

// HC-ART-05: generic outbuilding room layout checks. HC-PLACE retains mutation authority.
import {defineGeometry,rotatedCells,ORIENTATIONS} from './placement-contract.js';
const fail=m=>{throw new TypeError('hc-outbuilding-placement:'+m)};
const positive=n=>Number.isSafeInteger(n)&&n>0;
export const HERITAGE_SHED_INTERIOR=Object.freeze({width:3,height:2});
export const HERITAGE_SHED_TYPES=Object.freeze({
 'wall-mounted-tool-rack':Object.freeze({surface:'wall_slot',layer:'wall_decor',maxInstalled:1}),
 'garden-equipment-preparation-bench':Object.freeze({surface:'floor',layer:'furniture',maxInstalled:1}),
 'modular-storage-shelving':Object.freeze({surface:'floor',layer:'furniture',maxInstalled:1})
});
/**
 * Pure validation of the complete authoritative room snapshot.
 * Call under the HC-PLACE transaction lock using qualified geometry, approved
 * interior boundaries and approved attachment slots. This is not an authorization
 * service or an inventory mutation. No hard-coded capacity for other buildings.
 */
export function validateOutbuildingLayout({interior,placements,geometryByAsset,qualifiedWallSlots,itemTypes,blockedFloorCells=[]}={}){
 if(!interior||!positive(interior.width)||!positive(interior.height)||!Array.isArray(placements)||
 !(geometryByAsset instanceof Map)||!(qualifiedWallSlots instanceof Set)||!itemTypes||typeof itemTypes!=='object'||
 !Array.isArray(blockedFloorCells))fail('trusted-input-required');
 const counts=new Map(),occupied=new Set(),walls=new Set();
 for(const c of blockedFloorCells){
  if(!c||!Number.isSafeInteger(c.x)||!Number.isSafeInteger(c.y)||c.x<0||c.y<0||c.x>=interior.width||c.y>=interior.height)fail('blocked-cell-invalid');
  occupied.add(c.x+':'+c.y);
 }
 for(const p of placements){
  if(!p||typeof p!=='object'||typeof p.typeId!=='string'||!Object.hasOwn(itemTypes,p.typeId)||typeof p.assetId!=='string')fail('unknown-furniture');
  const spec=itemTypes[p.typeId];
  if(!spec||!positive(spec.maxInstalled)||typeof spec.surface!=='string'||typeof spec.layer!=='string')fail('invalid-type-policy');
  const count=(counts.get(p.typeId)||0)+1;
  if(count>spec.maxInstalled)fail('installation-limit');
  counts.set(p.typeId,count);
  if(p.surface!==spec.surface||p.layer!==spec.layer)fail('wrong-placement-surface');
  if(!ORIENTATIONS.includes(p.orientation))fail('invalid-rotation');
  const g=geometryByAsset.get(p.assetId);
  if(!g)fail('missing-qualified-geometry');
  const geometry=defineGeometry(g);
  if(!geometry.qualified||geometry.assetId!==p.assetId||geometry.surface!==spec.surface||
    geometry.layer!==spec.layer||!geometry.allowedOrientations.includes(p.orientation))fail('geometry-not-authorized');
  if(spec.surface==='wall_slot'||spec.surface==='tabletop_slot'||spec.surface==='shelf_slot'){
   const key=spec.surface+':'+p.slotId;
   if(typeof p.slotId!=='string'||!qualifiedWallSlots.has(key)||walls.has(key))fail('attachment-slot-invalid-or-occupied');
   walls.add(key);continue;
  }
  if(!Number.isSafeInteger(p.gridX)||!Number.isSafeInteger(p.gridY))fail('invalid-floor-coordinates');
  for(const c of rotatedCells(geometry,p.orientation)){
   const x=p.gridX+c.x,y=p.gridY+c.y,k=x+':'+y;
   if(x<0||y<0||x>=interior.width||y>=interior.height)fail('outside-usable-floor');
   if(occupied.has(k))fail('furniture-overlap');
   occupied.add(k);
  }
 }
 return Object.freeze({valid:true,installedTypes:Object.freeze([...counts.keys()].sort()),
  occupiedFloorTiles:occupied.size-blockedFloorCells.length,occupiedAttachmentSlots:walls.size});
}
export function validateHeritageShedFurnitureLayout({placements,geometryByAsset,qualifiedWallSlots}={}){
 const prefixed=new Set(qualifiedWallSlots instanceof Set?[...qualifiedWallSlots].map(s=>'wall_slot:'+s):[]);
 return validateOutbuildingLayout({interior:HERITAGE_SHED_INTERIOR,placements,geometryByAsset,
 qualifiedWallSlots:prefixed,itemTypes:HERITAGE_SHED_TYPES});
}

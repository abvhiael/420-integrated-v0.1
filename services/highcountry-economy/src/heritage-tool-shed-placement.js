// HC-ART-05-A-01: room-specific policy. HC-PLACE owns authoritative transactions.
import {defineGeometry,rotatedCells,ORIENTATIONS} from './placement-contract.js';
export const INTERIOR=Object.freeze({width:3,height:2});
export const FURNITURE=Object.freeze({
 'wall-mounted-tool-rack':Object.freeze({surface:'wall_slot',layer:'wall_decor'}),
 'garden-equipment-preparation-bench':Object.freeze({surface:'floor',layer:'furniture'}),
 'modular-storage-shelving':Object.freeze({surface:'floor',layer:'furniture'})
});
const fail=m=>{throw new TypeError('hc-art-05-a-01:'+m);};
/**
 * Check COMPLETE authoritative room state, not just the incoming object.
 * Invoke inside the HC-PLACE transaction with locked room occupants,
 * pinned certified geometries and trusted wall slots. No browser authority.
 * Item storage/custody and stat application remain with their own services.
 */
export function validateHeritageShedFurnitureLayout({placements,geometryByAsset,qualifiedWallSlots}={}){
 if(!Array.isArray(placements)||!(geometryByAsset instanceof Map)||!(qualifiedWallSlots instanceof Set))fail('trusted-input-required');
 if(placements.length>3)fail('too-many-furniture-items');
 const types=new Set(),occupied=new Set(),walls=new Set();
 for(const p of placements){
  if(!p||typeof p!=='object'||!Object.hasOwn(FURNITURE,p.typeId)||typeof p.assetId!=='string')fail('unknown-furniture');
  if(types.has(p.typeId))fail('duplicate-furniture-type');
  types.add(p.typeId);
  const spec=FURNITURE[p.typeId];
  if(p.surface!==spec.surface||p.layer!==spec.layer)fail('wrong-placement-surface');
  if(!ORIENTATIONS.includes(p.orientation))fail('invalid-rotation');
  const g=geometryByAsset.get(p.assetId);
  if(!g)fail('missing-qualified-geometry');
  const geometry=defineGeometry(g);
  if(!geometry.qualified||geometry.assetId!==p.assetId||geometry.surface!==spec.surface||geometry.layer!==spec.layer||!geometry.allowedOrientations.includes(p.orientation))fail('geometry-not-authorized');
  if(spec.surface==='wall_slot'){
   if(typeof p.slotId!=='string'||!qualifiedWallSlots.has(p.slotId)||walls.has(p.slotId))fail('wall-slot-invalid-or-occupied');
   walls.add(p.slotId);continue;
  }
  if(!Number.isSafeInteger(p.gridX)||!Number.isSafeInteger(p.gridY))fail('invalid-floor-coordinates');
  for(const c of rotatedCells(geometry,p.orientation)){
   const x=p.gridX+c.x,y=p.gridY+c.y,k=x+':'+y;
   if(x<0||y<0||x>=INTERIOR.width||y>=INTERIOR.height)fail('outside-usable-floor');
   if(occupied.has(k))fail('furniture-overlap');
   occupied.add(k);
  }
 }
 return Object.freeze({valid:true,installedTypes:Object.freeze([...types].sort()),occupiedFloorTiles:occupied.size,occupiedWallSlots:walls.size});
}

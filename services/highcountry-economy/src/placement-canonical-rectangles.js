// HC-PLACE-04: conservative full-rectangle masks from existing canonical catalogues.
// No sprite alpha, image canvas, browser preview or client input defines occupancy.
import {createHash} from 'node:crypto';
import {premiumFurnitureCatalogue} from '../../../apps/highcountry-web/src/premium-furniture-catalogue.js';
import {outdoorStructureCatalogue} from '../../../apps/highcountry-web/src/outdoor-structure-catalogue.js';
import {waterWildlifeCatalogue} from '../../../apps/highcountry-web/src/water-wildlife-catalogue.js';
import {fireGatheringCatalogue} from '../../../apps/highcountry-web/src/fire-gathering-catalogue.js';
import {gardenOrnamentCatalogue} from '../../../apps/highcountry-web/src/garden-ornament-catalogue.js';
import {landscapeCatalogue} from '../../../apps/highcountry-web/src/landscape-catalogue.js';
import {recreationCatalogue} from '../../../apps/highcountry-web/src/recreation-catalogue.js';
import {redMesaLeisureCatalogue} from '../../../apps/highcountry-web/src/red-mesa-leisure-catalogue.js';
import {CONTRACT_VERSION,TILE_SIZE_PX,defineGeometry,rotatedCells} from './placement-contract.js';

const sources=Object.freeze([...premiumFurnitureCatalogue,...outdoorStructureCatalogue,...waterWildlifeCatalogue,...fireGatheringCatalogue,...gardenOrnamentCatalogue,...landscapeCatalogue,...recreationCatalogue,...redMesaLeisureCatalogue]);
const identifier=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
const approved=new Map();
for(const item of sources){
 const {width,height,tileSizePx}=item.footprint??{};
 if(!identifier(item.id)||approved.has(item.id)||!Number.isSafeInteger(width)||!Number.isSafeInteger(height)
    ||width<1||height<1||width>256||height>256||tileSizePx!==TILE_SIZE_PX)
  throw Error('hc-place-04:invalid-canonical-footprint');
 if(!['floor','outdoor_ground'].includes(item.placement?.surface)
    ||!['furniture','outdoor_structure','outdoor_feature','outdoor_decor','outdoor_recreation','structure'].includes(item.placement?.layer))
  throw Error('hc-place-04:unsupported-catalogue-surface');
 // Identifier is bound to the exact canonical source metadata; changes produce a new ref.
 const canonical=JSON.stringify([item.id,item.collection,item.assetUrl,item.footprint,item.placement.surface,item.placement.layer]);
 const reference='hc04-'+createHash('sha256').update(canonical).digest('hex');
 // visualPx is a logical tile-space visual proxy, NOT measured sprite pixel bounds.
 // Rendering and the actual art anchor are explicitly outside this geometry registry.
 const geometry=defineGeometry({schemaVersion:CONTRACT_VERSION,assetId:item.id,geometryId:'rectangle-'+item.id,
  geometryVersion:1,surface:item.placement.surface,layer:item.placement.layer,
  visualPx:{width:width*TILE_SIZE_PX,height:height*TILE_SIZE_PX},
  renderAnchorPx:{x:0,y:0},occupancy:{kind:'rectangle',width,height},
  allowedOrientations:[0,90,180,270],qualified:true,qualificationRef:reference});
 for(const angle of geometry.allowedOrientations){
  const cells=rotatedCells(geometry,angle);
  if(cells.length!==width*height||new Set(cells.map(p=>p.x+':'+p.y)).size!==cells.length)
   throw Error('hc-place-04:rotation-not-conservative');
 }
 approved.set(item.id,geometry);
}
export const canonicalRectangleAssetIds=Object.freeze([...approved.keys()].sort());
export const canonicalRectangleEvidence=Object.freeze(canonicalRectangleAssetIds.map(assetId=>Object.freeze({
 assetId,qualificationRef:approved.get(assetId).qualificationRef,
 occupancy:structuredClone(approved.get(assetId).occupancy)
})));
export const resolveCanonicalGeometry=async assetId=>approved.has(assetId)?structuredClone(approved.get(assetId)):null;
export const resolveCanonicalAssets=async()=>new Set(canonicalRectangleAssetIds);
export const canonicalGeometrySnapshot=async()=>new Map([...approved].map(([id,g])=>[id,structuredClone(g)]));
export function createCanonicalRectanglePlacementConfig(world){
 if(!world||typeof world.geometrySnapshot!=='function')throw Error('hc-place-04:missing-independent-world-authority');
 // The world authority must independently return this exact qualified registry.
 // Keep geometrySnapshot on the authority side, not a user-supplied HTTP payload.
 return Object.freeze({world,resolveGeometry:resolveCanonicalGeometry,resolveAssets:resolveCanonicalAssets});
}

// HC-PLACE-02: pure, server-side placement record and geometry contracts.
// This module neither issues inventory nor authorizes mutations or placement.
export const CONTRACT_VERSION='highcountry-placement-v1';
export const TILE_SIZE_PX=64;
const id=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
const int=x=>Number.isSafeInteger(x);
const positive=x=>int(x)&&x>0;
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const fail=reason=>{throw new TypeError('hc-place-02:'+reason);};
const own=(x,k)=>Object.hasOwn(x,k);
const exact=(x,keys)=>object(x)&&Object.keys(x).length===keys.length&&keys.every(k=>own(x,k));
export const SURFACES=Object.freeze(['floor','outdoor_ground','wall_slot','tabletop_slot','shelf_slot']);
export const LAYERS=Object.freeze(['furniture','cultivation','outdoor_structure','outdoor_feature','outdoor_decor','outdoor_path','outdoor_recreation','wall_decor','tabletop_decor','shelf_decor']);
export const ORIENTATIONS=Object.freeze([0,90,180,270]);
export const STATES=Object.freeze(['stored','placed','removed']);
const layerSurface=Object.freeze({
 furniture:['floor'],cultivation:['floor','outdoor_ground'],outdoor_structure:['outdoor_ground'],
 outdoor_feature:['outdoor_ground'],outdoor_decor:['outdoor_ground'],outdoor_path:['outdoor_ground'],
 outdoor_recreation:['outdoor_ground'],wall_decor:['wall_slot'],
 tabletop_decor:['tabletop_slot'],shelf_decor:['shelf_slot']
});
const sortedUnique=c=>Array.isArray(c)&&new Set(c).size===c.length;
const dimensions=d=>exact(d,['width','height'])&&positive(d.width)&&positive(d.height)&&d.width<=256&&d.height<=256;
const anchor=a=>exact(a,['x','y'])&&int(a.x)&&int(a.y)&&Math.abs(a.x)<=1048576&&Math.abs(a.y)<=1048576;
const cells=c=>Array.isArray(c)&&c.length>0&&c.length<=65536&&c.every(p=>exact(p,['x','y'])&&int(p.x)&&int(p.y)&&p.x>=0&&p.y>=0&&p.x<256&&p.y<256)&&new Set(c.map(p=>p.x+':'+p.y)).size===c.length;
export function defineGeometry(g){
 if(!exact(g,['schemaVersion','assetId','geometryId','geometryVersion','surface','layer','visualPx','renderAnchorPx','occupancy','allowedOrientations','qualified','qualificationRef']))fail('geometry-shape');
 if(g.schemaVersion!==CONTRACT_VERSION||!id(g.assetId)||!id(g.geometryId)||!positive(g.geometryVersion)||!SURFACES.includes(g.surface)||!LAYERS.includes(g.layer)||!layerSurface[g.layer].includes(g.surface))fail('geometry-identity');
 if(!dimensions(g.visualPx)||!anchor(g.renderAnchorPx)||!sortedUnique(g.allowedOrientations)||!g.allowedOrientations.length||!g.allowedOrientations.every(v=>ORIENTATIONS.includes(Number(v))&&typeof v==='number'))fail('geometry-visual');
 if(typeof g.qualified!=='boolean'||(g.qualified&&!id(g.qualificationRef))||(g.qualificationRef!==null&&!id(g.qualificationRef)))fail('geometry-qualification');
 const attached=['wall_slot','tabletop_slot','shelf_slot'].includes(g.surface);
 if(!object(g.occupancy)||!['none','rectangle','cells'].includes(g.occupancy.kind))fail('geometry-mask');
 if(attached){if(g.occupancy.kind!=='none'||Object.keys(g.occupancy).length!==1)fail('attached-floor-occupancy');}
 else if(g.occupancy.kind==='rectangle'){
   if(!exact(g.occupancy,['kind','width','height'])||!positive(g.occupancy.width)||!positive(g.occupancy.height)||g.occupancy.width>256||g.occupancy.height>256)fail('rectangle-mask');
 }else if(g.occupancy.kind==='cells'){
   if(!exact(g.occupancy,['kind','cells'])||!cells(g.occupancy.cells))fail('cells-mask');
 }else fail('ground-mask-required');
 // Never let unqualified catalogue dimensions become usable physics.
 return Object.freeze(structuredClone(g));
}
export function rotatedCells(geometry,orientation){
 const g=defineGeometry(geometry);
 if(!g.qualified)fail('geometry-unqualified');
 if(!g.allowedOrientations.includes(orientation))fail('orientation-denied');
 if(g.occupancy.kind==='none')return Object.freeze([]);
 const source=g.occupancy.kind==='rectangle'
  ?Array.from({length:g.occupancy.width*g.occupancy.height},(_,i)=>({x:i%g.occupancy.width,y:Math.floor(i/g.occupancy.width)}))
  :g.occupancy.cells;
 const transformed=source.map(({x,y})=>orientation===0?{x,y}:orientation===90?{x:-y,y:x}:orientation===180?{x:-x,y:-y}:{x:y,y:-x});
 const minX=Math.min(...transformed.map(p=>p.x)),minY=Math.min(...transformed.map(p=>p.y));
 return Object.freeze(transformed.map(p=>Object.freeze({x:p.x-minX,y:p.y-minY})).sort((a,b)=>a.y-b.y||a.x-b.x));
}
const recordKeys=['schemaVersion','instanceId','assetId','ownerPrincipal','parcelId','buildingId','roomId','regionId','surface','layer','gridX','gridY','orientation','renderAnchor','geometryId','geometryVersion','parentInstanceId','slotId','revision','createdAt','updatedAt','history','state','validationVersion'];
export function definePlacedObject(record,{geometry,assetIds}={}){
 if(!exact(record,recordKeys))fail('record-shape');
 const r=record;
 if(r.schemaVersion!==CONTRACT_VERSION||!id(r.instanceId)||!id(r.assetId)||!id(r.ownerPrincipal)||!id(r.parcelId)||!id(r.regionId)||!id(r.geometryId)||!positive(r.geometryVersion)||!positive(r.validationVersion))fail('record-identity');
 if(!['emerald-coast','golden-prairie','red-mesa'].includes(r.regionId))fail('region');
 if(![r.buildingId,r.roomId].every(x=>x===null||id(x))||(r.roomId!==null&&r.buildingId===null))fail('room');
 if(!SURFACES.includes(r.surface)||!LAYERS.includes(r.layer)||!layerSurface[r.layer].includes(r.surface)||!int(r.gridX)||!int(r.gridY)||Math.abs(r.gridX)>10000000||Math.abs(r.gridY)>10000000||!ORIENTATIONS.includes(r.orientation)||!anchor(r.renderAnchor))fail('coordinate-surface');
 if(!positive(r.revision)||!positive(r.createdAt)||!positive(r.updatedAt)||r.updatedAt<r.createdAt||!STATES.includes(r.state)||!Array.isArray(r.history)||r.history.length>10000||!r.history.every(id))fail('record-lifecycle');
 const attached=['wall_slot','tabletop_slot','shelf_slot'].includes(r.surface);
 if(attached?(!id(r.parentInstanceId)||!id(r.slotId)):(r.parentInstanceId!==null||r.slotId!==null))fail('attachment-parent');
 if(!(assetIds instanceof Set)||!assetIds.has(r.assetId))fail('unknown-asset');
 if(!geometry)fail('missing-geometry');
 const g=defineGeometry(geometry);
 if(!g.qualified||g.assetId!==r.assetId||g.geometryId!==r.geometryId||g.geometryVersion!==r.geometryVersion||g.surface!==r.surface||g.layer!==r.layer||!g.allowedOrientations.includes(r.orientation))fail('geometry-incompatible');
 return Object.freeze(structuredClone(r));
}

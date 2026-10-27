// Geography admission is separate from the previously qualified schematic cadastral counters.
// Never turn a synthetic rectangle or unapproved terrain into a certified survey.
export function validateGeographicSurvey(inventory, atlas){
 if (!atlas||atlas.status!=='OWNER_APPROVED_TERRAIN_SURVEY' || atlas.schema!=='HC.WORLD.TERRAIN.SURVEY.V1') throw Error('approved terrain survey required');
 if (!Array.isArray(atlas.regions)||atlas.regions.length!==3)throw Error('three surveyed regions required');
 const heritageByRegion=new Map();
 for(const region of atlas.regions){
  if (!Number.isInteger(region.id)||!Array.isArray(region.allocatablePolygons)||!Array.isArray(region.exclusions)||!Array.isArray(region.accessCorridors)||!Array.isArray(region.heritageBuffers))throw Error('incomplete terrain survey');
  if (!region.sourceAssetSHA256 || !/^[0-9a-f]{64}$/i.test(region.sourceAssetSHA256)) throw Error('terrain evidence hash required');
  if (region.heritageBuffers.length!==64 && region.heritageBuffers.length===0)throw Error('heritage survey required');
  heritageByRegion.set(region.id,region.heritageBuffers);
 }
 const within=(a,b)=>a[0]>=b[0]&&a[1]>=b[1]&&a[2]<=b[2]&&a[3]<=b[3];
 const intersects=(a,b)=>a[0]<b[2]&&b[0]<a[2]&&a[1]<b[3]&&b[1]<a[3];
 for(const r of inventory.regions){
  const a=atlas.regions.find(x=>x.id===r.regionId);if(!a)throw Error('missing region atlas');
  if (r.countyGrid.allocatableMask==='SCHEMATIC_FULL_RECTANGLE_NOT_TERRAIN_APPROVED')throw Error('schematic parcel geometry cannot be certified');
  if (a.heritageBuffers.length<1)throw Error('heritage buffers required');
  for(const p of r.parcels){
   if(p.siteSurvey!=='FIELD_SURVEYED'||p.access==='SURVEY_ROAD_EASEMENT_REQUIRED')throw Error('unverified parcel');
   if(!a.allocatablePolygons.some(poly=>within(p.bounds,poly.bounds)))throw Error('parcel outside approved terrain');
   if(a.exclusions.some(ex=>intersects(p.bounds,ex.bounds)))throw Error('parcel intersects terrain exclusion');
   if(a.heritageBuffers.some(h=>intersects(p.bounds,h.bounds)))throw Error('parcel intersects heritage protection');
   if(!a.accessCorridors.some(e=>e.connectedParcelIds?.includes(p.id)))throw Error('parcel lacks certified access');
  }
 }
 return true;
}

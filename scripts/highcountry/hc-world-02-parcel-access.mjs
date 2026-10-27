// HC-WORLD-02 parcel-level access and physical terrain admission, kept separate from
// the previously qualified schematic reservation generator.
// All coordinates follow the canonical half-open integer tile convention.
export const overlap=(a,b)=>a[0]<b[2]&&b[0]<a[2]&&a[1]<b[3]&&b[1]<a[3];
export const contains=(outer,inner)=>outer[0]<=inner[0]&&outer[1]<=inner[1]&&outer[2]>=inner[2]&&outer[3]>=inner[3];
const rect=b=>Array.isArray(b)&&b.length===4&&b.every(Number.isSafeInteger)&&b[0]>=0&&b[1]>=0&&b[0]<b[2]&&b[1]<b[3];
const connected=(nodes,edges,roots)=>{
 const adj=new Map(nodes.map(n=>[n.id,[]]));
 for(const e of edges){if(!adj.has(e.from)||!adj.has(e.to))throw Error('road edge references unknown node');adj.get(e.from).push(e.to);adj.get(e.to).push(e.from)}
 const seen=new Set(roots),queue=[...roots];
 if(!roots.length||roots.some(x=>!adj.has(x)))throw Error('invalid road roots');
 for(let k=0;k<queue.length;k++)for(const next of adj.get(queue[k]))if(!seen.has(next)){seen.add(next);queue.push(next)}
 return seen;
};
const touches=(lot,road)=>{
 // Positive-length shared boundary, not merely a diagonal corner.
 const overlapX=Math.max(0,Math.min(lot[2],road[2])-Math.max(lot[0],road[0]));
 const overlapY=Math.max(0,Math.min(lot[3],road[3])-Math.max(lot[1],road[1]));
 return ((lot[2]===road[0]||lot[0]===road[2])&&overlapY>0)||
        ((lot[3]===road[1]||lot[1]===road[3])&&overlapX>0);
};
export function validateParcelAccessAndTerrain(region, survey){
 if(!survey||survey.schema!=='HC.WORLD.PHYSICAL.SURVEY.V1'||survey.status!=='OWNER_APPROVED_TERRAIN_SURVEY')throw Error('approved physical terrain survey required');
 if(region.regionId!==survey.regionId)throw Error('region mismatch');
 if(!/^[0-9a-f]{64}$/i.test(survey.terrainAssetSHA256||''))throw Error('terrain source hash missing');
 if(!Array.isArray(survey.allocatableMask)||!survey.allocatableMask.length||!Array.isArray(survey.exclusions)||!Array.isArray(survey.heritageBuffers)||!Array.isArray(survey.roadNodes)||!Array.isArray(survey.roadEdges)||!Array.isArray(survey.roadSurfaces)||!Array.isArray(survey.accessEvidence))throw Error('incomplete physical survey');
 const allShapes=[...survey.allocatableMask,...survey.exclusions,...survey.heritageBuffers,...survey.roadSurfaces];
 if(allShapes.some(x=>!rect(x.bounds)))throw Error('invalid surveyed geometry');
 if(survey.heritageBuffers.length!==survey.expectedRegionalHeritageCount)throw Error('heritage count mismatch');
 const roadNodes=new Map(survey.roadNodes.map(n=>[n.id,n]));
 if(roadNodes.size!==survey.roadNodes.length)throw Error('duplicate road node');
 const accessible=connected(survey.roadNodes,survey.roadEdges,survey.roadRoots);
 const surfaces=new Map(survey.roadSurfaces.map(s=>[s.id,s]));
 if(surfaces.size!==survey.roadSurfaces.length)throw Error('duplicate road surface');
 for(const s of survey.roadSurfaces){
  if(!roadNodes.has(s.nodeId)||!accessible.has(s.nodeId))throw Error('road surface disconnected');
  if(survey.exclusions.some(e=>overlap(s.bounds,e.bounds))||survey.heritageBuffers.some(h=>overlap(s.bounds,h.bounds)))throw Error('road intersects protected area');
 }
 const accessMap=new Map(survey.accessEvidence.map(e=>[e.parcelId,e]));
 if(accessMap.size!==survey.accessEvidence.length)throw Error('duplicate access evidence');
 if(accessMap.size!==region.parcels.length)throw Error('incomplete parcel access evidence');
 for(const p of region.parcels){
  if(p.siteSurvey!=='FIELD_SURVEYED')throw Error('parcel has not been physically surveyed');
  if(!rect(p.bounds)||!survey.allocatableMask.some(m=>contains(m.bounds,p.bounds)))throw Error('parcel outside allocatable mask');
  if(survey.exclusions.some(e=>overlap(p.bounds,e.bounds)))throw Error('parcel intersects excluded terrain');
  if(survey.heritageBuffers.some(h=>overlap(p.bounds,h.bounds)))throw Error('parcel intersects heritage buffer');
  const e=accessMap.get(p.id);if(!e||!['PUBLIC_ROAD','REGISTERED_EASEMENT'].includes(e.type))throw Error('parcel lacks supported road or easement');
  const road=surfaces.get(e.roadSurfaceId);if(!road)throw Error('missing road surface');
  if(!touches(p.bounds,road.bounds))throw Error('no surveyed frontage at parcel boundary');
  if(e.type==='REGISTERED_EASEMENT'&&(!e.easementId||!e.grantSource||!e.registered))throw Error('unregistered easement');
  if(p.owner!==null||p.issuance!=='RESERVED_UNISSUED')throw Error('survey cannot issue or transfer title');
 }
 return {regionId:region.regionId,verifiedParcels:region.parcels.length,connectedRoadNodes:accessible.size};
}
export function auditUnsurveyedReservations(world){
 const findings=[];
 for(const r of world.regions)for(const p of r.parcels){
  if(p.siteSurvey!=='FIELD_SURVEYED'||p.access==='SURVEY_ROAD_EASEMENT_REQUIRED')findings.push(p.id);
 }
 return {total:world.regions.reduce((n,r)=>n+r.parcels.length,0),blocked:findings.length,samples:findings.slice(0,12),admission:'DENIED_UNTIL_PHYSICAL_TERRAIN_AND_ACCESS_EVIDENCE'};
}

// HC-WORLD-02 exhaustive cadastral admission. It validates submitted terrain evidence;
// it does NOT manufacture owner approval or replace authoritative surveyed map sources.
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {generate} from './hc-world-02-cadastre.mjs';
const validRect=b=>Array.isArray(b)&&b.length===4&&b.every(Number.isSafeInteger)&&b[0]>=0&&b[1]>=0&&b[2]>b[0]&&b[3]>b[1];
const intersects=(a,b)=>a[0]<b[2]&&b[0]<a[2]&&a[1]<b[3]&&b[1]<a[3];
const inside=(a,b)=>a[0]<=b[0]&&a[1]<=b[1]&&a[2]>=b[2]&&a[3]>=b[3];
const frontage=(a,b)=>((a[2]===b[0]||a[0]===b[2])&&Math.min(a[3],b[3])>Math.max(a[1],b[1]))||((a[3]===b[1]||a[1]===b[3])&&Math.min(a[2],b[2])>Math.max(a[0],b[0]));
const hash=obj=>createHash('sha256').update(JSON.stringify(obj)).digest('hex');
const expectedCounts={R:8300,U:1700,C:420};
const expectedSizes={R:{RANCH:[256,256],ESTATE:[144,144],SMALLHOLDING:[80,80],HOMESTEAD:[48,48]},U:{COMPACT:[16,20],STANDARD:[24,24],LARGE:[32,32]},C:{COMPACT:[24,24],STANDARD:[32,32],LARGE:[48,48]}};
export function verifyRegionalSurvey(region, baseline, {requireApproval=true}={}){
 if(!region||region.schema!=='HC.WORLD.REGIONAL.SURVEY.V1')throw Error('regional survey schema');
 if(requireApproval&&(region.status!=='OWNER_APPROVED'||!region.approvalEvidence))throw Error('owner-approved terrain evidence required');
 if(!/^[0-9a-f]{64}$/i.test(region.sourceTerrainSHA256||''))throw Error('terrain hash');
 for(const key of ['parcels','allocatable','zoning','exclusions','heritage','roads','junctions','edges','access'])if(!Array.isArray(region[key]))throw Error('missing '+key);
 if(region.regionId!==baseline.regionId)throw Error('wrong region');
 const [width,height]=[16000,10000],withinWorld=b=>validRect(b)&&b[2]<=width&&b[3]<=height;
 const all=[...region.allocatable,...region.zoning,...region.exclusions,...region.heritage,...region.roads];
 if(all.some(v=>!withinWorld(v.bounds)))throw Error('invalid surveyed bounds');
 // Disjoint nondevelopable areas cannot be counted toward the allocatable denominator.
 const area=b=>(b[2]-b[0])*(b[3]-b[1]);
 const maskArea=region.allocatable.reduce((s,x)=>s+area(x.bounds),0);
 if(!maskArea)throw Error('zero allocatable area');
 for(let i=0;i<region.allocatable.length;i++)for(let j=0;j<i;j++)if(intersects(region.allocatable[i].bounds,region.allocatable[j].bounds))throw Error('overlapping allocatable mask');
 for(const e of region.exclusions)if(region.allocatable.some(m=>intersects(e.bounds,m.bounds)))throw Error('nondevelopable land counted in allocatable mask');
 const expected={PURCHASABLE:65,COMMUNITY:10,COOPERATIVE_LEASED:10,TOWN_CIVIC:10,CORP_RESERVE:5};
 const zoningTotals=Object.fromEntries(Object.keys(expected).map(k=>[k,0]));
 for(let i=0;i<region.zoning.length;i++){
  const z=region.zoning[i];if(!(z.kind in expected))throw Error('unknown zoning');
  if(!region.allocatable.some(m=>inside(m.bounds,z.bounds)))throw Error('zoning outside allocatable land');
  for(let j=0;j<i;j++)if(intersects(z.bounds,region.zoning[j].bounds))throw Error('overlapping zoning');
  zoningTotals[z.kind]+=area(z.bounds);
 }
 for(const [k,v] of Object.entries(expected))if(zoningTotals[k]*100!==maskArea*v)throw Error('actual land budget '+k);
 if(Object.values(zoningTotals).reduce((a,b)=>a+b,0)!==maskArea)throw Error('unallocated area');
 const original=new Map(baseline.parcels.map(p=>[p.id,p]));
 if(region.parcels.length!==baseline.parcels.length)throw Error('incorrect parcel count');
 const observed={R:0,U:0,C:0},seen=new Set(),rects=[];
 for(const p of region.parcels){
  const ref=original.get(p.id);if(!ref||seen.has(p.id))throw Error('unknown or duplicate immutable parcel ID');
  seen.add(p.id);observed[p.kind]=(observed[p.kind]||0)+1;
  if(p.kind!==ref.kind||p.parcelClass!==ref.parcelClass||p.settlementId!==ref.settlementId)throw Error('modified canonical parcel identity');
  if(!withinWorld(p.bounds))throw Error('invalid parcel bounds');
  const dims=expectedSizes[p.kind]?.[p.parcelClass];
  if(!dims||p.bounds[2]-p.bounds[0]!==dims[0]||p.bounds[3]-p.bounds[1]!==dims[1])throw Error('modified parcel size');
  if(!region.zoning.some(z=>z.kind==='PURCHASABLE'&&inside(z.bounds,p.bounds)))throw Error('parcel outside titled zone');
  if(region.exclusions.some(e=>intersects(e.bounds,p.bounds)))throw Error('parcel intersects prohibited terrain');
  if(region.heritage.some(h=>intersects(h.bounds,p.bounds)))throw Error('parcel intersects heritage');
  if(p.owner!==null||p.issuance!=='RESERVED_UNISSUED')throw Error('unissued ownership invariant');
  rects.push(p.bounds);
 }
 for(const [k,n] of Object.entries(expectedCounts))if(observed[k]!==n)throw Error('regional title counts');
 // Sweep line: compare rectangles only where vertical intervals overlap.
 rects.sort((a,b)=>a[1]-b[1]||a[0]-b[0]);let active=[];
 for(const b of rects){active=active.filter(a=>a[3]>b[1]);if(active.some(a=>intersects(a,b)))throw Error('overlapping parcel titles');active.push(b)}
 const graph=new Map(region.junctions.map(n=>[n.id,[]]));
 if(graph.size!==region.junctions.length||!graph.size)throw Error('invalid junctions');
 for(const e of region.edges){if(!graph.has(e.from)||!graph.has(e.to))throw Error('unknown road junction');graph.get(e.from).push(e.to);graph.get(e.to).push(e.from)}
 const root=region.roadRoot;if(!graph.has(root))throw Error('invalid road root');
 const reached=new Set([root]),queue=[root];for(let i=0;i<queue.length;i++)for(const k of graph.get(queue[i]))if(!reached.has(k)){reached.add(k);queue.push(k)}
 const roads=new Map();
 for(const road of region.roads){
  if(roads.has(road.id))throw Error('duplicate road');
  if(!reached.has(road.junctionId))throw Error('disconnected road');
  if(region.exclusions.some(e=>intersects(e.bounds,road.bounds))||region.heritage.some(h=>intersects(h.bounds,road.bounds)))throw Error('road intersects protected terrain');
  roads.set(road.id,road);
 }
 const access=new Map();
 for(const entry of region.access){if(access.has(entry.parcelId))throw Error('duplicate parcel access');access.set(entry.parcelId,entry)}
 if(access.size!==region.parcels.length)throw Error('missing parcel access records');
 for(const p of region.parcels){
  const a=access.get(p.id),road=roads.get(a?.roadId);
  if(!road||!frontage(p.bounds,road.bounds))throw Error('no connected geometric parcel frontage');
  if(a.type==='EASEMENT'&&(!a.registered||!a.documentHash||!a.grantId))throw Error('unverified easement');
  if(a.type!=='PUBLIC_ROAD'&&a.type!=='EASEMENT')throw Error('invalid access type');
 }
 return {regionId:region.regionId,parcels:seen.size,accessible:access.size,allocatableArea:maskArea,zoneTotals:zoningTotals,sourceSHA256:region.sourceTerrainSHA256,surveySHA256:hash(region)};
}
export function verifyWorldSurvey(world,baseline=generate(),options={}){
 if(world?.schema!=='HC.WORLD.ALL.REGIONS.SURVEY.V1'||!Array.isArray(world.regions)||world.regions.length!==3)throw Error('three regional surveys required');
 const ids=new Set(),results=[];
 for(const r of world.regions){if(ids.has(r.regionId))throw Error('duplicate region');ids.add(r.regionId);const b=baseline.regions.find(x=>x.regionId===r.regionId);if(!b)throw Error('unknown region');results.push(verifyRegionalSurvey(r,b,options))}
 if(results.reduce((n,r)=>n+r.parcels,0)!==31260)throw Error('world parcel count');
 return {schema:'HC.WORLD.SURVEY.EVIDENCE.V1',status:'GEOGRAPHY_ADMISSION_VALID',totalParcels:31260,regions:results};
}
if(process.argv[1]&&process.argv[1].endsWith('hc-world-02-full-survey.mjs')){if(!process.argv[2])throw Error('pass a surveyed inventory JSON path');const report=verifyWorldSurvey(JSON.parse(readFileSync(process.argv[2],'utf8')));console.log(JSON.stringify(report,null,2))}

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const read=p=>JSON.parse(readFileSync(path.join(root,p),'utf8'));
export const input=read('deployments/highcountry/hc-world-founding-spec.v1.json');
export const mix=read('deployments/highcountry/hc-world-02-approved-rural-mix.v1.json');
export const WIDTH=16000,HEIGHT=10000;
export const zoning=[['PURCHASABLE',0,6500],['COMMUNITY',6500,7500],['COOPERATIVE_LEASED',7500,8500],['TOWN_CIVIC',8500,9500],['CORP_RESERVE',9500,10000]];
const ruralClasses=[['RANCH',256,350],['ESTATE',144,1250],['SMALLHOLDING',80,2500],['HOMESTEAD',48,4200]];
const urbanClasses=[['COMPACT',16,20,850],['STANDARD',24,24,650],['LARGE',32,32,200]];
const commercialClasses=[['COMPACT',24,24,220],['STANDARD',32,32,160],['LARGE',48,48,40]];
// Site order is a deterministic geometric reservation, not a terrain overlay.
function makeRegion(region){
  const code=region.code,ss=input.settlements.filter(s=>s.regionId===region.id);
  const parcels=[],counters={R:0,U:0,C:0};let shelfY=0;
  function allocate(kind,klass,w,h,qty,extra){
    let x=0,y=shelfY,at=0;const start=shelfY;
    while(at<qty){
      if(x+w>WIDTH){x=0;y+=h;}
      if(y+h>6500)throw Error('purchasable zone overflow: '+code+' '+kind+' '+klass);
      const serial=++counters[kind];const record={id:`HC-${code}-${kind}-${String(serial).padStart(6,'0')}`,regionId:region.id,kind,parcelClass:klass,bounds:[x,y,x+w,y+h],owner:null,issuance:'RESERVED_UNISSUED',access:'SURVEY_ROAD_EASEMENT_REQUIRED',siteSurvey:'SYNTHETIC_RECTANGULAR_RESERVATION',...extra?.(at)};
      parcels.push(record);x+=w;at++;
    }
    shelfY=y+h;return {start,end:shelfY};
  }
  let ruralIndex=0;
  for(const [klass,w,qty] of ruralClasses)allocate('R',klass,w,w,qty,()=>({geographicCluster:geographicCluster(region.code,klass,ruralIndex++)}));
  const residentialSlots=ss.flatMap(s=>Array.from({length:s.residentialCapacity},()=>s.id));
  const commercialSlots=ss.flatMap(s=>Array.from({length:s.commercialCapacity},()=>s.id));
  let u=0,c=0;
  for(const [klass,w,h,qty] of urbanClasses)allocate('U',klass,w,h,qty,()=>({settlementId:residentialSlots[u++]}));
  for(const [klass,w,h,qty] of commercialClasses)allocate('C',klass,w,h,qty,()=>({settlementId:commercialSlots[c++]}));
  return {regionId:region.id,code,countyGrid:{width:WIDTH,height:HEIGHT,allocatableMask:'SCHEMATIC_FULL_RECTANGLE_NOT_TERRAIN_APPROVED'},zoning:zoning.map(([category,yMin,yMax])=>({category,bounds:[0,yMin,WIDTH,yMax],areaTiles:WIDTH*(yMax-yMin)})),occupiedBandHeight:shelfY,parcels,unissued:true};
}
function geographicCluster(code,klass,i){
 const table={
 EC:{RANCH:['SOUTHERN_VALLEYS','EASTERN_FOOTHILLS'],ESTATE:['SOUTHERN_VALLEYS','CENTRAL_RIVER','EASTERN_FOOTHILLS'],SMALLHOLDING:['CENTRAL_RIVER','SOUTHERN_VALLEYS','NORTHERN_FOREST'],HOMESTEAD:['NORTHERN_FOREST','WESTERN_COAST','CENTRAL_RIVER','EASTERN_HIGHLANDS']},
 GP:{RANCH:['WESTERN_GRAZING','NORTHERN_PLAINS'],ESTATE:['EASTERN_GRAIN_BELT','OPEN_PRAIRIE'],SMALLHOLDING:['SOUTHERN_RIVERLANDS','EASTERN_GRAIN_BELT'],HOMESTEAD:['CENTRAL_RAIL','SOUTHERN_RIVERLANDS','NORTHERN_SHELTERBELT']},
 RM:{RANCH:['WESTERN_PLATEAU','DESERT_BASIN'],ESTATE:['DESERT_BASIN','ACCESSIBLE_MESA'],SMALLHOLDING:['SOUTHERN_IRRIGATED','CENTRAL_TRADE'],HOMESTEAD:['SPRING_SETTLEMENTS','CENTRAL_TRADE','SOUTHERN_IRRIGATED']}
 };const options=table[code][klass];return options[i%options.length];
}
export function generate(){return {schema:'HC.WORLD.CADASTRAL.RESERVATION.V1',status:'SCHEMATIC_SURVEY_NOT_TERRAIN_VALIDATED_OR_ISSUED',reference:'HC.WORLD.INTEGER.TILE.V1',geometryRule:'half-open bounds [minX,minY,maxX,maxY)',urbanFootprints:urbanClasses.map(([name,w,h,count])=>({name,w,h,count})),commercialFootprints:commercialClasses.map(([name,w,h,count])=>({name,w,h,count})),regions:input.regions.map(makeRegion)}}
export function validate(m){
 if(m.regions.length!==3)throw Error('regions');const ids=new Set();
 for(const r of m.regions){
  if(r.parcels.length!==10420)throw Error('count');
  const counts={R:0,U:0,C:0};const settlementCounts=new Map();const areaByZone=Object.fromEntries(r.zoning.map(z=>[z.category,z.areaTiles]));
  for(const p of r.parcels){
   if(ids.has(p.id))throw Error('duplicate ID');ids.add(p.id);counts[p.kind]++;
   const [x,y,X,Y]=p.bounds;
   if(![x,y,X,Y].every(Number.isSafeInteger)||x<0||y<0||X>WIDTH||Y>6500||x>=X||y>=Y)throw Error('invalid bounds');
   if(p.kind!=='R'){const key=p.settlementId+':'+p.kind;settlementCounts.set(key,(settlementCounts.get(key)||0)+1)}
  }
  if(counts.R!==8300||counts.U!==1700||counts.C!==420)throw Error('class count');
  for(const s of input.settlements.filter(s=>s.regionId===r.regionId)){
   if(settlementCounts.get(s.id+':U')!==s.residentialCapacity||settlementCounts.get(s.id+':C')!==s.commercialCapacity)throw Error('settlement count');
  }
  const byArea=Object.fromEntries(r.zoning.map(z=>[z.category,100*z.areaTiles/(WIDTH*HEIGHT)]));
  for(const [k,v] of Object.entries(input.landBudget.percentages))if(byArea[k]!==v)throw Error('budget '+k);
  // Sweep by Y with active prior rectangles to check exact non-overlap.
  const boxes=r.parcels.map(p=>p.bounds).sort((a,b)=>a[1]-b[1]||a[0]-b[0]);let active=[];
  for(const box of boxes){active=active.filter(a=>a[3]>box[1]);for(const a of active)if(box[0]<a[2]&&a[0]<box[2]&&box[1]<a[3]&&a[1]<box[3])throw Error('overlap');active.push(box)}
 }
 return true;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const m=generate();validate(m);const out=process.argv[2]||'/tmp/hc-world-02-cadastre.json';mkdirSync(path.dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(m));console.log(JSON.stringify({output:out,total:m.regions.reduce((s,r)=>s+r.parcels.length,0),zoneArea:m.regions[0].zoning,occupiedHeight:m.regions[0].occupiedBandHeight}));}

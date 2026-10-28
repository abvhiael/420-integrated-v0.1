// HC-WORLD-06 navigation design contract. Not a cadastral survey or land authority.
export function pointInPolygon(point,polygon){
 let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[i],b=polygon[j];if(((a[1]>point[1])!==(b[1]>point[1]))&&(point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0]))inside=!inside;
 }return inside;
}
const validPoint=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isSafeInteger);
const rectBounds=p=>[Math.min(...p.map(v=>v[0])),Math.min(...p.map(v=>v[1])),Math.max(...p.map(v=>v[0])),Math.max(...p.map(v=>v[1]))];
const overlap=(a,b)=>a[0]<b[2]&&b[0]<a[2]&&a[1]<b[3]&&b[1]<a[3];
const edgeTouch=(a,b)=>((a[2]===b[0]||b[2]===a[0])&&Math.min(a[3],b[3])>Math.max(a[1],b[1]))||((a[3]===b[1]||b[3]===a[1])&&Math.min(a[2],b[2])>Math.max(a[0],b[0]));
export function validatePortAlderNavigation(m){
 if(m?.schema!=='HC.WORLD.PORT.ALDER.DISTRICT.NAV.V1'||m.settlementId!=='HC-EC-S01'||m.regionId!==1)throw Error('port alder navigation schema');
 if(m.status!=='DESIGN_GEOMETRY_PENDING_TERRAIN_ALIGNMENT'||m.ownershipAuthority!=='NONE_NAVIGATION_ONLY')throw Error('navigation must not confer land authority');
 if(!Array.isArray(m.districts)||m.districts.length!==13||!Array.isArray(m.countryExits))throw Error('missing district contract');
 const ids=new Map(),labels=new Set(),scenes=new Set(),rects=[];
 for(const d of m.districts){
  if(!/^HC-EC-S01-D(0[1-9]|1[0-3])$/.test(d.id)||ids.has(d.id))throw Error('invalid or duplicate immutable district id');
  if(typeof d.label!=='string'||!d.label||labels.has(d.label)||typeof d.sceneId!=='string'||scenes.has(d.sceneId))throw Error('duplicate or empty navigation label/scene');
  if(!Array.isArray(d.polygon)||d.polygon.length<3||!d.polygon.every(validPoint)||!validPoint(d.entrance)||!Array.isArray(d.neighbours))throw Error('invalid polygon or entrance');
  const b=rectBounds(d.polygon);
  if(b[0]<m.bounds[0]||b[1]<m.bounds[1]||b[2]>m.bounds[2]||b[3]>m.bounds[3])throw Error('district outside town bounds');
  if(!pointInPolygon(d.entrance,d.polygon))throw Error('entrance outside district');
  for(const other of rects)if(overlap(other.bounds,b))throw Error('overlapping district boundaries');
  ids.set(d.id,{d,b});labels.add(d.label);scenes.add(d.sceneId);rects.push({bounds:b});
 }
 for(const {d,b} of ids.values()){
  if(new Set(d.neighbours).size!==d.neighbours.length)throw Error('duplicate neighbours');
  for(const id of d.neighbours){
   const dest=ids.get(id);if(!dest||id===d.id||!dest.d.neighbours.includes(d.id)||!edgeTouch(b,dest.b))throw Error('invalid asymmetric or unconnected neighbour');
  }
 }
 const seen=new Set([m.districts[0].id]),queue=[m.districts[0].id];
 for(let k=0;k<queue.length;k++)for(const id of ids.get(queue[k]).d.neighbours)if(!seen.has(id)){seen.add(id);queue.push(id)}
 if(seen.size!==13)throw Error('district navigation graph disconnected');
 const exits=new Set();
 for(const x of m.countryExits){if(!ids.has(x.districtId)||typeof x.targetId!=='string'||!x.targetId.startsWith('HC-EC-')||!x.exitId||exits.has(x.exitId)||x.status!=='ROUTE_CONTRACT_PENDING_PHYSICAL_CONNECTION')throw Error('invalid county exit');exits.add(x.exitId)}
 if(m.heritageVisibility!=='SERVER_GATED_DISCOVERY_AND_CLAIM_ONLY')throw Error('premature heritage exposure');
 return {districts:ids.size,connected:seen.size,exits:exits.size,status:m.status};
}
export function districtTarget(m,id){
 validatePortAlderNavigation(m);
 const d=m.districts.find(x=>x.id===id);if(!d)throw Error('unknown district');
 return {districtId:d.id,sceneId:d.sceneId,entrance:d.entrance,route:'/port-alder/district/'+encodeURIComponent(d.id)};
}

import {selectPortAlderArtwork,requestPortAlderStage} from './port-alder-map-stage.js';
const ROOT='/assets/highcountry/maps/';
const load=async(fetchImpl,path)=>{const response=await fetchImpl(path);if(!response.ok)throw Error('map data unavailable');return response.json()};
const el=(doc,tag,text)=>{const n=doc.createElement(tag);n.textContent=text;return n};
const link=(doc,label,href)=>{const n=el(doc,'a',label);n.href=href;return n};
function clickableMap({document,main,src,alt,areas,imageSize}){
 const section=el(document,'section','');section.setAttribute('aria-label',alt);
 const img=el(document,'img','');img.src=src;img.alt=alt;img.style.width='100%';img.style.display='block';
 img.addEventListener('error',()=>{img.hidden=true;section.append(el(document,'p','Map artwork unavailable; text navigation remains available.'))});
 section.style.position='relative';section.append(img);
 const [w,h]=imageSize;
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');
 svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.setAttribute('aria-label',alt+' clickable district regions');
 svg.style.cssText='position:absolute;inset:0;width:100%;height:100%;';
 for(const area of areas){
  const a=document.createElementNS('http://www.w3.org/2000/svg','a');
  a.setAttribute('href',area.href);a.setAttribute('aria-label','Open '+area.label);
  const title=document.createElementNS('http://www.w3.org/2000/svg','title');title.textContent=area.label;a.append(title);
  const shape=document.createElementNS('http://www.w3.org/2000/svg','polygon');
  shape.setAttribute('points',area.polygon.map(p=>p.join(',')).join(' '));
  shape.setAttribute('fill','transparent');shape.setAttribute('stroke','transparent');shape.setAttribute('stroke-width','2');
  a.append(shape);svg.append(a);
 }
 section.append(svg);main.append(section);
}
export async function mountPortAlderNavigation({document,main,pathname,fetchImpl=fetch,runtime,authenticate}){
 const status=el(document,'p','Loading Emerald Coast map…');status.setAttribute('role','status');main.append(status);
 try{
  const catalog=await load(fetchImpl,ROOT+'hc-world-map-catalogue.v1.json');
  if(catalog.schema!=='HC.WORLD.MAP.CATALOGUE.V1'||catalog.regionId!==1||catalog.privacy?.heritageLocationsPublic!==false)throw Error('invalid public map catalogue');
  const a=(name,href)=>link(document,name,href);
  if(pathname==='/emerald-coast'){
   status.textContent='Emerald Coast regional map — select a settlement';
   const map=catalog.maps.region;clickableMap({document,main,src:map.src,alt:'Emerald Coast county regional map',imageSize:[1536,1024],areas:[]});
   const nav=el(document,'nav','');nav.setAttribute('aria-label','Emerald Coast destinations');
   for(const entry of map.navigation){const row=el(document,'p','');row.append(a(entry.label,entry.href));nav.append(row)}
   main.append(nav);return;
  }
  const [districts,hitboxes]=await Promise.all([load(fetchImpl,catalog.maps.town.districtContract),load(fetchImpl,catalog.maps.town.artworkHitboxes)]);
  if(districts.schema!=='HC.WORLD.PORT.ALDER.DISTRICT.NAV.V1'||hitboxes.schema!=='HC.WORLD.PORT.ALDER.ARTWORK.HITBOXES.V2'||
  hitboxes.notCadastral!==true||hitboxes.heritageSitesPublished!==false||hitboxes.districts.length!==13)throw Error('invalid district data');
  const mapIds=new Set(districts.districts.map(d=>d.id));
  if(hitboxes.districts.some(d=>!mapIds.has(d.districtId)))throw Error('unknown hitbox district');
  const id=pathname.split('/')[3],selected=id?districts.districts.find(d=>d.id===decodeURIComponent(id)):null;
  if(id&&!selected)throw Error('unknown district');
  if(selected){
   status.textContent='Port Alder / '+selected.label;
   main.append(el(document,'p','Street-level scene pending. No property rights are created by navigation.'));
   main.append(a('Back to Port Alder','/port-alder'));
   const nav=el(document,'nav','');nav.setAttribute('aria-label','Adjacent districts');
   for(const neighbour of selected.neighbours){const d=districts.districts.find(x=>x.id===neighbour);if(d){const row=el(document,'p','');row.append(a(d.label,'/port-alder/district/'+d.id));nav.append(row)}}
   main.append(nav);return;
  }
  const snapshot=await requestPortAlderStage({runtime,fetchImpl,authenticate});
  const stage=selectPortAlderArtwork(catalog,snapshot);
  status.textContent='Port Alder — '+(stage.stage==='DEVELOPED_50'?'50% development overview':'Genesis overview');
  if(!stage.verified)main.append(el(document,'p','Purchase milestone not verified: displaying Genesis artwork. No client-side purchase estimates are used.'));
  const areas=hitboxes.districts.map(d=>({label:districts.districts.find(x=>x.id===d.districtId).label,href:'/port-alder/district/'+d.districtId,polygon:d.polygon}));
  clickableMap({document,main,src:stage.src,alt:'Port Alder town map',imageSize:hitboxes.imageDimensions,areas});
  const nav=el(document,'nav','');nav.setAttribute('aria-label','Port Alder district links');
  for(const d of districts.districts){const row=el(document,'p','');row.append(a(d.label,'/port-alder/district/'+d.id));nav.append(row)}
  main.append(nav,a('Back to Emerald Coast regional map','/emerald-coast'));
 }catch(e){status.textContent='Map navigation unavailable: '+e.message;status.setAttribute('role','alert')}
}

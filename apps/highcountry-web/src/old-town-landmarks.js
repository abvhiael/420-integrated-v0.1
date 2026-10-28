// Public Old Town landmark navigation. Read-only; no quest reward, ownership or settlement writes.
export function validateOldTownLandmarks(m){
 if(m?.schema!=='HC.WORLD.PA.OLDTOWN.LANDMARK.HITBOXES.V1'||m.status!=='PROVISIONAL_UNTIL_ARTWORK_APPROVAL'||m.notCadastral!==true||m.privateTitleSaleEnabled!==false||m.heritageDiscoveryPublished!==false||m.landmarks?.length!==5)throw Error('invalid public landmarks');
 const ids=new Set();
 for(const l of m.landmarks){
  if(!/^HC-EC-S01-D07-LM-0[1-5]$/.test(l.id)||ids.has(l.id)||!Array.isArray(l.polygon)||l.polygon.length<3||!l.polygon.every(p=>Array.isArray(p)&&p.length===2&&p.every((v,i)=>Number.isSafeInteger(v)&&v>=0&&v<(i?1024:1536)))||!l.href.endsWith(l.id.split('-').slice(-2).join('-'))||l.questRewardsEnabled!==false||!Array.isArray(l.services))throw Error('invalid landmark hotspot');
  ids.add(l.id);
 }
 return true;
}
export async function mountOldTownLandmark({document,main,pathname,fetchImpl=fetch}){
 const el=(name,text)=>{const n=document.createElement(name);n.textContent=text;return n};
 const a=(label,href)=>{const n=el('a',label);n.href=href;return n};
 const response=await fetchImpl('/assets/highcountry/maps/hc-world-pa-oldtown-landmark-hitboxes.v1.json');
 if(!response.ok)throw Error('landmark data unavailable');
 const data=await response.json();validateOldTownLandmarks(data);
 const landmarkId=pathname.split('/')[5];
 const lm=landmarkId?data.landmarks.find(x=>x.id.endsWith('-'+landmarkId)):null;
 if(landmarkId&&!lm)throw Error('unknown landmark');
 if(lm){
  main.append(el('h3',lm.name));
  const img=el('img','');img.src=lm.exterior;img.alt=lm.name;img.width=360;img.style.maxWidth='100%';main.append(img);
  main.append(el('p','Historic public landmark — not for sale. Services below are informational; quests are not yet active.'));
  const ul=el('ul','');for(const service of lm.services)ul.append(el('li',service));main.append(ul,a('Back to Old Town','/port-alder/district/HC-EC-S01-D07'));return;
 }
 main.append(el('h3','Old Town historic landmarks'));
 main.append(el('p','Select a permanent public landmark. Entrance coordinates are provisional until map-art alignment is approved.'));
 const nav=el('nav','');nav.setAttribute('aria-label','Old Town public landmarks');
 for(const l of data.landmarks){const p=el('p','');p.append(a(l.name,l.href));nav.append(p)}main.append(nav);
 const map=el('img','');map.src='/assets/highcountry/maps/emerald-coast/port-alder/old-town-genesis-master-v1.png';map.alt='Old Town map — pending repository artwork upload';map.style.width='100%';map.addEventListener('error',()=>{map.hidden=true});const frame=el('div','');frame.style.position='relative';frame.append(map);
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 1536 1024');svg.setAttribute('aria-label','Old Town landmark entrances');svg.style.cssText='position:absolute;inset:0;width:100%;height:100%;';
 for(const l of data.landmarks){const link=document.createElementNS('http://www.w3.org/2000/svg','a');link.setAttribute('href',l.href);link.setAttribute('aria-label','Enter '+l.name);const shape=document.createElementNS('http://www.w3.org/2000/svg','polygon');shape.setAttribute('points',l.polygon.map(p=>p.join(',')).join(' '));shape.setAttribute('fill','transparent');shape.setAttribute('stroke','transparent');link.append(shape);svg.append(link)}
 map.addEventListener('load',()=>{svg.hidden=false});map.addEventListener('error',()=>{svg.hidden=true});svg.hidden=true;frame.append(svg);main.append(frame);
 // If map image has not been uploaded, accessible landmark links still work.
}

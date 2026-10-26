import {mountSeedPacks} from './seed-packs.js';
const plant=x=>typeof x==='string'&&/^[1-9]\d{0,19}$/.test(x)&&BigInt(x)<2n**64n;
export function createSeedCatalogueClient({apiUrl,authenticate,fetchImpl=fetch}){
 if(typeof apiUrl!=='string'||!/^https:\/\/[^/?#]+$/.test(apiUrl))throw Error('seed-service-config-invalid');
 async function post(path,body,privateRequest=false){
  const headers={'content-type':'application/json'};
  if(privateRequest){const token=await authenticate?.();if(typeof token!=='string'||!token||/\s/.test(token))throw Error('seed-sign-in-required');headers.authorization='Bearer '+token;}
  const res=await fetchImpl(new URL(path,apiUrl+'/'),{method:'POST',cache:'no-store',credentials:'omit',headers,body:JSON.stringify(body)});
  if(!res.ok)throw Error(res.status===401||res.status===403?'seed-request-denied':'seed-service-unavailable');
  const data=await res.json();if(data?.ok!==true||!data.result)throw Error('seed-response-invalid');return data.result;
 }
 return {catalogue:()=>post('/seeds/catalogue',{filters:{}}),collection:()=>post('/seeds/collection',{},true),claim:plantId=>{if(!plant(plantId))throw Error('invalid-harvest-plant');return post('/seeds/harvest-card',{plantId},true);}};
}
// Only canonical same-origin filenames may be rendered, even if catalogue JSON is malformed.
export function canonicalSeedArt(entry,kind){
 const id=entry?.id,tier=entry?.tier;if(typeof id!=='string'||!((tier==='exclusive'&&/^HC-F(?:0[1-9]|1[0-6])$/.test(id))||(tier==='common'&&/^HC-C-[a-z0-9-]+$/.test(id))||(tier==='rare'&&/^HC-R-[a-z0-9-]+$/.test(id))))return null;
 const slug=id.toLowerCase(),group=tier==='exclusive'?'original-sixteen':tier;
 const expected=kind==='illustration'?(tier==='exclusive'?'/assets/highcountry/original-sixteen/'+slug+'-botanical-plate.png':'/assets/highcountry/seed-catalogue/'+tier+'/'+slug+'-botanical-plate.png'):kind==='harvestCard'?'/assets/highcountry/seed-catalogue/harvest-cards/'+group+'/'+slug+'-harvest-card.png':kind==='harvestSeal'?'/assets/highcountry/seed-catalogue/harvest-cards/seals/hc-harvest-seal-'+group+'.png':null;
 return expected&&entry.art?.[kind]===expected?expected:null;
}
export function mountSeedCatalogue({document,main,runtime,authenticate,fetchImpl=fetch}){
 const el=(tag,text='')=>{const e=document.createElement(tag);e.textContent=text;return e;};
 if(!document.getElementById('seed-catalogue-style')){const link=el('link');link.id='seed-catalogue-style';link.rel='stylesheet';link.href='/seed-catalogue.css';document.head?.append(link);}
 const wrapper=el('section');wrapper.className='seed-catalogue';main.append(wrapper);
 const intro=el('div');intro.className='seed-intro';intro.append(el('p','HIGH COUNTRY · THE LIVING COLLECTION'),el('h3','Find your next grow.'),el('p','Explore the Original Sixteen, regional classics and rare HighCountry crosses. Earn a harvest card by successfully growing and harvesting a cultivar.'));wrapper.append(intro);
 const status=el('p','Loading seed catalogue…');status.setAttribute('role','status');status.setAttribute('aria-live','polite');wrapper.append(status);
 const controls=el('div');controls.className='seed-filters';wrapper.append(controls);
 function input(label,tag='input',options=[]){const box=el('label',label+' '),field=el(tag);field.setAttribute('aria-label',label);if(tag==='select')for(const [value,text] of options){const o=el('option',text);o.value=value;field.append(o);}box.append(field);controls.append(box);return field;}
 const search=input('Search cultivars');search.type='search';search.maxLength=80;search.placeholder='Name or cultivar ID';
 const region=input('Region','select',[['','All regions'],...['Emerald Coast','Golden Prairie','Red Mesa'].map(x=>[x,x])]);
 const tier=input('Rarity','select',[['','All rarities'],['common','Common'],['rare','Rare'],['exclusive','Original Sixteen']]);
 const state=input('Collection','select',[['','All cultivars'],['undiscovered','Undiscovered'],['discovered','Discovered'],['owned','Seeds owned'],['harvested','Harvest cards']]);
 const count=el('p');count.className='seed-count';wrapper.append(count);
 const grid=el('div');grid.className='seed-grid';wrapper.append(grid);
 const detail=el('section');detail.className='seed-detail';detail.setAttribute('aria-label','Cultivar details');wrapper.append(detail);
 const collectionPanel=el('section');collectionPanel.className='seed-collection';collectionPanel.append(el('h3','My harvest collection'),el('p','Cards are personal cosmetic records. They grant no BUDS, seed inventory or founder privileges.'));wrapper.append(collectionPanel);
 const collectionStatus=el('p',runtime.mode==='connected'?'Sign in and refresh to verify collection records.':'Offline browsing. Ownership and harvest awards require the authenticated game service.');collectionStatus.setAttribute('role','status');collectionPanel.append(collectionStatus);
 mountSeedPacks({document,parent:wrapper,runtime,authenticate,fetchImpl});
 let entries=[],collection=null,selected=null,busy=false;
 const client=runtime.mode==='connected'?createSeedCatalogueClient({apiUrl:runtime.apiUrl,authenticate,fetchImpl}):null;
 const button=(parent,text,fn)=>{const b=el('button',text);b.type='button';b.addEventListener('click',fn);parent.append(b);return b;};
 const progress=id=>collection?.entries.find(e=>e.id===id);
 const ownedText=p=>p?.ownedSeeds===null||!p?'Ownership not verified':p.ownedSeeds+' seeds owned';
 function picture(entry,kind,className){const src=canonicalSeedArt(entry,kind);if(!src)return null;const img=el('img');img.src=src;img.alt=entry.name+(kind==='illustration'?' botanical interpretation':kind==='harvestCard'?' unearned harvest card artwork':' authenticated harvest seal');img.className=className;img.loading='lazy';img.addEventListener('error',()=>{img.hidden=true;});return img;}
 function showDetail(entry){
  selected=entry.id;detail.replaceChildren();detail.append(el('p',entry.region+' · '+(entry.tier==='exclusive'?'Original Sixteen':entry.tier)),el('h3',entry.name),el('p',entry.history),el('h4','Ancestry'));
  const art=picture(entry,'illustration','seed-detail-art');if(art)detail.append(art);
  const preview=picture(entry,'harvestCard','seed-card-preview');if(preview){const box=el('details');box.append(el('summary','Harvest card preview · unearned'),preview);detail.append(box);}
  if(entry.ancestry.parents){for(const parent of entry.ancestry.parents)button(detail,parent.name,()=>showDetail(entries.find(e=>e.id===parent.id)));}
  else if(entry.ancestry.candidates?.length)for(const candidate of entry.ancestry.candidates)detail.append(el('p',candidate.join(' × ')));
  else detail.append(el('p','No confirmed parental pair recorded.'));
  detail.append(el('p',entry.ancestry.status));if(entry.ancestry.uncertainty)detail.append(el('p',entry.ancestry.uncertainty));
  if(entry.characteristics){const c=entry.characteristics;detail.append(el('h4','Source-described characteristics'),el('p',c.classification+' · '+c.flavors.join(', ')),el('p','Profile terpenes: '+c.terpenes.join(', ')),el('p',c.morphology||'No structural description established in the reviewed source.'));}
  detail.append(el('p',entry.geneticSemantics),el('p',ownedText(progress(entry.id))));
  const provenance=progress(entry.id)?.provenance;if(provenance)detail.append(el('p','Verified genome: '+provenance.genomeId+' · '+provenance.basis));
  for(const source of entry.sources??[]){let url;try{url=new URL(source.url);}catch{continue;}if(url.protocol!=='https:'||url.hostname!=='www.leafly.com')continue;const link=el('a','Source: '+source.title);link.href=source.url;link.rel='noopener noreferrer';link.target='_blank';detail.append(link);}
  detail.hidden=false;
 }
 function render(){
  const q=search.value.trim().toLowerCase();
  const rows=entries.filter(e=>{
   const p=progress(e.id);let eligible=true;
   if(state.value==='undiscovered')eligible=!!collection&&!p?.discovered;
   if(state.value==='discovered')eligible=p?.discovered===true;
   if(state.value==='owned')eligible=(p?.ownedSeeds??0)>0;
   if(state.value==='harvested')eligible=p?.harvested===true;
   return eligible&&(!q||(e.name+' '+e.id).toLowerCase().includes(q))&&(!region.value||e.region===region.value)&&(!tier.value||e.tier===tier.value);
  });
  count.textContent=rows.length+' of '+entries.length+' cultivars';grid.replaceChildren();
  if(!rows.length)grid.append(el('p',state.value&&!collection?'Refresh your authenticated collection to use this filter.':'No cultivars match these filters.'));
  for(const e of rows){const p=progress(e.id),card=el('article');card.className='seed-tile '+e.region.toLowerCase().replaceAll(' ','-');card.setAttribute('data-cultivar',e.id);
   const seal=el('div',e.name.split(' ').map(n=>n[0]).join('').slice(0,3));seal.className='seed-monogram';seal.setAttribute('aria-hidden','true');
   card.append(picture(e,'illustration','seed-cultivar-art')??seal,el('p',e.region),el('h4',e.name),el('span',e.tier==='exclusive'?'ORIGINAL SIXTEEN':e.tier.toUpperCase()),el('p',p?.harvested?'Harvest card earned':p?.discovered?'Discovered':'Not yet discovered'),el('p',ownedText(p)));
   button(card,'View '+e.name,()=>showDetail(e));grid.append(card);
  }
  if(selected)showDetail(entries.find(e=>e.id===selected));
 }
 for(const field of [search,region,tier,state])field.addEventListener(field===search?'input':'change',render);
 const cards=el('div');cards.className='seed-earned-cards';collectionPanel.append(cards);
 function renderCards(){cards.replaceChildren();for(const card of collection?.cards??[]){const e=entries.find(e=>e.id===card.cultivarId);if(!e||card.id!=='HC-HARVEST-CARD:'+e.id||card.nonTransferable!==true||card.cosmeticOnly!==true||card.firstHarvest?.successful!==true||!card.firstHarvest.sourceKey)continue;const tile=el('article');tile.className='seed-earned';const base=picture(e,'harvestCard','seed-harvest-art'),seal=picture(e,'harvestSeal','seed-harvest-seal');if(base){const art=el('div');art.className='seed-harvest-artwork';art.append(base);if(seal)art.append(seal);tile.append(art);}tile.append(el('p','HARVEST COLLECTION'),el('h4',e.name),el('p',e.region),el('p','Verified harvest · plant '+card.firstHarvest.plantId),el('p','Quality '+card.firstHarvest.qualityBps+' / 10000 · '+card.firstHarvest.quantityGrams+' g'),el('p','Personal · nontransferable'));cards.append(tile);}if(!cards.children.length)cards.append(el('p','No authenticated harvest cards earned yet.'));}
 async function refresh(){if(!client||busy)return;busy=true;collection=null;render();renderCards();collectionStatus.textContent='Verifying ownership and collection…';try{collection=await client.collection();collectionStatus.textContent=collection.ownershipStatus==='verified-finalized'?'Collection verified against finalized game records.':'Account collection loaded. Link a canonical wallet to verify seed ownership and harvest evidence.';render();renderCards();}catch(e){collectionStatus.textContent='Collection unavailable: '+e.message;}finally{busy=false;}}
 if(client){button(collectionPanel,'Refresh my collection',refresh);const field=el('label','Harvested plant ID '),plantId=el('input');plantId.inputMode='numeric';plantId.setAttribute('aria-label','Harvested plant ID');field.append(plantId);collectionPanel.append(field);
  button(collectionPanel,'Verify harvest and earn card',async()=>{if(busy)return;busy=true;try{await client.claim(plantId.value.trim());collectionStatus.textContent='Harvest verified. Loading your collection…';}catch(e){collectionStatus.textContent='Harvest card not awarded: '+e.message;busy=false;return;}busy=false;await refresh();});
 }
 async function load(){try{
  // Public catalogue remains usable before deployment. It carries no ownership or unlocks.
  const response=await fetchImpl('/assets/highcountry/seed-catalogue.v1.json',{cache:'no-store'});
  if(!response.ok)throw Error('public catalogue unavailable');const data=await response.json();if(data.schema!=='HC.SEED.CATALOGUE.V1'||!Array.isArray(data.entries)||data.entries.length!==65)throw Error('public catalogue invalid');
  entries=data.entries;status.textContent='65 cultivars · 3 regions · a growing collection';detail.hidden=true;render();renderCards();
 }catch(e){status.textContent='Catalogue unavailable: '+e.message;}}
 const ready=load();return {ready,refresh};
}

import {mountPortAlderNavigation} from './port-alder-navigation.js';
import {mountSeedCatalogue} from './seed-catalogue.js';
import {mountOriginalSixteenGallery} from './archive-gallery.js';
import {cultivationStageArt,cultivationSceneArt,CULTIVATION_REGIONS,CULTIVATION_ENVIRONMENTS} from './cultivation-art.js';
import {mountAccountPanel} from './account.js';
import {mountMarketplace} from './marketplace.js';
import {mountSkills} from './skills.js';
import {mountMissions} from './missions.js';
import {mountDiscovery} from './discovery.js';
import {validateHighCountryRuntime,detectHighCountryNetwork} from './runtime.js';
import {newGuest,loadGuest,saveGuest,plant,setEnvironment,advance,stage,harvest} from './guest.js';
const pages=Object.freeze({'/':'Home','/play':'Play','/account':'Account','/settings':'Settings','/about':'About','/archive':'Archive','/marketplace':'Marketplace','/skills':'Skills & Research','/missions':'Missions','/discovery':'Discovery','/seeds':'Seed Catalogue','/port-alder':'Port Alder','/emerald-coast':'Emerald Coast'});
export function resolveRoute(path){return path.startsWith('/port-alder/district/')?'/port-alder':Object.hasOwn(pages,path)?path:'/not-found';}
export function createHighCountryApp({document,location,config,fetchImpl,storage=globalThis.localStorage,authenticate=globalThis.highCountryAuth?.getToken,localAuth=globalThis.highCountryLocalAuth,walletProvider=globalThis.ethereum}){
 const runtime=validateHighCountryRuntime(config),root=document.getElementById('app');if(!root)throw Error('missing-game-root');
 let guest=null,error='';
 // Guest-only visual controls: no claim of land ownership, region authority or cultivation permission.
 let previewRegion='emerald-coast',previewEnvironment='outdoor';
 try{guest=loadGuest(storage);}catch(e){error=e.message;}
 const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
 function command(fn){try{const current=guest||newGuest();const updated=fn(current);saveGuest(storage,updated);guest=updated;error='';}catch(e){error=e.message;}render();}
 function render(){
  const path=resolveRoute(location.pathname);root.replaceChildren();
  const head=el('header','');const brand=el('a','');brand.href='/';brand.className='brand';brand.setAttribute('aria-label','High Country home');const mark=el('img','');mark.src='/assets/highcountry-logo.svg';mark.alt='High Country';mark.width=320;mark.height=96;brand.append(mark);head.append(brand,el('h1','High Country'));const nav=el('nav','');nav.setAttribute('aria-label','Main navigation');
  for(const [route,label] of Object.entries(pages)){const link=el('a',label);link.href=route;if(route===path)link.setAttribute('aria-current','page');nav.append(link);}
  const main=el('main','');main.id='main';main.append(el('h2',pages[path]||'Page not found'));
  if(path==='/port-alder'||path==='/emerald-coast'){mountPortAlderNavigation({document,main,pathname:location.pathname,fetchImpl,runtime,authenticate:localAuth?()=>localAuth.getToken():authenticate});}else if(path==='/seeds'){mountSeedCatalogue({document,main,runtime,authenticate:localAuth?()=>localAuth.getToken():authenticate,fetchImpl});}else if(path==='/discovery'){mountDiscovery({document,main,runtime,authenticate:localAuth?()=>localAuth.getToken():authenticate,fetchImpl});}else if(path==='/missions'){mountMissions({document,main,runtime,authenticate:localAuth?()=>localAuth.getToken():authenticate,fetchImpl});}else if(path==='/skills'){mountSkills({document,main,runtime,authenticate:localAuth?()=>localAuth.getToken():authenticate,fetchImpl});}else if(path==='/play'){
   main.append(el('p','Local guest play only. Saves remain on this device. No account, wallet, BUDS, or canonical assets are created.'));
   if(error){const p=el('p','Save error: '+error);p.setAttribute('role','alert');main.append(p);}

   const visual=el('section','');visual.className='cultivation-scene-preview';
   const visualHead=el('h3','Cultivation environment preview');visual.append(visualHead);
   visual.append(el('p','Illustration preview only — not a verified parcel, lease, or cultivation authorization.'));
   const selectors=el('div','');selectors.className='scene-selectors';
   for(const [title,values,current,set] of [['Region',CULTIVATION_REGIONS,previewRegion,value=>previewRegion=value],['Environment',CULTIVATION_ENVIRONMENTS,previewEnvironment,value=>previewEnvironment=value]]){
    const label=el('label',title);const select=document.createElement('select');
    select.setAttribute('aria-label','Preview '+title.toLowerCase());
    for(const value of values){const option=document.createElement('option');option.value=value;option.textContent=value.replaceAll('-',' ');option.selected=value===current;select.append(option);}
    select.addEventListener('change',()=>{if(!values.includes(select.value))return;set(select.value);render();});
    label.append(select);selectors.append(label);
   }
   visual.append(selectors);
   const scene=cultivationSceneArt(previewRegion,previewEnvironment);
   const sceneImg=el('img','');sceneImg.className='cultivation-scene-image';sceneImg.src=scene.src;sceneImg.alt=scene.alt;
   const fallback=el('p','Regional scene artwork has not been uploaded or could not be loaded. Cultivation remains playable.');fallback.hidden=true;
   sceneImg.addEventListener('error',()=>{sceneImg.hidden=true;fallback.hidden=false;});
   visual.append(sceneImg,fallback);main.append(visual);
   if(guest){const stats=el('div','');stats.className='game-stats';stats.append(el('p','Completed local harvests: '+guest.completed));main.append(stats);if(guest.plant){
    const p=guest.plant;const phase=stage(p,Math.max(guest.lastSeen,Date.now()));const panel=el('div','');panel.className='game-panel';const art=el('img','');const illustration=cultivationStageArt(phase);art.src=illustration.src;art.alt=illustration.alt;art.addEventListener('error',()=>{if(!art.dataset.fallback){art.dataset.fallback='true';art.src=illustration.fallback;}});art.width=240;art.height=180;panel.append(art);const detail=el('div','');detail.append(el('h3','Current cultivation'),el('p','Plant stage: '+phase));panel.append(detail);main.append(panel);
    main.append(el('p','Local preview plant: '+p.id));
    const controls=el('div','');controls.className='controls';main.append(controls);for(const [key,value] of Object.entries(p.env)){const label=el('label',key+' ('+value+') ');const input=document.createElement('input');input.type='number';input.min=key==='temperature'?'1000':'0';input.max=key==='temperature'?'4000':'10000';input.step='1';input.value=String(value);input.setAttribute('aria-label',key);const btn=el('button','Set '+key);btn.type='button';btn.addEventListener('click',()=>command(s=>setEnvironment(s,{[key]:Number(input.value)})));label.append(input,btn);controls.append(label);}
    const ready=phase==='ready';const b=el('button','Harvest local preview');b.type='button';b.disabled=!ready;b.addEventListener('click',()=>command(s=>harvest(s)));main.append(b);
   }else{const b=el('button','Plant locally');b.type='button';b.addEventListener('click',()=>command(s=>plant(s)));main.append(b);}
   const refresh=el('button','Recheck elapsed time');refresh.type='button';refresh.addEventListener('click',()=>command(s=>advance(s)));main.append(refresh);
   }else if(!error){const b=el('button','Start guest game');b.type='button';b.addEventListener('click',()=>command(()=>newGuest()));main.append(b);}
   if(guest?.harvests.length){const ul=el('ul','');for(const h of guest.harvests.slice(-10)){ul.append(el('li','Local FLOWER preview: '+h.massMg+' mg, grade '+h.grade+' (nontransferable)'));}main.append(ul);}
  }else if(path==='/marketplace'){mountMarketplace({document,main,runtime,authenticate:localAuth?()=>localAuth.getToken():authenticate,fetchImpl});}else if(path==='/archive'){mountOriginalSixteenGallery({document,main,fetchImpl});}else if(path==='/account'){mountAccountPanel({document,main,runtime,authenticate:localAuth?()=>localAuth.getToken():authenticate,localAuth,walletProvider,storage,fetchImpl});}else main.append(el('p',path==='/account'?'Account and wallet remain optional and are not activated in R06.2.':path==='/settings'?'Connected endpoints require operator configuration. Guest saves remain local.':path==='/not-found'?'Page not found.':'Guest-first browser cultivation. Go to Play to start locally.'));
  const status=el('output',runtime.mode==='offline'?'Network: offline / not configured':'Network: checking');status.id='network-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');main.append(status);
  const foot=el('footer','');const footIcon=el('img','');footIcon.src='/assets/highcountry-icon.svg';footIcon.alt='';footIcon.setAttribute('aria-hidden','true');foot.append(footIcon,document.createTextNode('High Country — guest-first local gameplay, optional wallet'));root.append(head,nav,main,foot);
  if(runtime.mode==='connected')detectHighCountryNetwork(runtime,{fetchImpl}).then(v=>{status.textContent='Network: '+v.status;});
 }
 render();return Object.freeze({runtime,render});
}

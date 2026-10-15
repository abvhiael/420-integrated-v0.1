import {mountAccountPanel} from './account.js';
import {validateHighCountryRuntime,detectHighCountryNetwork} from './runtime.js';
import {newGuest,loadGuest,saveGuest,plant,setEnvironment,advance,stage,harvest} from './guest.js';
const pages=Object.freeze({'/':'Home','/play':'Play','/account':'Account','/settings':'Settings','/about':'About'});
export function resolveRoute(path){return Object.hasOwn(pages,path)?path:'/not-found';}
export function createHighCountryApp({document,location,config,fetchImpl,storage=globalThis.localStorage,authenticate=globalThis.highCountryAuth?.getToken,localAuth=globalThis.highCountryLocalAuth}){
 const runtime=validateHighCountryRuntime(config),root=document.getElementById('app');if(!root)throw Error('missing-game-root');
 let guest=null,error='';
 try{guest=loadGuest(storage);}catch(e){error=e.message;}
 const el=(tag,text)=>{const n=document.createElement(tag);n.textContent=text;return n;};
 function command(fn){try{const current=guest||newGuest();const updated=fn(current);saveGuest(storage,updated);guest=updated;error='';}catch(e){error=e.message;}render();}
 function render(){
  const path=resolveRoute(location.pathname);root.replaceChildren();
  const head=el('header','');head.append(el('h1','High Country'));const nav=el('nav','');nav.setAttribute('aria-label','Main navigation');
  for(const [route,label] of Object.entries(pages)){const link=el('a',label);link.href=route;if(route===path)link.setAttribute('aria-current','page');nav.append(link);}
  const main=el('main','');main.id='main';main.append(el('h2',pages[path]||'Page not found'));
  if(path==='/play'){
   main.append(el('p','Local guest play only. Saves remain on this device. No account, wallet, BUDS, or canonical assets are created.'));
   if(error){const p=el('p','Save error: '+error);p.setAttribute('role','alert');main.append(p);}
   if(guest){main.append(el('p','Completed local harvests: '+guest.completed));if(guest.plant){
    const p=guest.plant;main.append(el('p','Plant stage: '+stage(p,Math.max(guest.lastSeen,Date.now()))));
    main.append(el('p','Local preview plant: '+p.id));
    for(const [key,value] of Object.entries(p.env)){const label=el('label',key+' ('+value+') ');const input=document.createElement('input');input.type='number';input.min=key==='temperature'?'1000':'0';input.max=key==='temperature'?'4000':'10000';input.step='1';input.value=String(value);input.setAttribute('aria-label',key);const btn=el('button','Set '+key);btn.type='button';btn.addEventListener('click',()=>command(s=>setEnvironment(s,{[key]:Number(input.value)})));label.append(input,btn);main.append(label);}
    const ready=stage(p,Math.max(guest.lastSeen,Date.now()))==='ready';const b=el('button','Harvest local preview');b.type='button';b.disabled=!ready;b.addEventListener('click',()=>command(s=>harvest(s)));main.append(b);
   }else{const b=el('button','Plant locally');b.type='button';b.addEventListener('click',()=>command(s=>plant(s)));main.append(b);}
   const refresh=el('button','Recheck elapsed time');refresh.type='button';refresh.addEventListener('click',()=>command(s=>advance(s)));main.append(refresh);
   }else if(!error){const b=el('button','Start guest game');b.type='button';b.addEventListener('click',()=>command(()=>newGuest()));main.append(b);}
   if(guest?.harvests.length){const ul=el('ul','');for(const h of guest.harvests.slice(-10)){ul.append(el('li','Local FLOWER preview: '+h.massMg+' mg, grade '+h.grade+' (nontransferable)'));}main.append(ul);}
  }else if(path==='/account'){mountAccountPanel({document,main,runtime,authenticate:localAuth?()=>localAuth.getToken():authenticate,localAuth,storage,fetchImpl});}else main.append(el('p',path==='/account'?'Account and wallet remain optional and are not activated in R06.2.':path==='/settings'?'Connected endpoints require operator configuration. Guest saves remain local.':path==='/not-found'?'Page not found.':'Guest-first browser cultivation. Go to Play to start locally.'));
  const status=el('output',runtime.mode==='offline'?'Network: offline / not configured':'Network: checking');status.id='network-status';status.setAttribute('aria-live','polite');main.append(status);
  root.append(head,nav,main,el('footer','High Country — guest local gameplay (R06.2)'));
  if(runtime.mode==='connected')detectHighCountryNetwork(runtime,{fetchImpl}).then(v=>{status.textContent='Network: '+v.status;});
 }
 render();return Object.freeze({runtime,render});
}

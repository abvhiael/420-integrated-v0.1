import {validateHighCountryRuntime,detectHighCountryNetwork} from './runtime.js';
const pages=Object.freeze({ '/':'Home','/play':'Play','/account':'Account','/settings':'Settings','/about':'About' });
export function resolveRoute(path){return Object.hasOwn(pages,path)?path:'/not-found';}
export function createHighCountryApp({document,location,config,fetchImpl}){
 const runtime=validateHighCountryRuntime(config);
 const root=document.getElementById('app');if(!root)throw Error('missing-game-root');
 function render(){
  const path=resolveRoute(location.pathname);
  root.replaceChildren();
  const head=document.createElement('header');const title=document.createElement('h1');title.textContent='High Country';head.append(title);
  const nav=document.createElement('nav');nav.setAttribute('aria-label','Main navigation');
  for(const [route,label] of Object.entries(pages)){
   const link=document.createElement('a');link.href=route;link.textContent=label;
   if(route===path)link.setAttribute('aria-current','page');nav.append(link);
  }
  const main=document.createElement('main');main.id='main';
  const h=document.createElement('h2');h.textContent=pages[path]||'Page not found';main.append(h);
  const info=document.createElement('p');
  info.textContent=path==='/play'?'Guest-first gameplay is introduced in R06.2. No playable loop is claimed in R06.1.':
   path==='/account'?'Accounts and wallet linking are optional; these journeys arrive in R06.3–R06.4.':
   path==='/settings'?'Connection configuration is operator-provided; the browser cannot substitute placeholder addresses.':
   path==='/not-found'?'The requested page does not exist.':
   'Application foundation. Guest access does not require a connected wallet.';
  main.append(info);
  const status=document.createElement('output');status.id='network-status';status.setAttribute('aria-live','polite');
  status.textContent=runtime.mode==='offline'?'Network: offline / not configured':'Network: checking';
  main.append(status);
  const foot=document.createElement('footer');foot.textContent='High Country — application foundation (R06.1)';
  root.append(head,nav,main,foot);
  if(runtime.mode==='connected')detectHighCountryNetwork(runtime,{fetchImpl}).then(v=>{
   status.textContent='Network: '+v.status;
  });
 }
 render();
 return Object.freeze({runtime,render});
}

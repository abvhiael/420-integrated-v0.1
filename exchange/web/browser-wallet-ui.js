import { BrowserExecutionController } from './core/browser-execution-controller.js';
import { discoverWalletProviders } from './core/wallet-compatibility.js';

// V15.11 browser mount: wallet selection is live; transaction submission remains
// disabled until canonical (non-fixture) V15.2 builders are bound to page controls.
export const V15_EXECUTION_CONTROL_IDS = Object.freeze([
  'swap-submit', 'order-sign', 'bridge-submit',
]);
export const EXECUTION_BLOCK_REASON = 'Testnet execution unavailable: canonical transaction controls and verified deployment are not yet connected.';

export function walletChoices({ethereum=null,announcements=[]}={}) {
  return discoverWalletProviders({ethereum,announcements}).map(({id,label})=>({id,label}));
}

export function executionSurfaceGate({runtime,source,canonicalBindings=false}={}) {
  if(runtime?.deployment?.status!=='RESOLVED'||runtime?.deployment?.environment!=='testnet') return {ok:false,reason:'DEPLOYMENT_UNRESOLVED'};
  if(source!=='api') return {ok:false,reason:'DEMO_OR_UNVERIFIED_SOURCE'};
  if(!canonicalBindings) return {ok:false,reason:'CANONICAL_EXECUTION_BINDINGS_MISSING'};
  return {ok:true,reason:null};
}

export function mountWalletUI({documentRef=globalThis.document,windowRef=globalThis.window,ethereum=globalThis.ethereum,loadRuntime=()=>fetch('./runtime-config.json',{cache:'no-store'}).then(response=>{if(!response.ok)throw new Error('Runtime configuration unavailable');return response.json();})}={}) {
  if(!documentRef?.querySelector||!windowRef?.addEventListener) throw new Error('Browser document and window required');
  const connect=documentRef.querySelector('#connect');
  if(!connect) throw new Error('Exchange wallet control unavailable');
  const panel=documentRef.createElement('div');
  panel.id='v15-wallet-selection';
  panel.setAttribute('aria-live','polite');
  panel.style.cssText='display:flex;flex-direction:column;gap:4px;max-width:260px';
  const caption=documentRef.createElement('label');
  caption.htmlFor='v15-wallet-provider';
  caption.textContent='Wallet provider';
  const select=documentRef.createElement('select');
  select.id='v15-wallet-provider';
  select.setAttribute('aria-label','Select a wallet provider');
  const message=documentRef.createElement('small');
  message.id='v15-wallet-message';
  message.textContent='Wallet discovery is available; trading is not yet enabled.';
  panel.append(caption,select,message);
  connect.parentElement?.insertBefore(panel,connect);
  const context={runtime:null,controller:null,pending:false,disposed:false};
  function lockExecution(root=documentRef){
    for(const id of V15_EXECUTION_CONTROL_IDS){
      const control=root.querySelector?.('#'+id);
      if(control){control.disabled=true;control.textContent='Testnet execution not qualified';control.title=EXECUTION_BLOCK_REASON;}
    }
    for(const control of root.querySelectorAll?.('[data-cancel-order]')??[]){
      control.disabled=true;control.textContent='Cancellation unavailable';control.title=EXECUTION_BLOCK_REASON;
    }
  }
  function renderChoices(){
    if(context.disposed)return;
    const candidates=context.controller?.discover(ethereum)??[];
    const previous=select.value;
    select.replaceChildren();
    const placeholder=documentRef.createElement('option');
    placeholder.value='';placeholder.textContent=candidates.length?'Select wallet':'No wallet detected';
    select.append(placeholder);
    for(const entry of candidates){const option=documentRef.createElement('option');option.value=entry.id;option.textContent=entry.label;select.append(option);}
    select.value=candidates.some(entry=>entry.id===previous)?previous:'';
    if(candidates.length===1) select.value=candidates[0].id;
    select.disabled=candidates.length===0;
    if(!context.controller?.wallet){connect.textContent=candidates.length?'Connect wallet':'Wallet unavailable';connect.disabled=candidates.length===0;}
  }
  function stateChange(event){
    if(context.disposed)return;
    if(event.type==='wallets-discovered')renderChoices();
    if(event.type==='wallet-connected'){
      const account=event.account??'';
      message.textContent='Connected '+account.slice(0,6)+'…'+account.slice(-4)+' · trading disabled pending testnet qualification';
      connect.textContent='Wallet connected';connect.disabled=false;
    }
    if(event.type==='wallet-invalidated'){
      message.textContent='Wallet changed: '+event.reason+'. Reconnect and review again.';
      connect.textContent='Reconnect wallet';connect.disabled=false;
    }
  }
  function intercept(event){
    const target=event.target;
    if(!target?.closest)return;
    const button=target.closest('#connect, #swap-submit, #order-sign, #bridge-submit, [data-cancel-order]');
    if(!button)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(button.id!=='connect'){
      lockExecution();message.textContent=EXECUTION_BLOCK_REASON;return;
    }
    if(context.pending||context.disposed||!context.controller)return;
    const chosen=select.value;
    if(!chosen){message.textContent='Select the wallet to connect.';return;}
    context.pending=true;connect.disabled=true;message.textContent='Requesting wallet connection…';
    context.controller.connect({ethereum,selectedId:chosen}).catch(error=>{
      if(!context.disposed) message.textContent=String(error?.message??'Wallet connection failed');
    }).finally(()=>{
      context.pending=false;if(!context.disposed)connect.disabled=false;
    });
  }
  documentRef.addEventListener('click',intercept,true);
  const observer=typeof MutationObserver==='function'?new MutationObserver(()=>lockExecution(documentRef)):null;
  const view=documentRef.querySelector('#app-view');
  if(view&&observer)observer.observe(view,{childList:true,subtree:true});
  lockExecution();
  Promise.resolve().then(loadRuntime).then(runtime=>{
    if(context.disposed)return;
    context.runtime=runtime;
    context.controller=new BrowserExecutionController({runtime,onState:stateChange,onInvalidate:()=>{lockExecution();}});
    context.controller.listen(windowRef,ethereum);
    renderChoices();
  }).catch(error=>{if(!context.disposed){message.textContent=String(error?.message??'Wallet unavailable');connect.disabled=true;}});
  windowRef.addEventListener('pagehide',dispose,{once:true});
  function dispose(){
    if(context.disposed)return;
    context.disposed=true;observer?.disconnect();context.controller?.dispose();
    documentRef.removeEventListener('click',intercept,true);
    windowRef.removeEventListener('pagehide',dispose);
  }
  return {dispose,lockExecution,renderChoices,context};
}

if(typeof document!=='undefined'&&document.querySelector('#connect')) mountWalletUI();

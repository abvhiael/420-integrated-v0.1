import { BrowserExecutionController } from './core/browser-execution-controller.js';
import { discoverWalletProviders } from './core/wallet-compatibility.js';
import { mountReadOnlySwapReview } from './read-only-swap-review-ui.js';

// Browser integration is wallet-only until the page supplies canonical V15 execution inputs.
export const V15_EXECUTION_CONTROL_IDS=Object.freeze(['swap-submit','order-sign','bridge-submit']);
export const EXECUTION_BLOCK_REASON='Testnet execution unavailable: canonical transaction controls and verified deployment are not yet connected.';
export function walletChoices({ethereum=null,announcements=[]}={}){
  return discoverWalletProviders({ethereum,announcements}).map(({id,label})=>({id,label}));
}
export function executionSurfaceGate({runtime,source,canonicalBindings=false}={}){
  if(runtime?.deployment?.status!=='RESOLVED'||runtime?.deployment?.environment!=='testnet')return {ok:false,reason:'DEPLOYMENT_UNRESOLVED'};
  if(source!=='api')return {ok:false,reason:'DEMO_OR_UNVERIFIED_SOURCE'};
  if(!canonicalBindings)return {ok:false,reason:'CANONICAL_EXECUTION_BINDINGS_MISSING'};
  return {ok:true,reason:null};
}
// A resolved deployment or an attached wallet cannot make demo-backed V14 forms executable.
// This status is informational; only a separate, authenticated, reviewed V15 request may
// eventually reach the controller's preflight and wallet methods.
export function browserExecutionReadiness({runtime=null,connected=false,verifiedQuote=false,canonicalReview=false}={}){
  if(runtime?.deployment?.status!=='RESOLVED'||runtime?.deployment?.environment!=='testnet')return {ready:false,reason:'Verified testnet deployment unavailable'};
  if(!connected)return {ready:false,reason:'Connect a wallet to review a transaction'};
  if(!verifiedQuote)return {ready:false,reason:'Live executable quote unavailable; display and fixture data cannot authorize trading'};
  if(!canonicalReview)return {ready:false,reason:'Canonical transaction review and preflight not connected to these controls'};
  return {ready:false,reason:'Browser execution remains disabled pending live operational qualification'};
}
export function mountWalletUI({documentRef=globalThis.document,windowRef=globalThis.window,ethereum=globalThis.ethereum,loadRuntime=()=>fetch('./runtime-config.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Runtime configuration unavailable');return r.json();})}={}){
  if(!documentRef?.querySelector||!windowRef?.addEventListener)throw Error('Browser document and window required');
  const connect=documentRef.querySelector('#connect');if(!connect)throw Error('Exchange wallet control unavailable');
  const panel=documentRef.createElement('div');panel.id='v15-wallet-selection';panel.style.cssText='display:flex;flex-direction:column;gap:4px;max-width:300px';
  const caption=documentRef.createElement('label');caption.htmlFor='v15-wallet-provider';caption.textContent='Wallet provider';
  const select=documentRef.createElement('select');select.id='v15-wallet-provider';select.setAttribute('aria-label','Select a wallet provider');
  const message=documentRef.createElement('small');message.id='v15-wallet-message';message.setAttribute('role','status');message.textContent='Wallet discovery available; trading not yet enabled.';
  const readiness=documentRef.createElement('small');readiness.id='v15-execution-readiness';readiness.setAttribute('role','status');readiness.textContent='Verified testnet deployment unavailable';
  panel.append(caption,select,message,readiness);connect.parentElement?.insertBefore(panel,connect);
  const context={runtime:null,controller:null,quoteSurface:null,pending:false,disposed:false,selectedProviderId:null};
  function updateReadiness(){
    if(context.disposed)return;
    const connected=Boolean(context.controller?.wallet?.session?.account);
    readiness.textContent='Trading disabled · '+browserExecutionReadiness({runtime:context.runtime,connected}).reason;
  }
  function lockExecution(root=documentRef){
    for(const id of V15_EXECUTION_CONTROL_IDS){const button=root.querySelector?.('#'+id);if(!button)continue;
      button.disabled=true;if(button.textContent!=='Testnet execution not qualified')button.textContent='Testnet execution not qualified';button.title=EXECUTION_BLOCK_REASON;
    }
    for(const button of root.querySelectorAll?.('[data-cancel-order]')??[]){button.disabled=true;
      if(button.textContent!=='Cancellation unavailable')button.textContent='Cancellation unavailable';button.title=EXECUTION_BLOCK_REASON;
    }
  }
  function renderChoices(){if(context.disposed)return;
    const candidates=context.controller?.discover(ethereum)??[];const previous=select.value;select.replaceChildren();
    const option=documentRef.createElement('option');option.value='';option.textContent=candidates.length?'Select wallet':'No wallet detected';select.append(option);
    for(const wallet of candidates){const item=documentRef.createElement('option');item.value=wallet.id;item.textContent=wallet.label;select.append(item);}
    select.value=candidates.some(wallet=>wallet.id===previous)?previous:'';
    if(candidates.length===1)select.value=candidates[0].id;select.disabled=!candidates.length;
    // Discovery may revoke or replace the selected provider. A new dropdown label does not preserve wallet authority.
    if(context.controller?.wallet&&select.value!==context.selectedProviderId)invalidateSelectedProvider('provider-discovery-changed');
    if(!context.controller?.wallet){connect.textContent=candidates.length?'Connect wallet':'Wallet unavailable';connect.disabled=!candidates.length;}
    updateReadiness();
  }
  function invalidateSelectedProvider(reason){
    if(context.disposed||!context.controller?.wallet)return;
    context.controller.unbind();context.selectedProviderId=null;
    context.quoteSurface?.clear('Wallet provider changed; quote review invalidated.');
    message.textContent='Wallet provider changed. Connect and review again.';
    connect.textContent='Connect wallet';connect.disabled=!select.value;
    lockExecution();updateReadiness();
  }
  function onProviderChoice(){if(context.disposed)return;
    if(context.controller?.wallet&&select.value!==context.selectedProviderId)invalidateSelectedProvider('provider-selection-changed');
    context.quoteSurface?.clear('Wallet selection changed; request a new quote after connecting.');
  }
  select.addEventListener('change',onProviderChoice);
  function onState(event){if(context.disposed)return;
    if(event.type==='wallets-discovered')renderChoices();
    if(event.type==='wallet-connected'){context.selectedProviderId=context.controller?.selection?.id??null;message.textContent='Connected '+event.account.slice(0,6)+'…'+event.account.slice(-4)+' · trading disabled pending testnet qualification';connect.textContent='Wallet connected';connect.disabled=false;context.quoteSurface?.clear('Wallet connected; request a new read-only quote.');}
    if(event.type==='wallet-invalidated'){message.textContent='Wallet changed: '+event.reason+'. Reconnect and review again.';connect.textContent='Reconnect wallet';connect.disabled=false;context.quoteSurface?.clear('Wallet changed; quote review invalidated.');lockExecution();}
    context.quoteSurface?.refresh();updateReadiness();
  }
  function intercept(event){const button=event.target?.closest?.('#connect, #swap-submit, #order-sign, #bridge-submit, [data-cancel-order]');if(!button)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(button.id!=='connect'){lockExecution();message.textContent=EXECUTION_BLOCK_REASON;updateReadiness();return;}
    if(context.pending||context.disposed||!context.controller)return;
    if(!select.value){message.textContent='Select the wallet to connect.';return;}
    context.quoteSurface?.clear('Wallet reconnecting; quote review invalidated.');
    context.selectedProviderId=null;
    context.pending=true;connect.disabled=true;message.textContent='Requesting wallet connection…';
    context.controller.connect({ethereum,selectedId:select.value}).catch(e=>{if(!context.disposed)message.textContent=String(e?.message??'Wallet connection failed');}).finally(()=>{context.pending=false;if(!context.disposed){connect.disabled=false;updateReadiness();}});
  }
  documentRef.addEventListener('click',intercept,true);
  const view=documentRef.querySelector('#app-view');
  // Observe only top-level view replacement: changing a button label must not trigger an observer feedback loop.
  const observer=typeof MutationObserver==='function'?new MutationObserver(()=>{
    lockExecution();
    if(context.quoteSurface){
      if(context.quoteSurface.panel.parentElement!==view)context.quoteSurface.clear('Swap view replaced; review invalidated.');
      context.quoteSurface.refresh();
    }
  }):null;
  if(view&&observer)observer.observe(view,{childList:true});lockExecution();updateReadiness();
  function onVisibility(){if(documentRef.hidden){context.quoteSurface?.clear('Page hidden; quote review invalidated.');lockExecution();}else{context.quoteSurface?.clear('Page resumed; request a fresh quote.');context.quoteSurface?.refresh();}}
  function onNavigation(){context.quoteSurface?.clear('Navigation changed; quote review invalidated.');context.quoteSurface?.refresh();lockExecution();}
  documentRef.addEventListener('visibilitychange',onVisibility);
  windowRef.addEventListener('popstate',onNavigation);
  Promise.resolve().then(loadRuntime).then(runtime=>{if(context.disposed)return;
    context.runtime=runtime;context.controller=new BrowserExecutionController({runtime,onState,onInvalidate:()=>{context.quoteSurface?.clear('Wallet invalidated; review cleared.');lockExecution();updateReadiness();}});
    context.quoteSurface=mountReadOnlySwapReview({documentRef,controller:context.controller});
    context.controller.listen(windowRef,ethereum);renderChoices();context.quoteSurface.refresh();updateReadiness();
  }).catch(e=>{if(!context.disposed){message.textContent=String(e?.message??'Wallet unavailable');connect.disabled=true;updateReadiness();}});
  windowRef.addEventListener('pagehide',dispose,{once:true});
  function dispose(){if(context.disposed)return;context.disposed=true;observer?.disconnect();context.quoteSurface?.dispose();context.controller?.dispose();documentRef.removeEventListener('click',intercept,true);documentRef.removeEventListener('visibilitychange',onVisibility);select.removeEventListener('change',onProviderChoice);windowRef.removeEventListener('popstate',onNavigation);windowRef.removeEventListener('pagehide',dispose);}
  return {dispose,lockExecution,renderChoices,updateReadiness,context};
}
if(typeof document!=='undefined'&&document.querySelector('#connect'))mountWalletUI();

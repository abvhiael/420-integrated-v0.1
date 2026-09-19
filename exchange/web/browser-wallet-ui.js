import { BrowserExecutionController } from './core/browser-execution-controller.js';
import { discoverWalletProviders } from './core/wallet-compatibility.js';

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
export function mountWalletUI({documentRef=globalThis.document,windowRef=globalThis.window,ethereum=globalThis.ethereum,loadRuntime=()=>fetch('./runtime-config.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('Runtime configuration unavailable');return r.json();})}={}){
  if(!documentRef?.querySelector||!windowRef?.addEventListener)throw Error('Browser document and window required');
  const connect=documentRef.querySelector('#connect');if(!connect)throw Error('Exchange wallet control unavailable');
  const panel=documentRef.createElement('div');panel.id='v15-wallet-selection';panel.style.cssText='display:flex;flex-direction:column;gap:4px;max-width:260px';
  const caption=documentRef.createElement('label');caption.htmlFor='v15-wallet-provider';caption.textContent='Wallet provider';
  const select=documentRef.createElement('select');select.id='v15-wallet-provider';select.setAttribute('aria-label','Select a wallet provider');
  const message=documentRef.createElement('small');message.id='v15-wallet-message';message.setAttribute('role','status');message.textContent='Wallet discovery available; trading not yet enabled.';
  panel.append(caption,select,message);connect.parentElement?.insertBefore(panel,connect);
  const context={runtime:null,controller:null,pending:false,disposed:false};
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
    if(!context.controller?.wallet){connect.textContent=candidates.length?'Connect wallet':'Wallet unavailable';connect.disabled=!candidates.length;}
  }
  function onState(event){if(context.disposed)return;
    if(event.type==='wallets-discovered')renderChoices();
    if(event.type==='wallet-connected'){message.textContent='Connected '+event.account.slice(0,6)+'…'+event.account.slice(-4)+' · trading disabled pending testnet qualification';connect.textContent='Wallet connected';connect.disabled=false;}
    if(event.type==='wallet-invalidated'){message.textContent='Wallet changed: '+event.reason+'. Reconnect and review again.';connect.textContent='Reconnect wallet';connect.disabled=false;}
  }
  function intercept(event){const button=event.target?.closest?.('#connect, #swap-submit, #order-sign, #bridge-submit, [data-cancel-order]');if(!button)return;
    event.preventDefault();event.stopImmediatePropagation();
    if(button.id!=='connect'){lockExecution();message.textContent=EXECUTION_BLOCK_REASON;return;}
    if(context.pending||context.disposed||!context.controller)return;
    if(!select.value){message.textContent='Select the wallet to connect.';return;}
    context.pending=true;connect.disabled=true;message.textContent='Requesting wallet connection…';
    context.controller.connect({ethereum,selectedId:select.value}).catch(e=>{if(!context.disposed)message.textContent=String(e?.message??'Wallet connection failed');}).finally(()=>{context.pending=false;if(!context.disposed)connect.disabled=false;});
  }
  documentRef.addEventListener('click',intercept,true);
  const view=documentRef.querySelector('#app-view');
  // Observe only top-level view replacement: changing a button label must not trigger an observer feedback loop.
  const observer=typeof MutationObserver==='function'?new MutationObserver(()=>lockExecution()):null;
  if(view&&observer)observer.observe(view,{childList:true});lockExecution();
  Promise.resolve().then(loadRuntime).then(runtime=>{if(context.disposed)return;
    context.runtime=runtime;context.controller=new BrowserExecutionController({runtime,onState,onInvalidate:()=>lockExecution()});
    context.controller.listen(windowRef,ethereum);renderChoices();
  }).catch(e=>{if(!context.disposed){message.textContent=String(e?.message??'Wallet unavailable');connect.disabled=true;}});
  windowRef.addEventListener('pagehide',dispose,{once:true});
  function dispose(){if(context.disposed)return;context.disposed=true;observer?.disconnect();context.controller?.dispose();documentRef.removeEventListener('click',intercept,true);windowRef.removeEventListener('pagehide',dispose);}
  return {dispose,lockExecution,renderChoices,context};
}
if(typeof document!=='undefined'&&document.querySelector('#connect'))mountWalletUI();

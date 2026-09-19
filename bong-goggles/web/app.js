import {loadRuntimeConfig} from './core/runtime-config.js';
import {createBongGogglesServices} from './core/services.js';
import {deriveBootstrapState} from './core/bootstrap.js';
import {createTelemetrySink} from './core/telemetry.js';
import {discover420Wallet,WalletSessionController420,buildWalletHandoffUrl} from './core/wallet-session.js';
import {renderApplicationShell,navigateWithoutReload} from './core/app-shell.js';

const root=document.querySelector('#app');
const telemetry=createTelemetrySink({emit:(event)=>console.info('[bg-web]',event)});
let runtimeConfig=null;
let walletController=null;
let walletView=null;

function shortAccount(value){
  return value?`${value.slice(0,6)}…${value.slice(-4)}`:'Not connected';
}

function walletMarkup(){
  const providerAvailable=Boolean(discover420Wallet(window));
  const connected=walletView?.connected===true;
  const supported=walletView?.supportedNetwork!==false;
  const account=shortAccount(walletView?.account);
  const chain=walletView?.chainId??'—';
  const sessionState=walletView?.sessionState??'none';
  return `
    <section class="wallet-panel" aria-labelledby="wallet-title">
      <div class="wallet-heading">
        <div>
          <p class="eyebrow">420Wallet</p>
          <h2 id="wallet-title">Session access</h2>
        </div>
        <span class="status">${connected?'connected':'read-only'}</span>
      </div>
      <dl class="wallet-grid">
        <div><dt>Account</dt><dd>${account}</dd></div>
        <div><dt>Network</dt><dd>${chain}</dd></div>
        <div><dt>Session</dt><dd>${sessionState}</dd></div>
        <div><dt>Write access</dt><dd>${walletView?.canWrite?'Wallet-confirmed':'disabled'}</dd></div>
      </dl>
      ${!providerAvailable?'<p class="notice">420Wallet browser provider not detected. Bong Goggles remains read-only.</p>':''}
      ${connected&&!supported?'<p class="notice warning">Wrong network. State-changing actions are blocked until 420Wallet is on the configured 420 network.</p>':''}
      <div class="actions">
        ${providerAvailable&&!connected?'<button type="button" data-action="connect">Connect 420Wallet</button>':''}
        ${providerAvailable&&connected&&!supported?'<button type="button" data-action="switch-network">Switch network</button>':''}
        ${connected?'<button type="button" data-action="sign-out" class="secondary">Sign out</button>':''}
        <a data-wallet-handoff="passkeys" href="#">Passkeys</a>
        <a data-wallet-handoff="sessions" href="#">Sessions</a>
      </div>
    </section>`;
}

function bindWalletActions(){
  root.querySelector('[data-action="connect"]')?.addEventListener('click',async()=>{
    try{
      walletView=await walletController.connect();
      telemetry.event('wallet_connected',{chainId:walletView.chainId});
      renderCurrent();
    }catch(error){
      telemetry.event('wallet_connect_failed',{code:error?.code,message:error?.message});
      renderCurrent('Wallet connection was not approved.');
    }
  });
  root.querySelector('[data-action="switch-network"]')?.addEventListener('click',async()=>{
    try{
      walletView=await walletController.requestSupportedNetwork();
      telemetry.event('wallet_network_changed',{chainId:walletView.chainId});
      renderCurrent();
    }catch(error){
      telemetry.event('wallet_network_change_failed',{code:error?.code,message:error?.message});
      renderCurrent(error?.message||'Network change was not completed.');
    }
  });
  root.querySelector('[data-action="sign-out"]')?.addEventListener('click',async()=>{
    walletView=await walletController.signOut();
    telemetry.event('wallet_signed_out');
    renderCurrent();
  });
  for(const link of root.querySelectorAll('[data-wallet-handoff]')){
    const action=link.dataset.walletHandoff;
    try{
      link.href=buildWalletHandoffUrl(runtimeConfig.walletUrl,{action,returnUrl:window.location.href});
      link.rel='noopener noreferrer';
    }catch{
      link.hidden=true;
    }
  }
}

function render(view){
  root.dataset.state=view.state;
  root.innerHTML=`
    <main class="bootstrap-shell" aria-live="polite">
      <section class="bootstrap-card">
        <p class="eyebrow">420 Integrated</p>
        <h1>Bong Goggles</h1>
        <p class="status">${view.state}</p>
        <p class="detail">${view.detail}</p>
        ${runtimeConfig?walletMarkup():''}
      </section>
    </main>`;
  if(runtimeConfig) bindWalletActions();
}

function renderCurrent(message=null){
  const bootstrap=deriveBootstrapState({
    config:runtimeConfig,
    connectedChainId:walletView?.chainId??null
  });
  if(bootstrap.state==='maintenance'){
    render({state:bootstrap.state,detail:'Bong Goggles is temporarily in maintenance mode.'});
    return;
  }
  const walletHref=runtimeConfig
    ?buildWalletHandoffUrl(runtimeConfig.walletUrl,{action:'connect',returnUrl:window.location.href})
    :null;
  const explorerHref=runtimeConfig?.explorerUrl??null;
  root.dataset.state=bootstrap.state;
  root.innerHTML=renderApplicationShell({
    pathname:window.location.pathname,
    walletView,
    bootstrapState:bootstrap.state,
    appOrigin:runtimeConfig.appOrigin,
    walletHref,
    explorerHref,
    announcement:message
  });
  bindWalletActions();
}

async function start(){
  render({state:'loading',detail:'Loading canonical application configuration…'});
  try{
    runtimeConfig=await loadRuntimeConfig();
    createBongGogglesServices(runtimeConfig);
    const provider=discover420Wallet(window);
    if(provider){
      walletController=new WalletSessionController420({
        provider,
        expectedChainId:runtimeConfig.chainId,
        storage:window.sessionStorage,
        onChange:(next)=>{walletView=next;}
      });
      try{ walletView=await walletController.snapshot(); }
      catch(error){ telemetry.event('wallet_snapshot_failed',{code:error?.code,message:error?.message}); }
    }
    const view=deriveBootstrapState({config:runtimeConfig,connectedChainId:walletView?.chainId??null});
    telemetry.event('bootstrap',{state:view.state,environment:runtimeConfig.environment});
    renderCurrent();
  }catch(error){
    telemetry.event('bootstrap_error',{message:error?.message});
    render({state:'degraded',detail:'Bong Goggles could not load a safe runtime configuration.'});
  }
}

window.addEventListener('error',(event)=>telemetry.event('window_error',{message:event.message}));
window.addEventListener('unhandledrejection',(event)=>telemetry.event('unhandled_rejection',{reason:String(event.reason)}));
root.addEventListener('click',(event)=>{
  navigateWithoutReload(event,{windowObject:window,onNavigate:()=>renderCurrent()});
});
window.addEventListener('popstate',()=>renderCurrent());
window.addEventListener('beforeunload',()=>walletController?.destroy());
start();

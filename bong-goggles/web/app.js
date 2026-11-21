import {loadRuntimeConfig} from './core/runtime-config.js';
import {createBongGogglesServices} from './core/services.js';
import {createIndexerStatusReader} from './core/indexer-status.js';
import {createPublicDiscoverFeedReader} from './core/public-discover-feed.js';
import {deriveBootstrapState} from './core/bootstrap.js';
import {createTelemetrySink} from './core/telemetry.js';
import {discover420Wallet,WalletSessionController420,buildWalletHandoffUrl} from './core/wallet-session.js';
import {renderApplicationShell,navigateWithoutReload} from './core/app-shell.js';
import {createChaosGame,takeChaosTurn,advanceChaosLeg} from './core/cross-country-chaos.js';
import {keepChaosHandRevealed} from './core/chaos-board.js';
import {CHAOS_VEHICLES,applyChaosVehicleSelection} from './core/chaos-vehicles.js';
import {selectGreeting,greetingSrc} from './core/dashboard-art.js';
import {AccountSocialController} from './core/account-social-controller.js';
import {AccountExtrasController} from './core/account-extras.js';
import {AccountXPController} from './core/account-xp.js';
import {AccountMonetizationController} from './core/account-monetization.js';
import {normalizeViewPreferences,DEFAULT_VIEW_PREFERENCES,documentIndexingPolicy} from './core/settings-public.js';
const root=document.querySelector('#app');
const telemetry=createTelemetrySink({emit:(event)=>console.info('[bg-web]',event)});
let runtimeConfig=null,walletController=null,walletView=null,indexerStatusReader=null,publicFeedReader=null,socialController=null,accountExtras=null,xpController=null,monetizationController=null;
let indexerStatus={status:'checking',data:null};
let publicFeedProjection=null,publicFeedNotice=null;
let viewPreferences=DEFAULT_VIEW_PREFERENCES;
let chaosGame=null,chaosRevealed=false,chaosError=null;
function shortAccount(value){return value?`${value.slice(0,6)}…${value.slice(-4)}`:'Not connected';}
function applyViewPreferences(){document.documentElement.dataset.textSize=viewPreferences.textSize;document.documentElement.dataset.contrast=viewPreferences.contrast;document.documentElement.dataset.motion=viewPreferences.motion;}
function updateRobots(){let tag=document.querySelector('meta[name="robots"]');if(!tag){tag=document.createElement('meta');tag.name='robots';document.head.append(tag);}tag.content=documentIndexingPolicy(window.location.pathname);}
function bindSettings(){for(const control of root.querySelectorAll('[data-view-preference]'))control.addEventListener('change',()=>{try{viewPreferences=normalizeViewPreferences({...viewPreferences,[control.dataset.viewPreference]:control.value});applyViewPreferences();}catch{renderCurrent('Invalid display preference.');}});root.querySelector('[data-settings-action="reset-display"]')?.addEventListener('click',()=>{viewPreferences=DEFAULT_VIEW_PREFERENCES;applyViewPreferences();renderCurrent();});}
function walletMarkup(){const providerAvailable=Boolean(discover420Wallet(window)),connected=walletView?.connected===true,supported=walletView?.supportedNetwork!==false,account=shortAccount(walletView?.account),chain=walletView?.chainId??'—',sessionState=walletView?.sessionState??'none';return `<section class="wallet-panel" aria-labelledby="wallet-title"><div class="wallet-heading"><div><p class="eyebrow">420Wallet</p><h2 id="wallet-title">Session access</h2></div><span class="status">${connected?'connected':'read-only'}</span></div><dl class="wallet-grid"><div><dt>Account</dt><dd>${account}</dd></div><div><dt>Network</dt><dd>${chain}</dd></div><div><dt>Session</dt><dd>${sessionState}</dd></div><div><dt>Write access</dt><dd>${walletView?.canWrite?'Wallet-confirmed':'disabled'}</dd></div></dl>${!providerAvailable?'<p class="notice">420Wallet browser provider not detected. Bong Goggles remains read-only.</p>':''}${connected&&!supported?'<p class="notice warning">Wrong network. State-changing actions are blocked until 420Wallet is on the configured 420 network.</p>':''}<div class="actions">${providerAvailable&&!connected?'<button type="button" data-action="connect">Connect 420Wallet</button>':''}${providerAvailable&&connected&&!supported?'<button type="button" data-action="switch-network">Switch network</button>':''}${connected?'<button type="button" data-action="sign-out" class="secondary">Sign out</button>':''}<a data-wallet-handoff="passkeys" href="#">Passkeys</a><a data-wallet-handoff="sessions" href="#">Sessions</a></div></section>`;}
function bindWalletActions(){root.querySelector('[data-action="connect"]')?.addEventListener('click',async()=>{try{walletView=await walletController.connect();telemetry.event('wallet_connected',{chainId:walletView.chainId});renderCurrent();}catch(error){telemetry.event('wallet_connect_failed',{code:error?.code,message:error?.message});renderCurrent('Wallet connection was not approved.');}});root.querySelector('[data-action="switch-network"]')?.addEventListener('click',async()=>{try{walletView=await walletController.requestSupportedNetwork();telemetry.event('wallet_network_changed',{chainId:walletView.chainId});renderCurrent();}catch(error){telemetry.event('wallet_network_change_failed',{code:error?.code,message:error?.message});renderCurrent(error?.message||'Network change was not completed.');}});root.querySelector('[data-action="sign-out"]')?.addEventListener('click',async()=>{walletView=await walletController.signOut();renderCurrent();});for(const link of root.querySelectorAll('[data-wallet-handoff]')){const action=link.dataset.walletHandoff;try{link.href=buildWalletHandoffUrl(runtimeConfig.walletUrl,{action,returnUrl:window.location.href});link.rel='noopener noreferrer';}catch{link.hidden=true;}}}
function render(view){root.dataset.state=view.state;root.innerHTML=`<main class="bootstrap-shell" aria-live="polite"><section class="bootstrap-card"><p class="eyebrow">420 Integrated</p><h1>Bong Goggles</h1><p class="status">${view.state}</p><p class="detail">${view.detail}</p>${runtimeConfig?walletMarkup():''}</section></main>`;if(runtimeConfig)bindWalletActions();updateRobots();}
function indexerNotice(){if(indexerStatus.status==='ready'){const head=indexerStatus.data.indexedHead??'not yet indexed';return `420Indexer HTTP diagnostic: indexed head ${head} (${indexerStatus.data.finality}). Social projections and write authority remain unverified.`;}if(indexerStatus.status==='unavailable')return '420Indexer HTTP status unavailable. Social projections and writes remain unverified.';return null;}
function bindAccountSocial(){
 if(window.location.pathname!=='/social'||!socialController?.client.enabled)return;
 root.querySelector('[data-social-post]')?.addEventListener('submit',event=>{event.preventDefault();const body=new FormData(event.currentTarget).get('body');void runSocial('post',{body});});
 root.querySelector('[data-social-profile]')?.addEventListener('submit',event=>{event.preventDefault();const data=new FormData(event.currentTarget);void runSocial('profile',{displayName:data.get('displayName'),bio:data.get('bio')});});
 for(const form of root.querySelectorAll('[data-social-comment]'))form.addEventListener('submit',event=>{event.preventDefault();const id=form.dataset.socialComment,body=new FormData(form).get('body');void runSocial('comment',{postID:id,body});});
 for(const button of root.querySelectorAll('[data-social-action]'))button.addEventListener('click',()=>{const action=button.dataset.socialAction;if(action==='refresh'){void socialController.refresh();return;}void runSocial(action,{postID:button.dataset.postId,subjectID:button.dataset.subjectId});});
}
async function runSocial(action,details){try{await socialController.act(action,details);}catch{socialController.emit({status:'error'});}}
function currentAccountExtra(){
 if(window.location.pathname==='/account/messages')return accountExtras?.messages;
 if(window.location.pathname==='/account/games')return accountExtras?.games;
 return null;
}
function bindAccountXP(){
 if(window.location.pathname!== '/account/xp'||!xpController?.client.enabled)return;
 root.querySelector('[data-xp-refresh]')?.addEventListener('click',()=>void xpController.refresh());
}
function bindAccountMonetization(){
 if(window.location.pathname!=='/account/monetization'||!monetizationController?.client.enabled)return;
 root.querySelector('[data-monetization-refresh]')?.addEventListener('click',()=>void monetizationController.refresh());
}
function bindAccountExtras(){
 const controller=currentAccountExtra();
 if(!controller?.client.enabled)return;
 for(const form of root.querySelectorAll('[data-extra-form]'))form.addEventListener('submit',event=>{
  event.preventDefault();
  const data=new FormData(event.currentTarget);
  const action=event.currentTarget.dataset.extraForm;
  if(action==='send')void runExtra('send',{target:data.get('target'),body:data.get('body')});
  if(action==='invite')void runExtra('invite',{target:data.get('target'),kind:data.get('kind')});
 });
 for(const button of root.querySelectorAll('[data-extra-action]'))button.addEventListener('click',()=>{
  const action=button.dataset.extraAction;
  if(action==='open-thread')void runExtra(action,{peer:button.dataset.peer});
  else if(action==='open-game')void runExtra(action,{id:button.dataset.game});
  else if(action==='delete-message')void runExtra(action,{id:button.dataset.message});
  else if(action==='move')void runExtra(action,{position:Number(button.dataset.position)});
  else void runExtra(action,{});
 });
}
async function runExtra(action,details){
 const controller=currentAccountExtra();
 if(!controller)return;
 try{await controller.act(action,details);}catch{controller.emit({status:'error'});}
}


function bindChaos(){
 if(window.location.pathname!=='/classics/cross-country-chaos')return;
 const countSelect=root.querySelector('#ccc-count');
 const updateSeats=()=>{
  const count=Number(countSelect?.value||4);
  for(const row of root.querySelectorAll('[data-chaos-driver]'))row.hidden=Number(row.dataset.chaosDriver)>=count;
 };
 countSelect?.addEventListener('change',updateSeats);updateSeats();
 for(const select of root.querySelectorAll('[data-chaos-vehicle-pick]'))select.addEventListener('change',()=>{
  const selected=CHAOS_VEHICLES.find(v=>v.id===select.value);
  const preview=select.closest('.ccc-driver-setup')?.querySelector('.ccc-vehicle-picker-preview');
  if(selected&&preview)preview.src=selected.src;
 });
 root.querySelector('[data-chaos-start]')?.addEventListener('submit',event=>{
  event.preventDefault();
  const data=new FormData(event.currentTarget),count=Number(data.get('count'));
  try{
   if(!Number.isInteger(count)||count<2||count>4)throw new Error('Choose two to four drivers.');
   const names=Array.from({length:count},(_,i)=>String(data.get('player'+i)||'').trim()||'Driver '+(i+1));
   const seed=window.crypto?.getRandomValues?window.crypto.getRandomValues(new Uint32Array(1))[0]:Math.floor(Math.random()*0xffffffff);
   const vehicleIds=Array.from({length:count},(_,i)=>String(data.get('vehicle'+i)||''));
   chaosGame=applyChaosVehicleSelection(createChaosGame({names,seed}),vehicleIds);
   chaosRevealed=false;chaosError=null;renderCurrent();
  }catch(error){chaosError=error.message;renderCurrent(chaosError);}
 });
 const apply=move=>{try{
  const previous=chaosGame;
  const updated=takeChaosTurn(previous,{player:previous.players[previous.turn].id,...move});
  chaosRevealed=keepChaosHandRevealed(previous,updated,chaosRevealed);
  chaosGame=updated;chaosError=null;renderCurrent();
 }catch(error){chaosError=error.message;renderCurrent(chaosError);}};
 for(const control of root.querySelectorAll('[data-chaos-action]'))control.addEventListener('click',()=>{
  const action=control.dataset.chaosAction;
  try{
   if(action==='reveal'){chaosRevealed=true;chaosError=null;renderCurrent();return;}
   if(action==='restart'){chaosGame=null;chaosRevealed=false;chaosError=null;renderCurrent();return;}
   if(action==='next'){chaosGame=advanceChaosLeg(chaosGame);chaosRevealed=false;chaosError=null;renderCurrent();return;}
   apply({action,index:control.dataset.card===undefined?null:Number(control.dataset.card),choice:control.dataset.choice||null});
  }catch(error){chaosError=error.message;renderCurrent(chaosError);}
 });
 for(const form of root.querySelectorAll('[data-chaos-move]'))form.addEventListener('submit',event=>{
  event.preventDefault();
  const data=new FormData(form);
  apply({action:form.dataset.chaosMove,index:Number(form.dataset.card),target:data.has('target')?Number(data.get('target')):null,useBoost:data.has('boost')});
 });
}

function renderCurrent(message=null){const bootstrap=deriveBootstrapState({config:runtimeConfig,connectedChainId:walletView?.chainId??null});if(bootstrap.state==='maintenance'){publicFeedReader?.invalidate();publicFeedProjection=null;render({state:bootstrap.state,detail:'Bong Goggles is temporarily in maintenance mode.'});return;}const walletHref=runtimeConfig?buildWalletHandoffUrl(runtimeConfig.walletUrl,{action:'connect',returnUrl:window.location.href}):null;root.dataset.state=bootstrap.state;root.innerHTML=renderApplicationShell({pathname:window.location.pathname,walletView,bootstrapState:bootstrap.state,appOrigin:runtimeConfig.appOrigin,walletHref,explorerHref:runtimeConfig?.explorerUrl??null,announcement:message??(window.location.pathname==='/'?publicFeedNotice:null)??indexerNotice(),feedProjection:window.location.pathname==='/'?publicFeedProjection:null,viewPreferences,walletSettingsUrl:runtimeConfig.walletUrl,accountSocialState:socialController?.state,accountSocialEnabled:runtimeConfig.features.accountSocial===true,
 accountMessagesState:accountExtras?.messages.state,accountGamesState:accountExtras?.games.state,
 accountMessagingEnabled:runtimeConfig.features.accountMessaging===true,accountGamesEnabled:runtimeConfig.features.accountGames===true,
 accountXPState:xpController?.state,accountXPEnabled:runtimeConfig.features.accountXP===true,
 accountMonetizationState:monetizationController?.state,
 accountMonetizationEnabled:runtimeConfig.features.accountMonetization===true,chaosGame,chaosRevealed,chaosError});updateRobots();bindWalletActions();bindSettings();bindAccountSocial();bindAccountExtras();bindAccountXP();bindAccountMonetization();bindChaos();}
// Re-fetching clears the previous page first: withdrawn/hidden content is not
// retained after a failed refresh or restored from a browser cache. This is a
// sampled public feed, not a real-time revocation stream or guaranteed freshness.
async function refreshPublicFeed(){
  if(!publicFeedReader?.enabled||window.location.pathname!=='/'||runtimeConfig?.maintenance)return;
  publicFeedReader.invalidate();publicFeedProjection=null;
  publicFeedNotice='Checking the qualified public DISCOVER feed…';renderCurrent();
  const result=await publicFeedReader.read();
  if(result.status==='stale'||window.location.pathname!=='/'||runtimeConfig?.maintenance)return;
  publicFeedProjection=result.status==='ready'?result.data:null;
  publicFeedNotice=result.status==='ready'?null:'Public DISCOVER feed unavailable. No cached posts are shown.';
  telemetry.event('public_discover_read',{status:result.status});renderCurrent();
}
function refreshGreeting(){const image=root.querySelector('[data-greeting]');if(!image)return;const greeting=selectGreeting();const src=greetingSrc(greeting);if(image.getAttribute('src')!==src){image.src=src;image.alt=greeting.label;}}
function onRouteChange(){
 chaosRevealed=false;
 monetizationController?.invalidate();xpController?.invalidate();socialController?.invalidate();for(const c of Object.values(accountExtras??{}))c.invalidate();
 publicFeedReader?.invalidate();publicFeedProjection=null;publicFeedNotice=null;renderCurrent();
 if(window.location.pathname==='/')void refreshPublicFeed();
 if(window.location.pathname==='/social'&&socialController?.client.enabled)void socialController.refresh();
 if(window.location.pathname==='/account/xp'&&xpController?.client.enabled)void xpController.refresh();
 if(window.location.pathname==='/account/monetization'&&monetizationController?.client.enabled)void monetizationController.refresh();
 const extras=currentAccountExtra();if(extras?.client.enabled)void extras.refresh();
}
async function start(){render({state:'loading',detail:'Loading canonical application configuration…'});try{runtimeConfig=await loadRuntimeConfig();const services=createBongGogglesServices(runtimeConfig);indexerStatusReader=createIndexerStatusReader({service:services.indexer,chainId:runtimeConfig.chainId});publicFeedReader=createPublicDiscoverFeedReader({config:runtimeConfig});socialController=new AccountSocialController({enabled:runtimeConfig.features.accountSocial===true,onChange:()=>{if(window.location.pathname==='/social')renderCurrent();}});xpController=new AccountXPController({enabled:runtimeConfig.features.accountXP===true,onChange:()=>{if(window.location.pathname==='/account/xp')renderCurrent();}});monetizationController=new AccountMonetizationController({enabled:runtimeConfig.features.accountMonetization===true,onChange:()=>{if(window.location.pathname==='/account/monetization')renderCurrent();}});accountExtras={
 messages:new AccountExtrasController({kind:'messages',enabled:runtimeConfig.features.accountMessaging===true,
 onChange:()=>{if(window.location.pathname==='/account/messages')renderCurrent();}}),
 games:new AccountExtrasController({kind:'games',enabled:runtimeConfig.features.accountGames===true,
 onChange:()=>{if(window.location.pathname==='/account/games')renderCurrent();}})
};const provider=discover420Wallet(window);if(provider){walletController=new WalletSessionController420({provider,expectedChainId:runtimeConfig.chainId,storage:window.sessionStorage,onChange:(next)=>{walletView=next;}});try{walletView=await walletController.snapshot();}catch(error){telemetry.event('wallet_snapshot_failed',{code:error?.code,message:error?.message});}}const view=deriveBootstrapState({config:runtimeConfig,connectedChainId:walletView?.chainId??null});telemetry.event('bootstrap',{state:view.state,environment:runtimeConfig.environment});applyViewPreferences();renderCurrent();if(publicFeedReader.enabled)void refreshPublicFeed();if(window.location.pathname==='/social'&&socialController.client.enabled)void socialController.refresh();if(window.location.pathname==='/account/xp'&&xpController?.client.enabled)void xpController.refresh();if(window.location.pathname==='/account/monetization'&&monetizationController?.client.enabled)void monetizationController.refresh();const extras=currentAccountExtra();if(extras?.client.enabled)void extras.refresh();void indexerStatusReader.read().then(result=>{if(result.status==='stale')return;indexerStatus=result;telemetry.event('indexer_http_diagnostic',{status:result.status});renderCurrent();});}catch(error){telemetry.event('bootstrap_error',{message:error?.message});render({state:'degraded',detail:'Bong Goggles could not load a safe runtime configuration.'});}}
window.addEventListener('error',(event)=>telemetry.event('window_error',{message:event.message}));window.addEventListener('unhandledrejection',(event)=>telemetry.event('unhandled_rejection',{reason:String(event.reason)}));root.addEventListener('click',(event)=>{navigateWithoutReload(event,{windowObject:window,onNavigate:onRouteChange});});window.addEventListener('popstate',onRouteChange);window.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshGreeting();if(publicFeedReader?.enabled)void refreshPublicFeed();}});window.setInterval(()=>{if(!document.hidden){refreshGreeting();if(publicFeedReader?.enabled)void refreshPublicFeed();}},15_000);window.addEventListener('beforeunload',()=>{publicFeedReader?.invalidate();socialController?.invalidate();xpController?.invalidate();for(const c of Object.values(accountExtras??{}))c.invalidate();indexerStatusReader?.invalidate();walletController?.destroy();});start();

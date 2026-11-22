import {loadRuntimeConfig} from './core/runtime-config.js';
import {createBongGogglesServices} from './core/services.js';
import {createIndexerStatusReader} from './core/indexer-status.js';
import {createPublicDiscoverFeedReader} from './core/public-discover-feed.js';
import {deriveBootstrapState} from './core/bootstrap.js';
import {createTelemetrySink} from './core/telemetry.js';
import {discover420Wallet,WalletSessionController420,buildWalletHandoffUrl} from './core/wallet-session.js';
import {renderApplicationShell,navigateWithoutReload} from './core/app-shell.js';
import {createChaosGame,takeChaosTurn,advanceChaosLeg} from './core/cross-country-chaos.js';
import {ChaosRoomsClient} from './core/chaos-online.js';
import {bindChaosOnline} from './core/chaos-online-bindings.js';
import {bindClassicRoomsDom} from './core/classic-room-bindings.js';
import {cc} from './core/classic-live-bindings.js';
import {configureChaosComputerSeats,isChaosComputer,advanceChaosComputerTurns} from './core/chaos-computer.js';
import {CHAOS_TAB_KEY,CHAOS_DEVICE_KEY,beginChaosJournal,appendChaosJournal,readChaosStorage,writeChaosStorage,removeChaosStorage} from './core/chaos-save.js';
import {keepChaosHandRevealed} from './core/chaos-board.js';
import {deriveChaosTableFeedback} from './core/chaos-table-art.js';
import {deriveChaosGameEffects} from './core/chaos-game-effects.js';
import {playChaosMotion} from './core/chaos-motion.js';
import {CHAOS_VEHICLES,applyChaosVehicleSelection} from './core/chaos-vehicles.js';
import {selectGreeting,greetingSrc} from './core/dashboard-art.js';
import {AccountSocialController} from './core/account-social-controller.js';
import {AccountIdentityController} from './core/account-identity.js';
import {ClassicRoomsController} from './core/classic-rooms.js';
import {resolveRoute} from './core/routes.js';
import {AccountExtrasController} from './core/account-extras.js';
import {AccountXPController} from './core/account-xp.js';
import {AccountMonetizationController} from './core/account-monetization.js';
import {normalizeViewPreferences,DEFAULT_VIEW_PREFERENCES,documentIndexingPolicy} from './core/settings-public.js';
const root=document.querySelector('#app');
const telemetry=createTelemetrySink({emit:(event)=>console.info('[bg-web]',event)});
let runtimeConfig=null,walletController=null,walletView=null,indexerStatusReader=null,publicFeedReader=null,socialController=null,identityController=null,classicRoomsController=null,classicLive=null,accountExtras=null,xpController=null,monetizationController=null;
let indexerStatus={status:'checking',data:null};
let publicFeedProjection=null,publicFeedNotice=null;
let viewPreferences=DEFAULT_VIEW_PREFERENCES;
let chaosGame=null,chaosRevealed=false,chaosError=null,chaosRepairCue=null,chaosEffects=null;
let chaosComputerScheduled=false,chaosComputerErrorStop=false;
let chaosJournal=null,chaosDeviceSaving=false,chaosSavedAvailable=false,chaosSavedInvalid=false,chaosSaveNotice=null,chaosGeneration=0;
let chaosOnline=null;
function shortAccount(value){return value?`${value.slice(0,6)}…${value.slice(-4)}`:'Not connected';}
function applyViewPreferences(){document.documentElement.dataset.textSize=viewPreferences.textSize;document.documentElement.dataset.contrast=viewPreferences.contrast;document.documentElement.dataset.motion=viewPreferences.motion;}
function updateRobots(){let tag=document.querySelector('meta[name="robots"]');if(!tag){tag=document.createElement('meta');tag.name='robots';document.head.append(tag);}tag.content=documentIndexingPolicy(window.location.pathname);}
function bindSettings(){for(const control of root.querySelectorAll('[data-view-preference]'))control.addEventListener('change',()=>{try{viewPreferences=normalizeViewPreferences({...viewPreferences,[control.dataset.viewPreference]:control.value});applyViewPreferences();}catch{renderCurrent('Invalid display preference.');}});root.querySelector('[data-settings-action="reset-display"]')?.addEventListener('click',()=>{viewPreferences=DEFAULT_VIEW_PREFERENCES;applyViewPreferences();renderCurrent();});}
function walletMarkup(){const providerAvailable=Boolean(discover420Wallet(window)),connected=walletView?.connected===true,supported=walletView?.supportedNetwork!==false,account=shortAccount(walletView?.account),chain=walletView?.chainId??'—',sessionState=walletView?.sessionState??'none';return `<section class="wallet-panel" aria-labelledby="wallet-title"><div class="wallet-heading"><div><p class="eyebrow">420Wallet</p><h2 id="wallet-title">Session access</h2></div><span class="status">${connected?'connected':'read-only'}</span></div><dl class="wallet-grid"><div><dt>Account</dt><dd>${account}</dd></div><div><dt>Network</dt><dd>${chain}</dd></div><div><dt>Session</dt><dd>${sessionState}</dd></div><div><dt>Write access</dt><dd>${walletView?.canWrite?'Wallet-confirmed':'disabled'}</dd></div></dl>${!providerAvailable?'<p class="notice">420Wallet browser provider not detected. Bong Goggles remains read-only.</p>':''}${connected&&!supported?'<p class="notice warning">Wrong network. State-changing actions are blocked until 420Wallet is on the configured 420 network.</p>':''}<div class="actions">${providerAvailable&&!connected?'<button type="button" data-action="connect">Connect 420Wallet</button>':''}${providerAvailable&&connected&&!supported?'<button type="button" data-action="switch-network">Switch network</button>':''}${connected?'<button type="button" data-action="sign-out" class="secondary">Sign out</button>':''}<a data-wallet-handoff="passkeys" href="#">Passkeys</a><a data-wallet-handoff="sessions" href="#">Sessions</a></div></section>`;}
function bindWalletActions(){root.querySelector('[data-action="connect"]')?.addEventListener('click',async()=>{try{walletView=await walletController.connect();telemetry.event('wallet_connected',{chainId:walletView.chainId});renderCurrent();}catch(error){telemetry.event('wallet_connect_failed',{code:error?.code,message:error?.message});renderCurrent('Wallet connection was not approved.');}});root.querySelector('[data-action="switch-network"]')?.addEventListener('click',async()=>{try{walletView=await walletController.requestSupportedNetwork();telemetry.event('wallet_network_changed',{chainId:walletView.chainId});renderCurrent();}catch(error){telemetry.event('wallet_network_change_failed',{code:error?.code,message:error?.message});renderCurrent(error?.message||'Network change was not completed.');}});root.querySelector('[data-action="sign-out"]')?.addEventListener('click',async()=>{walletView=await walletController.signOut();renderCurrent();});for(const link of root.querySelectorAll('[data-wallet-handoff]')){const action=link.dataset.walletHandoff;try{link.href=buildWalletHandoffUrl(runtimeConfig.walletUrl,{action,returnUrl:window.location.href});link.rel='noopener noreferrer';}catch{link.hidden=true;}}}
function render(view){root.dataset.state=view.state;root.innerHTML=`<main class="bootstrap-shell" aria-live="polite"><section class="bootstrap-card"><p class="eyebrow">420 Integrated</p><h1>Bong Goggles</h1><p class="status">${view.state}</p><p class="detail">${view.detail}</p>${runtimeConfig?walletMarkup():''}</section></main>`;if(runtimeConfig)bindWalletActions();updateRobots();}
function indexerNotice(){if(indexerStatus.status==='ready'){const head=indexerStatus.data.indexedHead??'not yet indexed';return `420Indexer HTTP diagnostic: indexed head ${head} (${indexerStatus.data.finality}). Social projections and write authority remain unverified.`;}if(indexerStatus.status==='unavailable')return '420Indexer HTTP status unavailable. Social projections and writes remain unverified.';return null;}
// Both Home and Account Social use one verified, fail-closed 420ID session.
const isAccountSocialSurface=()=>window.location.pathname==='/'||window.location.pathname==='/social';
function bindAccountSocial(){
 if(!isAccountSocialSurface()||!socialController?.client.enabled)return;
 root.querySelector('[data-social-post]')?.addEventListener('submit',event=>{event.preventDefault();const body=new FormData(event.currentTarget).get('body');void runSocial('post',{body});});
 root.querySelector('[data-social-profile]')?.addEventListener('submit',event=>{event.preventDefault();const data=new FormData(event.currentTarget);void runSocial('profile',{displayName:data.get('displayName'),bio:data.get('bio')});});
 for(const form of root.querySelectorAll('[data-social-comment]'))form.addEventListener('submit',event=>{event.preventDefault();const id=form.dataset.socialComment,body=new FormData(form).get('body');void runSocial('comment',{postID:id,body});});
 for(const button of root.querySelectorAll('[data-social-action]'))button.addEventListener('click',()=>{const action=button.dataset.socialAction;if(action==='refresh'){void socialController.refresh();return;}if(action==='logout'){void signOut420ID();return;}void runSocial(action,{postID:button.dataset.postId,subjectID:button.dataset.subjectId});});
}
async function runSocial(action,details){try{await socialController.act(action,details);if(action==='profile')void identityController?.refresh();}catch{socialController.emit({status:'error'});void identityController?.refresh();}}
async function signOut420ID(){
 // Clear the visible account before invalidating other in-memory projections.
 const pending=identityController.logout();
 socialController?.invalidate();xpController?.invalidate();monetizationController?.invalidate();
 for(const c of Object.values(accountExtras??{}))c.invalidate();
 classicRoomsController?.invalidate();classicLive?.invalidate();
 try{await pending;}catch{renderCurrent('420ID sign-out could not be confirmed. Recheck your session before continuing.');return;}
 if(isAccountSocialSurface()&&socialController?.client.enabled)void socialController.refresh();
 if(isClassicRoomSurface()&&classicRoomsController?.client.enabled)void refreshClassicRooms();
 const extra=currentAccountExtra();if(extra?.client.enabled)void extra.refresh();
 if(window.location.pathname==='/account/xp'&&xpController?.client.enabled)void xpController.refresh();
 if(window.location.pathname==='/account/monetization'&&monetizationController?.client.enabled)void monetizationController.refresh();
}
function bindAccountActions(){
 for(const control of root.querySelectorAll('[data-account-action]'))control.addEventListener('click',()=>{
  if(control.dataset.accountAction==='retry'){void identityController?.refresh();return;}
  if(control.dataset.accountAction==='logout')void signOut420ID();
 });
}
function roomRoute(){return resolveRoute(window.location.pathname);}
function isClassicRoomSurface(){return ['classic-rooms','classic-room'].includes(roomRoute().id);}
function refreshClassicRooms(){return classicLive?.refresh(roomRoute().roomId??null)??classicRoomsController?.refresh(roomRoute().roomId??null);}
function bindClassicRooms(){bindClassicRoomsDom(root,classicRoomsController,{isSurface:isClassicRoomSurface(),onRefresh:refreshClassicRooms,onRouteChange,history:window.history});}
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


// CCC-6: all game data stays in this browser. Device persistence is opt-in,
// because the seed and move journal can reconstruct other drivers' private hands.
function chaosStorage(kind){
 try{return kind==='tab'?window.sessionStorage:window.localStorage;}catch{return null;}
}
function refreshChaosRecovery(){
 const tab=readChaosStorage(chaosStorage('tab'),CHAOS_TAB_KEY);
 const device=readChaosStorage(chaosStorage('device'),CHAOS_DEVICE_KEY);
 chaosSavedAvailable=device.status==='ready';
 chaosSavedInvalid=tab.status==='invalid'||device.status==='invalid';
 if(tab.status==='ready'){
  chaosJournal=tab.journal;chaosGame=tab.game;chaosRevealed=false;
  chaosDeviceSaving=device.status==='ready'&&
   JSON.stringify(device.journal)===JSON.stringify(tab.journal);
  chaosSaveNotice='Championship recovered from this tab. Reveal your hand only when it is your turn.';
 }else if(tab.status==='invalid'){
  chaosSaveNotice='Previous tab progress is damaged. Resume a verified device save or start over.';
 }
}
function restoreChaosOnGameRoute(){
 // Old same-screen journals cannot authorize an account match.
 if(window.location.pathname==='/classics/cross-country-chaos/practice'&&!chaosGame&&!chaosJournal)
  refreshChaosRecovery();
}
function eraseChaosRecovery(){
 const a=removeChaosStorage(chaosStorage('tab'),CHAOS_TAB_KEY);
 const b=removeChaosStorage(chaosStorage('device'),CHAOS_DEVICE_KEY);
 chaosSavedAvailable=false;chaosSavedInvalid=!(a&&b);chaosDeviceSaving=false;
 return a&&b;
}
function recordChaosTransition(before,after,events){
 if(!chaosJournal)throw Error('Cannot save this untracked championship.');
 const updated=appendChaosJournal(chaosJournal,before,after,events);
 chaosJournal=updated;
 const tab=writeChaosStorage(chaosStorage('tab'),CHAOS_TAB_KEY,updated);
 let device={ok:true};
 if(chaosDeviceSaving)device=writeChaosStorage(chaosStorage('device'),CHAOS_DEVICE_KEY,updated);
 chaosSavedAvailable=chaosSavedAvailable||chaosDeviceSaving&&device.ok;
 chaosSaveNotice=!tab.ok?tab.message:!device.ok?device.message:null;
 if(!device.ok)chaosDeviceSaving=false;
}
function saveChaosDisplayInfo(){
 return {deviceSaving:chaosDeviceSaving,available:chaosSavedAvailable,
  invalid:chaosSavedInvalid,notice:chaosSaveNotice};
}
// Yield between bounded local computer batches. Never reveal a bot's hand.
function scheduleChaosComputer(){
 if(chaosComputerScheduled||chaosComputerErrorStop||
  window.location.pathname!=='/classics/cross-country-chaos/practice'||
  chaosGame?.phase!=='playing'||!isChaosComputer(chaosGame.players[chaosGame.turn]))return;
 const generation=chaosGeneration;
 chaosComputerScheduled=true;
 window.setTimeout(()=>{
  if(generation!==chaosGeneration)return;
  chaosComputerScheduled=false;
  if(window.location.pathname!=='/classics/cross-country-chaos/practice'||chaosComputerErrorStop||
   chaosGame?.phase!=='playing'||!isChaosComputer(chaosGame.players[chaosGame.turn]))return;
  try{
   const result=advanceChaosComputerTurns(chaosGame,{maxActions:96});
   if(!result.moves.length)throw Error('Computer move made no progress.');
   const events=[],before=chaosGame;
   let cursor=before;
   for(const move of result.moves){
    const player=cursor.players[cursor.turn].id;
    events.push({kind:'move',player,move});
    cursor=takeChaosTurn(cursor,{player,...move});
   }
   recordChaosTransition(before,result.game,events);
   chaosGame=result.game;
   chaosRevealed=false;
   chaosRepairCue=deriveChaosTableFeedback(result.lastBefore,result.game,result.lastMove);
   chaosEffects=deriveChaosGameEffects(result.lastBefore,result.game,result.lastMove);
   chaosError=null;renderCurrent();
  }catch{
   chaosComputerErrorStop=true;
   chaosRevealed=false;chaosRepairCue=null;chaosEffects=null;
   chaosError='Computer move could not be completed. Retry this turn.';
   renderCurrent();
  }
 },0);
}
function bindChaos(){
 if(window.location.pathname!=='/classics/cross-country-chaos/practice')return;
 const countSelect=root.querySelector('#ccc-count');
 const updateSeats=()=>{
  const count=Number(countSelect?.value||4);
  for(const row of root.querySelectorAll('[data-chaos-driver]'))row.parentElement.hidden=Number(row.dataset.chaosDriver)>=count;
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
   const controllers=Array.from({length:count},(_,i)=>String(data.get('control'+i)||''));
   const plan={names,seed,controllers,vehicles:vehicleIds};
   const next=configureChaosComputerSeats(
    applyChaosVehicleSelection(createChaosGame({names,seed}),vehicleIds),controllers);
   const journal=beginChaosJournal(plan);
   chaosGeneration++;chaosComputerScheduled=false;chaosComputerErrorStop=false;
   eraseChaosRecovery();
   chaosGame=next;chaosJournal=journal;chaosRevealed=false;
   const saved=writeChaosStorage(chaosStorage('tab'),CHAOS_TAB_KEY,chaosJournal);
   chaosSaveNotice=saved.ok?null:saved.message;
   chaosRevealed=false;chaosError=null;chaosRepairCue=null;chaosEffects=null;renderCurrent();
  }catch(error){chaosError=error.message;renderCurrent(chaosError);}
 });
 const apply=move=>{try{
  const previous=chaosGame;
  if(isChaosComputer(previous.players[previous.turn]))throw Error('Computer drivers use automatic moves.');
  const updated=takeChaosTurn(previous,{player:previous.players[previous.turn].id,...move});
  chaosRepairCue=deriveChaosTableFeedback(previous,updated,move);
  chaosEffects=deriveChaosGameEffects(previous,updated,move);
  chaosRevealed=keepChaosHandRevealed(previous,updated,chaosRevealed);
  recordChaosTransition(previous,updated,[{kind:'move',player:previous.players[previous.turn].id,move}]);
  chaosGame=updated;chaosError=null;renderCurrent();
 }catch(error){chaosRepairCue=null;chaosEffects=null;chaosError=error.message;renderCurrent(chaosError);}};
 for(const control of root.querySelectorAll('[data-chaos-action]'))control.addEventListener('click',()=>{
  const action=control.dataset.chaosAction;
  try{
   if(action==='save-device'){
    if(!chaosGame||!chaosJournal)throw Error('No championship to save.');
    const saved=writeChaosStorage(chaosStorage('device'),CHAOS_DEVICE_KEY,chaosJournal);
    chaosDeviceSaving=saved.ok;chaosSavedAvailable=saved.ok;
    chaosSaveNotice=saved.ok?'Championship saved on this device. Autosave is active.':saved.message;
    renderCurrent();return;
   }
   if(action==='stop-device-save'){
    if(!removeChaosStorage(chaosStorage('device'),CHAOS_DEVICE_KEY))
     throw Error('The saved device copy could not be deleted.');
    chaosDeviceSaving=false;chaosSavedAvailable=false;
    chaosSaveNotice='Device save deleted. This tab still recovers after reload.';
    renderCurrent();return;
   }
   if(action==='resume'){
    if(chaosGame)throw Error('Finish or restart the current championship first.');
    const saved=readChaosStorage(chaosStorage('device'),CHAOS_DEVICE_KEY);
    if(saved.status!=='ready')throw Error('The saved championship could not be verified.');
    chaosGeneration++;chaosComputerScheduled=false;chaosComputerErrorStop=false;
    chaosGame=saved.game;chaosJournal=saved.journal;chaosDeviceSaving=true;
    chaosSavedAvailable=true;chaosSavedInvalid=false;chaosRevealed=false;
    chaosEffects=null;chaosRepairCue=null;chaosError=null;
    const tab=writeChaosStorage(chaosStorage('tab'),CHAOS_TAB_KEY,chaosJournal);
    chaosSaveNotice=tab.ok?'Championship resumed. Private hands stay concealed.':tab.message;
    renderCurrent();return;
   }
   if(action==='delete-save'){
    if(!eraseChaosRecovery())throw Error('Browser storage prevented deleting the save.');
    chaosJournal=null;chaosSaveNotice='Saved championship deleted.';
    chaosError=null;renderCurrent();return;
   }
   if(action==='reveal'){chaosRevealed=true;chaosEffects=null;chaosRepairCue=null;chaosError=null;renderCurrent();return;}
   if(action==='restart'){chaosGeneration++;chaosComputerScheduled=false;eraseChaosRecovery();chaosJournal=null;chaosGame=null;chaosRevealed=false;chaosEffects=null;chaosRepairCue=null;chaosError=null;chaosComputerErrorStop=false;chaosSaveNotice=null;renderCurrent();return;}
   if(action==='retry-cpu'){chaosComputerErrorStop=false;chaosError=null;renderCurrent();return;}
   if(action==='next'){const before=chaosGame,after=advanceChaosLeg(before);recordChaosTransition(before,after,[{kind:'stage'}]);chaosGame=after;chaosRevealed=false;chaosEffects=null;chaosRepairCue=null;chaosError=null;renderCurrent();return;}
   apply({action,index:control.dataset.card===undefined?null:Number(control.dataset.card),choice:control.dataset.choice||null});
  }catch(error){chaosError=error.message;renderCurrent(chaosError);}
 });
 for(const form of root.querySelectorAll('[data-chaos-move]'))form.addEventListener('submit',event=>{
  event.preventDefault();
  const data=new FormData(form);
  apply({action:form.dataset.chaosMove,index:Number(form.dataset.card),target:data.has('target')?Number(data.get('target')):null,useBoost:data.has('boost')});
 });
}

function renderCurrent(message=null){const bootstrap=deriveBootstrapState({config:runtimeConfig,connectedChainId:walletView?.chainId??null});if(bootstrap.state==='maintenance'){publicFeedReader?.invalidate();publicFeedProjection=null;render({state:bootstrap.state,detail:'Bong Goggles is temporarily in maintenance mode.'});return;}const walletHref=runtimeConfig?buildWalletHandoffUrl(runtimeConfig.walletUrl,{action:'connect',returnUrl:window.location.href}):null;root.dataset.state=bootstrap.state;const existingInput=root.querySelector('[data-chaos-online-chat] textarea');const draft=existingInput?.value;
 const focused=existingInput===document.activeElement;const selection=focused?[existingInput.selectionStart,existingInput.selectionEnd]:null;
 const existingLog=root.querySelector('[data-chaos-chat-log]');
 const scrolled=existingLog?{top:existingLog.scrollTop,nearBottom:existingLog.scrollHeight-existingLog.scrollTop-existingLog.clientHeight<36}:null;
 root.innerHTML=renderApplicationShell({pathname:window.location.pathname,walletView,bootstrapState:bootstrap.state,appOrigin:runtimeConfig.appOrigin,walletHref,explorerHref:runtimeConfig?.explorerUrl??null,announcement:message??(window.location.pathname==='/'&&runtimeConfig.features.accountSocial===true?null:((window.location.pathname==='/'?publicFeedNotice:null)??indexerNotice())),feedProjection:window.location.pathname==='/'?publicFeedProjection:null,viewPreferences,walletSettingsUrl:runtimeConfig.walletUrl,accountSocialState:socialController?.state,accountSocialEnabled:runtimeConfig.features.accountSocial===true,
 accountIdentityState:identityController?.state,accountIdentityEnabled:runtimeConfig.features.accountSocial===true,
 classicRoomsState:classicRoomsController?.state,classicRoomsEnabled:runtimeConfig.features.classicRooms===true,classicCommunicationsState:classicLive?.state,
 accountMessagesState:accountExtras?.messages.state,accountGamesState:accountExtras?.games.state,
 accountMessagingEnabled:runtimeConfig.features.accountMessaging===true,accountGamesEnabled:runtimeConfig.features.accountGames===true,
 accountXPState:xpController?.state,accountXPEnabled:runtimeConfig.features.accountXP===true,
 accountMonetizationState:monetizationController?.state,
 accountMonetizationEnabled:runtimeConfig.features.accountMonetization===true,chaosGame,chaosRevealed,chaosError,chaosRepairCue,chaosEffects,chaosSaveInfo:saveChaosDisplayInfo(),online:chaosOnline?.state});
 const nextInput=root.querySelector('[data-chaos-online-chat] textarea');
 if(nextInput&&draft!==undefined){nextInput.value=draft;if(focused){nextInput.focus({preventScroll:true});if(selection)nextInput.setSelectionRange(...selection);}}
 const nextLog=root.querySelector('[data-chaos-chat-log]');
 if(nextLog)nextLog.scrollTop=!scrolled||scrolled.nearBottom?nextLog.scrollHeight:scrolled.top;
 updateRobots();bindWalletActions();bindSettings();bindAccountSocial();bindAccountActions();bindClassicRooms();bindAccountExtras();bindAccountXP();bindAccountMonetization();bindChaos();bindChaosOnline(root,chaosOnline,window.location.pathname);
 const effect=chaosEffects;
 chaosEffects=null;chaosRepairCue=null;
 if(effect&&window.location.pathname==='/classics/cross-country-chaos/practice'){
  const reduced=viewPreferences.motion==='reduce'||
   Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)||
   document.documentElement.dataset.motion==='reduce';
  playChaosMotion(root,effect,chaosGame,{reducedMotion:reduced});
 }
 scheduleChaosComputer();
}
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
 restoreChaosOnGameRoute();
 chaosRevealed=false;chaosRepairCue=null;chaosEffects=null;
 monetizationController?.invalidate();xpController?.invalidate();socialController?.invalidate();identityController?.invalidate();classicRoomsController?.invalidate();classicLive?.invalidate();for(const c of Object.values(accountExtras??{}))c.invalidate();
 publicFeedReader?.invalidate();publicFeedProjection=null;publicFeedNotice=null;renderCurrent();
 if(window.location.pathname==='/classics/cross-country-chaos'&&chaosOnline)void chaosOnline.refresh({preserve:false});
 if(window.location.pathname==='/')void refreshPublicFeed();
 if(isAccountSocialSurface()&&socialController?.client.enabled)void socialController.refresh();
 if(identityController?.client.enabled)void identityController.refresh();
 if(isClassicRoomSurface()&&classicRoomsController?.client.enabled)void refreshClassicRooms();
 if(window.location.pathname==='/account/xp'&&xpController?.client.enabled)void xpController.refresh();
 if(window.location.pathname==='/account/monetization'&&monetizationController?.client.enabled)void monetizationController.refresh();
 const extras=currentAccountExtra();if(extras?.client.enabled)void extras.refresh();
}
async function start(){render({state:'loading',detail:'Loading canonical application configuration…'});try{runtimeConfig=await loadRuntimeConfig();const services=createBongGogglesServices(runtimeConfig);indexerStatusReader=createIndexerStatusReader({service:services.indexer,chainId:runtimeConfig.chainId});publicFeedReader=createPublicDiscoverFeedReader({config:runtimeConfig});identityController=new AccountIdentityController({enabled:runtimeConfig.features.accountSocial===true,onChange:()=>renderCurrent()});classicRoomsController=new ClassicRoomsController({enabled:runtimeConfig.features.classicRooms===true,onChange:()=>{if(isClassicRoomSurface())renderCurrent();}});classicLive=cc({rooms:classicRoomsController,enabled:runtimeConfig.features.classicCommunications,route:roomRoute,onChange:renderCurrent,windowObject:window,documentObject:document});socialController=new AccountSocialController({enabled:runtimeConfig.features.accountSocial===true,onChange:()=>{if(isAccountSocialSurface())renderCurrent();}});xpController=new AccountXPController({enabled:runtimeConfig.features.accountXP===true,onChange:()=>{if(window.location.pathname==='/account/xp')renderCurrent();}});monetizationController=new AccountMonetizationController({enabled:runtimeConfig.features.accountMonetization===true,onChange:()=>{if(window.location.pathname==='/account/monetization')renderCurrent();}});chaosOnline=new ChaosRoomsClient({onChange:()=>{if(window.location.pathname==='/classics/cross-country-chaos')renderCurrent();}});accountExtras={
 messages:new AccountExtrasController({kind:'messages',enabled:runtimeConfig.features.accountMessaging===true,
 onChange:()=>{if(window.location.pathname==='/account/messages')renderCurrent();}}),
 games:new AccountExtrasController({kind:'games',enabled:runtimeConfig.features.accountGames===true,
 onChange:()=>{if(window.location.pathname==='/account/games')renderCurrent();}})
};const provider=discover420Wallet(window);if(provider){walletController=new WalletSessionController420({provider,expectedChainId:runtimeConfig.chainId,storage:window.sessionStorage,onChange:(next)=>{walletView=next;}});try{walletView=await walletController.snapshot();}catch(error){telemetry.event('wallet_snapshot_failed',{code:error?.code,message:error?.message});}}const view=deriveBootstrapState({config:runtimeConfig,connectedChainId:walletView?.chainId??null});telemetry.event('bootstrap',{state:view.state,environment:runtimeConfig.environment});applyViewPreferences();restoreChaosOnGameRoute();renderCurrent();if(window.location.pathname==='/classics/cross-country-chaos')void chaosOnline.refresh({preserve:false});if(publicFeedReader.enabled)void refreshPublicFeed();if(identityController.client.enabled)void identityController.refresh();if(isClassicRoomSurface()&&classicRoomsController.client.enabled)void refreshClassicRooms();if(isAccountSocialSurface()&&socialController.client.enabled)void socialController.refresh();if(window.location.pathname==='/account/xp'&&xpController?.client.enabled)void xpController.refresh();if(window.location.pathname==='/account/monetization'&&monetizationController?.client.enabled)void monetizationController.refresh();const extras=currentAccountExtra();if(extras?.client.enabled)void extras.refresh();void indexerStatusReader.read().then(result=>{if(result.status==='stale')return;indexerStatus=result;telemetry.event('indexer_http_diagnostic',{status:result.status});renderCurrent();});}catch(error){telemetry.event('bootstrap_error',{message:error?.message});render({state:'degraded',detail:'Bong Goggles could not load a safe runtime configuration.'});}}
window.addEventListener('error',(event)=>telemetry.event('window_error',{message:event.message}));window.addEventListener('unhandledrejection',(event)=>telemetry.event('unhandled_rejection',{reason:String(event.reason)}));root.addEventListener('click',(event)=>{navigateWithoutReload(event,{windowObject:window,onNavigate:onRouteChange});});window.addEventListener('popstate',onRouteChange);window.addEventListener('visibilitychange',()=>{if(!document.hidden){refreshGreeting();if(identityController?.client.enabled)void identityController.refresh({quiet:true});if(publicFeedReader?.enabled&&!socialController?.client.enabled)void refreshPublicFeed();}});window.setInterval(()=>{if(!document.hidden){refreshGreeting();if(publicFeedReader?.enabled&&!socialController?.client.enabled)void refreshPublicFeed();}},15_000);
window.setInterval(()=>{if(!document.hidden&&identityController?.client.enabled)void identityController.refresh({quiet:true});},60_000);window.setInterval(()=>{if(!document.hidden&&window.location.pathname==='/classics/cross-country-chaos'&&!chaosOnline?.busy&&chaosOnline?.state.room?.id)void chaosOnline.open(chaosOnline.state.room.id,{silent:true});},4_000);window.addEventListener('beforeunload',()=>{publicFeedReader?.invalidate();socialController?.invalidate();identityController?.invalidate();classicRoomsController?.invalidate();classicLive?.destroy();xpController?.invalidate();for(const c of Object.values(accountExtras??{}))c.invalidate();indexerStatusReader?.invalidate();walletController?.destroy();});start();

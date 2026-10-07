import {validateRuntimeConfig,readiness,feature,IDS} from './core/config.js';
import {connectWallet,validNetwork,installInvalidation} from './core/wallet.js';
import {parseRoute,href} from './core/routes.js';
import {idempotencyKey,rememberRetry,retryState,clearRetry,resetAuthorityState} from './core/state.js';
import {DoobTubeService,MediaService,safeMediaURL} from './core/service.js';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const state={config:null,dt:null,media:null,wallet:null,compat:null,caps:null,feed:[],feedCursor:'',assets:[],assetCursor:'',selected:null,live:null,disposeWallet:null};
function text(sel,value){const n=$(sel);if(n)n.textContent=String(value??'—');}
function show(sel,on=true){const n=$(sel);if(n)n.hidden=!on;}
function status(sel,message,kind='pending'){const n=$(sel);if(n){n.textContent=message;n.dataset.state=kind;}}
function setChildren(sel,nodes=[]){const n=$(sel);if(n)n.replaceChildren(...nodes);}
function requireWallet(){
  const chain=state.config?.network?.chainId;
  if(!state.wallet)throw Error('Connect Wallet before this action.');
  if(!validNetwork(state.wallet,chain))throw Error('WRONG_NETWORK');
  return state.wallet;
}
function card(item){
  const a=document.createElement('a');a.className='card';a.href=href('watch',item.media_asset_id||item.id||'');
  const strong=document.createElement('strong');strong.textContent=item.title||item.id||item.media_asset_id||'Untitled video';
  const small=document.createElement('small');small.textContent=(item.creator_ref||item.owner_ref||'Unknown creator')+' · '+(item.status||item.state||'PUBLIC');
  a.append(strong,small);return a;
}
function renderItems(sel,items){setChildren(sel,items.map(card));}
function route(){
  const r=parseRoute(location.hash);
  $$('.view').forEach(v=>v.classList.toggle('active',v.dataset.view===r.name));
  $$('[data-route]').forEach(a=>a.setAttribute('aria-current',a.dataset.route===r.name?'page':'false'));
  if(r.name==='watch'&&r.param)loadAsset(r.param);
  if(r.name==='creator')renderCreator(r.param);
  if(r.name==='library')loadLibrary();
  if(r.name==='status')renderStatus();
}
function renderRuntime(){
  const ready=state.config?readiness(state.config):{ready:false,missing:['config']};
  text('#runtime-state',ready.ready?'Runtime resolved':'Runtime unresolved');
  text('#wallet-state',state.wallet?'Wallet '+state.wallet.account.slice(0,8)+'…':'Wallet disconnected');
  $('#connect-wallet').textContent=state.wallet?'Reconnect wallet':'Connect wallet';
}
function renderStatus(){
  const values=[
    ['Runtime',readiness(state.config||{}).ready?'resolved':'fail-closed'],
    ['Wallet',state.wallet?.account||'disconnected'],
    ['Network',state.config?.network?.network||'unresolved'],
    ['Chain',state.config?.network?.chainId||'unresolved'],
    ['Media',state.compat?.service_id||'unresolved'],
    ['Identity','optional / not required for public viewing']
  ];
  setChildren('#status-grid',values.map(([k,v])=>{const d=document.createElement('div');d.className='card';const a=document.createElement('strong');a.textContent=k;const b=document.createElement('small');b.textContent=String(v);d.append(a,b);return d;}));
}
async function boot(){
  try{
    const res=await fetch('./runtime-config.json',{cache:'no-store'});
    if(!res.ok)throw Error('DoobTube runtime configuration unavailable');
    state.config=validateRuntimeConfig(await res.json());renderRuntime();
    const r=readiness(state.config);
    if(!r.ready){status('#global-status','Repository preview is fail-closed: '+r.missing.join(', ')+' unresolved. Public fixture/browser tests remain available in qualification.','pending');route();return;}
    state.dt=new DoobTubeService({baseUrl:state.config.services.doobtube.baseUrl});
    state.media=new MediaService({baseUrl:state.config.services.media.baseUrl});
    [state.compat,state.caps]=await Promise.all([state.media.compatibility(),state.media.capabilities()]);
    if(state.compat.service_id!==IDS.media||state.compat.api_version!=='v1'||state.compat.compatibility_major!==1)throw Error('Media compatibility mismatch');
    if(state.caps.service_id!==IDS.media)throw Error('Media capability service mismatch');
    status('#global-status','Runtime resolved. Public viewing is available without Wallet connection.','success');
    await loadFeed();
  }catch(e){status('#global-status',e.message||String(e),'error');state.dt=null;state.media=null;}
  finally{renderRuntime();route();}
}
async function connect(){
  try{
    state.wallet=await connectWallet(globalThis.ethereum,state.config?.network?.chainId);
    state.disposeWallet?.();
    state.disposeWallet=installInvalidation(globalThis.ethereum,reason=>{state.wallet=null;state.live=null;resetAuthorityState();renderRuntime();status('#global-status','Wallet authority invalidated: '+reason+'. Public viewing remains available.','error');});
    status('#global-status','Wallet connected and expected network validated.','success');
  }catch(e){state.wallet=null;status('#global-status',e.message||String(e),'error');}
  renderRuntime();renderStatus();
}
async function loadFeed({append=false}={}){
  if(!state.dt){show('#feed-loading',false);show('#feed-empty',true);return;}
  show('#feed-loading',true);show('#feed-error',false);
  try{
    const p=await state.dt.feed({cursor:append?state.feedCursor:'',limit:24});
    const items=Array.isArray(p.items)?p.items:[];
    state.feed=append?[...state.feed,...items]:items;state.feedCursor=p.next_cursor||'';
    renderItems('#feed-grid',state.feed);show('#feed-empty',state.feed.length===0);show('#feed-more',!!state.feedCursor);
  }catch(e){show('#feed-error',true);text('#feed-error',e.message||String(e));if(!append){state.feed=[];renderItems('#feed-grid',[]);}}
  finally{show('#feed-loading',false);}
}
async function search(event){
  event.preventDefault();setChildren('#search-results',[]);status('#search-state','Searching qualified public projection…','pending');
  if(!state.media)return status('#search-state','Search unavailable until canonical Media runtime is resolved.','error');
  try{
    const p=await state.media.search($('#search-query').value,{limit:24});const items=p.items||p.results||[];
    renderItems('#search-results',items);status('#search-state',items.length?items.length+' public result(s).':'No public results.','success');
  }catch(e){status('#search-state','Search service failure: '+(e.message||String(e)),'error');}
}
async function loadAsset(id){
  if(!state.media)return clearPlayback('Playback unavailable until canonical Media runtime is resolved.');
  try{
    const asset=await state.media.asset(id);state.selected=asset;renderAsset(asset);
  }catch(e){clearPlayback('Media unavailable: '+(e.message||String(e)));}
}
function clearPlayback(message){
  const p=$('#player');p.pause();p.removeAttribute('src');p.load();text('#watch-name',message);text('#playback-state','Unavailable');
}
function renderAsset(asset){
  text('#watch-name',asset.title||asset.id||'Media asset');text('#watch-state',asset.status||asset.state||'UNKNOWN');
  text('#watch-visibility',asset.visibility||'UNKNOWN');text('#watch-provenance',asset.provenance_ref||asset.provenance?.transaction_hash||'Unavailable');
  const creator=asset.creator_ref||asset.owner_ref||'';text('#watch-creator',creator||'Pseudonymous creator');$('#watch-creator').href=href('creator',creator);
  const url=safeMediaURL(asset.playback_url);if(!feature(state.config,'playback')||!url)return clearPlayback('Playback unavailable for this asset.');
  const p=$('#player');p.src=url;p.load();text('#playback-state','Ready');
  $('#report-media').href=href('moderation',asset.id||'');
}
async function share(){
  if(!state.selected)return status('#global-status','Select an eligible media item first.','error');
  if(state.selected.visibility==='PRIVATE')return status('#global-status','PRIVATE media cannot be shared as an access grant.','error');
  const value=location.origin+location.pathname+href('watch',state.selected.id);
  try{await navigator.clipboard?.writeText(value);status('#global-status','Canonical DoobTube application reference copied.','success');}
  catch{status('#global-status','Share reference: '+value,'pending');}
}
function renderCreator(ref){
  text('#creator-name',ref||'Pseudonymous creator');
  const items=state.feed.filter(x=>(x.creator_ref||x.owner_ref)===ref);renderItems('#creator-items',items);
}
async function subscribeCreator(){
  try{
    const w=requireWallet();const creator=parseRoute(location.hash).param;if(!creator)throw Error('Creator reference required.');
    if(!state.media)throw Error('Media subscription service unavailable.');
    const id='dt-'+creator.replace(/[^A-Za-z0-9]/g,'').slice(0,40)+'-'+w.account.slice(2,10);
    const payload={id,user_ref:w.account,topic:'creator:'+creator,channel:'in_app',minimum_severity:0,minimum_finality:'FINALIZED',promotional_opt_in:false};
    const sub=await state.media.subscribe(payload,idempotencyKey('subscribe'));status('#subscriptions-state','Subscribed to creator updates. This is not a paid entitlement.','success');return sub;
  }catch(e){status('#subscriptions-state',e.message||String(e),'error');}
}
async function loadLibrary({append=false}={}){
  if(!state.media){show('#library-empty',true);return;}
  if(!state.wallet){show('#library-error',true);text('#library-error','Connect Wallet to view creator-authorized library state.');return;}
  show('#library-loading',true);show('#library-error',false);
  try{const p=await state.media.assets({cursor:append?state.assetCursor:'',limit:24});const items=p.items||[];state.assets=append?[...state.assets,...items]:items;state.assetCursor=p.next_cursor||'';renderItems('#library-grid',state.assets);show('#library-empty',state.assets.length===0);show('#library-more',!!state.assetCursor);}
  catch(e){show('#library-error',true);text('#library-error',e.message||String(e));}finally{show('#library-loading',false);}
}
async function digest(file){const b=await file.arrayBuffer();const h=await crypto.subtle.digest('SHA-256',b);return [...new Uint8Array(h)].map(v=>v.toString(16).padStart(2,'0')).join('');}
function uploadPayload(form,file,hash,wallet){
  const commitment='sha256:'+hash,id='doobtube-'+hash.slice(0,24);
  return {id,owner_ref:wallet.account,mime_type:file.type,visibility:String(form.get('visibility')),provenance_ref:commitment,object_id:'media-object-'+hash,manifest_id:'media-manifest-'+hash,shard_index:0,shard_root:hash,size_bytes:file.size,commitment_id:commitment,preconditions:{agreement_id:String(form.get('agreementId')).trim(),capacity_reservation_id:String(form.get('capacityReservationId')).trim(),commitment_id:commitment}};
}
async function pollReady(id){
  for(let i=0;i<5;i++){const asset=await state.media.asset(id);if((asset.status||asset.state)==='READY'){clearRetry('upload');status('#upload-state','Canonical Media/Storage state is READY.','success');return asset;}await new Promise(r=>setTimeout(r,500*(i+1)));}
  status('#upload-state','Transport may be complete, but canonical READY is still pending. Retry/revalidate safely.','pending');return null;
}
async function doTransport(plan,file){
  if(!plan.endpoint)throw Error('Prepared plan has no qualified upload transport endpoint.');
  await state.media.uploadBytes(plan.endpoint,file);status('#upload-state','Transport accepted bytes. Waiting for canonical READY…','pending');await pollReady(plan.asset?.id);
}
async function prepareUpload(event){
  event.preventDefault();
  try{
    const w=requireWallet();const file=$('#upload-file').files?.[0];if(!file?.type?.startsWith('video/'))throw Error('Choose a video/* file.');
    const form=new FormData(event.currentTarget);const hash=await digest(file);const payload=uploadPayload(form,file,hash,w);const key=idempotencyKey('upload');
    const retry=rememberRetry('upload',key,{payload,file,plan:null});status('#upload-state','Preparing idempotent upload…','pending');
    retry.payload.plan=await state.media.prepareUpload(payload,key);show('#retry-upload',true);await doTransport(retry.payload.plan,file);
  }catch(e){status('#upload-state','Upload paused safely: '+(e.message||String(e)),'error');show('#retry-upload',!!retryState('upload'));}
}
async function retryUpload(){
  const r=retryState('upload');if(!r)return status('#upload-state','No in-memory upload retry exists.','error');
  try{if(!r.payload.plan)r.payload.plan=await state.media.prepareUpload(r.payload.payload,r.key);await doTransport(r.payload.plan,r.payload.file);}
  catch(e){status('#upload-state','Retry paused: '+(e.message||String(e)),'error');}
}
async function createLive(event){
  event.preventDefault();
  try{
    const w=requireWallet(),f=new FormData(event.currentTarget);
    const payload={id:String(f.get('id')).trim(),controller:w.account,protocol:String(f.get('protocol')),direction:String(f.get('direction')),endpoint:String(f.get('endpoint')).trim(),credential_ref:String(f.get('credentialRef')).trim(),stream_ref:String(f.get('streamRef')).trim(),max_duration_seconds:Number(f.get('maxDuration'))};
    state.live=await state.media.createLive(payload,idempotencyKey('live-create'));status('#live-state','Session '+(state.live.status||'CREATED')+'.','success');
  }catch(e){status('#live-state','Create failed safely: '+(e.message||String(e)),'error');}
}
async function refreshLive(){
  try{const w=requireWallet();if(!state.live?.id)throw Error('Create/select a session first.');state.live=await state.media.live(state.live.id,w.account);status('#live-state','Canonical session '+(state.live.status||'UNKNOWN')+'.','success');}
  catch(e){status('#live-state','Status unavailable: '+(e.message||String(e)),'error');}
}
async function liveAction(action){
  try{const w=requireWallet();if(!state.live?.id)throw Error('Create/select a session first.');state.live=await state.media.liveAction(state.live.id,action,{controller:w.account},idempotencyKey('live-'+action));status('#live-state','Canonical '+action+' result: '+(state.live.status||'UNKNOWN')+'.','success');}
  catch(e){status('#live-state',action+' failed. Refresh canonical status before retry: '+(e.message||String(e)),'error');}
}
async function savePreferences(event){
  event.preventDefault();
  try{requireWallet();if(!state.dt)throw Error('DoobTube preference service unavailable.');const payload={autoplay:$('#pref-autoplay').checked,reduced_motion:$('#pref-reduced').checked};await state.dt.savePreferences(payload,idempotencyKey('preferences'));status('#subscriptions-state','Preferences saved by DoobTube control plane.','success');}
  catch(e){status('#subscriptions-state',e.message||String(e),'error');}
}
async function report(event){
  event.preventDefault();
  try{const w=requireWallet(),f=new FormData(event.currentTarget);if(!state.media)throw Error('Media moderation service unavailable.');const payload={id:'report-'+crypto.randomUUID(),reporter_ref:w.account,target_kind:'MediaAsset',target_id:String(f.get('targetId')).trim(),reason:String(f.get('reason')).trim(),evidence_ref:String(f.get('evidenceRef')).trim()};await state.media.report(payload,idempotencyKey('report'));status('#moderation-state','Report submitted. The report itself does not hide/delete/transfer media.','success');}
  catch(e){status('#moderation-state',e.message||String(e),'error');}
}
async function appeal(event){
  event.preventDefault();
  try{const w=requireWallet(),f=new FormData(event.currentTarget),decision=String(f.get('decisionId')).trim();if(!state.media)throw Error('Media moderation service unavailable.');const payload={id:'appeal-'+crypto.randomUUID(),appellant_ref:w.account,reason:String(f.get('reason')).trim()};await state.media.appeal(decision,payload,idempotencyKey('appeal'));status('#moderation-state','Appeal submitted without rewriting prior decision history.','success');}
  catch(e){status('#moderation-state',e.message||String(e),'error');}
}

window.addEventListener('hashchange',route);
$('#connect-wallet').addEventListener('click',connect);$('#feed-more').addEventListener('click',()=>loadFeed({append:true}));
$('#search-form').addEventListener('submit',search);$('#share-media').addEventListener('click',share);$('#creator-subscribe').addEventListener('click',subscribeCreator);
$('#refresh-library').addEventListener('click',()=>loadLibrary());$('#library-more').addEventListener('click',()=>loadLibrary({append:true}));
$('#upload-form').addEventListener('submit',prepareUpload);$('#retry-upload').addEventListener('click',retryUpload);
$('#live-form').addEventListener('submit',createLive);$('#live-refresh').addEventListener('click',refreshLive);$('#live-start').addEventListener('click',()=>liveAction('start'));$('#live-stop').addEventListener('click',()=>liveAction('stop'));
$('#preferences-form').addEventListener('submit',savePreferences);$('#report-form').addEventListener('submit',report);$('#appeal-form').addEventListener('submit',appeal);
$('#player').addEventListener('error',()=>status('#playback-state','Playback failed; canonical media state is unchanged.','error'));
boot();

import {validateRuntimeConfig,runtimeReadiness,featureEnabled} from './core/config.js';
import {MediaService,safeMediaURL} from './core/service.js';
import {connectWallet,walletNetworkValid,installWalletInvalidation} from './core/wallet.js';
import {idempotencyKey,rememberRetry,retryState,clearRetry,resetRetries} from './core/state.js';

const state={config:null,service:null,capabilities:null,compatibility:null,wallet:null,assets:[],nextCursor:'',selected:null,file:null,uploadPlan:null,live:null};
const $=s=>document.querySelector(s);
const text=(s,v)=>{const el=$(s);if(el)el.textContent=String(v??'');};
const show=(s,on=true)=>{const el=$(s);if(el)el.hidden=!on;};
const setStatus=(s,message,kind='idle')=>{const el=$(s);if(!el)return;el.textContent=String(message);el.dataset.state=kind;};
const disable=(s,on=true)=>{const el=$(s);if(el)el.disabled=!!on;};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

function expectedChainId(){return state.compatibility?.chain_id??state.config?.network?.chainId??null;}
function expectedNetwork(){return state.compatibility?.network??state.config?.network?.network??null;}
function runtime(){
  return runtimeReadiness(state.config,{compatibility:state.compatibility,capabilities:state.capabilities,wallet:state.wallet});
}
function walletReady(){return walletNetworkValid(state.wallet,expectedChainId());}

function renderRuntime(){
  const r=runtime();
  const ready=r.ready;
  text('#runtime-state',ready?'Runtime ready':'Runtime locked · '+r.missing.join(', '));
  $('#runtime-state').dataset.state=ready?'ready':'locked';
  text('#wallet-network',r.chainId?String(r.network||'network')+' · chain '+r.chainId:'Unresolved');
  text('#capability-state',state.capabilities?'Loaded':'Not loaded');
  renderFeatures();
}
function renderWallet(){
  text('#wallet-account',state.wallet?state.wallet.account:'Not connected');
  text('#connect-wallet',state.wallet?state.wallet.account.slice(0,8)+'…'+state.wallet.account.slice(-4):'Connect wallet');
  renderRuntime();
}
function renderFeatures(){
  const upload=featureEnabled(state.config,state.capabilities,'upload');
  const library=featureEnabled(state.config,state.capabilities,'library');
  const playback=featureEnabled(state.config,state.capabilities,'playback');
  const live=featureEnabled(state.config,state.capabilities,'livestreaming');
  text('#upload-feature',upload?'Available':'Unavailable');
  text('#live-feature',live?'Available':'Unavailable');
  disable('#prepare-upload',!upload||!walletReady());
  disable('#refresh-library',!library||!state.service);
  disable('#create-live',!live||!walletReady());
  for(const s of ['#refresh-live','#start-live','#stop-live'])disable(s,!live||!walletReady()||!state.live?.id);
  if(!playback&&state.selected)clearPlayback('Playback feature unavailable.');
}

function mediaCard(asset){
  const button=document.createElement('button');
  button.type='button';button.className='media-card';
  const title=document.createElement('strong');title.textContent=asset.id||'Untitled media';
  const mime=document.createElement('span');mime.textContent=asset.mime_type||'unknown media';
  const status=document.createElement('small');status.textContent=(asset.status||'UNKNOWN')+' · '+(asset.visibility||'UNKNOWN');
  const provenance=document.createElement('small');provenance.textContent='provenance '+(asset.provenance_ref||'unavailable');
  button.append(title,mime,status,provenance);
  button.addEventListener('click',()=>selectAsset(asset));
  return button;
}

function renderLibrary(){
  const grid=$('#library-grid');grid.replaceChildren();
  for(const asset of state.assets)grid.append(mediaCard(asset));
  show('#library-empty',state.assets.length===0);
}
async function loadLibrary({append=false}={}){
  if(!state.service)return;
  show('#library-loading',true);show('#library-error',false);disable('#refresh-library',true);
  try{
    const page=await state.service.assets({cursor:append?state.nextCursor:'',limit:24});
    const items=Array.isArray(page.items)?page.items:[];
    state.assets=append?[...state.assets,...items]:items;
    state.nextCursor=page.next_cursor||'';
    renderLibrary();show('#load-more',!!state.nextCursor);
    setStatus('#global-status',state.assets.length?'Media library loaded.':'Media library is empty.','success');
  }catch(error){
    show('#library-error',true);text('#library-error',error.message||String(error));
    if(!append){state.assets=[];renderLibrary();}
    setStatus('#global-status','Library unavailable. Existing canonical media state is unchanged.','error');
  }finally{show('#library-loading',false);renderFeatures();}
}

function clearPlayback(message='No playable asset selected.'){
  const player=$('#player');player.pause();player.removeAttribute('src');player.load();
  text('#playback-state','Unavailable');text('#playback-name',message);
  for(const s of ['#playback-status','#playback-visibility','#playback-provenance'])text(s,'—');
}
function selectAsset(asset){
  state.selected=asset;
  text('#playback-name',asset.id||'Media asset');
  text('#playback-status',asset.status||'UNKNOWN');
  text('#playback-visibility',asset.visibility||'UNKNOWN');
  text('#playback-provenance',asset.provenance_ref||asset.provenance?.transaction_hash||'Unavailable');
  const enabled=featureEnabled(state.config,state.capabilities,'playback');
  const url=enabled?safeMediaURL(asset.playback_url):null;
  if(!url){clearPlayback(enabled?'Playback URL is not materialized for this asset.':'Playback feature unavailable.');state.selected=asset;return;}
  const player=$('#player');player.src=url;player.load();
  text('#playback-state','Ready');
  text('#playback-name',asset.id||'Media asset');
  text('#playback-status',asset.status||'UNKNOWN');
  text('#playback-visibility',asset.visibility||'UNKNOWN');
  text('#playback-provenance',asset.provenance_ref||asset.provenance?.transaction_hash||'Unavailable');
}

async function digestFile(file){
  const bytes=await file.arrayBuffer();
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return [...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,'0')).join('');
}
function uploadPayload(form,file,digest){
  const assetOverride=String(form.get('assetId')||'').trim();
  const id=assetOverride||'media-'+digest.slice(0,24);
  const commitment='sha256:'+digest;
  return {
    id,
    owner_ref:state.wallet.account,
    mime_type:file.type||'video/octet-stream',
    visibility:String(form.get('visibility')||'PRIVATE'),
    provenance_ref:'sha256:'+digest,
    object_id:'media-object-'+digest,
    manifest_id:'media-manifest-'+digest,
    shard_index:0,
    shard_root:digest,
    size_bytes:file.size,
    commitment_id:commitment,
    preconditions:{
      agreement_id:String(form.get('agreementId')||'').trim(),
      capacity_reservation_id:String(form.get('capacityReservationId')||'').trim(),
      commitment_id:commitment
    }
  };
}
function renderUploadPlan(plan){
  state.uploadPlan=plan;show('#upload-plan',true);
  text('#plan-upload-id',plan.upload_id||'—');text('#plan-provider',plan.provider_id||'—');
  text('#plan-node',plan.node_id||'—');text('#plan-service',plan.service_id||'—');
}
async function pollReady(assetId){
  for(let attempt=0;attempt<5;attempt++){
    try{
      const asset=await state.service.asset(assetId);
      if(asset.status==='READY'){setStatus('#upload-progress','Upload is canonically READY.','success');clearRetry('upload');await loadLibrary();return asset;}
      if(asset.status==='DELETED')throw new Error('asset was deleted before becoming ready');
    }catch(error){if(attempt===4)throw error;}
    await sleep(800*(attempt+1));
  }
  setStatus('#upload-progress','Transport completed. Canonical READY state is still pending; refresh the library to recover safely.','pending');
  return null;
}
async function transportUpload(plan,file){
  if(!plan.endpoint){
    setStatus('#upload-progress','Upload prepared, but no transport endpoint is materialized. Retry after the service publishes one.','pending');
    show('#retry-upload',true);return;
  }
  setStatus('#upload-progress','Uploading video bytes to the prepared Storage transport…','pending');
  await state.service.uploadBytes(plan.endpoint,file);
  show('#retry-upload',false);
  setStatus('#upload-progress','Transport accepted the bytes. Waiting for canonical Media/Storage READY state…','pending');
  await pollReady(plan.asset?.id);
}
async function prepareUpload(event){
  event.preventDefault();
  if(!walletReady())return setStatus('#upload-progress','Connect the expected network before uploading.','error');
  const file=$('#upload-file').files?.[0];
  if(!file||!file.type.startsWith('video/'))return setStatus('#upload-progress','Choose a video file.','error');
  const form=new FormData(event.currentTarget);
  if(!String(form.get('agreementId')||'').trim()||!String(form.get('capacityReservationId')||'').trim())return setStatus('#upload-progress','Agreement and capacity reservation IDs are required.','error');
  disable('#prepare-upload',true);setStatus('#transaction-state','Preparing idempotent upload request…','pending');
  try{
    const digest=await digestFile(file),payload=uploadPayload(form,file,digest),key=idempotencyKey('upload');
    const retry=rememberRetry('upload',key,{payload,file});
    const plan=await state.service.prepareUpload(retry.payload.payload,key);
    renderUploadPlan(plan);state.file=file;retry.payload.plan=plan;
    setStatus('#transaction-state','Upload plan prepared. No wallet key or raw media entered the Media API.','success');
    await transportUpload(plan,file);
  }catch(error){
    setStatus('#upload-progress','Upload paused: '+(error.message||String(error))+'. The same prepared request can be retried safely.','error');
    setStatus('#transaction-state','Upload action failed without changing local authority.','error');
    show('#retry-upload',!!retryState('upload'));
  }finally{renderFeatures();}
}
async function retryUpload(){
  const retry=retryState('upload');
  if(!retry?.payload?.file)return setStatus('#upload-progress','No recoverable upload is held in this browser session.','error');
  disable('#retry-upload',true);
  try{
    let plan=retry.payload.plan;
    if(!plan){plan=await state.service.prepareUpload(retry.payload.payload,retry.key);retry.payload.plan=plan;renderUploadPlan(plan);}
    await transportUpload(plan,retry.payload.file);
  }catch(error){setStatus('#upload-progress','Retry paused: '+(error.message||String(error)),'error');show('#retry-upload',true);}
}

function livePayload(form){
  return {
    id:String(form.get('id')||'').trim(),
    controller:state.wallet.account,
    protocol:String(form.get('protocol')||''),
    direction:String(form.get('direction')||''),
    endpoint:String(form.get('endpoint')||'').trim(),
    credential_ref:String(form.get('credentialRef')||'').trim(),
    stream_ref:String(form.get('streamRef')||'').trim(),
    max_duration_seconds:Number(form.get('maxDuration')||0)
  };
}
function renderLive(item){
  state.live=item;
  text('#live-id',item.id||$('#live-id').value);
  text('#live-controller',item.controller||'—');text('#live-state',item.status||'—');
  text('#live-desired',item.desired_live?'yes':'no');text('#live-reconnects',item.reconnect_attempts??0);
  setStatus('#live-status','Session '+(item.status||'UNKNOWN')+'.','success');renderFeatures();
}
async function createLive(event){
  event.preventDefault();
  if(!walletReady())return setStatus('#live-status','Connect the expected network before creating a livestream.','error');
  const payload=livePayload(new FormData(event.currentTarget));
  setStatus('#transaction-state','Creating livestream session…','pending');
  try{
    const item=await state.service.createLivestream(payload,idempotencyKey('live-create'));
    renderLive(item);setStatus('#transaction-state','Livestream session created.','success');
  }catch(error){setStatus('#live-status',error.message||String(error),'error');setStatus('#transaction-state','Livestream create failed safely.','error');}
}
async function refreshLive(){
  const id=state.live?.id||$('#live-id').value.trim();
  if(!id||!walletReady())return setStatus('#live-status','Session ID and valid wallet network are required.','error');
  try{renderLive(await state.service.livestream(id,state.wallet.account));}
  catch(error){setStatus('#live-status','Status unavailable: '+(error.message||String(error)),'error');}
}
async function liveAction(action){
  const id=state.live?.id||$('#live-id').value.trim();
  if(!id||!walletReady())return setStatus('#live-status','Session ID and valid wallet network are required.','error');
  setStatus('#transaction-state',(action==='start'?'Starting':'Stopping')+' livestream…','pending');
  try{
    const item=await state.service.livestreamAction(id,action,{controller:state.wallet.account},idempotencyKey('live-'+action));
    renderLive(item);setStatus('#transaction-state','Livestream '+action+' completed.','success');
  }catch(error){
    setStatus('#live-status',action+' failed: '+(error.message||String(error))+'. Refresh status before retrying.','error');
    setStatus('#transaction-state','Livestream action failed; canonical status was not assumed.','error');
  }
}

async function connect(){
  try{
    state.wallet=await connectWallet(globalThis.ethereum,expectedChainId());
    installWalletInvalidation(globalThis.ethereum,reason=>{
      state.wallet=null;state.live=null;resetRetries();renderWallet();
      setStatus('#transaction-state','Wallet invalidated: '+reason+'. Reconnect before continuing.','error');
    });
    renderWallet();setStatus('#transaction-state','Wallet connected. Network validated.','success');
  }catch(error){state.wallet=null;renderWallet();setStatus('#transaction-state',error.message||String(error),'error');}
}

async function boot(){
  try{
    const response=await fetch('./runtime-config.json',{cache:'no-store'});
    if(!response.ok)throw new Error('Media runtime configuration unavailable');
    state.config=validateRuntimeConfig(await response.json());
    renderRuntime();
    if(!state.config.api.baseUrl){
      setStatus('#global-status','Repository preview only: canonical Media API/network are not deployed in runtime configuration.','pending');
      renderFeatures();return;
    }
    state.service=new MediaService({baseUrl:state.config.api.baseUrl});
    const [compat,caps]=await Promise.all([state.service.compatibility(),state.service.capabilities()]);
    if(caps.service_id!=='420/service/media/v1'||caps.api_version!=='v1'||caps.compatibility_major!==1)throw new Error('Media capability contract mismatch');
    if(compat.service_id!=='420/service/media/v1'||compat.api_version!=='v1'||compat.compatibility_major!==1)throw new Error('Media compatibility contract mismatch');
    state.compatibility=compat;state.capabilities=caps;renderRuntime();
    setStatus('#global-status','Media runtime resolved. Connect wallet for authority-bearing workflows.','success');
    await loadLibrary();
  }catch(error){
    setStatus('#global-status',error.message||String(error),'error');state.service=null;renderFeatures();
  }
}

$('#connect-wallet')?.addEventListener('click',connect);
$('#refresh-library')?.addEventListener('click',()=>loadLibrary());
$('#load-more')?.addEventListener('click',()=>loadLibrary({append:true}));
$('#upload-form')?.addEventListener('submit',prepareUpload);
$('#retry-upload')?.addEventListener('click',retryUpload);
$('#live-create-form')?.addEventListener('submit',createLive);
$('#refresh-live')?.addEventListener('click',refreshLive);
$('#start-live')?.addEventListener('click',()=>liveAction('start'));
$('#stop-live')?.addEventListener('click',()=>liveAction('stop'));
$('#player')?.addEventListener('error',()=>setStatus('#playback-state','Playback failed; asset authority is unchanged.','error'));
boot();

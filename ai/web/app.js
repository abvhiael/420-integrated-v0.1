import {validateAiRuntimeConfig420,clientReadiness420} from './core/config.js';
import {AiClientController420} from './core/controller.js';

const $=(s)=>document.querySelector(s);
const state={config:null,controller:null,discovery:null,job:null,review:null,wallet:null};
function short(v,n=10){if(!v)return '—';return String(v).length>n+8?String(v).slice(0,n)+'…'+String(v).slice(-8):String(v);}
function setStatus(message,kind=''){const el=$('#status');el.textContent=message;el.className='status '+kind;}
function renderList(selector,items,label,selectVersion=false){
  const root=$(selector);root.replaceChildren();
  if(!items?.length){root.textContent='No '+label+' indexed.';return;}
  for(const item of items){const div=document.createElement('div');div.className='item';const button=document.createElement('button');button.type='button';
    if(label==='models')button.textContent=short(item.modelId)+' · '+item.state;
    else if(label==='versions')button.textContent=short(item.modelVersionId)+' · v'+item.version+(item.deprecated?' · deprecated':'');
    else button.textContent=short(item.deploymentId)+' · '+item.state;
    if(selectVersion&&item.modelVersionId)button.addEventListener('click',()=>{$('#model-version-id').value=item.modelVersionId;setStatus('Selected model version '+short(item.modelVersionId),'ok');});
    div.append(button);root.append(div);
  }
}
function renderDiscovery(result){state.discovery=result;renderList('#model-list',result.models,'models');renderList('#version-list',result.versions,'versions',true);renderList('#deployment-list',result.deployments,'deployments');}
function reviewRows(intent){return Object.entries(intent).map(([k,v])=>'<dt>'+k.replace(/[A-Z]/g,m=>' '+m.toLowerCase())+'</dt><dd>'+String(v)+'</dd>').join('');}
function renderReview(kind,intent){state.review={kind,intent};$('#review-panel').hidden=false;$('#review-details').innerHTML=reviewRows(intent);$('#submit-reviewed').disabled=!state.wallet;}
function clearReview(){state.review=null;state.controller?.clearReview();$('#review-panel').hidden=true;$('#review-details').replaceChildren();}
function renderJob(job){
  state.job=job;const root=$('#job-detail');
  if(!job){root.textContent='Job not found.';return;}
  root.innerHTML='<dl>'+
    '<dt>Job</dt><dd>'+job.jobId+'</dd>'+
    '<dt>Status</dt><dd>'+job.status+'</dd>'+
    '<dt>Requester</dt><dd>'+job.requester+'</dd>'+
    '<dt>Model version</dt><dd>'+job.modelVersionId+'</dd>'+
    '<dt>Maximum spend</dt><dd>'+job.maxSpend+'</dd>'+
    '<dt>Funded amount</dt><dd>'+(job.fundedAmount??'not funded')+'</dd>'+
    '<dt>Funding reference</dt><dd>'+(job.fundingRef??'—')+'</dd>'+
    '<dt>Vault reference</dt><dd>'+(job.vaultRef??'—')+'</dd>'+
    '<dt>Provider</dt><dd>'+(job.providerId??'unmatched')+'</dd>'+
    '<dt>Compute job</dt><dd>'+(job.computeJobId??'—')+'</dd>'+
    '<dt>Result commitment</dt><dd>'+(job.resultHash??'—')+'</dd>'+
    '<dt>Authoritative</dt><dd>'+String(job.authoritative)+'</dd></dl>';
  const mine=state.wallet&&job.requester?.toLowerCase()===state.wallet.account;
  $('#prepare-cancel').disabled=!(mine&&job.status==='CREATED'&&state.config.features.requestCancellation);
  $('#prepare-dispute').disabled=!(mine&&['RESULT_COMMITTED','VERIFIED'].includes(job.status)&&state.config.features.disputeOpening);
}
function transactionState(event){
  const el=$('#transaction-state');
  if(event.state==='SIMULATED')el.textContent='Simulation passed · gas '+event.gas;
  else if(event.state==='SUBMITTED')el.textContent='Submitted '+event.txHash;
  else el.textContent=(event.state??'UNKNOWN')+(event.confirmations!=null?' · confirmations '+event.confirmations:'');
}
function onControllerState(event){
  if(event.type==='readiness'&&!event.ready)setStatus('Client code loaded; deployment materialization pending: '+event.reasons.join(', '));
  if(event.type==='wallet-connected'){state.wallet={account:event.account,chainId:event.chainId};$('#connect-wallet').textContent='Connected '+short(event.account,6);$('#connect-wallet').disabled=true;$('#network-badge').textContent=event.chainId;$('#submit-reviewed').disabled=!state.review;setStatus('Wallet connected on expected network.','ok');if(state.job)renderJob(state.job);}
  if(event.type==='wallet-invalidated'){state.wallet=null;clearReview();$('#connect-wallet').disabled=false;$('#connect-wallet').textContent='Reconnect wallet';setStatus('Wallet authority invalidated by '+event.reason+'. Reconnect and review again.','error');}
  if(event.type==='discovery')renderDiscovery(event);
  if(event.type==='job')renderJob(event.job);
  if(event.type==='review')renderReview(event.kind,event.intent);
  if(event.type==='transaction')transactionState(event);
  if(event.type==='transaction-confirmed'){setStatus(event.kind+' transaction confirmed. Indexed lifecycle will refresh when available.','ok');transactionState({state:'CONFIRMED',confirmations:event.result.confirmations});}
}
async function loadConfig(){
  const r=await fetch('./runtime-config.json',{cache:'no-store'});if(!r.ok)throw Error('runtime config '+r.status);
  const config=validateAiRuntimeConfig420(await r.json());state.config=config;state.controller=new AiClientController420({config,onState:onControllerState});
  const ready=clientReadiness420(config);$('#network-badge').textContent=config.network.chainId??'network unresolved';
  $('#connect-wallet').disabled=!config.features.walletConnection||!config.network.chainId;
  $('#refresh-discovery').disabled=!config.readApi.baseUrl;
  $('#prepare-request').disabled=!config.features.requestCreation;
  if(ready.ready){setStatus('420AI client ready. Connect a wallet or browse indexed models.','ok');await state.controller.discover();}
  else setStatus('Client deployed in fail-closed mode pending AI-AUDIT-9 materialization: '+ready.reasons.join(', '));
}
$('#connect-wallet').addEventListener('click',async()=>{try{if(!globalThis.ethereum)throw Error('No injected EIP-1193 wallet found');setStatus('Requesting wallet authorization…');await state.controller.connect();}catch(e){setStatus(e.message,'error');}});
$('#refresh-discovery').addEventListener('click',async()=>{try{setStatus('Refreshing model and deployment discovery…');await state.controller.discover();setStatus('Discovery refreshed.','ok');}catch(e){setStatus(e.message,'error');}});
$('#request-form').addEventListener('submit',(event)=>{event.preventDefault();try{const input=$('#private-input').value;const pending=state.controller.prepareRequest({modelVersionId:$('#model-version-id').value.trim(),workloadClass:$('#workload-class').value.trim(),privateInput:input,privacyPolicyId:$('#privacy-policy-id').value.trim(),verificationProfileId:$('#verification-profile-id').value.trim(),maxSpend:$('#max-spend').value.trim(),deadline:$('#deadline').value.trim()});$('#private-input').value='';renderReview(pending.kind,pending.intent);setStatus('Request commitment prepared locally. Review before wallet approval.');}catch(e){setStatus(e.message,'error');}});
$('#clear-review').addEventListener('click',clearReview);
$('#submit-reviewed').addEventListener('click',async()=>{try{if(!state.review)throw Error('No reviewed transaction');$('#submit-reviewed').disabled=true;setStatus('Simulating reviewed transaction…');await state.controller.submitReviewed();clearReview();if(state.job)await state.controller.loadJob(state.job.jobId);}catch(e){setStatus(e.message,'error');$('#submit-reviewed').disabled=!state.wallet?true:false;}});
$('#job-form').addEventListener('submit',async(event)=>{event.preventDefault();try{setStatus('Loading indexed AI lifecycle…');await state.controller.loadJob($('#job-id').value.trim());setStatus('Indexed AI lifecycle loaded.','ok');}catch(e){setStatus(e.message,'error');}});
$('#prepare-cancel').addEventListener('click',()=>{try{const p=state.controller.prepareCancel(state.job.jobId);renderReview(p.kind,p.intent);}catch(e){setStatus(e.message,'error');}});
$('#prepare-dispute').addEventListener('click',()=>{$('#dispute-box').hidden=false;$('#dispute-ref').focus();});
$('#confirm-dispute-review').addEventListener('click',()=>{try{const p=state.controller.prepareDispute(state.job.jobId,$('#dispute-ref').value.trim());$('#dispute-box').hidden=true;renderReview(p.kind,p.intent);}catch(e){setStatus(e.message,'error');}});
window.addEventListener('pagehide',()=>state.controller?.dispose(),{once:true});
loadConfig().catch(e=>setStatus('Configuration error: '+e.message,'error'));

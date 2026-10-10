/* global COMMERCE_CONFIG */
import {createCommerceSdk420} from '../../packages/420-sdk/dist/commerce.js';
import {WalletSession} from './core/wallet.js';
const $=id=>document.getElementById(id),add=(node,tag,text)=>{const element=document.createElement(tag);element.textContent=String(text??'');node.append(element);return element;};
let session=null,sdk=null,store=null,busy=false,epoch=0,notificationCursor=null;
const status=text=>$('status').textContent=text;
const fail=e=>{$('error').hidden=false;$('error').textContent=e.code??e.message??'Unavailable';$('error').focus();};
const clean=()=>{epoch++;session=null;sdk=null;store=null;$('orders').replaceChildren();$('assets').replaceChildren();$('integrations').replaceChildren();$('refunds').replaceChildren();$('disputes').replaceChildren();$('notifications').replaceChildren();notificationCursor=null;$('notifySave').disabled=true;$('notifyMore').disabled=true;$('notifyMore').hidden=true;$('notifyOptIn').checked=false;$('summary').textContent='No merchant selected.';$('analytics').textContent='No verified data.';$('refresh').disabled=true;status('Wallet disconnected; merchant data cleared.');};
async function action(fn){if(busy)return;busy=true;$('error').hidden=true;try{if(!navigator.onLine)throw Error('Offline');await fn();}catch(e){fail(e);}finally{busy=false}}
async function load(){
 if(!sdk||!store)throw Error('Connect Wallet and select a store');
 const current=epoch,id=store;
 const [orders,analytics,integrations,refunds,disputes,preferences,notifications]=await Promise.all([sdk.merchantOperations(id),sdk.merchantAnalytics(id),sdk.merchantIntegrations(id),sdk.merchantRefunds(id),sdk.merchantDisputes(id),sdk.merchantNotificationPreferences(id),sdk.merchantNotifications(id)]);
 if(current!==epoch||id!==store)throw Error('Wallet identity changed');
 $('orders').replaceChildren();$('assets').replaceChildren();$('integrations').replaceChildren();
 $('summary').textContent=orders.totalCount+' order attempts · '+orders.items.length+' shown · chain '+orders.provenance.chainId+' · finalized block '+orders.provenance.blockNumber;
 for(const item of orders.items){
  const li=add($('orders'),'li','Order '+item.orderId+' · '+item.state+' · amount '+item.total+' base units in '+item.asset+' · '+(item.paid?'canonical paid':'not verified paid'));
  if(item.receiptHash&&item.paymentId&&item.paid)add(li,'p','Final Pay receipt commitment: '+item.receiptHash+' · Payment: '+item.paymentId);
  if(['PAID','FULFILLED','DISPUTED'].includes(item.state)){
   for(const kind of ['refund','dispute']){
    if(kind==='refund'&&!item.paid)continue;
    let inputs;
    if(kind==='refund'){
      const form=add(li,'div','');
      const amountLabel=add(form,'label','Refund amount (asset base units)');
      const amount=document.createElement('input');amount.type='text';amount.required=true;amount.pattern='[1-9][0-9]*';amount.value=String(item.total);amountLabel.append(amount);
      const reasonLabel=add(form,'label','Reason commitment (0x + 64 hex)');
      const reason=document.createElement('input');reason.type='text';reason.required=true;reason.pattern='0x[a-f0-9]{64}';reason.placeholder='0x…';reasonLabel.append(reason);
      inputs={amount,reason};
    }
    if(kind==='dispute') {const label=add(li,'label','Dispute evidence commitment (0x + 64 lowercase hex)');const reason=document.createElement('input');reason.type='text';reason.required=true;reason.pattern='0x[a-f0-9]{64}';reason.placeholder='0x…';label.append(reason);inputs={reason};}
    const button=add(li,'button','Prepare '+kind+' handoff');button.type='button';
    button.addEventListener('click',()=>action(async()=>{
     if(inputs&&(!inputs.reason.checkValidity()||(kind==='refund'&&!inputs.amount.checkValidity())))throw Error('Valid dispute or refund commitment required');
     const request=kind==='refund'?{amount:inputs.amount.value,reasonHash:inputs.reason.value}:{disputeHash:inputs.reason.value};
     const result=await sdk.merchantRemedy(id,item.attempt_id,kind,request);
     add(li,'p',result.authority+': '+result.status+' · No transaction executed.');
     if(kind==='dispute'&&result.proposal?.intent){
       const submit=add(li,'button','Submit canonical Market dispute via Wallet');submit.type='button';
       submit.addEventListener('click',()=>action(async()=>{
         if(!session||!sdk||id!==store)throw Error('Wallet or merchant store changed');
         const receipt=await session.sendMarketDispute(result.proposal);
         add(li,'p','Market transaction broadcast: '+receipt.transactionHash+'. Await finalized Market proof; not an Arbitration case or ruling.');
         await load();
       }));
       add(li,'p','Review the dispute evidence commitment, then explicitly submit through your verified Wallet. No transaction executed yet.');
     }
    }));
   }
  }
 }
 for(const dispute of disputes.items){
  const li=add($('disputes'),'li',dispute.orderId+' · '+dispute.state+(dispute.arbitrationCase?' · Case '+dispute.arbitrationCase.caseId:''));
  if(dispute.arbitrationCase?.ruling){
    const ruling=dispute.arbitrationCase.ruling;
    add(li,'p','Ruling commitment: '+ruling.rulingHash+' · '+(ruling.finalized?'FINALIZED':'APPEAL WINDOW / NOT FINAL')+' · No external remedy executed.');
  }
  if(!COMMERCE_CONFIG?.arbitration){add(li,'p','Arbitration service not approved in deployment manifest. No case or ruling is implied.');continue;}
  if(dispute.marketDisputed&&!dispute.arbitrationCase){
    const remedyLabel=add(li,'label','Requested remedy commitment (0x + 64 lowercase hex)');
    const remedy=document.createElement('input');remedy.pattern='0x[a-f0-9]{64}';remedy.required=true;remedyLabel.append(remedy);
    const prepare=add(li,'button','Prepare independent Arbitration case');prepare.type='button';
    prepare.addEventListener('click',()=>action(async()=>{
      if(!remedy.checkValidity())throw Error('Valid requested remedy commitment required');
      const plan=await sdk.arbitrationPrepare(id,dispute.attemptId,{remedyHash:remedy.value});
      const send=add(li,'button','Open case using verified Wallet');send.type='button';
      send.addEventListener('click',()=>action(async()=>{
        const receipt=await session.sendArbitrationAction(plan);
        add(li,'p','Arbitration transaction broadcast: '+receipt.transactionHash+' · Not finalized. Retrieve the finalized CaseOpened case ID before binding.');
      }));
      add(li,'p','Policy checked at finalized block. A separate Wallet confirmation is required to open a case; Commerce cannot adjudicate.');
    }));
    const caseLabel=add(li,'label','Finalized Arbitration Case ID (0x + 64 lowercase hex)');
    const caseInput=document.createElement('input');caseInput.pattern='0x[a-f0-9]{64}';caseInput.required=true;caseLabel.append(caseInput);
    const bind=add(li,'button','Verify and bind finalized Arbitration case');bind.type='button';
    bind.addEventListener('click',()=>action(async()=>{
      if(!caseInput.checkValidity())throw Error('Valid finalized case ID required');
      await sdk.arbitrationBind(id,dispute.attemptId,{caseId:caseInput.value});
      await load();
    }));
  }
  if(dispute.arbitrationCase&&dispute.arbitrationCase.caseState==='OPEN'){
    const evidenceLabel=add(li,'label','Evidence commitment (0x + 64 lowercase hex)');
    const evidence=document.createElement('input');evidence.required=true;evidence.pattern='0x[a-f0-9]{64}';evidenceLabel.append(evidence);
    const submit=add(li,'button','Prepare evidence submission');submit.type='button';
    submit.addEventListener('click',()=>action(async()=>{
      if(!evidence.checkValidity())throw Error('Valid evidence commitment required');
      const plan=await sdk.arbitrationEvidence(id,dispute.attemptId,{evidenceHash:evidence.value});
      const send=add(li,'button','Submit evidence with verified Wallet');send.type='button';
      send.addEventListener('click',()=>action(async()=>{
        const receipt=await session.sendArbitrationAction(plan);
        add(li,'p','Evidence broadcast '+receipt.transactionHash+' · finality pending.');
      }));
    }));
  }
  if(dispute.arbitrationCase&&dispute.arbitrationCase.caseState==='RULED'){
    const appeal=add(li,'button','Prepare bounded Arbitration appeal');appeal.type='button';
    appeal.addEventListener('click',()=>action(async()=>{
      const plan=await sdk.arbitrationAppeal(id,dispute.attemptId);
      const send=add(li,'button','Submit appeal with verified Wallet');send.type='button';
      send.addEventListener('click',()=>action(async()=>{
        const receipt=await session.sendArbitrationAction(plan);
        add(li,'p','Appeal broadcast '+receipt.transactionHash+' · await canonical round update.');
      }));
    }));
  }
 }
 $('notifyOptIn').checked=preferences.enabled===true;$('notifySave').disabled=false;
 $('notifications').replaceChildren();notificationCursor=notifications.nextCursor;
 for(const n of notifications.items){
  const li=add($('notifications'),'li',n.eventName+' · Order '+n.orderId+' · finalized block '+n.blockNumber+(n.read?' · Read':' · Unread'));
  add(li,'small','Transaction '+n.transactionHash+' · '+n.blockHash+' · noncanonical alert');
  const button=add(li,'button',n.read?'Mark unread':'Mark read');button.type='button';
  button.addEventListener('click',()=>action(async()=>{await sdk.markMerchantNotification(id,n.id,!n.read);await load();}));
 }
 $('notifyMore').hidden=!notificationCursor;$('notifyMore').disabled=!notificationCursor;
 for(const refund of refunds.items)add($('refunds'),'li',refund.refundId+' · '+refund.amount+' base units '+refund.asset+' · '+(refund.fundsReturned?'FUNDS RETURNED — canonical funded payout verified':'NOT PAID — governance pending or payout unverified'));
 $('analytics').textContent='Finalized merchant analytics page ('+analytics.offset+'–'+(analytics.offset+analytics.totals.orders)+' of '+analytics.totalCount+' checkout attempts; not all-time revenue when partial). '+JSON.stringify(analytics.totals)+' · partial='+analytics.partial;
 for(const [asset,amounts] of Object.entries(analytics.byAsset??{}))add($('assets'),'li',asset+' · '+JSON.stringify(amounts));
 for(const [name,value] of Object.entries(integrations))if(value&&typeof value==='object'&&'status' in value)add($('integrations'),'li',name+': '+value.status+' · '+value.authority+(value.externalDelivery?' · external delivery: '+value.externalDelivery:''));
 $('refresh').disabled=false;status('Verified finalized merchant operations loaded. No settlement, refund or dispute was executed.');
}
$('notifySave').addEventListener('click',()=>action(async()=>{if(!sdk||!store)throw Error('Connect merchant Wallet first');await sdk.setMerchantNotificationPreferences(store,$('notifyOptIn').checked);await load();}));
$('notifyMore').addEventListener('click',()=>action(async()=>{if(!sdk||!store||!notificationCursor)throw Error('No older alerts');const current=store,epochBefore=epoch;const result=await sdk.merchantNotifications(store,25,notificationCursor);if(current!==store||epochBefore!==epoch)throw Error('Wallet changed');for(const n of result.items)add($('notifications'),'li',n.eventName+' · Order '+n.orderId+' · finalized block '+n.blockNumber+(n.read?' · Read':' · Unread'));notificationCursor=result.nextCursor;$('notifyMore').hidden=!notificationCursor;$('notifyMore').disabled=!notificationCursor;}));
$('connect').addEventListener('click',()=>action(async()=>{
 if(!COMMERCE_CONFIG||!window.ethereum)throw Error('Approved Wallet and manifest required');
 clean();session=new WalletSession(window.ethereum,COMMERCE_CONFIG,{onReset:clean});await session.connect();
 sdk=createCommerceSdk420({baseUrl:COMMERCE_CONFIG.apiUrl,origin:location.origin,chainId:COMMERCE_CONFIG.chainId,wallet:session.wallet(),host:session.host()});
 status('Verified Wallet connected. Enter your authorized store ID.');
}));
$('open').addEventListener('submit',event=>{event.preventDefault();action(async()=>{
 if(!session||!sdk)throw Error('Connect Wallet first');
 store=new FormData($('open')).get('storeId');await load();
});});
$('refresh').addEventListener('click',()=>action(load));

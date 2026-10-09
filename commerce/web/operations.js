/* global COMMERCE_CONFIG */
import {createCommerceSdk420} from '../../packages/420-sdk/dist/commerce.js';
import {WalletSession} from './core/wallet.js';
const $=id=>document.getElementById(id),add=(node,tag,text)=>{const element=document.createElement(tag);element.textContent=String(text??'');node.append(element);return element;};
let session=null,sdk=null,store=null,busy=false,epoch=0;
const status=text=>$('status').textContent=text;
const fail=e=>{$('error').hidden=false;$('error').textContent=e.code??e.message??'Unavailable';$('error').focus();};
const clean=()=>{epoch++;session=null;sdk=null;store=null;$('orders').replaceChildren();$('assets').replaceChildren();$('integrations').replaceChildren();$('refunds').replaceChildren();$('summary').textContent='No merchant selected.';$('analytics').textContent='No verified data.';$('refresh').disabled=true;status('Wallet disconnected; merchant data cleared.');};
async function action(fn){if(busy)return;busy=true;$('error').hidden=true;try{if(!navigator.onLine)throw Error('Offline');await fn();}catch(e){fail(e);}finally{busy=false}}
async function load(){
 if(!sdk||!store)throw Error('Connect Wallet and select a store');
 const current=epoch,id=store;
 const [orders,analytics,integrations,refunds]=await Promise.all([sdk.merchantOperations(id),sdk.merchantAnalytics(id),sdk.merchantIntegrations(id),sdk.merchantRefunds(id)]);
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
    const button=add(li,'button','Prepare '+kind+' handoff');button.type='button';
    button.addEventListener('click',()=>action(async()=>{
     if(inputs&&(!inputs.amount.checkValidity()||!inputs.reason.checkValidity()))throw Error('Valid refund amount and reason commitment required');
     const request=inputs?{amount:inputs.amount.value,reasonHash:inputs.reason.value}:undefined;
     const result=await sdk.merchantRemedy(id,item.attempt_id,kind,request);
     add(li,'p',result.authority+': '+result.status+' · No transaction executed.');
    }));
   }
  }
 }
 for(const refund of refunds.items)add($('refunds'),'li',refund.refundId+' · '+refund.amount+' base units '+refund.asset+' · '+(refund.fundsReturned?'FUNDS RETURNED — canonical funded payout verified':'NOT PAID — governance pending or payout unverified'));
 $('analytics').textContent='Finalized projection preview (first 100 attempts; incomplete when more exist). '+JSON.stringify(analytics.totals)+' · partial='+analytics.partial;
 for(const [asset,amounts] of Object.entries(analytics.byAsset??{}))add($('assets'),'li',asset+' · '+JSON.stringify(amounts));
 for(const [name,value] of Object.entries(integrations))if(value&&typeof value==='object'&&'status' in value)add($('integrations'),'li',name+': '+value.status+' · '+value.authority);
 $('refresh').disabled=false;status('Verified finalized merchant operations loaded. No settlement, refund or dispute was executed.');
}
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

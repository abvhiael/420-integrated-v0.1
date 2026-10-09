/* global COMMERCE_CONFIG */
import {createCommerceSdk420} from '../../packages/420-sdk/dist/commerce.js';
import {normalizeCart,getPublicProduct,reviewedOrder,receiptLabel} from './public-core.js';
import {WalletSession} from './core/wallet.js';
import {submitReviewedMarketOrder} from './buyer-order.js';
import {createNative420Payment,settleNative420Payment,qualifiedSwapRoute} from './native-pay.js';
const $=id=>document.getElementById(id);
const add=(node,tag,value)=>{const el=document.createElement(tag);el.textContent=String(value??'');node.append(el);return el;};
let sdk=null, wallet=null, lines=[],offset=0,attempts=[],page=[],busy=false;
const nativeAttempts=new Map();
const origin=location.origin,api=COMMERCE_CONFIG?.apiUrl??origin+'/';
sdk=createCommerceSdk420({baseUrl:api,origin,chainId:COMMERCE_CONFIG?.chainId??'1'});
const message=t=>$('message').textContent=t;
const failure=e=>{$('error').hidden=false;$('error').textContent=e.code??e.message??'Request failed';$('error').focus();};
async function guard(fn){if(busy)return;busy=true;try{if(!navigator.onLine)throw Error('Offline');$('error').hidden=true;await fn();}catch(e){failure(e)}finally{busy=false}}
const setOptions=(id,rows,key,label)=>{const el=document.querySelector('#filters [name="'+id+'"]');if(!el)throw Error('missing_filter_control');for(const row of rows){const option=document.createElement('option');option.value=row[key];option.textContent=String(row[label]);el.append(option)}};
async function stores(){const [s,c]=await Promise.all([sdk.storefronts(),sdk.categories()]);$('stores').replaceChildren();setOptions('storeId',s.items,'store_id','slug');setOptions('category',c.items,'category_id','slug');for(const item of s.items){const card=add($('stores'),'article','');add(card,'h3',item.slug);add(card,'p',item.public_description);const button=add(card,'button','View merchant');button.type='button';button.addEventListener('click',()=>{document.querySelector('#filters [name=storeId]').value=item.store_id;search()})}}
const filters=()=>Object.fromEntries(new FormData($('filters')));
async function search(append=false){const f=filters();if(!append)offset=0;const result=await sdk.search({query:f.query,storeId:f.storeId||undefined,category:f.category||undefined,offset,limit:20});if(!append){page=[];$('products').replaceChildren()}page.push(...result.items);for(const row of result.items){const p=getPublicProduct(row);if(!p)continue;const card=add($('products'),'article','');add(card,'h3',p.sku);add(card,'p',p.description);add(card,'p',p.price===null?'Price unavailable':p.price+' base units · '+p.asset);add(card,'p',p.canCart?'Canonical reservation required':'Listing unavailable');const detail=add(card,'button','Product details');detail.type='button';detail.addEventListener('click',()=>guard(async()=>{const result=await sdk.product(p.id);const latest=getPublicProduct(result.items[0]);if(!latest)throw Error('Product no longer published');message(latest.description+' · '+(latest.price??'Price unavailable')+' · stock must be verified at checkout')}));const button=add(card,'button','Add to cart');button.type='button';button.disabled=!p.canCart;button.addEventListener('click',()=>{try{lines=normalizeCart(lines,{listingId:p.listingId,revision:Number(p.revision),quantity:1,sku:p.sku},p.storeId);renderCart()}catch(e){failure(e)}})}
offset=result.nextOffset??offset+result.items.length;$('more').hidden=result.nextOffset===null;$('count').textContent=page.length+' products loaded · source is not a live stock guarantee';message('Results loaded')}
function renderCart(){$('cart').replaceChildren();for(const item of lines){const li=add($('cart'),'li',item.sku+' · '+item.quantity+' · listing '+item.listingId.slice(0,12));const remove=add(li,'button','Remove');remove.type='button';remove.addEventListener('click',()=>{lines=lines.filter(l=>l.listingId!==item.listingId);renderCart()})}$('review').disabled=!wallet||!lines.length||busy;message(lines.length+' cart items (not reserved)')}
async function connect(){if(!COMMERCE_CONFIG)throw Error('Approved chain manifest required for checkout');if(!window.ethereum)throw Error('Compatible Wallet unavailable');wallet=new WalletSession(window.ethereum,COMMERCE_CONFIG,{onReset:()=>{wallet=null;attempts=[];nativeAttempts.clear();renderCart()}});await wallet.connect();sdk=createCommerceSdk420({baseUrl:api,origin,chainId:COMMERCE_CONFIG.chainId,wallet:wallet.wallet(),host:wallet.host()});renderCart()}
async function prepare(){
 if(!wallet||!lines.length)throw Error('Connect verified Wallet and select products');
 const cart=await sdk.cart({storeId:lines[0].storeId,lines:lines.map(({listingId,revision,quantity})=>({listingId,revision,quantity}))});
 const key=crypto.randomUUID().replaceAll('-','')+Date.now().toString();
 const result=await sdk.prepareCheckout(cart.cart_id,cart.version,key);
 for(const a of result.attempts){
   const terms=reviewedOrder(a,COMMERCE_CONFIG.chainId);
   attempts.push(a.attemptId);
   const li=add($('attempts'),'li','Order '+terms.orderId+' · '+terms.quantity+' units · '+terms.total+' base units · order signature required. No payment has occurred.');
   const confirm=add(li,'button','Review and sign Market order');
   confirm.type='button';
   confirm.addEventListener('click',()=>guard(async()=>{
     if(!wallet)throw Error('Wallet disconnected');
     const info=reviewedOrder(a,COMMERCE_CONFIG.chainId);
     const summary='MARKET ORDER (not payment)\\nOrder: '+info.orderId+'\\nListing: '+info.listingId+'\\nQuantity: '+info.quantity+'\\nAsset: '+info.asset+'\\nTotal base units: '+info.total+'\\nContract: '+info.target;
     if(!window.confirm(summary))return;
     const sent=await submitReviewedMarketOrder(wallet,a);
     confirm.disabled=true;
     add(li,'p','Order broadcast: '+sent.transactionHash+' · NOT FINALIZED / NOT PAID. Refresh chain status after finality.');
   }));
 }
 $('refresh').disabled=false;
 message('Order plans prepared; no signature was submitted or inventory reserved.');
}
const approvePayment=terms=>window.confirm('CANONICAL PAY TRANSACTION\\nAction: '+terms.action+'\\nChain: '+terms.chainId+'\\nPayer: '+terms.payer+'\\nSeller: '+terms.seller+'\\nRecipient: '+terms.recipient+'\\nAmount (native $420 base units): '+terms.amount+'\\nPay target: '+terms.target+'\\nInvoice: '+terms.invoiceId+'\\nPayment ID: '+terms.paymentId+'\\nBroadcast is NOT proof of settlement.');
async function refresh(){
 if(!wallet)throw Error('Wallet required');
 $('attempts').replaceChildren();
 for(const id of attempts){
   const status=await sdk.checkoutStatus(id);
   const li=add($('attempts'),'li',String(status.orderId??id)+' · '+status.state+' · '+receiptLabel(status));
   if(status.provenance?.finalized) add(li,'p','Canonical finalized source: chain '+status.provenance.chainId+' · block '+status.provenance.blockNumber+' · '+status.provenance.blockHash);
   if(status.paid===true&&status.provenance?.finalized&&status.paymentId&&status.receiptHash) add(li,'p','Pay payment ID: '+status.paymentId+' · Receipt commitment: '+status.receiptHash+' · Invoice: '+status.invoiceId);
   if(status.paymentAllowed===true&&status.asset==='0x0000000000000000000000000000000000000000'&&COMMERCE_CONFIG?.contracts?.PaymentRouter420?.verified){
     const existing=nativeAttempts.get(id);
     const button=add(li,'button',existing?'Settle native $420 through approved Pay':'Create native $420 Pay payment');
     button.type='button';
     button.addEventListener('click',()=>guard(async()=>{
       const fresh=await sdk.checkoutStatus(id);
       if(fresh.paymentAllowed!==true||fresh.state!=='PAYMENT_SIGNATURE_REQUIRED')throw Error('Canonical invoice changed');
       if(existing){
         const result=await settleNative420Payment(wallet,fresh,existing,{approve:approvePayment});
         button.disabled=true;
         add(li,'p','Pay native settlement broadcast '+result.transactionHash+' · NOT FINALIZED / NOT PAID. Await canonical Pay and Market reporter finality.');
       }else{
         const result=await createNative420Payment(wallet,fresh,{approve:approvePayment});
         nativeAttempts.set(id,result);
         button.textContent='Settle native $420 through approved Pay';
         add(li,'p','Pay payment creation broadcast '+result.transactionHash+' · NOT FINALIZED. Wait for canonical finality before settlement.');
       }
     }));
   }
   const swap=qualifiedSwapRoute();
   if(!swap.available&&status.paymentAllowed===true)add(li,'p','Swap route unavailable: '+swap.reason);
 }
 message('Chain-backed order/payment status refreshed. Only verified finalized Pay and Market state can show paid.');
}
$('filters').addEventListener('submit',e=>{e.preventDefault();guard(()=>search())});$('more').addEventListener('click',()=>guard(()=>search(true)));$('clear').addEventListener('click',()=>{lines=[];renderCart()});$('connect').addEventListener('click',()=>guard(connect));$('review').addEventListener('click',()=>guard(prepare));$('refresh').addEventListener('click',()=>guard(refresh));guard(async()=>{await stores();await search()});

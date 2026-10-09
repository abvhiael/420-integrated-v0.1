/* global COMMERCE_CONFIG */
import {createCommerceSdk420} from '../../packages/420-sdk/dist/commerce.js';
import {normalizeCart,getPublicProduct,reviewedOrder,receiptLabel} from './public-core.js';
import {WalletSession} from './core/wallet.js';
import {submitReviewedMarketOrder} from './buyer-order.js';
const $=id=>document.getElementById(id);
const add=(node,tag,value)=>{const el=document.createElement(tag);el.textContent=String(value??'');node.append(el);return el;};
let sdk=null, wallet=null, lines=[],offset=0,attempts=[],page=[],busy=false;
const origin=location.origin,api=COMMERCE_CONFIG?.apiUrl??origin+'/';
sdk=createCommerceSdk420({baseUrl:api,origin,chainId:COMMERCE_CONFIG?.chainId??'1'});
const message=t=>$('message').textContent=t;
const failure=e=>{$('error').hidden=false;$('error').textContent=e.code??e.message??'Request failed';$('error').focus();};
async function guard(fn){if(busy)return;busy=true;try{if(!navigator.onLine)throw Error('Offline');$('error').hidden=true;await fn();}catch(e){failure(e)}finally{busy=false}}
const setOptions=(id,rows,key,label)=>{const el=$(id);for(const row of rows){const option=document.createElement('option');option.value=row[key];option.textContent=String(row[label]);el.append(option)}};
async function stores(){const [s,c]=await Promise.all([sdk.storefronts(),sdk.categories()]);$('stores').replaceChildren();setOptions('storeId',s.items,'store_id','slug');setOptions('category',c.items,'category_id','slug');for(const item of s.items){const card=add($('stores'),'article','');add(card,'h3',item.slug);add(card,'p',item.public_description);const button=add(card,'button','View merchant');button.type='button';button.addEventListener('click',()=>{document.querySelector('#filters [name=storeId]').value=item.store_id;search()})}}
const filters=()=>Object.fromEntries(new FormData($('filters')));
async function search(append=false){const f=filters();if(!append)offset=0;const result=await sdk.search({query:f.query,storeId:f.storeId||undefined,category:f.category||undefined,offset,limit:20});if(!append){page=[];$('products').replaceChildren()}page.push(...result.items);for(const row of result.items){const p=getPublicProduct(row);if(!p)continue;const card=add($('products'),'article','');add(card,'h3',p.sku);add(card,'p',p.description);add(card,'p',p.price===null?'Price unavailable':p.price+' base units · '+p.asset);add(card,'p',p.canCart?'Canonical reservation required':'Listing unavailable');const detail=add(card,'button','Product details');detail.type='button';detail.addEventListener('click',()=>guard(async()=>{const result=await sdk.product(p.id);const latest=getPublicProduct(result.items[0]);if(!latest)throw Error('Product no longer published');message(latest.description+' · '+(latest.price??'Price unavailable')+' · stock must be verified at checkout')}));const button=add(card,'button','Add to cart');button.type='button';button.disabled=!p.canCart;button.addEventListener('click',()=>{try{lines=normalizeCart(lines,{listingId:p.listingId,revision:Number(p.revision),quantity:1,sku:p.sku},p.storeId);renderCart()}catch(e){failure(e)}})}
offset=result.nextOffset??offset+result.items.length;$('more').hidden=result.nextOffset===null;$('count').textContent=page.length+' products loaded · source is not a live stock guarantee';message('Results loaded')}
function renderCart(){$('cart').replaceChildren();for(const item of lines){const li=add($('cart'),'li',item.sku+' · '+item.quantity+' · listing '+item.listingId.slice(0,12));const remove=add(li,'button','Remove');remove.type='button';remove.addEventListener('click',()=>{lines=lines.filter(l=>l.listingId!==item.listingId);renderCart()})}$('review').disabled=!wallet||!lines.length||busy;message(lines.length+' cart items (not reserved)')}
async function connect(){if(!COMMERCE_CONFIG)throw Error('Approved chain manifest required for checkout');if(!window.ethereum)throw Error('Compatible Wallet unavailable');wallet=new WalletSession(window.ethereum,COMMERCE_CONFIG,{onReset:()=>{wallet=null;attempts=[];renderCart()}});await wallet.connect();sdk=createCommerceSdk420({baseUrl:api,origin,chainId:COMMERCE_CONFIG.chainId,wallet:wallet.wallet(),host:wallet.host()});renderCart()}
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
async function refresh(){if(!wallet)throw Error('Wallet required');$('attempts').replaceChildren();for(const id of attempts){const state=await sdk.checkoutStatus(id);const li=add($('attempts'),'li',String(state.orderId??id)+' · '+state.state+' · '+receiptLabel(state));if(state.provenance?.finalized){add(li,'p','Canonical finalized source: chain '+state.provenance.chainId+' · block '+state.provenance.blockNumber+' · '+state.provenance.blockHash);}if(state.paid===true&&state.provenance?.finalized&&state.paymentId&&state.receiptHash){add(li,'p','Pay payment ID: '+state.paymentId+' · Receipt commitment: '+state.receiptHash+' · Invoice: '+state.invoiceId);}}message('Chain-backed order status refreshed; unconfirmed payments never show as paid.')}
$('filters').addEventListener('submit',e=>{e.preventDefault();guard(()=>search())});$('more').addEventListener('click',()=>guard(()=>search(true)));$('clear').addEventListener('click',()=>{lines=[];renderCart()});$('connect').addEventListener('click',()=>guard(connect));$('review').addEventListener('click',()=>guard(prepare));$('refresh').addEventListener('click',()=>guard(refresh));guard(async()=>{await stores();await search()});

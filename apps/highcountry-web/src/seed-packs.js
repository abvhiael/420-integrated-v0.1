export function createSeedPackClient({apiUrl,authenticate,fetchImpl=fetch}){
 if(typeof apiUrl!=='string'||!/^https:\/\/[^/?#]+$/.test(apiUrl))throw Error('seed-service-config-invalid');
 async function post(path,body){const token=await authenticate?.();if(typeof token!=='string'||!token||/\s/.test(token))throw Error('seed-sign-in-required');
  const response=await fetchImpl(new URL('/seeds/packs/'+path,apiUrl+'/'),{method:'POST',cache:'no-store',credentials:'omit',headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(body)});
  if(!response.ok)throw Error('seed-pack-request-denied');const data=await response.json();if(data?.ok!==true||!data.result)throw Error('seed-pack-response-invalid');return data.result;
 }
 return {shop:()=>post('shop',{}),purchasePrepare:request=>post('purchase-prepare',request),purchaseConfirm:purchaseId=>post('purchase-confirm',{purchaseId}),purchaseCancel:purchaseId=>post('purchase-cancel',{purchaseId}),open:packId=>post('open',{packId}),opening:packId=>post('opening',{packId}),inventory:()=>post('inventory',{}),starter:region=>post('starter',{region}),prepare:packId=>post('prepare',{packId}),confirm:packId=>post('confirm',{packId})};
}
export function mountSeedPacks({document,parent,runtime,authenticate,fetchImpl=fetch,provider=document.defaultView?.ethereum}){
 const el=(tag,text='')=>{const e=document.createElement(tag);e.textContent=text;return e;};
 const section=el('section');section.className='seed-collection seed-packs';section.id='seed-pack-marketplace';section.append(el('h3','My seed packs'),el('p','Start with two free common packs: two distinct cultivars, three seeds each. Your regional choice is permanent. Regional and World packs contain three seeds of one cultivar. Standard openings use verified 60% common, 30% rare and 10% Original Sixteen odds. Committing an opening is permanent.'));parent.append(section);
 const status=el('p',runtime.mode==='connected'?'Sign in to view your packs and claim your starter seeds.':'Starter seeds require the authenticated game service.');status.setAttribute('role','status');status.setAttribute('aria-live','polite');section.append(status);
 if(runtime.mode!=='connected')return {section};
 const client=createSeedPackClient({apiUrl:runtime.apiUrl,authenticate,fetchImpl}),label=el('label','Starter region '),region=el('select');region.setAttribute('aria-label','Starter region');for(const name of ['Emerald Coast','Golden Prairie','Red Mesa']){const option=el('option',name);option.value=name;region.append(option);}label.append(region);section.append(label);
 const inventory=el('div');let busy=false;
 const button=(parent,text,fn)=>{const b=el('button',text);b.type='button';b.addEventListener('click',fn);parent.append(b);return b;};
 const run=async fn=>{if(busy)return;busy=true;try{await fn();}catch{status.textContent='Request not confirmed. Check purchase history and your wallet link before retrying. Existing packs and payment reservations are preserved.';}finally{busy=false;}};
 const claim=button(section,'Claim starter packs',()=>run(async()=>{await client.starter(region.value);await refresh();}));
 button(section,'Refresh seed packs',()=>run(refresh));section.append(inventory);
 const shop=el('div');section.append(shop);button(section,'Browse seed packs',()=>run(refreshShop));
 let checkout=null;
 async function submitWallet(transaction){
  if(typeof provider?.request!=='function')throw Error('wallet-unavailable');
  if(!Number.isSafeInteger(runtime.chainId)||transaction.chainId!==runtime.chainId||BigInt(await provider.request({method:'eth_chainId'}))!==BigInt(runtime.chainId))throw Error('wallet-wrong-network');
  const accounts=await provider.request({method:'eth_accounts'});if(!Array.isArray(accounts)||!accounts.some(a=>a.toLowerCase()===transaction.from.toLowerCase()))throw Error('wallet-account-mismatch');
  const {chainId,...tx}=transaction;const hash=await provider.request({method:'eth_sendTransaction',params:[tx]});if(!/^0x[0-9a-f]{64}$/i.test(hash))throw Error('wallet-submission-invalid');return hash;
 }
 function review(p){
  checkout=p;shop.replaceChildren(el('h3','Review seed pack purchase'),el('p',p.region+' · 1 pack · 3 seeds · '+(p.currency==='BUDS'?'420 BUDS':'1 $420 plus network gas')),el('p','60% common · 30% rare · 10% Original Sixteen. One cultivar per pack. Payment does not reveal or change the draw.'));
  if(p.status==='pending'&&(p.currency==='BUDS'||p.transaction?.data)){
   button(shop,p.currency==='BUDS'?'Confirm 420 BUDS purchase':'Pay 1 $420 with wallet',()=>run(async()=>{
    if(checkout.id!==p.id)throw Error('checkout-changed');
    if(p.currency==='420'){const hash=await submitWallet(p.transaction);status.textContent='Payment submitted: '+hash+'. Awaiting finalized confirmation. Check purchase history before trying again.';await refreshShop();}
    else{const result=await client.purchaseConfirm(p.id);if(result.status!=='paid')throw Error('purchase-unconfirmed');status.textContent='Purchase confirmed. Your sealed pack is ready.';checkout=null;await refresh();await refreshShop();}
   }));
   button(shop,p.currency==='BUDS'?'Cancel unpaid checkout':'Cancel unpaid checkout with wallet',()=>run(async()=>{if(p.currency==='420')await submitWallet(p.cancelTransaction);await client.purchaseCancel(p.id);checkout=null;await refreshShop();}));
  }
 }
 async function refreshShop(){
  const data=await client.shop();if(!Array.isArray(data.pools)||!Array.isArray(data.purchases))throw Error('invalid seed marketplace');
  shop.replaceChildren(el('h3','Seed pack marketplace'),el('p','420 BUDS or 1 $420 per pack · 3 seeds of one cultivar · 60% common / 30% rare / 10% Original Sixteen'),el('p','Available BUDS: '+data.availableBuds));
  for(const pool of data.pools){const card=el('article');card.append(el('h4',pool.region),el('p',pool.remaining+' packs available'));const img=el('img');img.className='seed-pack-art';img.src='/assets/highcountry/seed-packs/hc-seed-pack-'+pool.region.toLowerCase().replaceAll(' ','-')+'.png';img.alt=pool.region+' seed pack';card.append(img);
   for(const currency of ['BUDS','420']){const b=button(card,currency==='BUDS'?'Review · 420 BUDS':'Review · 1 $420',()=>run(async()=>{const operation=document.defaultView.crypto.randomUUID();review(await client.purchasePrepare({operation,region:pool.region,currency}));}));b.disabled=pool.remaining<1||(currency==='420'&&data.nativeAvailable===false);}shop.append(card);
  }
  shop.append(el('h3','Purchase and delivery history'));
  for(const p of data.purchases){const row=el('article');row.append(el('h4',p.region+' · '+p.currency),el('p',p.id),el('p',p.status==='pending'?'Awaiting payment or finalized confirmation':p.status==='cancelled'?'Cancelled without payment':'Paid · '+(p.pack?.status??'reconciling ownership')),el('p',p.delivery?'Seed delivery: '+p.delivery.status+' · lot '+p.delivery.lotId:p.pack?.outcome?'Verified result: '+p.pack.outcome.cultivarName+' · '+p.pack.outcome.tier:'Seed delivery follows verified opening.'));
   if(p.status==='pending'){button(row,'Resume checkout',()=>run(async()=>review(await client.purchasePrepare({operation:p.operation,region:p.region,currency:p.currency}))));if(p.currency==='420')button(row,'Check purchase confirmation',()=>run(async()=>{await client.purchaseConfirm(p.id);await refresh();await refreshShop();}));}shop.append(row);
  }
 }
 async function refresh(){
  const data=await client.inventory();if(!Array.isArray(data.packs)||!Array.isArray(data.lots))throw Error('invalid pack inventory');
  claim.disabled=data.starterClaimed===true;region.disabled=data.starterClaimed===true;inventory.replaceChildren();
  status.textContent=data.starterClaimed?'Starter packs claimed. Each pack can be issued once.':'Choose a region to claim your two starter packs.';
  for(const pack of data.packs){const card=el('article');card.className='seed-earned';const art=el('img');art.className='seed-pack-art';art.src='/assets/highcountry/seed-packs/hc-seed-pack-'+pack.region.toLowerCase().replaceAll(' ','-')+'.png';art.alt=pack.region+' seed pack';art.loading='lazy';card.append(art);card.append(el('h4',pack.region+' · '+(pack.starterCultivarId?'Common starter pack':'Seed pack')),el('p',pack.seeds+' seeds · '+(pack.status==='opened'?'Issued':pack.status==='issuance-prepared'?'Preparing seeds':pack.status==='opening-committed'?'Waiting for verified opening':pack.status==='outcome-ready'?'Verified selection ready':'Sealed')));
   if(!pack.starterCultivarId&&pack.status==='sealed')button(card,'Commit pack opening',()=>run(async()=>{await client.open(pack.id);await refresh();}));
   if(pack.status==='opening-committed')button(card,'Check verified opening',()=>run(async()=>{await client.opening(pack.id);await refresh();}));
   if(pack.outcome?.verification){const v=pack.outcome.verification,proof=el('details');proof.append(el('summary','Opening verification'));for(const [label,value] of [['Opening contract',v.contract],['Canonical request',v.requestId],['Entropy root',v.entropy],['Proof commitment',v.proofHash],['Finalized block',v.anchor?.blockHash]])if(value)proof.append(el('p',label+': '+value));card.append(proof);}
   if(pack.status==='outcome-ready'){card.append(el('p',pack.outcome.cultivarName+' · '+pack.outcome.tier));button(card,'Prepare selected seeds',()=>run(async()=>{await client.prepare(pack.id);await refresh();}));}
   if(pack.starterCultivarId&&pack.status==='sealed')button(card,'Prepare starter seeds',()=>run(async()=>{await client.prepare(pack.id);await refresh();}));
   if(pack.status==='issuance-prepared')button(card,'Check seed issuance',()=>run(async()=>{await client.confirm(pack.id);await refresh();}));
   inventory.append(card);
  }
 }
 return {section,refresh,refreshShop};
}

import {agriculturalBuildingCatalogue,getAgriculturalBuilding} from './agricultural-building-catalogue.js';
import {waterWildlifeCatalogue,getWaterWildlifeFeature} from './water-wildlife-catalogue.js';
import {outdoorStructureCatalogue,getOutdoorStructure} from './outdoor-structure-catalogue.js';
import {regionalMemorabiliaCatalogue,getRegionalMemorabilia} from './regional-memorabilia-catalogue.js';
import {premiumFurnitureCatalogue,getPremiumFurniture} from './premium-furniture-catalogue.js';
// HC-NEXT-4.4 player experience. All balances, ownership and settlement states are server-derived.
const opaque=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
const pos=x=>Number.isSafeInteger(x)&&x>0;
export function createMarketplaceClient({apiUrl,authenticate,fetchImpl=fetch}={}){
 if(typeof apiUrl!=='string'||!/^https:\/\/[^/?#]+$/.test(apiUrl)||typeof authenticate!=='function'
   ||typeof fetchImpl!=='function')throw Error('marketplace-config-invalid');
 const post=async(path,data)=>{
  const token=await authenticate();
  if(typeof token!=='string'||!token||token.length>4096||/\s/.test(token))throw Error('marketplace-sign-in-required');
  let response;try{response=await fetchImpl(new URL(path,apiUrl+'/'),{method:'POST',cache:'no-store',credentials:'omit',
   headers:{'content-type':'application/json',authorization:'Bearer '+token},body:JSON.stringify(data)});}
  catch{throw Error('marketplace-service-unavailable');}
  if(!response.ok)throw Error(response.status===403||response.status===401?'marketplace-action-denied':'marketplace-service-unavailable');
  const result=await response.json();if(result?.ok!==true||!Object.hasOwn(result,'result'))throw Error('marketplace-response-invalid');
  return result.result;
 };
 const action=(name,fields)=>{
  if(!fields||Object.keys(fields).sort().join(',')!=='listing,operation'||!opaque(fields.operation)||!opaque(fields.listing))throw Error('marketplace-input-invalid');
  return post('/market/'+name,fields);
 };
 return Object.freeze({
  snapshot:()=>post('/market/snapshot',{}),
  list:input=>{
   if(!input||Object.keys(input).sort().join(',')!=='asset,expiresAt,listing,operation,price,quantity'||!opaque(input.operation)||!opaque(input.listing)||!opaque(input.asset)
    ||!pos(input.quantity)||!pos(input.price)||!Number.isSafeInteger(input.expiresAt)
    ||input.expiresAt<=Date.now())throw Error('marketplace-input-invalid');
   return post('/market/list',input);
  },
  buy:input=>action('buy',input),
  cancel:input=>action('cancel',input),
  expire:input=>action('expire',input),
  dispute:input=>{
   if(!['missing-item','incorrect-item','payment','other'].includes(input?.reason))
    throw Error('marketplace-dispute-invalid');
   if(Object.keys(input).sort().join(',')!=='listing,operation,reason'||!opaque(input.operation)||!opaque(input.listing))throw Error('marketplace-input-invalid');
   return post('/market/dispute',input);
  }
 });
}
export function mountMarketplace({document,main,runtime,authenticate,fetchImpl=fetch,operationId=()=>globalThis.crypto?.randomUUID?.().replaceAll('-','')}){
 const el=(tag,text='')=>{const e=document.createElement(tag);e.textContent=text;return e;};
 const status=el('p',runtime.mode==='connected'?'Sign in to load verified marketplace inventory.':'Marketplace unavailable offline; guest items are never spendable.');
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');main.append(status);
 if(runtime.mode!=='connected'||typeof authenticate!=='function')return;
 const client=createMarketplaceClient({apiUrl:runtime.apiUrl,authenticate,fetchImpl});
 const region=el('section');region.setAttribute('aria-label','Marketplace');main.append(region);
 const button=(parent,title,callback)=>{
  const b=el('button',title);b.type='button';b.addEventListener('click',callback);parent.append(b);return b;
 };
 const section=(title)=>{const part=el('section');part.append(el('h3',title));region.append(part);return part;};
 const formField=(parent,title,type='text')=>{
  const label=el('label',title+' '),input=document.createElement('input');input.type=type;
  label.append(input);parent.append(label);return input;
 };
 let busy=false,confirmation=null;
 async function run(fn,success){
  if(busy)return;busy=true;status.textContent='Submitting authenticated marketplace request…';
  try{await fn();confirmation=success;await refresh();}
  catch(e){status.textContent='Marketplace action denied or unavailable: '+e.message;}
  finally{busy=false;}
 }
 async function refresh(){
  const data=await client.snapshot();
  if(!data||!['ordinary','canonical'].includes(data.mode))throw Error('marketplace-invalid-state');
  region.replaceChildren();
  status.textContent=confirmation||'Server-verified marketplace loaded. No local guest inventory is spendable.';
  if(confirmation){const p=el('p',confirmation);p.setAttribute('role','status');region.append(p);}
  region.append(el('p',data.mode==='ordinary'
   ?'Internal BUDS marketplace · no wallet needed · zero transaction fee.'
   :'Canonical escrow marketplace · separate wallet authorization and finalized chain confirmation required.'));
  region.append(el('p','BUDS available: '+data.buds.available+' · reserved: '+data.buds.reserved));
  const seedLink=el('a','Seed packs · regional and World · 420 BUDS or 1 $420');seedLink.href='/seeds#seed-pack-marketplace';region.append(seedLink);
  const premium=section('Premium comfort & regional furniture');
  premium.append(el('p','Visual catalogue only. Prices and availability require authenticated server-verified listings.'));
  for(const asset of premiumFurnitureCatalogue){
   const item=el('article'); const img=document.createElement('img');
   img.src=asset.assetUrl;img.alt=asset.name;img.width=96;img.height=96;img.loading='lazy';
   img.addEventListener('error',()=>{img.hidden=true;});
   item.append(img,el('p',asset.name+' · '+asset.region+' · '+asset.footprint.width+'×'+asset.footprint.height));premium.append(item);
  }
  const memorabilia=section('Regional memorabilia');
  memorabilia.append(el('p','Cosmetic catalogue only. BUDS prices and tradable quantities are determined by authenticated server listings.'));
  for(const asset of regionalMemorabiliaCatalogue){
   const item=el('article');const img=document.createElement('img');
   img.src=asset.assetUrl;img.alt=asset.name;img.width=96;img.height=96;img.loading='lazy';
   img.addEventListener('error',()=>{img.hidden=true;});
   item.append(img,el('p',asset.name+' · '+asset.region+' · '+asset.placement.layer+' · '+asset.footprint.width+'×'+asset.footprint.height));
   memorabilia.append(item);
  }
  const outdoor=section('Garden structures & shade');
  outdoor.append(el('p','Visual catalogue only. Ownership, BUDS prices and stock require authenticated server records. Placement requires qualified structure collision geometry.'));
  for(const asset of outdoorStructureCatalogue){
   const entry=el('article'),img=document.createElement('img');
   img.src=asset.assetUrl;img.alt=asset.name;img.width=110;img.height=110;img.loading='lazy';
   img.addEventListener('error',()=>{img.hidden=true;});
   entry.append(img,el('p',asset.name+' · '+asset.footprint.width+'×'+asset.footprint.height+' · '+asset.originRegion));outdoor.append(entry);
  }
  const waterWildlife=section('Water features & wildlife gardens');
  waterWildlife.append(el('p','Decorative catalogue only. BUDS prices, inventory and ownership require authenticated server records. Unqualified collision/water-edge placement remains blocked.'));
  for(const asset of waterWildlifeCatalogue){
   const entry=el('article'),img=document.createElement('img');img.src=asset.assetUrl;img.alt=asset.name;img.width=110;img.height=110;img.loading='lazy';img.addEventListener('error',()=>{img.hidden=true;});
   entry.append(img,el('p',asset.name+' · '+asset.footprint.width+'×'+asset.footprint.height+' · '+asset.originRegion));waterWildlife.append(entry);
  }
  const agricultural=section('Barns, agricultural buildings & homesteads');
  agricultural.append(el('p','Visual catalogue only. Prices, BUDS purchases and ownership require authenticated server records. Placement requires independent qualified HC-PLACE collision geometry.'));
  for(const asset of agriculturalBuildingCatalogue){
   const entry=el('article'),img=document.createElement('img');img.src=asset.assetUrl;img.alt=asset.name;img.width=110;img.height=110;img.loading='lazy';
   img.addEventListener('error',()=>{img.hidden=true;});
   entry.append(img,el('p',asset.name+' · '+asset.footprint.width+'×'+asset.footprint.height+' · '+asset.originRegion));agricultural.append(entry);
  }
  const inventory=section('My verified inventory');
  if(!data.inventory.length)inventory.append(el('p','No tradeable registered inventory. Local guest harvests cannot be listed.'));
  for(const item of data.inventory)inventory.append(el('p',(getAgriculturalBuilding(item.asset)?.name||getWaterWildlifeFeature(item.asset)?.name||getOutdoorStructure(item.asset)?.name||getPremiumFurniture(item.asset)?.name||getRegionalMemorabilia(item.asset)?.name||item.asset)+' · available '+item.available+' · reserved '+item.reserved));
  if(data.mode==='ordinary'){
   const list=section('Create a listing');
   const asset=formField(list,'Verified asset ID');
   const quantity=formField(list,'Quantity','number');quantity.min='1';quantity.step='1';
   const price=formField(list,'Total BUDS price','number');price.min='1';price.step='1';
   const duration=formField(list,'Expires in hours','number');duration.min='1';duration.max='720';duration.step='1';duration.value='24';
   button(list,'Reserve goods and list',()=>run(async()=>{
    const q=Number(quantity.value),p=Number(price.value),hours=Number(duration.value);
    if(!pos(q)||!pos(p)||!Number.isSafeInteger(hours)||hours<1||hours>720)throw Error('invalid listing amounts');
    if(!data.inventory.some(x=>x.asset===asset.value&&x.available>=q))throw Error('verified inventory unavailable');
    const op=operationId(),listing=operationId();
    await client.list({operation:op,listing,asset:asset.value,quantity:q,price:p,expiresAt:Date.now()+hours*3600000});
   },'Listing submitted. Inventory reserved by the authenticated marketplace.'));
  }
  const browse=section('Browse available listings');
  if(!data.browse.length)browse.append(el('p','No available listings.'));
  for(const item of data.browse){
   const row=el('article');row.append(el('p',(getAgriculturalBuilding(item.asset)?.name||getWaterWildlifeFeature(item.asset)?.name||getOutdoorStructure(item.asset)?.name||getPremiumFurniture(item.asset)?.name||getRegionalMemorabilia(item.asset)?.name||item.asset)+' · '+item.quantity+' units · '+item.price+' BUDS · seller '+item.seller));
   row.append(el('p','Listing '+item.listing+' · expires '+new Date(item.expiresAt).toLocaleString()));
   if(data.mode==='ordinary'){
    button(row,'Purchase for '+item.price+' BUDS',()=>{
     if(!globalThis.confirm?.('Buy '+item.quantity+' '+item.asset+' for '+item.price+' BUDS? This spends your authenticated game balance.'))return;
     run(()=>client.buy({operation:operationId(),listing:item.listing}),
      'Purchase completed by the server. Refresh history to verify settlement.');
    });
   }else {
    row.append(el('p','Canonical trades require independently verified wallet consent, a prepared escrow intent, operator execution and finalized chain/indexer reconciliation.'));
    const link=el('a','Open optional canonical wallet and transaction controls');link.href='/account';row.append(link);
   }
   browse.append(row);
  }
  const history=section('My listings and trade history');
  if(!data.history.length)history.append(el('p','No trade history on this registered profile.'));
  for(const item of data.history){
   const row=el('article');row.append(el('p',(getAgriculturalBuilding(item.asset)?.name||getWaterWildlifeFeature(item.asset)?.name||getOutdoorStructure(item.asset)?.name||getPremiumFurniture(item.asset)?.name||getRegionalMemorabilia(item.asset)?.name||item.asset)+' · '+item.quantity+' units · '+item.price+' BUDS · '+item.status));
   row.append(el('p','Listing '+item.listing+' · '+(item.seller===data.principal?'I am the seller':'I am the buyer')));
   if(data.mode==='ordinary'&&item.seller===data.principal&&item.status==='active')
    button(row,'Cancel listing',()=>run(()=>client.cancel({operation:operationId(),listing:item.listing}),
     'Listing cancellation confirmed; reserved inventory returned by the service.'));
   if(data.mode==='ordinary'&&item.status==='expired-pending-release')
    button(row,'Release expired listing',()=>run(()=>client.expire({operation:operationId(),listing:item.listing}),
     'Expired listing closed and its reservation reconciled.'));
   if(['sold','settling','cancelled','expired'].includes(item.status)){
    const reasons=['missing-item','incorrect-item','payment','other'];
    const select=document.createElement('select');
    for(const reason of reasons){const option=el('option',reason);option.value=reason;select.append(option);}
    select.setAttribute('aria-label','Dispute reason');row.append(select);
    button(row,'Report trade dispute',()=>run(()=>client.dispute({operation:operationId(),listing:item.listing,reason:select.value}),
     'Dispute reported. This is not a refund, chargeback or custody reversal.'));
   }
   history.append(row);
  }
  const disputes=section('My dispute status');
  if(!data.disputes.length)disputes.append(el('p','No disputes filed.'));
  for(const d of data.disputes)disputes.append(el('p',d.listing+' · '+d.reason+' · '+d.status+
   (d.decision?' · '+d.decision:'')+' (no automatic settlement)'));
 }
 button(main,'Refresh marketplace',()=>run(async()=>{},null));
 refresh().catch(e=>{status.textContent='Marketplace unavailable: '+e.message;});
}

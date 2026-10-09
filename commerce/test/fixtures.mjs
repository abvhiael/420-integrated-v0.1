import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Wallet, Interface } from 'ethers';
import { Database } from '../src/database.mjs';
import { Projection } from '../src/projection.mjs';
import { CommerceService } from '../src/service.mjs';
import { ABIS, fixedPrice } from '../src/authority.mjs';
export const b32=n=>'0x'+n.toString(16).padStart(64,'0');
export const address=n=>'0x'+n.toString(16).padStart(40,'0');
export const NOW=1800000000000;
export const seller=Wallet.createRandom(),buyer=Wallet.createRandom(),attacker=Wallet.createRandom();
export function setup() {
  const dir=mkdtempSync(join(tmpdir(),'commerce-test-')),file=join(dir,'commerce.sqlite');
  const db=new Database(file);let clock=NOW;
  const contracts=Object.fromEntries(Object.keys(ABIS).map((name,i)=>[name,{address:address(i+20)}]));
  const listings=new Map(),orders=new Map(),payments=new Map(),invoices=new Map();let controller=seller.address.toLowerCase(),active=true,unavailable=false;
  const source={chainId:'420',finalized:true,blockHash:b32(100),blockNumber:100,merchant:async()=>({controller,active}),listing:async key=>listings.get(key),order:async key=>orders.get(key)??{status:'0'},payment:async key=>payments.get(key),invoice:async key=>invoices.get(key)??{active:false},invoiceId:async()=>b32(900),boundPayment:async()=>b32(901),invoicePaid:async()=>({amount:'100',closed:true}),policy:async()=>({policyActive:true,adapterActive:true}),transaction:(contract,method,args)=>({chainId:'420',contract,target:contracts[contract].address,method,args,data:new Interface(ABIS[contract]).encodeFunctionData(method,args),requiresWalletAuthorization:true,canonicalAuthority:false}),intent:(method,args)=>({chainId:'420',target:contracts.OrderRegistry420.address,method,args,requiresWalletAuthorization:true,canonicalAuthority:false})};
  const authority={snapshot:async()=>{if(unavailable)throw new Error('outage');return source;},verifyBlocks:async()=>true};
  const projection=new Projection(db,authority,{chainId:'420',contracts,startHeight:1,startParentHash:b32(99),now:()=>clock});
  const service=new CommerceService(db,authority,projection,{chainId:'420',deliveryKey:randomBytes(32),now:()=>clock});
  return {db,dir,file,contracts,source,authority,projection,service,listings,orders,payments,invoices,now:()=>clock,advance:n=>clock+=n,setController:a=>controller=a.toLowerCase(),setActive:a=>active=a,setOutage:a=>unavailable=a,close(){db.close();rmSync(dir,{recursive:true,force:true});}};
}
export async function published(f) {
  const store=await f.service.createStore(seller.address,{merchantId:b32(1),slug:'test-store'});
  await f.service.updateStore(seller.address,store.store_id,{version:1,slug:'test-store',status:'published'});
  const draft=await f.service.product(seller.address,store.store_id,{sku:'PRODUCT',description:'A product',media:[],publishState:'draft'});
  const listing={seller:seller.address.toLowerCase(),metadataHash:draft.metadata_hash,revision:'1',active:true,quantity:'10',available:'10',unitPrice:'100',quoteAsset:address(100),expiresAt:'0',policyActive:true,adapterActive:true,reporterActive:true,saleMechanism:fixedPrice,policyId:b32(40),settlementAdapterId:b32(41)};
  f.listings.set(b32(2),listing);
  const product=await f.service.product(seller.address,store.store_id,{id:draft.product_id,version:1,sku:'PRODUCT',description:'A product',media:[],publishState:'published',listingId:b32(2),revision:1});
  return {store:f.service.store(store.store_id),product,listing};
}
export async function checkout(f) {
  const state=await published(f);
  const cart=f.service.cart(buyer.address,{storeId:state.store.store_id,lines:[{listingId:b32(2),revision:1,quantity:'1'}]});
  const plan=await f.service.prepare(buyer.address,{cartId:cart.cart_id,cartVersion:1,idempotencyKey:'abcdefghijklmnop'});
  const attempt=plan.attempts[0],order={listingId:b32(2),listingRevision:'1',buyer:buyer.address.toLowerCase(),seller:seller.address.toLowerCase(),quantity:'1',paymentAsset:address(100),totalAmount:'100',settlementAdapterId:b32(41),status:'1',paymentRef:b32(0)};
  return {...state,cart,plan,attempt,order};
}
export function listingEvent(f,{height=1,blockHash=b32(100),revision='1',logIndex=0}={}) {
  return {streamVersion:'v1',source:'protocol',protocol:'420Market',eventName:'ListingPublished',topic:'420Market.ListingPublished',id:['420evt','v1','420',blockHash,b32(200),String(logIndex)].join(':'),objectKey:'listingId:'+b32(2),lifecycleState:null,fields:{listingId:b32(2),seller:seller.address.toLowerCase(),revision,unitPrice:'100',quantity:'10',metadataHash:b32(3),quoteAsset:address(100),expiresAt:'0',active:true},provenance:{chainId:'420',blockNumber:String(height),blockHash,transactionHash:b32(200),transactionIndex:0,logIndex,contractAddress:f.contracts.ListingRegistry420.address},authoritative:false};
}
export const batch=events=>({streamVersion:'v1',events,nextCursor:'opaque-cursor',authoritative:false});
export const header=(height=1,hash=b32(100),parentHash=b32(99),finalized=false)=>({height,hash,parentHash,finalized});

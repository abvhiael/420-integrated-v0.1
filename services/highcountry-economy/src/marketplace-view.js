// Authenticated read models and non-settling dispute notices for internal game trades.
import {SettlementError} from './buds-ledger.js';
const id=x=>{if(typeof x!=='string'||!/^[A-Za-z0-9:_-]{1,128}$/.test(x))throw new SettlementError('invalid marketplace identifier');return x;};
export class HighCountryMarketplaceView {
 constructor({store,identity,market,clock=()=>Date.now()}){
  if(typeof store?.transact!=='function'||typeof identity?.registeredPrincipal!=='function'||!market)
   throw new SettlementError('marketplace view configuration missing');
  Object.assign(this,{store,identity,market,clock});
 }
 async snapshot(session){
  const principal=id(await this.identity.registeredPrincipal(session)),now=this.clock();
  return this.store.transact(s=>{
   const bal=s.balances.get(principal)||{available:0,reserved:0};
   const inventory=[...s.assets].filter(([key])=>{try{return JSON.parse(key)[0]===principal;}catch{return false;}})
    .map(([key,b])=>({asset:JSON.parse(key)[1],available:b.available,reserved:b.reserved}))
    .sort((a,b)=>a.asset.localeCompare(b.asset)).slice(0,200);
   const canonical=this.market.authority?.canonicalSettlementRequired===true;
   const listings=[...s.listings].filter(([,l])=>l&&
    (canonical?true:!l.canonicalOnly)).map(([listing,l])=>({
    listing,seller:l.seller,asset:l.asset,quantity:l.quantity,price:l.price,
    expiresAt:l.expiresAt,status:l.status==='active'&&now>=l.expiresAt?'expired-pending-release':l.status,
    buyer:l.buyer??null,kind:canonical?'canonical':'ordinary'
   }));
   const browse=listings.filter(l=>l.status==='active'&&l.seller!==principal).slice(-100);
   const history=listings.filter(l=>l.seller===principal||l.buyer===principal).slice(-100).reverse();
   const disputes=[...(s.marketDisputes??new Map())].filter(([,d])=>d.principal===principal)
    .map(([dispute,d])=>({dispute,listing:d.listing,reason:d.reason,status:d.status,createdAt:d.createdAt,decision:d.decision??null,evidence:d.evidence??null}))
    .slice(-50).reverse();
   return {principal,mode:canonical?'canonical':'ordinary',
    buds:{available:bal.available,reserved:bal.reserved},inventory,browse,history,disputes,
    walletRequired:canonical,feePolicy:canonical?'independent-chain-policy':'zero'};
  });
 }
 async review(session,operation,dispute,status,evidence){
  if(typeof this.identity.requireMarketOperator!=='function')throw new SettlementError('dispute review disabled');
  await this.identity.requireMarketOperator(session);
  id(operation);id(dispute);id(evidence);
  if(!['under-review','closed-no-adjustment','referred'].includes(status))
   throw new SettlementError('invalid dispute transition');
  return this.store.transact(s=>{
   if(s.operations.has(operation))throw new SettlementError('replayed dispute action');
   const d=s.marketDisputes?.get(dispute);
   if(!d||!['open','under-review'].includes(d.status))throw new SettlementError('dispute not reviewable');
   if(d.status==='open'&&status!=='under-review')throw new SettlementError('review required before closure');
   if(d.status==='under-review'&&status==='under-review')throw new SettlementError('duplicate dispute review');
   d.status=status;d.evidence=evidence;
   d.decision=status==='closed-no-adjustment'?'no-ledger-adjustment':
    status==='referred'?'external-authority-required':null;
   s.operations.add(operation);
   // This workflow is descriptive evidence, NEVER an escrow or credit adjustment.
   return {dispute,status,settlementChanged:false};
  });
 }
 async dispute(session,operation,listing,reason){
  const principal=id(await this.identity.registeredPrincipal(session));
  id(operation);id(listing);
  if(!['missing-item','incorrect-item','payment','other'].includes(reason))
   throw new SettlementError('invalid dispute category');
  return this.store.transact(s=>{
   if(s.operations.has(operation))throw new SettlementError('replayed dispute');
   const l=s.listings.get(listing);
   if(!l||!['sold','settling','cancelled','expired'].includes(l.status)||
      (l.seller!==principal&&l.buyer!==principal))
    throw new SettlementError('not an affected market participant');
   if(!s.marketDisputes)s.marketDisputes=new Map();
   if([...s.marketDisputes.values()].some(d=>d.listing===listing&&d.principal===principal&&d.status==='open'))
    throw new SettlementError('dispute already open');
   s.marketDisputes.set(operation,{listing,principal,reason,status:'open',createdAt:this.clock()});
   s.operations.add(operation);
   // A report is a support record; it never itself credits, refunds or modifies custody.
   return {dispute:operation,listing,status:'open',settlementChanged:false};
  });
 }
}

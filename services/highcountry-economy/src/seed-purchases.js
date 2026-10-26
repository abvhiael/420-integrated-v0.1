import {SettlementError,BudsLedger} from './buds-ledger.js';
import {SEED_PACK_POLICY,seedPackState} from './seed-packs.js';
import {address,calldata} from './finalized-rpc.js';
import {seedHash,abiHash,OPENING_POLICY_HASH,OPENING_POOLS,poolDefinition,eligibleGenomeCommitment} from './seed-opening-selection.js';
const fail=m=>{throw new SettlementError(m);};
const valid=x=>typeof x==='string'&&/^[A-Za-z0-9:_-]{1,128}$/.test(x);
const hash=x=>seedHash(JSON.stringify(x));
const MARKET=seedHash('HC.EMERGENCY.MARKET');
export function seedPurchaseState(s){seedPackState(s);s.seedPurchases??=new Map();s.seedPurchaseHolds??=new Map();}
export class SeedPurchases {
 constructor({packs,reader,signerRpc,clock=()=>Date.now()}){if(!packs||typeof reader?.read!=='function'||!reader.binding)fail('canonical payment reader required');Object.assign(this,{packs,reader,store:packs.store,identity:packs.identity,signerRpc,clock});this.ledger=new BudsLedger(this.store,null);packs.purchasesEnabled=true;packs.purchaseVerifier=this;}
 async browse(token){const owner=await this.identity.registeredPrincipal(token);return this.store.transact(s=>{this.packs.guard(s,token,owner);seedPurchaseState(s);return {policy:structuredClone(SEED_PACK_POLICY),nativeAvailable:typeof this.signerRpc?.request==='function',availableBuds:s.balances.get(owner)?.available??0,pools:OPENING_POOLS.map(region=>({region,remaining:Math.max(0,Math.min(SEED_PACK_POLICY.standardLimitPerPool-(s.seedSupply.get('standard:'+region)??0)-(s.seedPurchaseHolds.get(region)??0),...Object.entries(this.packs.pools.get(region)).flatMap(([tier,ids])=>ids.map(cid=>Math.floor(((tier==='exclusive'?SEED_PACK_POLICY.maxExclusiveSeedUnitsPerCultivar:SEED_PACK_POLICY.maxSeedUnitsPerCultivar)-(s.seedSupply.get('seeds:'+cid)??0)-(s.seedOpeningHolds?.get(cid)??0))/3)))))})),purchases:[...s.seedPurchases.values()].filter(p=>p.owner===owner).map(p=>this.view(s,p))};});}
 view(s,p){const pack=p.packId?s.seedPacks.get(p.packId):null,lot=p.packId?s.seedLotIntents.get(p.packId):null;return {...structuredClone(p),pack:pack?structuredClone(pack):null,delivery:lot?{status:lot.status,lotId:lot.lotId,evidence:lot.evidence??null}:null};}
 async prepare(token,{operation,region,currency}){
  if(currency==='420'&&typeof this.signerRpc?.request!=='function')fail('native quote signer unavailable');
  if(!valid(operation)||!OPENING_POOLS.includes(region)||!['BUDS','420'].includes(currency))fail('invalid seed purchase');
  if(!await this.identity.rpc.unrestricted(MARKET))fail('seed marketplace restricted');
  const owner=await this.identity.registeredPrincipal(token),wallet=address(await this.identity.walletOf(token));
  const id='purchase:'+hash([this.identity.gameId,owner,operation]).slice(2);
  const existing=await this.store.transact(s=>{this.packs.guard(s,token,owner);seedPurchaseState(s);return structuredClone(s.seedPurchases.get(id));});
  if(existing){if(existing.region!==region||existing.currency!==currency)fail('purchase replay mismatch');return this.authorizeQuote(token,await this.historyOne(token,id));}
  const poolDef=poolDefinition(this.packs.catalogue,region);await this.packs.openingVerifier.validatePool(poolDef);const eligible=[];for(const cid of poolDef.tiers.flat()){const g=await this.packs.reader.cultivar(cid);if(g?.cultivarId!==cid||!['registered-common-reference','finalized-canonical-breeding','registered-founding-line'].includes(g.basis))fail('complete registered purchase pool required');eligible.push(g);}
  const prepared=await this.store.transact(s=>{this.packs.guard(s,token,owner);seedPurchaseState(s);const old=s.seedPurchases.get(id);
   if(old){if(old.region!==region||old.currency!==currency)fail('purchase replay mismatch');return this.view(s,old);}
   const link=s.runtimeWallets.get(owner);if(link?.wallet!==wallet)fail('purchase wallet changed');
   if([...s.seedPurchases.values()].filter(p=>p.owner===owner&&p.status==='pending').length>=8)fail('pending purchase limit');
   const used=s.seedSupply.get('standard:'+region)??0,held=s.seedPurchaseHolds.get(region)??0;if(used+held>=SEED_PACK_POLICY.standardLimitPerPool)fail('pack supply exhausted');
   for(const cid of poolDef.tiers.flat()){const cap=this.packs.catalogue.detail(cid).tier==='exclusive'?SEED_PACK_POLICY.maxExclusiveSeedUnitsPerCultivar:SEED_PACK_POLICY.maxSeedUnitsPerCultivar;if((s.seedSupply.get('seeds:'+cid)??0)+(s.seedOpeningHolds?.get(cid)??0)+3>cap)fail('complete purchase seed supply unavailable');}
   s.seedOpeningHolds??=new Map();for(const cid of poolDef.tiers.flat())s.seedOpeningHolds.set(cid,(s.seedOpeningHolds.get(cid)??0)+3);
   const key=hash(['HC.SEED.PURCHASE.KEY.V1',this.identity.gameId,id]),amount=currency==='BUDS'?String(SEED_PACK_POLICY.priceBuds):SEED_PACK_POLICY.priceNative420Wei;
   const paymentBinding=structuredClone(this.reader.binding),pool=OPENING_POOLS.indexOf(region),commitment=hash(['HC.SEED.PURCHASE.V1',this.identity.gameId,OPENING_POLICY_HASH,id,owner,wallet,link.profile,region,currency,amount,paymentBinding.chainId,paymentBinding.contract,paymentBinding.codeHash,paymentBinding.treasury,poolDef.hash,eligibleGenomeCommitment(eligible)]);
   const p={operation,eligible,poolHash:poolDef.hash,holdStatus:'reserved',id,key,owner,wallet,ownerProfile:link.profile,region,pool,currency,amount,commitment,paymentBinding,nativeId:abiHash(this.identity.gameId,wallet,key),status:'pending',createdAt:this.clock(),packId:null};
   if(currency==='420'){p.transaction={chainId:paymentBinding.chainId,from:wallet,to:paymentBinding.contract,value:'0x'+BigInt(amount).toString(16),data:null};p.cancelTransaction={...p.transaction,value:'0x0',data:calldata('cancel(bytes32)',key)};}
   s.seedPurchaseHolds.set(region,held+1);s.seedPurchases.set(id,p);return this.view(s,p);
  });
  return this.authorizeQuote(token,prepared);
 }
 async authorizeQuote(token,p){if(p.currency!=='420'||p.status!=='pending'||p.transaction?.data)return p;const data=await this.reader.authorize(p,this.signerRpc);return this.store.transact(s=>{this.packs.guard(s,token,p.owner);const current=s.seedPurchases.get(p.id);if(current.commitment!==p.commitment)fail('quote changed');if(current.status==='pending'){current.transaction.data=data;current.quoteAuthorized=true;}return this.view(s,current);});}
 async owned(token,id){if(!valid(id))fail('invalid purchase identity');const owner=await this.identity.registeredPrincipal(token);return this.store.transact(s=>{this.packs.guard(s,token,owner);seedPurchaseState(s);const p=s.seedPurchases.get(id);if(!p||p.owner!==owner)fail('purchase ownership required');return structuredClone(p);});}
 issue(s,p,evidence){
  if(p.status==='paid')return this.view(s,p);if(p.status!=='pending')fail('purchase is closed');
  const held=s.seedPurchaseHolds.get(p.region)??0,used=s.seedSupply.get('standard:'+p.region)??0;if(held<1||used>=SEED_PACK_POLICY.standardLimitPerPool)fail('purchase reservation corrupt');
  const source={kind:'settled-purchase',receiptId:p.id,issuer:'seed-market',policyVersion:SEED_PACK_POLICY.version,currency:p.currency,commitment:p.commitment};
  const pack=this.packs.create(s,{packId:'pack:'+hash([this.identity.gameId,'paid',p.id]).slice(2),owner:p.owner,region:p.region,source});
  s.seedPackSources.set('purchase:'+p.id,{issuer:source.issuer,request:{owner:p.owner,region:p.region,count:1},packIds:[pack.id],source});
  s.seedPurchaseHolds.set(p.region,held-1);s.seedSupply.set('standard:'+p.region,used+1);p.status='paid';p.packId=pack.id;p.evidence=evidence;p.paidAt=this.clock();return this.view(s,p);
 }
 async confirm(token,id){
  const snapshot=await this.owned(token,id);if(snapshot.status==='cancelled')return this.historyOne(token,id);
  if(snapshot.currency==='BUDS'&&snapshot.status==='pending'&&!await this.identity.rpc.unrestricted(MARKET))fail('seed marketplace restricted');
  const evidence=snapshot.currency==='420'?await this.reader.read(snapshot):null;
  if(snapshot.status==='paid'&&evidence&&evidence.status!=='paid')fail('payment no longer finalized');
  return this.store.transact(s=>{this.packs.guard(s,token,snapshot.owner);seedPurchaseState(s);const p=s.seedPurchases.get(id);if(p.commitment!==snapshot.commitment)fail('purchase changed');
   if(p.status==='paid')return this.view(s,p);if(p.status!=='pending')return this.view(s,p);
   if(p.currency==='420'){if(evidence.status==='pending')return this.view(s,p);if(evidence.status==='cancelled'){this.release(s,p);return this.view(s,p);}return this.issue(s,p,evidence);}
   if(s.runtimeWallets?.get(p.owner)?.wallet!==p.wallet||s.runtimeWallets?.get(p.owner)?.profile!==p.ownerProfile)fail('purchase recipient authority changed');
   const b=this.ledger.get(s,p.owner);if(b.available<Number(p.amount))fail('insufficient BUDS');
   if(!Number.isSafeInteger(s.burned+Number(p.amount))||s.burned+Number(p.amount)>s.issued)fail('BUDS totals corrupt');
   b.available-=Number(p.amount);s.burned+=Number(p.amount);return this.issue(s,p,{kind:'atomic-BUDS-sink',sink:'HC.SEED.PURCHASE.V1',amount:p.amount,operation:p.id});
  });
 }
 release(s,p){if(p.status!=='pending')fail('purchase cannot be cancelled');const held=s.seedPurchaseHolds.get(p.region)??0;if(held<1)fail('purchase reservation corrupt');if(p.holdStatus!=='reserved')fail('purchase seed holds changed');for(const g of p.eligible){const h=s.seedOpeningHolds.get(g.cultivarId)??0;if(h<3)fail('purchase seed hold missing');s.seedOpeningHolds.set(g.cultivarId,h-3);}p.holdStatus='released';s.seedPurchaseHolds.set(p.region,held-1);p.status='cancelled';p.cancelledAt=this.clock();}
 async cancel(token,id){const p=await this.owned(token,id);if(p.currency==='420')return this.confirm(token,id);return this.store.transact(s=>{this.packs.guard(s,token,p.owner);const current=s.seedPurchases.get(id);if(current.status==='cancelled')return this.view(s,current);this.release(s,current);return this.view(s,current);});}
 async historyOne(token,id){const p=await this.owned(token,id);return this.store.transact(s=>{this.packs.guard(s,token,p.owner);return this.view(s,s.seedPurchases.get(id));});}
 async checkPack(pack,wallet){const p=await this.store.transact(s=>{seedPurchaseState(s);const p=s.seedPurchases.get(pack.source.receiptId);if(!p||p.status!=='paid'||p.packId!==pack.id||p.owner!==pack.owner||p.region!==pack.region||p.commitment!==pack.source.commitment)fail('settled purchase source required');return structuredClone(p);});if(wallet&&wallet!==p.wallet)fail('purchase recipient wallet is immutable');if(p.currency==='420'&&(await this.reader.read(p)).status!=='paid')fail('current finalized seed payment required');return true;}
}

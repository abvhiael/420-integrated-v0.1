import {SettlementError} from './buds-ledger.js';
import {CanonicalEscrowReader} from './canonical-escrow-reader.js';
import {CanonicalMarketSettlement} from './canonical-settlement.js';
import {CanonicalSettlementWorker} from './canonical-settlement-worker.js';
import {calldata,words,address} from './finalized-rpc.js';
import {keccak256} from './keccak.js';
export class CanonicalRpcEscrowClient {
 constructor(rpc){this.rpc=rpc;}
 async getChainId(){return Number(BigInt(await this.rpc.request('eth_chainId',[])));}
 async getBlockNumber(){return BigInt((await this.rpc.header()).number);}
 async readContract({functionName,args}){
  if(functionName==='transferOperation')return (await this.rpc.call('escrow',calldata('transferOperation(bytes32,address)',...args))).result;
  if(functionName!=='listing')throw new SettlementError('unreviewed escrow read');
  const w=words((await this.rpc.call('escrow',calldata('listing(bytes32)',...args))).result);
  if(w.length!==5)throw new SettlementError('invalid escrow ABI');
  return {owner:address('0x'+w[0].slice(24)),asset:'0x'+w[1],quantity:BigInt('0x'+w[2]),expiresAt:BigInt('0x'+w[3]),status:Number(BigInt('0x'+w[4]))};
 }
 async getContractEvents({address:target,eventName,args,fromBlock}){
  const spec=this.rpc.contracts.escrow;if(address(target)!==address(spec.address))throw new SettlementError('wrong event source');
  const signatures={EscrowListed:'EscrowListed(bytes32,address,bytes32,uint256,uint64)',
   EscrowSettled:'EscrowSettled(bytes32,bytes32,address)',EscrowClosed:'EscrowClosed(bytes32,uint8)'};
  if(!signatures[eventName])throw new SettlementError('unreviewed escrow event');
  const h=await this.rpc.header();
  const logs=await this.rpc.request('eth_getLogs',[{address:target,fromBlock:'0x'+fromBlock.toString(16),toBlock:h.number,topics:[keccak256(Buffer.from(signatures[eventName]))]}]);
  if(!Array.isArray(logs)||logs.length>10000)throw new SettlementError('unbounded escrow events');
  const out=[];
  for(const l of logs){
   if(l.removed||address(l.address)!==address(target)||BigInt(l.blockNumber)>BigInt(h.number)
      ||l.topics?.[0]!==keccak256(Buffer.from(signatures[eventName])))throw new SettlementError('noncanonical event');
   const block=await this.rpc.request('eth_getBlockByNumber',[l.blockNumber,false]);
   if(!block||block.hash!==l.blockHash)throw new SettlementError('event reorg');
   const ev={listingId:l.topics[1]};
   if(eventName==='EscrowSettled'){ev.operationId=l.topics[2];ev.buyer=address('0x'+l.topics[3].slice(-40));}
   if(eventName==='EscrowListed'){const w=words(l.data);ev.owner=address('0x'+l.topics[2].slice(-40));ev.asset=l.topics[3];ev.quantity=BigInt('0x'+w[0]);ev.expiresAt=BigInt('0x'+w[1]);}
   if(eventName==='EscrowClosed')ev.status=Number(BigInt('0x'+words(l.data)[0]));
   if(Object.entries(args).every(([k,v])=>ev[k]?.toLowerCase()===v.toLowerCase()))out.push({args:ev,blockNumber:BigInt(l.blockNumber),blockHash:l.blockHash});
  }
  return out;
 }
}
export function composeSettlementRuntime({store,identity,rpc,operator,issuer,marketDomain,signerRpc,fromBlock=0n,clock}){
 if(!marketDomain||!signerRpc||!operator)throw new SettlementError('missing settlement deployment policy');
 const reader=new CanonicalEscrowReader({client:new CanonicalRpcEscrowClient(rpc),
  escrow:rpc.contracts.escrow.address,chainId:rpc.chainId,issuer,fromBlock});
 const binding=async principal=>{
  const b=await store.transact(s=>s.runtimeWallets?.get(principal));
  if(!b||await rpc.playerProfile(identity.gameId,b.wallet)!==b.profile)throw new SettlementError('canonical account binding missing');
  return b.wallet;
 };
 const listing=async id=>{
  const l=await store.transact(s=>s.listings.get(id));if(!l?.sourceReceiptId)throw new SettlementError('canonical escrow required');
  return l;
 };
 const authority={
  canonicalSettlementRequired:true,
  preparedParties:async(id,buyer)=>{
   const l=await listing(id),sellerWallet=await binding(l.seller),buyerWallet=await binding(buyer);
   const snapshot=await store.transact(s=>({seller:s.runtimeWallets.get(l.seller),buyer:s.runtimeWallets.get(buyer),
    sellerEpoch:s.runtimeEpochs.get(l.seller)||0,buyerEpoch:s.runtimeEpochs.get(buyer)||0}));
   if(snapshot.seller?.wallet!==sellerWallet||snapshot.buyer?.wallet!==buyerWallet)throw new SettlementError('chain binding changed');
   return {seller:l.seller,buyer,sellerWallet,buyerWallet,sellerProfile:snapshot.seller.profile,buyerProfile:snapshot.buyer.profile,
    sellerEpoch:snapshot.sellerEpoch,buyerEpoch:snapshot.buyerEpoch,operationId:await reader.expectedTransferOperation(l.sourceReceiptId,buyerWallet)};
  },
  validatePreparedParties:(s,p,l,buyer,token)=>{
   const c=identity.verifyToken(token);
   if(!p||p.seller!==l.seller||p.buyer!==buyer||c.sub!==buyer||c.epoch!==p.buyerEpoch
      ||s.runtimeWallets.get(l.seller)?.wallet!==p.sellerWallet||s.runtimeWallets.get(buyer)?.wallet!==p.buyerWallet
      ||(s.runtimeEpochs.get(l.seller)||0)!==p.sellerEpoch||(s.runtimeEpochs.get(buyer)||0)!==p.buyerEpoch)
    throw new SettlementError('chain binding or authority changed');
  },
  registeredPrincipal:token=>identity.registeredPrincipal(token),
  expectedTransferOperation:async(id,buyer)=>reader.expectedTransferOperation((await listing(id)).sourceReceiptId,await binding(buyer)),
  confirmedListingClosure:async id=>reader.confirmedListingClosure((await listing(id)).sourceReceiptId),
  confirmedReservedTransfer:async op=>{
   const t=await store.transact(s=>s.transferIntents.get(op));if(!t)return null;
   const r=await reader.confirmedReservedTransfer(op);
   if(!r||r.sourceReceiptId!==t.sourceReceiptId||r.from!==t.canonicalParties?.sellerWallet||r.to!==t.canonicalParties?.buyerWallet)return null;
   return {...r,from:t.seller,to:t.buyer};
  },
  proveUnexecutedAndCancelled:async(op,id,buyer)=>{
   const t=await store.transact(s=>s.transferIntents.get(op));
   if(!t?.canonicalParties||t.listingId!==id||t.buyer!==buyer)return false;
   return reader.proveUnexecutedAndCancelled(op,t.sourceReceiptId,t.canonicalParties.buyerWallet);
  },
  requireSubmissionAllowed:async()=>{if(!await rpc.unrestricted(marketDomain))throw new SettlementError('market restricted');}
 };
 const settlement=new CanonicalMarketSettlement(store,authority,clock);
 const submitCanonical=async intent=>{
  await authority.requireSubmissionAllowed();
  // Re-read durable reservation immediately before asking the external operator wallet to sign.
  const current=await store.transact(s=>s.transferIntents.get(intent.transferOp));
  if(!current||current.status!=='prepared'||JSON.stringify(current)!==JSON.stringify(intent))throw new SettlementError('stale transfer intent');
  const p=intent.canonicalParties;
  if(!p)throw new SettlementError('missing immutable chain parties');
  await store.transact(s=>{
   if((s.runtimeEpochs.get(intent.buyer)||0)!==p.buyerEpoch||(s.runtimeEpochs.get(intent.seller)||0)!==p.sellerEpoch)
    throw new SettlementError('submission authority revoked');
  });
  const buyer=await binding(intent.buyer),seller=await binding(intent.seller);
  if(buyer!==p.buyerWallet||seller!==p.sellerWallet)throw new SettlementError('submission binding changed');
  const l=await reader._listing(intent.sourceReceiptId);
  if(l.owner!==seller||l.asset!==intent.asset||l.quantity!==BigInt(intent.quantity)||Number(l.status)!==1
     ||await reader.expectedTransferOperation(intent.sourceReceiptId,buyer)!==intent.transferOp)throw new SettlementError('escrow intent mismatch');
  const actual=words((await rpc.call('escrow',calldata('marketOperator()'))).result)[0];
  if(address('0x'+actual.slice(24))!==address(operator))throw new SettlementError('wrong signer authority');
  if(Number(BigInt(await signerRpc.request('eth_chainId',[])))!==rpc.chainId)throw new SettlementError('signer wrong chain');
  const txHash=await signerRpc.request('eth_sendTransaction',[{from:address(operator),to:address(rpc.contracts.escrow.address),
   data:calldata('settle(bytes32,address)',intent.sourceReceiptId,buyer),value:'0x0',chainId:'0x'+rpc.chainId.toString(16)}]);
  if(!/^0x[0-9a-f]{64}$/i.test(txHash))throw new SettlementError('invalid submission hash');
  return {txHash};
 };
 return {reader,authority,settlement,worker:new CanonicalSettlementWorker({store,settlement,authority,submitCanonical,clock})};
}

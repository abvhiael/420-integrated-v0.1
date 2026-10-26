// Explicit test-only finalized RPC transport; no live deployment/provider claim.
import {openingFixture} from './seed-openings.fixture.mjs';
import {SeedPurchases} from '../src/seed-purchases.js';
import {SeedPaymentReader} from '../src/seed-payment-reader.js';
import {word} from '../src/finalized-rpc.js';
import {selector} from '../src/keccak.js';
import {seedHash,OPENING_POLICY_HASH} from '../src/seed-opening-selection.js';
export async function purchaseFixture(options={}){
 const f=await openingFixture(options),paymentState={receipts:new Map(),missingLog:false,badLog:false,reorg:false,restricted:false},treasury='0x'+'93'.repeat(20),quoteSigner='0x'+'95'.repeat(20);
 f.rpc.contracts.seedPayments={address:'0x'+'94'.repeat(20),codeHash:seedHash(Buffer.from('6000','hex'))};
 f.identity.rpc.unrestricted=async()=>!paymentState.restricted;
 const original=f.rpc.request,encoded=(...v)=>'0x'+v.map(word).join('');
 f.rpc.request=async(method,args)=>{
  if(method==='eth_getLogs'&&args[0].address===f.rpc.contracts.seedPayments.address){const filter=args[0],p=paymentState.receipts.get(filter.topics[1]);if(!p||paymentState.missingLog)return [];return [{address:filter.address,topics:filter.topics,data:p.status==='paid'?encoded(p.intent.commitment,p.intent.pool,p.intent.amount):'0x',removed:false,blockNumber:'0x63',blockHash:'0x'+'aa'.repeat(32),transactionHash:seedHash('TEST_PAYMENT_TX'),...(paymentState.badLog?{data:encoded(999)}:{})}];}
  if(method==='eth_getBlockByNumber'&&paymentState.reorg)return {hash:'0x'+'bb'.repeat(32),number:args[0]};
  if(method==='eth_call'&&args[0].to===f.rpc.contracts.seedPayments.address){const data=args[0].data,sig=data.slice(2,10);for(const [name,v] of [['gameId()',f.identity.gameId],['policyHash()',OPENING_POLICY_HASH],['treasury()',treasury],['quoteSigner()',quoteSigner],['emergencyState()',f.rpc.contracts.emergency.address],['PRICE()','1000000000000000000']])if(sig===selector(name))return encoded(v);
   if(sig===selector('quoteValid(address,bytes32,bytes32,uint8,uint8,bytes32,bytes32)'))return encoded(1);
   if(sig===selector('receipt(bytes32)')){const p=paymentState.receipts.get('0x'+data.slice(10,74));return p?encoded(p.intent.wallet,p.status==='paid'?p.intent.commitment:0,p.status==='paid'?p.intent.pool:0,p.status==='paid'?1:2):encoded(0,0,0,0);}
  }
  return original(method,args);
 };
 f.rpc.call=async(name,data)=>({result:await f.rpc.request('eth_call',[{to:f.rpc.contracts[name].address,data},{blockHash:'0x'+'aa'.repeat(32),requireCanonical:true}])});
 const paymentReader=new SeedPaymentReader({rpc:f.rpc,gameId:f.identity.gameId,treasury,quoteSigner});
 const purchases=new SeedPurchases({packs:f.packs,reader:paymentReader,signerRpc:{request:async method=>method==='eth_chainId'?'0x1a4':'0x'+'11'.repeat(64)+'1b'},clock:()=>1000});
 const fund=async(amount=4200)=>f.store.transact(s=>{s.balances.set('alice',{available:amount,reserved:0});s.issued=amount;});
 const pay=p=>paymentState.receipts.set(p.nativeId,{intent:p,status:'paid'}),cancelPayment=p=>paymentState.receipts.set(p.nativeId,{intent:p,status:'cancelled'});
 return {...f,purchases,paymentReader,paymentState,fund,pay,cancelPayment};
}

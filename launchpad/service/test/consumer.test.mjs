import test from 'node:test';
import assert from 'node:assert/strict';
import {wordUint,wordAddress,wordHex} from '../core/abi.mjs';
import {readSale,position,checkoutContext,transactionStatus} from '../core/consumer.mjs';

const S='0x'+'11'.repeat(32),P='0x'+'22'.repeat(32),I='0x'+'33'.repeat(32),PROFILE='0x'+'44'.repeat(32);
const POLICY='0x'+'55'.repeat(32),TX='0x'+'66'.repeat(32),BLOCK='0x'+'77'.repeat(32),MERCHANT='0x000000000000000000000000000000000000c111';
const USER='0x000000000000000000000000000000000000a11c',TOKEN='0x000000000000000000000000000000000000c222';
const A={sales:'0x0000000000000000000000000000000000001002',
  allocations:'0x0000000000000000000000000000000000001003',
  crowd:'0x0000000000000000000000000000000000001004',
  project:'0x0000000000000000000000000000000000001005',
  identity:'0x0000000000000000000000000000000000001006',
  payments:'0x0000000000000000000000000000000000001007',
  resolver:'0x0000000000000000000000000000000000001008',
  invoices:'0x0000000000000000000000000000000000001009'};
const runtime={saleRegistryAddress:A.sales,allocationRegistryAddress:A.allocations,
  crowdfundingIntegrationAddress:A.crowd,projectRegistryAddress:A.project};
const w=x=>typeof x==='string'&&x.startsWith('0x')?wordHex(x):wordUint(x);
const out=(...items)=>'0x'+items.map(w).join('');
function makeRpc(){
  const data={
    'sale(bytes32)':out(P,TOKEN,MERCHANT,20,100,80,10,100,200,210,POLICY,PROFILE,12,2,1),
    'project(bytes32)':out(MERCHANT,TOKEN,PROFILE,PROFILE,1,1),
    'identity()':out(A.identity),
    'profileByParticipant(address)':out(PROFILE),
    'profiles(bytes32)':out(USER,'0x'+'0'.repeat(40),PROFILE,PROFILE,1,2,1),
    'hasValidCredential(bytes32,bytes32)':out(1),
    'profileAtSale(bytes32,address)':out(PROFILE),
    'contributed(bytes32,address)':out(10),
    'claimed(bytes32,address)':out(0),
    'refunded(bytes32,address)':out(0),
    'paymentIds(bytes32,address)':out(32,0),
    'preparedRefundCommitment(bytes32,address)':out('0x'+'0'.repeat(64)),
    'deliveryAttestation(bytes32,address)':out('0x'+'0'.repeat(64)),
    'disputeCase(bytes32,address)':out('0x'+'0'.repeat(64)),
    'paymentRegistry()':out(A.payments),
    'arbitrationCases()':out('0x0000000000000000000000000000000000001010'),
    'invoiceIdFor(bytes32,address,uint128,uint256)':out(I),
    'registeredContributionIntent(bytes32)':out(1),
    'checkoutPaymentForInvoice(bytes32)':out('0x'+'0'.repeat(64)),
    'registry()':out(A.resolver),
    'resolve(bytes32)':out(A.invoices),
    'merchantOf(bytes32)':out(MERCHANT),
    'getInvoice(bytes32)':out(PROFILE,MERCHANT,PROFILE,'0x343230',42,190,200,0,1,0,0,PROFILE,PROFILE,PROFILE,1)
  };
  let currentBlock=BLOCK,txn=null,receipt=null;
  const selector=new Map(),reverse=new Map();
  const rpc={
    data,set(signature,response){data[signature]=response;},setTransaction(t,r){txn=t;receipt=r;},reorg(){currentBlock='0x'+'88'.repeat(32);},
    async selector(sig){if(!selector.has(sig)){const v='0x'+(selector.size+1).toString(16).padStart(8,'0');selector.set(sig,v);reverse.set(v,sig);}return selector.get(sig);},
    async ethCall(_to,input){const sig=reverse.get(input.slice(0,10));if(!Object.hasOwn(data,sig))throw Error('unmocked eth_call: '+sig);return data[sig];},
    async call(method,params){
      if(method==='eth_chainId')return '0x1a4';
      if(method==='eth_getBlockByNumber')return {hash:currentBlock,number:'0x10',timestamp:'0x96'};
      if(method==='eth_getTransactionByHash')return txn;
      if(method==='eth_getTransactionReceipt')return receipt;
      if(method==='web3_sha3')return '0x'+'99'.repeat(32);
      throw Error('unmocked RPC '+method);
    }
  };
  return rpc;
}
test('sale ABI decodes authoritative project, payout, caps and status',async()=>{
  const sale=await readSale(makeRpc(),runtime,S);
  assert.equal(sale.paymentAsset,TOKEN.toLowerCase());assert.equal(sale.proceedsReceiver,MERCHANT.toLowerCase());
  assert.equal(sale.hardCap,'100');assert.equal(sale.raised,'12');assert.equal(sale.state,'ACTIVE');
});
test('participant position reads canonical capacity, identity credential and contribution history',async()=>{
  const p=await position(makeRpc(),runtime,S,USER);
  assert.equal(p.canonical,true);assert.equal(p.eligibility,'ELIGIBLE');
  assert.equal(p.remaining,'88');assert.equal(p.walletRemaining,'70');assert.equal(p.expectedClaim,'8');
  assert.deepEqual(p.history,[]);assert.equal(p.claimable,false);
  assert.equal(p.identity.profileAtSale,PROFILE);assert.equal(p.source.blockHash,BLOCK);
});
test('unregistered invoice and invalid settlement payout cannot enter canonical checkout',async()=>{
  const rpc=makeRpc();
  const base=await checkoutContext(rpc,runtime,S,USER,'42','9');
  assert.equal(base.next,'QUOTE_CONVERSION');assert.equal(base.invoiceId,I);assert.equal(base.amount,'42');
  rpc.set('registeredContributionIntent(bytes32)',out(0));
  await assert.rejects(()=>checkoutContext(rpc,runtime,S,USER,'42','9'),/unregistered payment intent/);
  rpc.set('registeredContributionIntent(bytes32)',out(1));
  rpc.set('merchantOf(bytes32)',out(USER));
  await assert.rejects(()=>checkoutContext(rpc,runtime,S,USER,'42','9'),/invoice merchant mismatches/);
});
test('checkout refuses unavailable capacity, missing eligibility, and bad invoice terms',async()=>{
  const rpc=makeRpc();
  await assert.rejects(()=>checkoutContext(rpc,runtime,S,USER,'90','9'),/exceeds canonical capacity/);
  rpc.set('hasValidCredential(bytes32,bytes32)',out(0));
  await assert.rejects(()=>checkoutContext(rpc,runtime,S,USER,'42','9'),/identity eligibility/);
  rpc.set('hasValidCredential(bytes32,bytes32)',out(1));
  rpc.set('getInvoice(bytes32)',out(PROFILE,MERCHANT,PROFILE,'0x343230',99,190,200,0,1,0,0,PROFILE,PROFILE,PROFILE,1));
  await assert.rejects(()=>checkoutContext(rpc,runtime,S,USER,'42','9'),/canonical invoice terms mismatch/);
});
test('reorg and revert are explicit transaction recovery states',async()=>{
  const rpc=makeRpc(),t={from:USER,to:A.allocations};
  rpc.setTransaction(t,null);
  assert.equal((await transactionStatus(rpc,runtime,TX,USER)).state,'PENDING');
  rpc.setTransaction(t,{status:'0x1',blockNumber:'0x10',blockHash:BLOCK,logs:[]});
  assert.equal((await transactionStatus(rpc,runtime,TX,USER)).state,'FINALIZED');
  rpc.reorg();
  assert.equal((await transactionStatus(rpc,runtime,TX,USER)).state,'REORGED');
  const bad=makeRpc();bad.setTransaction(t,{status:'0x0',blockNumber:'0x10',blockHash:BLOCK,logs:[]});
  assert.equal((await transactionStatus(bad,runtime,TX,USER)).state,'REVERTED');
});

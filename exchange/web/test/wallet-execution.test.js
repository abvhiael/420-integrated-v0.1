import test from 'node:test';
import assert from 'node:assert/strict';
import { WalletSession } from '../core/wallet-session.js';
import { preflightLimitOrderSigning, transactionFingerprint } from '../core/preflight.js';
import {
  WalletExecutionError,
  signQualifiedLimitOrder,
  submitPreflightedTransaction,
  walletTransactionGate,
  walletTypedDataGate,
} from '../core/wallet-execution.js';

const address=(n)=>'0x'+BigInt(n).toString(16).padStart(40,'0');
const id=(n)=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const txHash='0x'+'ab'.repeat(32);

function session(){
  const s=new WalletSession();
  s.connected({account:address(1),chainId:'0x420'});
  return s;
}
function transaction(){
  return {
    kind:'SWAP',
    chainId:'0x420',
    request:{from:address(1),to:address(2),data:'0x12345678',value:'0x0'},
  };
}
function preflight(tx){
  return {
    ok:true,
    kind:'SWAP',
    chainId:'0x420',
    account:address(1),
    transactionFingerprint:transactionFingerprint(tx),
    gasEstimate:'0x5208',
  };
}
class MockProvider{
  constructor(handler){this.handler=handler;this.calls=[];}
  async request(payload){this.calls.push(payload);return this.handler(payload,this.calls.length);}
}

test('transaction gate binds preflight to exact transaction, account, chain and generation',()=>{
  const s=session();
  const tx=transaction();
  const pf=preflight(tx);
  assert.deepEqual(walletTransactionGate({
    session:s,expectedChainId:'0x420',expectedGeneration:s.generation,transaction:tx,preflight:pf,
  }),{ok:true,reason:null});

  const mutated=structuredClone(tx);
  mutated.request.data='0xdeadbeef';
  assert.equal(walletTransactionGate({
    session:s,expectedChainId:'0x420',expectedGeneration:s.generation,transaction:mutated,preflight:pf,
  }).reason,'preflight-transaction-mismatch');

  const generation=s.generation;
  s.accountChanged(address(9));
  assert.notEqual(walletTransactionGate({
    session:s,expectedChainId:'0x420',expectedGeneration:generation,transaction:tx,preflight:pf,
  }).reason,null);
});

test('successful transaction submission rechecks live wallet state and uses preflight gas',async()=>{
  const s=session();
  const tx=transaction();
  const pf=preflight(tx);
  const provider=new MockProvider(({method,params})=>{
    if(method==='eth_chainId') return '0x420';
    if(method==='eth_accounts') return [address(1)];
    if(method==='eth_sendTransaction'){
      assert.equal(params[0].from,address(1));
      assert.equal(params[0].gas,'0x5208');
      assert.equal(params[0].data,tx.request.data);
      return txHash;
    }
    throw new Error('unexpected '+method);
  });
  const result=await submitPreflightedTransaction({
    provider,session:s,expectedChainId:'0x420',expectedGeneration:s.generation,transaction:tx,preflight:pf,
  });
  assert.equal(result.txHash,txHash);
  assert.equal(result.transactionFingerprint,pf.transactionFingerprint);
  assert.deepEqual(provider.calls.map(x=>x.method),['eth_chainId','eth_accounts','eth_sendTransaction']);
});

test('live account drift blocks sendTransaction',async()=>{
  const s=session();
  const tx=transaction();
  const pf=preflight(tx);
  const provider=new MockProvider(({method})=>{
    if(method==='eth_chainId') return '0x420';
    if(method==='eth_accounts') return [address(9)];
    throw new Error('send should not be reached');
  });
  await assert.rejects(
    submitPreflightedTransaction({
      provider,session:s,expectedChainId:'0x420',expectedGeneration:s.generation,transaction:tx,preflight:pf,
    }),
    (error)=>error instanceof WalletExecutionError && error.code==='ACCOUNT_MISMATCH',
  );
});

test('wallet user rejection is preserved as a structured submission error',async()=>{
  const s=session();
  const tx=transaction();
  const pf=preflight(tx);
  const provider=new MockProvider(({method})=>{
    if(method==='eth_chainId') return '0x420';
    if(method==='eth_accounts') return [address(1)];
    if(method==='eth_sendTransaction'){const e=new Error('rejected');e.code=4001;throw e;}
  });
  await assert.rejects(
    submitPreflightedTransaction({
      provider,session:s,expectedChainId:'0x420',expectedGeneration:s.generation,transaction:tx,preflight:pf,
    }),
    (error)=>error instanceof WalletExecutionError && error.code==='USER_REJECTED',
  );
});

test('invalid transaction hashes are rejected',async()=>{
  const s=session();
  const tx=transaction();
  const provider=new MockProvider(({method})=>{
    if(method==='eth_chainId') return '0x420';
    if(method==='eth_accounts') return [address(1)];
    if(method==='eth_sendTransaction') return '0x1234';
  });
  await assert.rejects(
    submitPreflightedTransaction({
      provider,session:s,expectedChainId:'0x420',expectedGeneration:s.generation,transaction:tx,preflight:preflight(tx),
    }),
    (error)=>error.code==='INVALID_TX_HASH',
  );
});

test('limit-order qualification enforces allowance, capability and expiry before signing',async()=>{
  const runtime={
    deployment:{status:'RESOLVED'},
    network:{chainId:'0x420'},
    contracts:{
      ExchangeLimitOrderSettlement420:address(50),
      ExchangeAuthorization420:address(51),
    },
  };
  const provider=new MockProvider(({method,params})=>{
    if(method==='eth_chainId') return '0x420';
    if(method==='eth_call'){
      if(params[0].to.toLowerCase()===address(5).toLowerCase()) return '0x'+(1000n).toString(16).padStart(64,'0');
      if(params[0].to.toLowerCase()===address(51).toLowerCase()) return '0x'+(1n).toString(16).padStart(64,'0');
    }
    throw new Error('unexpected '+method);
  });
  const result=await preflightLimitOrderSigning({
    provider,runtime,account:address(1),nowSeconds:1000,
    order:{sellToken:address(5),marketId:id(7),sellAmountRaw:'420',expiry:'2000'},
  });
  assert.equal(result.ok,true);
  assert.equal(result.allowance.ok,true);
  assert.equal(result.authorization.ok,true);
});

test('qualified EIP-712 limit order signs through eth_signTypedData_v4',async()=>{
  const s=session();
  const signingRequest={
    method:'eth_signTypedData_v4',
    kind:'LIMIT_ORDER',
    account:address(1),
    chainId:'0x420',
    typedData:{
      domain:{name:'420Exchange Limit Orders',version:'1',chainId:'0x420',verifyingContract:address(50)},
      types:{EIP712Domain:[],LimitOrder:[]},
      primaryType:'LimitOrder',
      message:{maker:address(1)},
    },
    order:{maker:address(1)},
  };
  const qualification={ok:true,kind:'LIMIT_ORDER',account:address(1),chainId:'0x420'};
  assert.deepEqual(walletTypedDataGate({
    session:s,expectedChainId:'0x420',expectedGeneration:s.generation,signingRequest,qualification,
  }),{ok:true,reason:null});

  const signature='0x'+'11'.repeat(65);
  const provider=new MockProvider(({method,params})=>{
    if(method==='eth_chainId') return '0x420';
    if(method==='eth_accounts') return [address(1)];
    if(method==='eth_signTypedData_v4'){
      assert.equal(params[0],address(1));
      assert.equal(JSON.parse(params[1]).domain.verifyingContract,address(50));
      return signature;
    }
    throw new Error('unexpected '+method);
  });
  const result=await signQualifiedLimitOrder({
    provider,session:s,expectedChainId:'0x420',expectedGeneration:s.generation,signingRequest,qualification,
  });
  assert.equal(result.signature,signature);
  assert.equal(result.order.maker,address(1));
});

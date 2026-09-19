import test from 'node:test';
import assert from 'node:assert/strict';
import { functionSelector, uintWord } from '../core/abi.js';
import {
  ExchangePreflightError,
  checkAllowance,
  checkAuthorization,
  classifyExchangeRevert,
  freshnessGate,
  preflightExchangeTransaction,
} from '../core/preflight.js';

const address=(n)=>'0x'+BigInt(n).toString(16).padStart(40,'0');
const id=(n)=>'0x'+BigInt(n).toString(16).padStart(64,'0');

const runtime={
  deployment:{schema:'420-exchange-testnet-runtime-v15.1',environment:'testnet',status:'RESOLVED'},
  network:{chainId:'0x420'},
  contracts:{
    ExchangeAuthorization420:address(90),
  },
};
const transaction={
  kind:'SWAP',
  chainId:'0x420',
  request:{from:address(1),to:address(100),data:'0x12345678',value:'0x0'},
};

class MockProvider {
  constructor(handler){ this.handler=handler; this.calls=[]; }
  async request(payload){ this.calls.push(payload); return this.handler(payload,this.calls.length); }
}

test('freshness gate distinguishes canonical, expired and stale intents',()=>{
  assert.deepEqual(freshnessGate({observedAt:100,expiresAt:150,nowSeconds:120,maxAgeSeconds:30}),{ok:true,reason:null});
  assert.deepEqual(freshnessGate({observedAt:100,expiresAt:110,nowSeconds:120,maxAgeSeconds:30}),{ok:false,reason:'expired'});
  assert.deepEqual(freshnessGate({observedAt:100,expiresAt:200,nowSeconds:140,maxAgeSeconds:30}),{ok:false,reason:'stale'});
});

test('allowance check compares exact raw integer values',async()=>{
  const provider=new MockProvider(({method})=>{
    assert.equal(method,'eth_call');
    return '0x'+uintWord(500n);
  });
  const result=await checkAllowance({
    provider,token:address(2),owner:address(1),spender:address(3),requiredAmountRaw:'420',
  });
  assert.equal(result.ok,true);
  assert.equal(result.allowance,'500');
  assert.equal(result.required,'420');
});

test('authorization check uses canonical ExchangeAuthorization420 read',async()=>{
  const provider=new MockProvider(({method})=>{
    assert.equal(method,'eth_call');
    return '0x'+uintWord(1n);
  });
  const result=await checkAuthorization({
    provider,
    authorizationContract:runtime.contracts.ExchangeAuthorization420,
    principal:address(1),
    action:'SWAP',
    subjectId:id(7),
    amountRaw:'1000',
  });
  assert.equal(result.ok,true);
  assert.equal(result.action,'SWAP');
});

test('successful preflight validates chain, checks policy, simulates, and estimates gas',async()=>{
  const provider=new MockProvider(({method,params})=>{
    if(method==='eth_chainId') return '0x420';
    if(method==='eth_call'){
      const to=params[0].to.toLowerCase();
      if(to===address(2).toLowerCase()) return '0x'+uintWord(1000n); // allowance
      if(to===runtime.contracts.ExchangeAuthorization420.toLowerCase()) return '0x'+uintWord(1n); // authorization
      if(to===address(50).toLowerCase()) return '0x'+uintWord(1n); // static qualification
      if(to===transaction.request.to.toLowerCase()) return '0x01'; // transaction simulation
    }
    if(method==='eth_estimateGas') return '0x5208';
    throw new Error('unexpected RPC request '+method);
  });
  const result=await preflightExchangeTransaction({
    provider,transaction,runtime,
    freshness:{observedAt:100,expiresAt:160,nowSeconds:120,maxAgeSeconds:30},
    allowanceChecks:[{token:address(2),owner:address(1),spender:address(3),requiredAmountRaw:'420'}],
    authorizationChecks:[{principal:address(1),action:'SWAP',subjectId:id(7),amountRaw:'420'}],
    staticCalls:[{to:address(50),data:'0x12345678',label:'bridge-qualification'}],
  });
  assert.equal(result.ok,true);
  assert.equal(result.chainId,'0x420');
  assert.equal(result.gasEstimate,'0x5208');
  assert.equal(result.allowances[0].ok,true);
  assert.equal(result.authorizations[0].ok,true);
  assert.equal(result.staticCalls[0].ok,true);
});

test('preflight fails closed on RPC chain mismatch before simulation',async()=>{
  const provider=new MockProvider(({method})=>method==='eth_chainId'?'0x1':'0x');
  await assert.rejects(
    preflightExchangeTransaction({provider,transaction,runtime}),
    (error)=>error instanceof ExchangePreflightError && error.code==='CHAIN_MISMATCH',
  );
});

test('preflight fails closed when reviewed intent is stale',async()=>{
  const provider=new MockProvider(({method})=>method==='eth_chainId'?'0x420':'0x');
  await assert.rejects(
    preflightExchangeTransaction({
      provider,transaction,runtime,
      freshness:{observedAt:100,expiresAt:200,nowSeconds:150,maxAgeSeconds:20},
    }),
    (error)=>error instanceof ExchangePreflightError && error.code==='STALE_INTENT',
  );
});

test('preflight fails closed on insufficient allowance before transaction simulation',async()=>{
  const provider=new MockProvider(({method,params})=>{
    if(method==='eth_chainId') return '0x420';
    if(method==='eth_call' && params[0].to.toLowerCase()===address(2).toLowerCase()) return '0x'+uintWord(10n);
    throw new Error('simulation should not be reached');
  });
  await assert.rejects(
    preflightExchangeTransaction({
      provider,transaction,runtime,
      allowanceChecks:[{token:address(2),owner:address(1),spender:address(3),requiredAmountRaw:'420'}],
    }),
    (error)=>error instanceof ExchangePreflightError && error.code==='INSUFFICIENT_ALLOWANCE',
  );
});

test('preflight fails closed when ExchangeAuthorization420 denies capability',async()=>{
  const provider=new MockProvider(({method,params})=>{
    if(method==='eth_chainId') return '0x420';
    if(method==='eth_call' && params[0].to.toLowerCase()===runtime.contracts.ExchangeAuthorization420.toLowerCase()) return '0x'+uintWord(0n);
    throw new Error('simulation should not be reached');
  });
  await assert.rejects(
    preflightExchangeTransaction({
      provider,transaction,runtime,
      authorizationChecks:[{principal:address(1),action:'SWAP',subjectId:id(7),amountRaw:'420'}],
    }),
    (error)=>error instanceof ExchangePreflightError && error.code==='UNAUTHORIZED',
  );
});

test('simulation custom errors are decoded into Exchange signatures',async()=>{
  const unauthorized=functionSelector('UnauthorizedSwap()');
  const provider=new MockProvider(({method})=>{
    if(method==='eth_chainId') return '0x420';
    if(method==='eth_call'){
      const error=new Error('execution reverted');
      error.data=unauthorized;
      throw error;
    }
    throw new Error('gas estimation should not be reached');
  });
  await assert.rejects(
    preflightExchangeTransaction({provider,transaction,runtime}),
    (error)=>{
      assert.equal(error.code,'SIMULATION_REVERTED');
      assert.equal(error.details.revert.signature,'UnauthorizedSwap()');
      assert.equal(error.details.revert.selector,unauthorized);
      return true;
    },
  );
});

test('known custom revert classifier is deterministic',()=>{
  const selector=functionSelector('SlippageExceeded()');
  const error=new Error('reverted');
  error.data=selector;
  const decoded=classifyExchangeRevert(error);
  assert.equal(decoded.kind,'CUSTOM_ERROR');
  assert.equal(decoded.signature,'SlippageExceeded()');
  assert.equal(decoded.message,'SlippageExceeded()');
});

test('gas estimation failure remains a hard preflight blocker',async()=>{
  const provider=new MockProvider(({method})=>{
    if(method==='eth_chainId') return '0x420';
    if(method==='eth_call') return '0x';
    if(method==='eth_estimateGas') throw new Error('estimate unavailable');
  });
  await assert.rejects(
    preflightExchangeTransaction({provider,transaction,runtime}),
    (error)=>error instanceof ExchangePreflightError && error.code==='GAS_ESTIMATE_FAILED',
  );
});

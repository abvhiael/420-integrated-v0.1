import test from 'node:test';
import assert from 'node:assert/strict';
import { qualifyLiveTestnetSwap, LiveSwapQualificationError } from '../core/live-swap-qualification.js';
import { uintWord } from '../core/abi.js';

const address=(n)=>'0x'+BigInt(n).toString(16).padStart(40,'0');
const id=(n)=>'0x'+BigInt(n).toString(16).padStart(64,'0');
const txHash='0x'+'ab'.repeat(32);
const blockHash='0x'+'cd'.repeat(32);

const runtime={
  deployment:{environment:'testnet',status:'RESOLVED'},
  network:{chainId:'0x420'},
  contracts:{
    ExchangeAtomicRouter420:address(100),
    ExchangeAuthorization420:address(101),
  },
};

const reviewedIntent={
  kind:'EXACT_INPUT_PATH',
  recipient:address(1),
  inputToken:address(2),
  routeCommitment:id(90),
  hops:[{marketId:id(10),outputToken:address(3)}],
};
const execution={
  mode:'ERC20_TO_ERC20',
  tokenIn:address(2),
  recipient:address(1),
  amountInRaw:'1000',
  minFinalAmountOutRaw:'900',
  expectedPathHash:id(90),
  hops:[{marketId:id(10),routeId:id(11),tokenOut:address(3),minAmountOutRaw:'900',routeData:'0x'}],
};

class Provider{
  constructor({reorg=false,reverted=false}={}){this.calls=[];this.reorg=reorg;this.reverted=reverted;}
  async request({method,params=[]}){
    this.calls.push({method,params});
    if(method==='eth_accounts') return [address(1)];
    if(method==='eth_chainId') return '0x420';
    if(method==='eth_call') return '0x';
    if(method==='eth_estimateGas') return '0x10000';
    if(method==='eth_sendTransaction') return txHash;
    if(method==='eth_getTransactionByHash') return {hash:txHash};
    if(method==='eth_getTransactionReceipt') return {
      transactionHash:txHash,
      blockHash,
      blockNumber:'0xa',
      status:this.reverted?'0x0':'0x1',
      gasUsed:'0x9000',
      cumulativeGasUsed:'0x9000',
      logs:[],
    };
    if(method==='eth_getBlockByNumber'){
      if(params[0]==='latest') return {number:'0xf',hash:'0x'+'11'.repeat(32)};
      if(params[0]==='safe') return {number:'0xc',hash:'0x'+'22'.repeat(32)};
      if(params[0]==='finalized') return {number:'0xa',hash:'0x'+'33'.repeat(32)};
      if(params[0]==='0xa') return {number:'0xa',hash:this.reorg?'0x'+'ef'.repeat(32):blockHash};
    }
    throw new Error('unexpected RPC '+method);
  }
}

test('V15.6 qualifies a live swap only after finality and V13 canonical reconciliation',async()=>{
  const provider=new Provider();
  const exchangeClient={
    async history({kind}){
      return kind==='TRADE'
        ? {records:[{recordId:'trade-1',subjectId:'m1',kind:'TRADE',txHash,active:true}],nextCursor:''}
        : {records:[],nextCursor:''};
    },
  };
  const result=await qualifyLiveTestnetSwap({
    provider,
    runtime,
    reviewedIntent,
    execution,
    freshness:{observedAt:100,expiresAt:200,nowSeconds:120,maxAgeSeconds:30},
    exchangeClient,
    subjectId:'m1',
    targetState:'FINALIZED',
    maxAttempts:1,
    pollIntervalMs:0,
  });
  assert.equal(result.qualified,true);
  assert.equal(result.finalState,'FINALIZED');
  assert.equal(result.indexedStatus,'CANONICAL');
  assert.equal(result.indexedReconciled,true);
  assert.equal(result.txHash,txHash);
  assert.ok(provider.calls.some((x)=>x.method==='eth_sendTransaction'));
  assert.ok(provider.calls.some((x)=>x.method==='eth_getTransactionReceipt'));
});

test('V15.6 rejects unresolved or non-testnet runtime',async()=>{
  await assert.rejects(
    qualifyLiveTestnetSwap({
      provider:new Provider(),
      runtime:{...runtime,deployment:{environment:'testnet',status:'UNRESOLVED_UNTIL_DEPLOYMENT'}},
      reviewedIntent,execution,maxAttempts:1,pollIntervalMs:0,
    }),
    (error)=>error instanceof LiveSwapQualificationError&&error.code==='TESTNET_RUNTIME_REQUIRED',
  );
});

test('V15.6 fails qualification when canonical inclusion is reorged',async()=>{
  await assert.rejects(
    qualifyLiveTestnetSwap({
      provider:new Provider({reorg:true}),
      runtime,reviewedIntent,execution,
      freshness:{observedAt:100,expiresAt:200,nowSeconds:120,maxAgeSeconds:30},
      exchangeClient:{async history(){return {records:[],nextCursor:''};}},
      targetState:'FINALIZED',maxAttempts:1,pollIntervalMs:0,
    }),
    (error)=>error instanceof LiveSwapQualificationError&&error.code==='SWAP_FAILED'&&error.details.lifecycle.rpc.state==='REORGED',
  );
});

test('V15.6 fails qualification on reverted receipt',async()=>{
  await assert.rejects(
    qualifyLiveTestnetSwap({
      provider:new Provider({reverted:true}),
      runtime,reviewedIntent,execution,
      freshness:{observedAt:100,expiresAt:200,nowSeconds:120,maxAgeSeconds:30},
      exchangeClient:{async history(){return {records:[],nextCursor:''};}},
      targetState:'FINALIZED',maxAttempts:1,pollIntervalMs:0,
    }),
    (error)=>error instanceof LiveSwapQualificationError&&error.code==='SWAP_FAILED'&&error.details.lifecycle.rpc.state==='REVERTED',
  );
});

test('V15.6 surfaces V13/RPC conflict instead of qualifying',async()=>{
  const provider=new Provider();
  const exchangeClient={
    async history({kind}){
      return kind==='TRADE'
        ? {records:[{recordId:'old',subjectId:'m1',kind:'TRADE',txHash,active:false,replacedBy:'new'}],nextCursor:''}
        : {records:[],nextCursor:''};
    },
  };
  await assert.rejects(
    qualifyLiveTestnetSwap({
      provider,runtime,reviewedIntent,execution,
      freshness:{observedAt:100,expiresAt:200,nowSeconds:120,maxAgeSeconds:30},
      exchangeClient,targetState:'FINALIZED',maxAttempts:1,pollIntervalMs:0,
    }),
    (error)=>error instanceof LiveSwapQualificationError&&error.code==='INDEXER_CONFLICT',
  );
});

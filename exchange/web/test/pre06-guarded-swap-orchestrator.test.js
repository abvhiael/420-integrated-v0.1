import test from 'node:test';
import assert from 'node:assert/strict';
import {uintWord} from '../core/abi.js';
import {BrowserExecutionController} from '../core/browser-execution-controller.js';
import {buildSwapAuthorizationReview,GuardedSwapOrchestrator} from '../core/guarded-swap-orchestrator.js';
import {WalletExecutionError} from '../core/wallet-execution.js';
import {authenticatedFixture,runtimeForAuth,vector} from './authenticated-quote-fixture.js';

const txHash='0x'+'ab'.repeat(32);
const authAddress='0x'+'77'.repeat(20);

class MockProvider{
  constructor(handler){this.handler=handler;this.calls=[];this.listeners=new Map();}
  on(name,cb){this.listeners.set(name,cb);}
  removeListener(name,cb){if(this.listeners.get(name)===cb)this.listeners.delete(name);}
  async request(payload){this.calls.push(payload);return this.handler(payload,this.calls);}
}
function runtime(){
  const base=runtimeForAuth();
  return {...base,contracts:{...base.contracts,ExchangeAuthorization420:authAddress}};
}
function basicProvider({estimate=()=> '0x5208',send=()=>txHash}={}){
  return new MockProvider(({method,params})=>{
    if(method==='eth_requestAccounts'||method==='eth_accounts')return [vector.request.account];
    if(method==='eth_chainId')return vector.chainId;
    if(method==='eth_call'){
      if(params?.[0]?.to?.toLowerCase()===vector.request.tokenIn.toLowerCase())return '0x'+uintWord(10n**30n);
      if(params?.[0]?.to?.toLowerCase()===authAddress.toLowerCase())return '0x'+uintWord(1n);
      return '0x01';
    }
    if(method==='eth_estimateGas')return estimate();
    if(method==='eth_sendTransaction')return send(params?.[0]);
    throw new Error('unexpected '+method);
  });
}
async function setup({submissionGate,lifecycleInspector,provider=basicProvider()}={}){
  const rt=runtime();
  const trusted=await authenticatedFixture({runtime:rt});
  const controller=new BrowserExecutionController({runtime:rt});
  await controller.connect({ethereum:provider});
  const clock=()=>1001;
  const orchestrator=new GuardedSwapOrchestrator({controller,nowSeconds:clock,submissionGate,lifecycleInspector});
  orchestrator.prepare({trustedQuote:trusted});
  return {rt,trusted,controller,orchestrator,provider};
}
function allowanceReview(trusted){
  return buildSwapAuthorizationReview({
    mode:'ALLOWANCE',owner:vector.request.account,token:vector.request.tokenIn,spender:vector.spender,amountRaw:vector.request.amountInRaw,
  });
}
async function confirmAndPreflight(env,{authorization=false}={}){
  const review=authorization?allowanceReview(env.trusted):buildSwapAuthorizationReview();
  env.orchestrator.beginReview({authorizationReview:review});
  const displayed=structuredClone(env.orchestrator.bound.projection);
  env.orchestrator.confirm({
    displayed,
    confirmedFingerprint:env.orchestrator.bound.review.transactionFingerprint,
    authorizationFingerprint:authorization?review.fingerprint:null,
  });
  const allowanceChecks=authorization?[{
    token:review.token,owner:review.owner,spender:review.spender,requiredAmountRaw:review.amountRaw,
  }]:[];
  return env.orchestrator.preflightSwap({allowanceChecks});
}

test('PRE-06 composes authenticated quote -> review -> explicit confirmation -> fresh preflight but default gate prevents wallet send',async()=>{
  const env=await setup();
  await confirmAndPreflight(env);
  assert.equal(env.orchestrator.state,'PREFLIGHTED');
  await assert.rejects(env.orchestrator.submit(),error=>error instanceof WalletExecutionError&&error.code==='LIVE_SUBMISSION_DISABLED');
  assert.equal(env.provider.calls.some(call=>call.method==='eth_sendTransaction'),false);
  assert.equal(env.orchestrator.state,'PREFLIGHTED');
  env.orchestrator.dispose();env.controller.dispose();
});

test('approval/permit authority is reviewed and confirmed separately from the swap',async()=>{
  const env=await setup();
  const review=allowanceReview(env.trusted);
  env.orchestrator.beginReview({authorizationReview:review});
  const displayed=structuredClone(env.orchestrator.bound.projection);
  assert.throws(()=>env.orchestrator.confirm({
    displayed,confirmedFingerprint:env.orchestrator.bound.review.transactionFingerprint,
  }),error=>error.code==='AUTHORIZATION_CONFIRMATION_REQUIRED');
  env.orchestrator.confirm({
    displayed,confirmedFingerprint:env.orchestrator.bound.review.transactionFingerprint,authorizationFingerprint:review.fingerprint,
  });
  await assert.rejects(
    env.orchestrator.preflightSwap({allowanceChecks:[{...review,requiredAmountRaw:'1'}]}),
    error=>error.code==='AUTHORIZATION_REVIEW_MISMATCH',
  );
  env.orchestrator.dispose();env.controller.dispose();
});

test('fresh submit-boundary preflight supersedes stale gas estimate and tx hash is only SUBMITTED, never settlement',async()=>{
  let estimates=0,sent=null;
  const provider=basicProvider({
    estimate:()=>++estimates===1?'0x5208':'0x6000',
    send:request=>{sent=request;return txHash;},
  });
  const env=await setup({provider,submissionGate:{enabled:true,mode:'PRE06_MOCK'}});
  const first=await confirmAndPreflight(env);
  assert.equal(first.gasEstimate,'0x5208');
  const submission=await env.orchestrator.submit();
  assert.equal(submission.txHash,txHash);
  assert.equal(sent.gas,'0x6000');
  assert.equal(env.orchestrator.state,'SUBMITTED');
  assert.notEqual(env.orchestrator.state,'CONFIRMED');
  env.orchestrator.dispose();env.controller.dispose();
});

test('wallet rejection and stale nonce remain structured submit failures',async()=>{
  for(const [errorFactory,expected] of [
    [()=>Object.assign(new Error('rejected'),{code:4001}),'USER_REJECTED'],
    [()=>Object.assign(new Error('nonce too low'),{code:-32000}),'STALE_NONCE'],
  ]){
    const provider=basicProvider({send:()=>{throw errorFactory();}});
    const env=await setup({provider,submissionGate:{enabled:true,mode:'PRE06_MOCK'}});
    await confirmAndPreflight(env);
    await assert.rejects(env.orchestrator.submit(),error=>error.code===expected);
    assert.equal(env.orchestrator.state,'PREFLIGHTED');
    env.orchestrator.dispose();env.controller.dispose();
  }
});

test('wallet/session invalidation actively destroys a pending review',async()=>{
  const env=await setup();
  env.orchestrator.beginReview();
  env.provider.listeners.get('accountsChanged')?.(['0x'+'22'.repeat(20)]);
  assert.equal(env.orchestrator.state,'INVALIDATED');
  assert.throws(()=>env.orchestrator.confirm({}),error=>error.code==='REVIEW_INVALIDATED');
  env.orchestrator.dispose();env.controller.dispose();
});

test('lifecycle integration exposes pending, replacement, reorg, indexer delay/conflict and bounded timeout deterministically',async()=>{
  let scenario='PENDING';
  const lifecycleInspector=async()=> {
    if(scenario==='PENDING')return {rpc:{state:'PENDING'},indexed:{status:'UNINDEXED',reconciled:false,conflicts:[],replacementRecordIds:[]}};
    if(scenario==='REPLACED')return {rpc:{state:'DROPPED'},indexed:{status:'REORGED',reconciled:false,conflicts:[],replacementRecordIds:['replacement-1']}};
    if(scenario==='REORGED')return {rpc:{state:'REORGED'},indexed:{status:'REORGED',reconciled:false,conflicts:[],replacementRecordIds:[]}};
    if(scenario==='DELAYED')return {rpc:{state:'FINALIZED'},indexed:{status:'UNINDEXED',reconciled:false,conflicts:[],replacementRecordIds:[]}};
    if(scenario==='CONFLICT')return {rpc:{state:'FINALIZED'},indexed:{status:'REORGED',reconciled:false,conflicts:['rpc-canonical-v13-reorg'],replacementRecordIds:[]}};
    return {rpc:{state:'FINALIZED'},indexed:{status:'CANONICAL',reconciled:true,conflicts:[],replacementRecordIds:[]}};
  };
  const env=await setup({submissionGate:{enabled:true,mode:'PRE06_MOCK'},lifecycleInspector});
  await confirmAndPreflight(env);
  await env.orchestrator.submit();

  assert.equal((await env.orchestrator.observeLifecycle()).state,'PENDING');
  await assert.rejects(env.orchestrator.waitForLifecycle({maxAttempts:2,sleep:async()=>{}}),error=>error.code==='LIFECYCLE_TIMEOUT');

  scenario='REPLACED';
  assert.equal((await env.orchestrator.observeLifecycle()).state,'REPLACED');
  scenario='REORGED';
  assert.equal((await env.orchestrator.observeLifecycle()).state,'REORGED');
  scenario='DELAYED';
  assert.equal((await env.orchestrator.observeLifecycle({exchangeClient:{}})).state,'INDEXER_DELAYED');
  scenario='CONFLICT';
  assert.equal((await env.orchestrator.observeLifecycle({exchangeClient:{}})).state,'INDEXER_CONFLICTING');
  scenario='CONFIRMED';
  assert.equal((await env.orchestrator.observeLifecycle({exchangeClient:{}})).state,'CONFIRMED');
  env.orchestrator.dispose();env.controller.dispose();
});

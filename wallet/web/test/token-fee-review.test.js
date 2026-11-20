import test from 'node:test';
import assert from 'node:assert/strict';
import {TOKEN_TEMPLATES_420,createTokenDiscoverySession420,createTokenCatalogue420,
  createERC20Wizard420,createERC721Wizard420,createERC1155Wizard420,createTokenFeeReview420} from '../core/token-app.js';
import {TOKEN_CREATION_FEE_WEI_420} from '../core/token-runtime.js';
import {encodeExecute} from '../core/abi.js';
import {tokenHashHex420,tokenReadCall420} from '../core/token-sdk.js';
import {connected} from './token-connected-fixture.js';
import {controller,account,addr,digest,abi,serviceHash} from './token-test-fixture.js';
const fixed=TOKEN_TEMPLATES_420[0],wei=TOKEN_CREATION_FEE_WEI_420;
const start=(session,f)=>session.refresh({provider:f.provider,config:f.config,controller,smartAccount:f.selected});
async function setup(profile=fixed){
  const f=connected(),session=createTokenDiscoverySession420(),catalogue=createTokenCatalogue420(session);
  const factory={ERC20:createERC20Wizard420,ERC721:createERC721Wizard420,ERC1155:createERC1155Wizard420}[profile.standard];
  const wizard=factory(catalogue,session,{salt:()=>digest(5)}),review=createTokenFeeReview420(wizard,session);
  assert.equal((await start(session,f)).status,'verified');assert.equal(await catalogue.select(profile.key),true);
  if(profile.standard==='ERC20'){wizard.setField('name','Token');wizard.setField('symbol','TOK');wizard.setField('supply','12.000000000000000001');if(profile.capped)wizard.setField('cap','20');}
  if(profile.standard==='ERC721'){wizard.setField('name','Collection');wizard.setField('symbol','NFT');wizard.setField('baseURI','ipfs://example/metadata.json');}
  if(profile.standard==='ERC1155')wizard.setField('uri','ipfs://example/{id}.json');
  const draft=await wizard.review();assert.ok(draft);
  return {f,session,catalogue,wizard,review,draft,dispose(){review.dispose();wizard.dispose();catalogue.dispose();}};
}
test('all eight profiles review exact native creation fee and controller gas, simulate real canonical execute envelope, explicitly authorize without sending',async()=>{
  for(const profile of TOKEN_TEMPLATES_420){
    const x=await setup(profile),{f,review,draft}=x;
    assert.equal(await review.authorize(null),null);
    const q=await review.simulate();assert.ok(q,review.getSnapshot().error);
    assert.equal(q.authority,'SIMULATED_REVIEW_ONLY');assert.equal(q.simulationPassed,true);assert.equal(review.getSnapshot().authorization,null);
    assert.equal(q.creationFeeWei,wei.toString());assert.equal(q.gasUnits,'1048576');assert.equal(q.gasPriceWei,'1000000000');
    assert.equal(q.estimatedGasWei,'1048576000000000');assert.equal(q.estimatedTotalWei,(wei+1048576000000000n).toString());
    assert.equal(q.smartAccount,account);assert.equal(q.controller,controller);assert.equal(q.chainId,420);
    assert.deepEqual(q.transaction,{from:controller,to:account,value:'0x0',data:encodeExecute(draft.request.target,wei,draft.request.data)});
    assert.equal(q.executionHash,tokenHashHex420(q.transaction.data));assert.equal(q.templateId,profile.id);
    assert.equal(q.configHash,draft.request.configHash);assert.equal(q.calldataHash,draft.request.calldataHash);
    assert.equal(q.communityTreasuryVault,f.binding.communityTreasuryVault.address);assert.equal(q.predictedAddress,addr(77));
    assert.equal(q.authorizationEpoch,'1');assert.equal(q.creatorNonce,'0');assert.equal(q.simulationBlock.number,'0x10');
    assert.equal(await review.authorize({...q}),null);
    const auth=await review.authorize(q);assert.ok(auth,review.getSnapshot().error);
    assert.equal(auth.authority,'EXPLICIT_TOKEN_CREATION_AUTHORIZATION');assert.equal(auth.submitted,false);
    assert.equal(auth.maxGasWei,q.estimatedGasWei);assert.equal(auth.maxTotalWei,q.estimatedTotalWei);
    assert.equal(auth.review.calldataHash,q.calldataHash);assert.equal(await review.authorize(auth.review),null);
    assert.ok(Object.isFrozen(auth)&&Object.isFrozen(auth.review)&&Object.isFrozen(auth.review.transaction));
    const estimates=f.calls.filter(([m])=>m==='eth_estimateGas');assert.equal(estimates.length,2);
    for(const [,args] of estimates)assert.deepEqual(args,[q.transaction,'0x10']);
    assert.equal(f.calls.filter(([m,args])=>m==='eth_call'&&args[0].data===q.transaction.data&&args[1]==='0x10').length,2);
    assert.ok(f.calls.every(([m])=>['eth_accounts','eth_chainId','eth_getBlockByNumber','eth_getCode','eth_call','eth_estimateGas','eth_gasPrice','eth_getBalance'].includes(m)));
    x.dispose();
  }
});
test('simulation revert, estimate failure, malformed ABI address, gas estimates and fee overflow block authorization',async()=>{
  for(const mutate of [
    f=>{f.control.simulationError='revert'},f=>{f.control.estimateError='estimate failure'},f=>{f.control.simulationResult='0x'},
    f=>{f.control.simulationResult=abi(32,32,addr(0))},f=>{f.control.simulationResult=abi(32,31,addr(77))},
    f=>{f.control.simulationResult=abi(32,32,account)},f=>{f.control.gasEstimate='0x0'},f=>{f.control.gasEstimate='0x01'},
    f=>{f.control.gasPrice='0xZ'},f=>{f.control.gasPrice='0x'+'f'.repeat(64)},f=>{f.control.smartBalance='0x01'},
  ]){
    const x=await setup();mutate(x.f);
    assert.equal(await x.review.simulate(),null);assert.ok(x.review.getSnapshot().error);
    assert.equal(x.review.getSnapshot().quote,null);assert.equal(await x.review.authorize(null),null);x.dispose();
  }
});
test('insufficient balances separately reject SmartAccount creation fee and controller gas; zero gas price is supported',async()=>{
  for(const [key,message] of [['smartBalance',/Insufficient SmartAccount/],['controllerBalance',/Insufficient controller/]]){
    const x=await setup();x.f.control[key]='0x0';
    assert.equal(await x.review.simulate(),null);assert.match(x.review.getSnapshot().error,message);x.dispose();
  }
  const x=await setup();x.f.control.gasPrice='0x0';x.f.control.controllerBalance='0x0';x.f.control.smartBalance='0x'+wei.toString(16);
  const q=await x.review.simulate();assert.ok(q,x.review.getSnapshot().error);assert.equal(q.estimatedTotalWei,wei.toString());assert.ok(await x.review.authorize(q));x.dispose();
});
test('changed gas estimate, price, creator nonce or predicted address requires another explicit review gesture',async()=>{
  for(const mutate of [f=>{f.control.gasPrice='0x77359400'},f=>{f.control.gasEstimate='0x200000'},f=>{f.control.creatorNonce=1},f=>{f.control.simulationResult=abi(32,32,addr(78))}]){
    const x=await setup(),q=await x.review.simulate();assert.ok(q,x.review.getSnapshot().error);mutate(x.f);
    assert.equal(await x.review.authorize(q),null);const state=x.review.getSnapshot();assert.match(state.error,/Review changed/);
    assert.equal(state.authorization,null);assert.ok(state.quote);assert.notEqual(state.quote,q);
    assert.equal(await x.review.authorize(q),null);assert.ok(await x.review.authorize(state.quote));x.dispose();
  }
});
test('governance revocation, wrong chain, selected controller, owner, epoch, policy or prior block reorg deny authorization',async()=>{
  for(const mutate of [
    f=>f.enable(fixed,false),
    f=>f.set(f.binding.registry.address,'getService(bytes32)',abi(f.binding.factory.address,f.binding.factory.codeHash,f.binding.release.metadataHash,1,1000,0),['bytes32'],[serviceHash]),
    f=>{f.tokenControl.chain='0x1'},f=>{f.control.accounts=[addr(88)]},f=>{f.control.owner=addr(88)},
    f=>{f.control.epoch=2},f=>{f.control.policyVersion=2},f=>{f.tokenControl.canonicalHash=digest(9)},
    f=>{f.control.accountDeployed=false},f=>{f.control.smartBalance='0x0'}
  ]){
    const x=await setup(),q=await x.review.simulate();assert.ok(q,x.review.getSnapshot().error);mutate(x.f);
    assert.equal(await x.review.authorize(q),null);assert.match(x.review.getSnapshot().error,/Authorization rejected/);
    assert.equal(x.review.getSnapshot().quote,null);assert.equal(x.review.getSnapshot().authorization,null);x.dispose();
  }
});
test('mid-simulation governance, epoch or selected account change invalidates the quote',async()=>{
  for(const mutate of [f=>f.enable(fixed,false),f=>{f.control.epoch=2},f=>{f.control.accounts=[]},f=>{f.tokenControl.canonicalHash=digest(9)}]){
    const x=await setup();x.f.control.onEstimate=()=>mutate(x.f);
    assert.equal(await x.review.simulate(),null);assert.ok(x.review.getSnapshot().error);x.dispose();
  }
});
test('normal chain advancement preserves canonical simulation block; changed creator nonce between blocks fails closed',async()=>{
  for(const changed of [false,true]){
    const x=await setup(),f=x.f;let advanced=false;
    const orig=f.provider.request;
    f.provider.request=async(method,args=[])=>{
      if(method==='eth_getBlockByNumber'&&(args[0]==='0x11'||(args[0]==='latest'&&advanced)))return {number:'0x11',hash:digest(112)};
      if(method==='eth_call'&&args[0].data===tokenReadCall420('creatorNonce(address)',['address'],[account]))return abi(changed&&args[1]==='0x11'?1:0);
      if(args[1]==='0x11')args=[args[0],'0x10',...args.slice(2)];
      return orig(method,args);
    };
    f.control.onEstimate=()=>{advanced=true;};
    const q=await x.review.simulate();
    if(changed){assert.equal(q,null);assert.match(x.review.getSnapshot().error,/nonce changed/);}
    else{assert.ok(q,x.review.getSnapshot().error);assert.equal(q.simulationBlock.number,'0x10');assert.equal(q.verificationBlock.number,'0x11');}
    x.dispose();
  }
});
test('edits, reset, selecting another profile, refresh or cancel remove quote and explicit authorization',async()=>{
  for(const action of ['edit','reset','select','refresh','cancel','disconnect']){
    const x=await setup(),q=await x.review.simulate();assert.ok(await x.review.authorize(q));
    if(action==='edit')x.wizard.setField('symbol','EDIT');
    if(action==='reset')x.wizard.reset();
    if(action==='select')await x.catalogue.select('ERC721_COLLECTION');
    if(action==='refresh')await x.catalogue.refresh();
    if(action==='cancel')x.review.cancel();
    if(action==='disconnect')x.session.invalidate();
    assert.equal(x.review.getSnapshot().quote,null);assert.equal(x.review.getSnapshot().authorization,null);
    assert.equal(await x.review.authorize(q),null);x.dispose();
  }
});
test('concurrent simulation and authorization cannot resurrect a stale quote or approval',async()=>{
  for(const mode of ['simulate','authorize']){
    for(const action of ['edit','disconnect','cancel','dispose']){
      const x=await setup(),q=mode==='authorize'?await x.review.simulate():null;
      let release;const gate=new Promise(r=>{release=r}),original=x.f.provider.request;
      x.f.provider.request=async(...a)=>{await gate;return original(...a);};
      const pending=mode==='authorize'?x.review.authorize(q):x.review.simulate();
      assert.equal(x.review.getSnapshot().busy,true);
      assert.equal(await x.review.simulate(),null);assert.equal(await x.review.authorize(q),null);
      if(action==='edit')x.wizard.setField('symbol','EDIT');
      if(action==='disconnect')x.session.invalidate();
      if(action==='cancel')x.review.cancel();
      if(action==='dispose')x.review.dispose();
      release();assert.equal(await pending,null);assert.equal(x.review.getSnapshot().authorization,null);assert.equal(x.review.getSnapshot().quote,null);x.dispose();
    }
  }
});
test('host review rejects forged draft binding/fee/target or stale snapshot before any simulation',async()=>{
  const x=await setup(),{f,session,draft}=x;
  for(const patch of [{owner:addr(9)},{controller:addr(9)},{chainId:1},{environment:'mainnet'},{authority:'APPROVED'},
    {request:{...draft.request,value:wei+1n}},{request:{...draft.request,target:addr(9)}},
    {request:{...draft.request,data:'0x'}},{request:{...draft.request,configHash:digest(9)}},
    {verificationBlock:{number:'0x10',hash:digest(9)}}]){
    await assert.rejects(session.simulateCurrent({...draft,...patch}));
  }
  assert.equal(f.calls.filter(([m])=>m==='eth_estimateGas').length,0);
  const snapshot=session.getSnapshot();session.invalidate();
  await assert.rejects(session.simulateCurrent(draft,snapshot),/context unavailable/);x.dispose();
});

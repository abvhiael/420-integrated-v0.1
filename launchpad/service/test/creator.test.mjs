import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeCampaignDraft,prepareCampaignRequest,creatorLifecycle,MODES} from '../core/creator.mjs';
import {wordHex,wordUint} from '../core/abi.mjs';
const CONTROLLER='0x000000000000000000000000000000000000c111';
const ASSET='0x000000000000000000000000000000000000c222';
const PAY='0x000000000000000000000000000000000000c333';
const B32='0x'+'aa'.repeat(32),ISSUE='0x'+'bb'.repeat(32),SALE_ID='0x'+'cc'.repeat(32),PROJECT_ID='0x'+'dd'.repeat(32);
const rt={chainId:'0x1a4',launchpadRouterAddress:'0x0000000000000000000000000000000000001001',
  projectRegistryAddress:'0x0000000000000000000000000000000000001002',
  saleRegistryAddress:'0x0000000000000000000000000000000000001003',
  crowdfundingIntegrationAddress:'0x0000000000000000000000000000000000001004'};
const raw=(...v)=>'0x'+v.map(x=>typeof x==='string'&&x.startsWith('0x')?wordHex(x):wordUint(x)).join('');
function draft(mode='REWARD'){
  return {title:'A genuine project',summary:'Building a community launch',description:'Detailed and public product scope.',
    website:'https://example.org',mode,controller:CONTROLLER,saleAsset:ASSET,paymentAsset:PAY,
    proceedsReceiver:CONTROLLER,softCap:'10',hardCap:'100',perWalletCap:'20',tokenAllocation:'200',
    startsAt:'2000000000',endsAt:'2000001000',claimStartsAt:'2000001000',
    eligibilityPolicyHash:B32,issuanceCommitment:ISSUE,
    rewardTiers:mode==='REWARD'||mode==='PRODUCT_PREORDER'?
      [{name:'First supporters',description:'Early supporter reward',price:'5',quantity:'20'}]:[],
    milestones:mode==='COMMUNITY_PROJECT'?['Research','Deliver']:[],
    productPreorder:mode==='PRODUCT_PREORDER'?{productName:'Prototype',terms:'The first edition ships as pictured.',
      shippingRegions:'Canada',estimatedDeliveryAt:2000010000,refundPolicy:'Refunds under published conditions'}:null};
}
function rpc(){
  const sel=new Map(),reverse=new Map(),calls=[];
  return {calls,async selector(sig){
    if(!sel.has(sig)){const s='0x'+(sel.size+1).toString(16).padStart(8,'0');sel.set(sig,s);reverse.set(s,sig);}return sel.get(sig);
  },
  async ethCall(to,data){
    const sig=reverse.get(data.slice(0,10));calls.push({to,sig,data});
    if(sig==='canonicalId(address,address,bytes32,bytes32)')return raw(PROJECT_ID);
    if(sig==='canonicalId(bytes32,address,address,uint128,uint128,uint128,uint128,uint64,uint64,uint64,bytes32,bytes32)')return raw(SALE_ID);
    if(sig==='sale(bytes32)')return raw(PROJECT_ID,PAY,CONTROLLER,10,100,20,200,2000000000,2000001000,2000001000,B32,ISSUE,0,1,1);
    if(sig==='project(bytes32)')return raw(CONTROLLER,ASSET,B32,ISSUE,1,1);
    throw Error('unexpected contract getter '+sig);
  },
  async call(method){
    if(method==='eth_chainId')return '0x1a4';
    if(method==='web3_sha3')return B32;
    throw Error('unexpected RPC '+method);
  }};
}
test('canonical creator wizard accepts precisely four crowdfunding modes and deterministic metadata',async()=>{
  assert.deepEqual(MODES,['REWARD','DONATION','COMMUNITY_PROJECT','PRODUCT_PREORDER']);
  for(const mode of MODES){
    const r=rpc(),first=await prepareCampaignRequest(r,rt,draft(mode));
    const second=await prepareCampaignRequest(r,rt,draft(mode));
    assert.equal(first.schema,'420-launchpad-creator-preparation-v1');
    assert.equal(first.status,'PREPARED_NOT_SUBMITTED');assert.equal(first.requiresGovernance,true);
    assert.equal(first.requestId,second.requestId);
    assert.equal(first.projectId,PROJECT_ID);assert.equal(first.saleId,SALE_ID);
    assert.equal(first.metadataHash,B32);assert.equal(first.metadata.mode,mode);
    assert.equal(first.governanceRequest.calls.length,3);
    assert.deepEqual(first.governanceRequest.calls.map(x=>x.stage),['REGISTER_PROJECT','CREATE_SALE','SET_CAMPAIGN_MODE']);
    assert.deepEqual(first.governanceRequest.calls.map(x=>x.target),
      [rt.projectRegistryAddress,rt.saleRegistryAddress,rt.crowdfundingIntegrationAddress]);
    assert.equal(first.governanceRequest.requester,CONTROLLER);
    assert.ok(first.governanceRequest.calls.every(x=>x.value==='0x0'));
    assert.equal(first.governanceRequest.calls[2].data.slice(-64),wordUint(MODES.indexOf(mode)+1));
    assert.ok(r.calls.some(x=>x.sig.startsWith('canonicalId(')));
  }
});
test('creator draft blocks caps, invalid modes, tier spoofing, bad schedules, incorrect asset or preorder conditions',()=>{
  assert.throws(()=>normalizeCampaignDraft({...draft(),mode:'EQUITY'}),/crowdfunding mode/);
  assert.throws(()=>normalizeCampaignDraft({...draft(),hardCap:'2'}),/cap ordering/);
  assert.throws(()=>normalizeCampaignDraft({...draft(),perWalletCap:'101'}),/cap ordering/);
  assert.throws(()=>normalizeCampaignDraft({...draft(),startsAt:'2000002000'}),/schedule/);
  assert.throws(()=>normalizeCampaignDraft({...draft(),paymentAsset:'0x'+'0'.repeat(40)}),/settlement asset/);
  assert.throws(()=>normalizeCampaignDraft({...draft(),issuanceCommitment:'0x'+'0'.repeat(64)}),/issuance commitment/);
  assert.throws(()=>normalizeCampaignDraft({...draft(),website:'http://localhost'}),/website URL/);
  assert.throws(()=>normalizeCampaignDraft({...draft('DONATION'),rewardTiers:draft().rewardTiers}),/donation tiers/);
  assert.throws(()=>normalizeCampaignDraft({...draft('REWARD'),rewardTiers:[]}),/tiers required/);
  assert.throws(()=>normalizeCampaignDraft({...draft('REWARD'),rewardTiers:[draft().rewardTiers[0],draft().rewardTiers[0]]}),/duplicate tier/);
  assert.throws(()=>normalizeCampaignDraft({...draft('PRODUCT_PREORDER'),productPreorder:{...draft('PRODUCT_PREORDER').productPreorder,estimatedDeliveryAt:2000000500}}),/delivery must follow/);
  assert.throws(()=>normalizeCampaignDraft({...draft('COMMUNITY_PROJECT'),milestones:[]}),/milestones required/);
});
test('creator lifecycle proposals require on-chain ownership and valid transition',async()=>{
  const r=rpc(),request=await creatorLifecycle(r,rt,{account:CONTROLLER,saleId:SALE_ID,action:'activate'});
  assert.equal(request.requiresGovernance,true);assert.equal(request.governanceRequest.action,'activate');
  assert.equal(request.governanceRequest.calls[0].target,rt.saleRegistryAddress);
  await assert.rejects(()=>creatorLifecycle(r,rt,{account:ASSET,saleId:SALE_ID,action:'activate'}),/canonical project controller/);
  await assert.rejects(()=>creatorLifecycle(r,rt,{account:CONTROLLER,saleId:SALE_ID,action:'finalize'}),/action unavailable/);
  await assert.rejects(()=>creatorLifecycle(r,rt,{account:CONTROLLER,saleId:SALE_ID,action:'unpause'}),/action unavailable/);
});

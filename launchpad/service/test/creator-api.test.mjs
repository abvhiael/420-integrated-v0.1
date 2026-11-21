import test from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../core/app.mjs';
import {wordHex,wordUint} from '../core/abi.mjs';
const WHO='0x000000000000000000000000000000000000c111';
const ASSET='0x000000000000000000000000000000000000c222';
const PAY='0x000000000000000000000000000000000000c333';
const PROJECT='0x'+'aa'.repeat(32),SALE='0x'+'bb'.repeat(32),BLOCK='0x'+'cc'.repeat(32),ID='0x'+'dd'.repeat(32);
const A={router:'0x0000000000000000000000000000000000001001',
  sale:'0x0000000000000000000000000000000000001002',
  allocation:'0x0000000000000000000000000000000000001003',
  crowd:'0x0000000000000000000000000000000000001004',
  projects:'0x0000000000000000000000000000000000001005',
  cases:'0x0000000000000000000000000000000000001006'};
const out=(...v)=>'0x'+v.map(x=>typeof x==='string'&&x.startsWith('0x')?wordHex(x):wordUint(x)).join('');
function draft(){return {title:'Public title',summary:'Summary',description:'Public campaign description',
  mode:'DONATION',controller:WHO,saleAsset:ASSET,issuanceCommitment:ID,
  paymentAsset:PAY,proceedsReceiver:WHO,softCap:'1',hardCap:'50',perWalletCap:'10',
  tokenAllocation:'10',startsAt:'2000000000',endsAt:'2000001000',claimStartsAt:'2000001000',
  eligibilityPolicyHash:ID,rewardTiers:[],milestones:[],productPreorder:null};}
function rpc(){
  const selectors=new Map(),reverse=new Map();
  return {
    async selector(sig){if(!selectors.has(sig)){const id='0x'+(selectors.size+1).toString(16).padStart(8,'0');selectors.set(sig,id);reverse.set(id,sig);}return selectors.get(sig);},
    async ethCall(to,data){
      const sig=reverse.get(data.slice(0,10));
      if(sig==='resolveActive(bytes32)')return out(A.router,1);
      if(sig==='sales()')return out(A.sale);
      if(sig==='allocations()')return out(A.allocation);
      if(sig==='crowdfundingIntegration()')return out(A.crowd);
      if(sig==='projects()')return out(A.projects);
      if(sig==='arbitrationCases()')return out(A.cases);
      if(sig==='canonicalId(address,address,bytes32,bytes32)')return out(PROJECT);
      if(sig==='canonicalId(bytes32,address,address,uint128,uint128,uint128,uint128,uint64,uint64,uint64,bytes32,bytes32)')return out(SALE);
      if(sig==='sale(bytes32)')return out(PROJECT,PAY,WHO,1,50,10,10,2000000000,2000001000,2000001000,ID,ID,0,1,1);
      if(sig==='project(bytes32)')return out(WHO,ASSET,ID,ID,1,1);
      if(sig==='campaignMode(bytes32)')return out(2);
      if(sig==='reconciledSaleRefundPrincipal(bytes32)')return out(0);
      throw Error('unmocked contract '+sig+' at '+to);
    },
    async call(method){
      if(method==='eth_chainId')return '0x1a4';if(method==='eth_getCode')return '0x6001';
      if(method==='web3_sha3')return ID;
      if(method==='eth_getBlockByNumber')return {hash:BLOCK,number:'0x9',timestamp:'0x5'};
      throw Error('unmocked RPC '+method);
    }
  };
}
test('creator HTTP dispatch prepares, records signed-review receipt, lists requests and resolves owned report',async()=>{
  let written=null;
  const queue={async submit(_rpc,prepared,signature){
    written={prepared,signature};
    return {schema:'420-launchpad-governance-receipt-v1',canonical:true,
      status:'RECEIVED_FOR_GOVERNANCE_REVIEW',requestId:prepared.requestId};
  },list(account){return written&&account===WHO?[{requestId:written.prepared.requestId,status:'RECEIVED_FOR_GOVERNANCE_REVIEW'}]:[];}};
  const projection={read:()=>({schema:'420-launchpad-projection-v1',canonical:true,
    source:{chainId:'0x1a4',blockHash:BLOCK},items:[{saleId:SALE,projectId:PROJECT,controller:WHO,title:'Owned'}]})};
  const app=createApp({rpc:rpc(),projection,creatorQueue:queue,chainId:'0x1a4'});
  const prep=await app({method:'POST',path:'/v1/launchpad/creator/prepare',body:{kind:'CREATE_CAMPAIGN',draft:draft()}});
  assert.equal(prep.status,200);assert.equal(prep.body.requestId,ID);
  assert.equal(prep.body.requiresGovernance,true);
  assert.equal(prep.body.governanceRequest.calls.length,3);
  const conflict=await app({method:'POST',path:'/v1/launchpad/creator/submit',
    body:{kind:'CREATE_CAMPAIGN',draft:draft(),requestId:PROJECT,signature:'0x11'}});
  assert.equal(conflict.status,409);assert.match(conflict.body.error,/changed/);
  const receipt=await app({method:'POST',path:'/v1/launchpad/creator/submit',
    body:{kind:'CREATE_CAMPAIGN',draft:draft(),requestId:ID,signature:'0x11'}});
  assert.equal(receipt.status,202);assert.equal(receipt.body.status,'RECEIVED_FOR_GOVERNANCE_REVIEW');
  assert.equal(written.signature,'0x11');
  const requests=await app({path:'/v1/launchpad/creator/requests/'+WHO});
  assert.equal(requests.body.items.length,1);
  const campaigns=await app({path:'/v1/launchpad/creator/campaigns/'+WHO});
  assert.equal(campaigns.body.items[0].saleId,SALE);
  const report=await app({path:'/v1/launchpad/creator/report/'+WHO+'/'+SALE});
  assert.equal(report.status,200);assert.equal(report.body.mode,'DONATION');
  const forbidden=await app({path:'/v1/launchpad/creator/report/'+ASSET+'/'+SALE});
  assert.equal(forbidden.status,403);
});

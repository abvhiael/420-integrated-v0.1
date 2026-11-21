import test from 'node:test';
import assert from 'node:assert/strict';
import {creatorReport,creatorCampaigns} from '../core/creator-report.mjs';
import {wordHex,wordUint} from '../core/abi.mjs';
const OWNER='0x000000000000000000000000000000000000c111';
const OTHER='0x000000000000000000000000000000000000c222';
const TOKEN='0x000000000000000000000000000000000000c333';
const SALE='0x'+'11'.repeat(32),PROJECT='0x'+'22'.repeat(32),B='0x'+'33'.repeat(32),TX='0x'+'44'.repeat(32);
const A={sales:'0x0000000000000000000000000000000000001002',project:'0x0000000000000000000000000000000000001003',
  allocation:'0x0000000000000000000000000000000000001004',crowd:'0x0000000000000000000000000000000000001005'};
const rt={chainId:'0x1a4',saleRegistryAddress:A.sales,projectRegistryAddress:A.project,
  allocationRegistryAddress:A.allocation,crowdfundingIntegrationAddress:A.crowd};
const out=(...values)=>'0x'+values.map(x=>typeof x==='string'&&x.startsWith('0x')?wordHex(x):wordUint(x)).join('');
function fakeRpc(){
  const selectors=new Map(),reverse=new Map(),topics=new Map();
  let reorg=false,controller=OWNER,mode=1;
  return {
    setController(x){controller=x;},setMode(x){mode=x;},reorg(){reorg=true;},
    async selector(signature){
      if(!selectors.has(signature)){const s='0x'+(selectors.size+1).toString(16).padStart(8,'0');selectors.set(signature,s);reverse.set(s,signature);}
      return selectors.get(signature);
    },
    async ethCall(to,data){
      const fn=reverse.get(data.slice(0,10));
      if(fn==='sale(bytes32)')return out(PROJECT,TOKEN,OWNER,10,100,50,20,100,200,200,B,B,30,2,1);
      if(fn==='project(bytes32)')return out(controller,TOKEN,B,B,1,1);
      if(fn==='campaignMode(bytes32)')return out(mode);
      if(fn==='reconciledSaleRefundPrincipal(bytes32)')return out(7);
      throw Error('unexpected read '+fn+' '+to);
    },
    async call(method,params){
      if(method==='eth_chainId')return '0x1a4';
      if(method==='eth_getBlockByNumber')return {number:'0x8',hash:reorg?TX:B};
      if(method==='web3_sha3'){
        const sig=Buffer.from(params[0].slice(2),'hex').toString('utf8');
        if(!topics.has(sig))topics.set(sig,'0x'+(topics.size+1).toString(16).padStart(64,'0'));
        return topics.get(sig);
      }
      if(method==='eth_getLogs'){
        const filter=params[0],name=[...topics.entries()].find(([,id])=>id===filter.topics[0])?.[0]||'';
        if(!name.startsWith('ContributionRecorded('))return [];
        return [{address:A.allocation,topics:[filter.topics[0],SALE,'0x'+wordHex(OWNER)],blockHash:B,transactionHash:TX,logIndex:'0x0',data:out(17,B)}];
      }
      throw Error('unexpected RPC '+method);
    }
  };
}
test('creator report verifies ownership, mode, state, gross funding and refund checkpoints without inventing full history',async()=>{
  const r=fakeRpc(),report=await creatorReport(r,rt,OWNER,SALE);
  assert.equal(report.canonical,true);assert.equal(report.mode,'REWARD');assert.equal(report.approval,'ACTIVE');
  assert.equal(report.grossRecordedFunding,'30');assert.equal(report.recordedRefundPrincipal,'7');
  assert.equal(report.historicalRaisedIsNotNet,true);
  assert.equal(report.events,null);assert.equal(report.coverage.available,false);
  await assert.rejects(()=>creatorReport(r,rt,OTHER,SALE),/canonical project controller/);
});
test('creator report scans actual canonical event logs and marks complete vs partial coverage',async()=>{
  const r=fakeRpc(),full=await creatorReport(r,rt,OWNER,SALE,{fromBlock:'0'});
  assert.equal(full.events.contributions.count,1);
  assert.equal(full.events.contributions.amount,'17');
  assert.equal(full.events.contributions.participants,1);
  assert.equal(full.events.disputes.count,0);assert.equal(full.events.reputationEvidence.count,0);
  assert.equal(full.coverage.completeFromGenesis,true);
  const partial=await creatorReport(r,rt,OWNER,SALE,{fromBlock:'0x4'});
  assert.equal(partial.coverage.completeFromGenesis,false);
  await assert.rejects(()=>creatorReport(r,rt,OWNER,SALE,{fromBlock:'0x9'}),/out of bounds/);
});
test('creator report fails closed when canonical block reorgs mid-scan',async()=>{
  const r=fakeRpc(),original=r.call.bind(r);let scanned=false;
  r.call=async(name,args)=>{if(name==='eth_getBlockByNumber'&&scanned)r.reorg();const result=await original(name,args);if(name==='eth_getLogs')scanned=true;return result;};
  await assert.rejects(()=>creatorReport(r,rt,OWNER,SALE,{fromBlock:'0'}),/reorged/);
});
test('creator discovery only returns canonical-controller-owned projection matches',async()=>{
  const r=fakeRpc();
  const p={read:()=>({schema:'420-launchpad-projection-v1',canonical:true,
    source:{chainId:'0x1a4',blockHash:B},items:[{saleId:SALE,projectId:PROJECT,controller:OWNER,title:'Our project'}]})};
  const data=await creatorCampaigns(r,rt,p,OWNER);
  assert.equal(data.items.length,1);assert.equal(data.items[0].state,'ACTIVE');assert.equal(data.items[0].mode,'REWARD');
  r.setController(OTHER);
  assert.equal((await creatorCampaigns(r,rt,p,OWNER)).items.length,0);
  r.setController(OWNER);
  const bad={read:()=>({source:{chainId:'0x1a4',blockHash:B},items:[{saleId:SALE,projectId:B,controller:OWNER}]})};
  await assert.rejects(()=>creatorCampaigns(r,rt,bad,OWNER),/changed sale project/);
});

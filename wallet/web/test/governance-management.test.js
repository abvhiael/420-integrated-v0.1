import test from 'node:test';
import assert from 'node:assert/strict';
import { keccak256Hex } from '../core/keccak.js';
import {
  createGovernance420Client,
  createGovernanceIndexer420,
  classifyGovernance420Error,
  GOVERNANCE420_SERVICE_ID,
} from '../core/governance-management.js';

const A={
  constitution:'0x0000000000000000000000000000000000001001',
  proposalRegistry:'0x0000000000000000000000000000000000001002',
  electorateRegistry:'0x0000000000000000000000000000000000001003',
  voting:'0x0000000000000000000000000000000000001004',
  governor:'0x0000000000000000000000000000000000001005',
};
const ALICE='0x1111111111111111111111111111111111111111';
const REGISTRY='0x0000000000000000000000000000000000000434';
const ID_PREIMAGES={
  constitution:'420/component/governance/civic-constitution/v1',
  proposalRegistry:'420/component/governance/civic-proposal-registry/v1',
  electorateRegistry:'420/component/governance/civic-electorate-registry/v1',
  voting:'420/component/governance/civic-voting/v1',
  governor:'420/component/governance/civic-governor/v1',
};
const IDS=Object.fromEntries(Object.entries(ID_PREIMAGES).map(([key,value])=>[key,keccak256Hex(new TextEncoder().encode(value))]));
const SERVICE_HASH=keccak256Hex(new TextEncoder().encode(GOVERNANCE420_SERVICE_ID));
const REGISTRY_CODE_HASH=keccak256Hex(Uint8Array.from([0x60,0x01]));
const PROPOSAL='0x'+'aa'.repeat(32);
const META='0x'+'bb'.repeat(32);
const ACTIONS='0x'+'cc'.repeat(32);
const ROOT='0x'+'dd'.repeat(32);
const SOURCE='0x2222222222222222222222222222222222222222';
const TYPE='0x'+'ee'.repeat(32);
const TX='0x'+'99'.repeat(32);
const REPLACEMENT='0x'+'98'.repeat(32);
const BLOCK_HASH='0x'+'44'.repeat(32);

const selector=(signature)=>keccak256Hex(new TextEncoder().encode(signature)).slice(2,10);
const w=(value)=>BigInt(value).toString(16).padStart(64,'0');
const aw=(address)=>address.slice(2).padStart(64,'0');
const bw=(value)=>value.slice(2);
const result=(...words)=>'0x'+words.join('');
const str=(text)=>{
  const data=Buffer.from(text,'utf8').toString('hex');
  return result(w(32),w(data.length/2),data.padEnd(Math.ceil(data.length/64)*64,'0'));
};
const discovery=()=>({source:'protocol-registry',serviceId:GOVERNANCE420_SERVICE_ID,revision:7,registryAddress:REGISTRY,componentIds:{...IDS},modules:{...A}});

class FakeProvider{
  constructor(overrides={}){
    this.chain=overrides.chain??'0x1a4';
    this.accounts=overrides.accounts??[ALICE];
    this.code=overrides.code??'0x6001';
    this.block=overrides.block??15n;
    const baseReceipt={status:'0x1',transactionHash:TX,from:ALICE,to:A.voting,
      blockHash:BLOCK_HASH,blockNumber:'0xf'};
    this.receipt=overrides.receipt===null?null:{...baseReceipt,...(overrides.receipt??{})};
    this.canonicalBlock=overrides.canonicalBlock??{number:'0xf',hash:BLOCK_HASH};
    this.sent=[];
    this.calls=[];
    this.voted=overrides.voted??false;
    this.weight=overrides.weight??40n;
    this.state=overrides.state??1n;
    this.actionsHash=overrides.actionsHash??ACTIONS;
    this.computedActionsHash=overrides.computedActionsHash??this.actionsHash;
    this.serviceGovernor=overrides.serviceGovernor??A.governor;
    this.serviceVersion=overrides.serviceVersion??1n;
    this.componentHash=overrides.componentHash??REGISTRY_CODE_HASH;
  }
  async request(method,params=[]){
    this.calls.push({method,params});
    if(method==='eth_chainId')return this.chain;
    if(method==='eth_accounts')return this.accounts;
    if(method==='eth_getCode')return this.code;
    if(method==='eth_blockNumber')return '0x'+this.block.toString(16);
    if(method==='eth_getTransactionCount')return '0x5';
    if(method==='eth_estimateGas')return '0x5208';
    if(method==='eth_sendTransaction'){this.sent.push(params[0]);return TX;}
    if(method==='eth_getTransactionReceipt')return this.receipt;
    if(method==='eth_getBlockByNumber')return this.canonicalBlock;
    if(method!=='eth_call')throw new Error('unexpected '+method);
    const [{to,data}]=params;
    const sel=data.slice(2,10);
    const names={
      [REGISTRY]:'ProtocolRegistry',
      [A.constitution]:'CivicConstitution420',[A.proposalRegistry]:'CivicProposalRegistry420',
      [A.electorateRegistry]:'CivicElectorateRegistry420',[A.voting]:'CivicVoting420',[A.governor]:'CivicGovernor420',
    };
    if(sel===selector('systemName()'))return str(names[to]);
    if(sel===selector('protocolVersion()'))return result(w(to===REGISTRY?4:1));
    if(to===REGISTRY&&sel===selector('resolveActive(bytes32)')){
      assert.equal('0x'+data.slice(-64).toLowerCase(),SERVICE_HASH);
      return result(aw(this.serviceGovernor),w(this.serviceVersion));
    }
    if(to===REGISTRY&&sel===selector('runtimeCodeHash(bytes32)')){
      return result(bw(this.componentHash));
    }
    if(to===REGISTRY&&sel===selector('resolve(bytes32)')){
      const componentId='0x'+data.slice(-64).toLowerCase();
      const key=Object.keys(IDS).find((name)=>IDS[name]===componentId);
      if(!key)throw new Error('unknown component');
      return result(aw(A[key]));
    }
    if(to===A.governor&&sel===selector('constitution()'))return result(aw(A.constitution));
    if(to===A.governor&&sel===selector('proposalRegistry()'))return result(aw(A.proposalRegistry));
    if(to===A.governor&&sel===selector('electorateRegistry()'))return result(aw(A.electorateRegistry));
    if(to===A.governor&&sel===selector('voting()'))return result(aw(A.voting));
    if(to===A.voting&&sel===selector('proposalRegistry()'))return result(aw(A.proposalRegistry));
    if(to===A.voting&&sel===selector('electorateRegistry()'))return result(aw(A.electorateRegistry));
    if(to===A.proposalRegistry&&sel===selector('proposals(bytes32)')){
      return result(aw(ALICE),w(0),bw(META),bw(this.actionsHash),w(10),w(11),w(20),w(this.state),w(1));
    }
    if(to===A.governor&&sel===selector('frozenRule(bytes32)')){
      return result(w(604800),w(5000),w(6000),w(5000),w(6000),w(1),w(3),w(1));
    }
    if(to===A.electorateRegistry&&sel===selector('proposalSnapshot(bytes32)')){
      return result(
        w(10),
        aw(SOURCE),bw(TYPE),bw(ROOT),w(100),w(2),w(1),
        aw(SOURCE),bw(TYPE),bw(ROOT),w(50),w(4),w(1),
        w(1),w(1)
      );
    }
    if(to===A.voting&&sel===selector('tally(bytes32,uint8)')){
      const house=BigInt('0x'+data.slice(-64));
      return house===0n?result(w(10),w(55),w(5)):result(w(5),w(25),w(5));
    }
    if(to===A.voting&&sel===selector('ballot(bytes32,uint8,address)')){
      return result(w(1),w(this.voted?this.weight:0),w(this.voted?1:0));
    }
    if(to===A.electorateRegistry&&sel===selector('votingWeight(bytes32,uint8,address,bytes)'))return result(w(this.weight));
    if(to===A.governor&&sel===selector('hashActions((address,uint256,bytes)[])'))return this.computedActionsHash;
    if(to===A.voting&&sel===selector('castVote(bytes32,uint8,uint8,bytes)'))return result(w(this.weight));
    throw new Error('unexpected eth_call '+to+' '+sel);
  }
}
const client=(provider,indexer=null,disc=discovery())=>createGovernance420Client({provider,chainId:'0x1a4',account:ALICE,discovery:disc,indexer});

test('canonical ProtocolRegistry discovery validates code, identity, versions and exact Civic module graph',async()=>{
  const p=new FakeProvider();
  const c=client(p);
  const verified=await c.verifySession();
  assert.equal(verified.discovery.source,'protocol-registry');
  assert.equal(verified.discovery.revision,7);
  assert.deepEqual(c.modules,A);
  assert.equal(p.calls.filter((x)=>x.method==='eth_getCode').length,6);
  assert.equal(p.calls.filter((x)=>x.method==='eth_call'&&x.params?.[0]?.to===REGISTRY&&x.params?.[0]?.data?.slice(2,10)===selector('resolve(bytes32)')).length,5);
  assert.equal(p.calls.filter((x)=>x.method==='eth_call'&&x.params?.[0]?.data?.slice(2,10)===selector('runtimeCodeHash(bytes32)')).length,5);
});

test('discovery fails closed on invented source, wrong chain, missing code, account drift and module mismatch',async()=>{
  assert.throws(()=>client(new FakeProvider(),null,{source:'runtime-hardcode',serviceId:GOVERNANCE420_SERVICE_ID,registryAddress:REGISTRY,componentIds:IDS,modules:A}),/ProtocolRegistry discovery/);
  await assert.rejects(client(new FakeProvider({chain:'0x1'})).verifySession(),/Wrong network/);
  await assert.rejects(client(new FakeProvider({code:'0x'})).verifySession(),/no deployed code/);
  await assert.rejects(client(new FakeProvider({accounts:[]})).verifySession(),/no longer authorized/);
  const wrong=discovery();wrong.modules.voting=wrong.modules.governor;
  assert.throws(()=>client(new FakeProvider(),null,wrong),/duplicate module addresses/);
  const missingIds=discovery();delete missingIds.componentIds.voting;
  assert.throws(()=>client(new FakeProvider(),null,missingIds),/invalid bytes32/);
});

test('ProtocolRegistry resolution fails closed on mismatched or missing deployed component',async()=>{
  for(const resolved of ['0x000000000000000000000000000000000000dead','0x0000000000000000000000000000000000000000']){
    const p=new FakeProvider();
    const original=p.request.bind(p);
    p.request=async(method,params=[])=>{
      if(method==='eth_call'){
        const [{to,data}]=params;
        if(to===REGISTRY&&data.slice(2,10)===selector('resolve(bytes32)')){
          const componentId='0x'+data.slice(-64).toLowerCase();
          if(componentId===IDS.voting)return result(aw(resolved));
        }
      }
      return original(method,params);
    };
    await assert.rejects(client(p).verifySession(),/ProtocolRegistry resolution mismatch for voting/);
  }
});

test('proposal detail exposes frozen class revision window electorates thresholds commitment and non-authoritative tallies',async()=>{
  const detail=await client(new FakeProvider()).proposal(PROPOSAL);
  assert.equal(detail.className,'G1');
  assert.equal(detail.state,'ACTIVE');
  assert.equal(detail.frozenRule.constitutionRevision,3n);
  assert.equal(detail.voteStart,11n);
  assert.equal(detail.voteEnd,20n);
  assert.equal(detail.electorate.community.totalWeight,100n);
  assert.equal(detail.electorate.validator.totalWeight,50n);
  assert.equal(detail.tallies.community.forVotes,55n);
  assert.equal(detail.tallies.community.quorumMet,true);
  assert.equal(detail.tallies.community.approvalMet,true);
  assert.equal(detail.tallies.community.authoritative,false);
  assert.equal(detail.actionsHash,ACTIONS);
});

test('proposal list uses Indexer only for enumeration and drops stale/reorged IDs that chain rejects',async()=>{
  const ids=[];
  const indexer={async listProposalIds(chainId){ids.push(chainId);return [PROPOSAL];}};
  const items=await client(new FakeProvider(),indexer).listProposals();
  assert.equal(ids[0],420n);
  assert.equal(items.length,1);
  assert.equal(items[0].authority,'chain');
});

test('Indexer proposal enumeration accepts only canonical CivicProposalRegistered events and de-duplicates IDs',async()=>{
  let requested;
  const indexer=createGovernanceIndexer420({
    baseUrl:'https://indexer.example',
    async fetchImpl(url){requested=url;return {ok:true,async json(){return {items:[
      {eventName:'CivicProposalRegistered',fields:{proposalId:PROPOSAL}},
      {eventName:'CivicProposalRegistered',fields:{proposalId:PROPOSAL.toUpperCase().replace('0X','0x')}},
      {eventName:'CivicProposalCreated',fields:{proposalId:'0x'+'11'.repeat(32)}},
    ]};}};}
  });
  const ids=await indexer.listProposalIds(420n);
  assert.deepEqual(ids,[PROPOSAL]);
  assert.equal(requested.searchParams.get('protocol'),'420Governance');
  assert.equal(requested.searchParams.get('chainId'),'420');
});

test('required-house eligibility reads frozen voting weight and rejects already-cast or non-required ballots',async()=>{
  const c=client(new FakeProvider({weight:42n}));
  assert.deepEqual(await c.eligibility(PROPOSAL,0),{eligible:true,weight:42n,reason:null,ballot:{support:1,supportName:'FOR',weight:0n,cast:false}});
  const voted=client(new FakeProvider({voted:true,weight:42n}));
  assert.equal((await voted.eligibility(PROPOSAL,0)).reason,'already voted');
});

test('action review requires exact on-chain commitment and flags undecodable actions without inventing meaning',async()=>{
  const p=new FakeProvider();
  const c=client(p);
  const actions=[{target:SOURCE,value:0,data:'0x12345678'}];
  const raw=await c.reviewActionBatch(PROPOSAL,actions,{});
  assert.equal(raw.matchesCommitment,true);
  assert.equal(raw.fullyDecoded,false);
  assert.match(raw.actions[0].warning,/cannot be decoded safely/);

  const decoded=await c.reviewActionBatch(PROPOSAL,actions,{[`${SOURCE}:0x12345678`]:{signature:'setThing()'}});
  assert.equal(decoded.fullyDecoded,true);
  assert.equal(decoded.actions[0].decoded.signature,'setThing()');

  p.computedActionsHash='0x'+'44'.repeat(32);
  await assert.rejects(c.reviewActionBatch(PROPOSAL,actions,{}),/does not match proposal commitment/);
});

test('vote submission supports FOR AGAINST ABSTAIN only after simulation gas estimation and fresh eligibility revalidation',async()=>{
  for(const support of [0,1,2]){
    const p=new FakeProvider();
    const submitted=await client(p).sendVote({proposalId:PROPOSAL,house:0,support,proofData:'0x'});
    assert.equal(submitted.state,'submitted');
    assert.equal(submitted.support,support);
    assert.equal(submitted.weight,40n);
    assert.equal(p.sent.length,1);
    const methods=p.calls.map((x)=>x.method);
    assert.ok(methods.includes('eth_call'));
    assert.ok(methods.includes('eth_estimateGas'));
    assert.ok(methods.includes('eth_getTransactionCount'));
  }
});

test('vote fails closed on inactive/out-of-window/account/network changes and safe retry blocks an already-cast ballot',async()=>{
  await assert.rejects(client(new FakeProvider({state:2n})).sendVote({proposalId:PROPOSAL,house:0,support:1}),/not active/);
  await assert.rejects(client(new FakeProvider({block:21n})).sendVote({proposalId:PROPOSAL,house:0,support:1}),/voting has ended/);
  const changed=new FakeProvider(); let chains=0; const original=changed.request.bind(changed);
  changed.request=async(method,params=[])=>{if(method==='eth_chainId'&&++chains>1)return '0x421';return original(method,params);};
  await assert.rejects(client(changed).sendVote({proposalId:PROPOSAL,house:0,support:1}),/Wrong network/);
  const voted=new FakeProvider({voted:true});
  await assert.rejects(client(voted).sendVote({proposalId:PROPOSAL,house:0,support:1}),/already voted/);
  assert.equal(voted.sent.length,0);
});

test('receipt confirmation binds canonical block, original account, Registry code and actual Civic voting target',async()=>{
  const reorged=client(new FakeProvider({canonicalBlock:{number:'0xf',hash:REPLACEMENT}}));
  assert.equal((await reorged.confirmVote({txHash:TX,nonce:5n},{attempts:1,delayMs:0})).state,'reorged');

  const missing=client(new FakeProvider({canonicalBlock:null}));
  // A missing canonical block is not success.
  const missingProvider=new FakeProvider();
  missingProvider.canonicalBlock=null;
  assert.equal((await client(missingProvider).confirmVote({txHash:TX,nonce:5n},{attempts:1,delayMs:0})).state,'reorged');

  for(const altered of [
    {transactionHash:REPLACEMENT}, {to:A.governor}, {from:SOURCE},
    {status:'0x2'}, {blockHash:'0xdead'}, {blockNumber:null}
  ]){
    await assert.rejects(
      client(new FakeProvider({receipt:altered})).confirmVote({txHash:TX,nonce:5n},{attempts:1,delayMs:0}),
      /receipt|Governance|invalid|canonical|malformed/i);
  }

  await assert.rejects(
    client(new FakeProvider({chain:'0x1a5'})).confirmVote({txHash:TX,nonce:5n},{attempts:1,delayMs:0}),
    /chain changed/);
  await assert.rejects(
    client(new FakeProvider({accounts:[]})).confirmVote({txHash:TX,nonce:5n},{attempts:1,delayMs:0}),
    /account changed/);
  const replacedCode=new FakeProvider();
  let servedReceipt=false;
  const original=replacedCode.request.bind(replacedCode);
  replacedCode.request=async(method,params=[])=>{
    if(method==='eth_getTransactionReceipt')servedReceipt=true;
    if(servedReceipt&&method==='eth_getCode')return '0x6002';
    return original(method,params);
  };
  await assert.rejects(client(replacedCode).confirmVote({txHash:TX,nonce:5n},{attempts:1,delayMs:0}),
    /code hash mismatch/);
});

test('transaction state reports confirmed failed pending and replaced without auto-resubmission',async()=>{
  const c=client(new FakeProvider({receipt:{status:'0x1'}}));
  assert.equal((await c.confirmVote({txHash:TX,nonce:5n},{attempts:1,delayMs:0})).state,'confirmed');
  const failed=client(new FakeProvider({receipt:{status:'0x0'}}));
  assert.equal((await failed.confirmVote({txHash:TX,nonce:5n},{attempts:1,delayMs:0})).state,'failed');
  const pending=client(new FakeProvider({receipt:null}));
  assert.equal((await pending.confirmVote({txHash:TX,nonce:5n},{attempts:1,delayMs:0})).state,'pending');
  const replaced=client(new FakeProvider({receipt:null}));
  const state=await replaced.confirmVote({txHash:TX,nonce:5n},{attempts:1,delayMs:0,replacementLookup:async()=>({txHash:REPLACEMENT})});
  assert.equal(state.state,'replaced');
  assert.equal(state.replacementHash,REPLACEMENT);
});

test('error classifier gives explicit recovery semantics',()=>{
  assert.equal(classifyGovernance420Error({message:'User rejected'}).code,'USER_REJECTED');
  assert.equal(classifyGovernance420Error(new Error('chain changed')).code,'NETWORK_CHANGED');
  assert.equal(classifyGovernance420Error(new Error('account changed')).code,'ACCOUNT_CHANGED');
  assert.equal(classifyGovernance420Error(new Error('already voted')).retryable,false);
});

test('GOV-REC-5 frozen component IDs, Registry address, service activity and runtime hash are enforced',async()=>{
  const wrongId=discovery(); wrongId.componentIds.governor='0x'+'aa'.repeat(32);
  assert.throws(()=>client(new FakeProvider(),null,wrongId),/canonical component ID mismatch/);
  const wrongRegistry=discovery(); wrongRegistry.registryAddress='0x0000000000000000000000000000000000000435';
  assert.throws(()=>client(new FakeProvider(),null,wrongRegistry),/ProtocolRegistry address mismatch/);
  await assert.rejects(client(new FakeProvider({serviceGovernor:A.voting})).verifySession(),/active service mismatch/);
  await assert.rejects(client(new FakeProvider({serviceVersion:0n})).verifySession(),/active service mismatch/);
  await assert.rejects(client(new FakeProvider({componentHash:'0x'+'44'.repeat(32)})).verifySession(),/runtime code hash mismatch/);
});

test('GOV-REC-5 listing/details reject stale network, Registry and code after initially verified session',async()=>{
  const p=new FakeProvider();
  const c=client(p,{async listProposalIds(){return [PROPOSAL];}});
  await c.verifySession();
  p.chain='0x1';
  await assert.rejects(c.proposal(PROPOSAL),/Wrong network/);
  await assert.rejects(c.listProposals(),/Wrong network/);
  p.chain='0x1a4'; p.serviceGovernor=A.voting;
  await assert.rejects(c.proposal(PROPOSAL),/active service mismatch/);
  p.serviceGovernor=A.governor; p.componentHash='0x'+'77'.repeat(32);
  await assert.rejects(c.listProposals(),/runtime code hash mismatch/);
});

test('GOV-REC-5 changed proposal state and action commitment after gas estimate block vote submission',async()=>{
  for(const mutation of ['state','actionsHash','block']){
    const p=new FakeProvider();
    const original=p.request.bind(p);
    p.request=async(method,params=[])=>{
      if(method==='eth_estimateGas'){
        const gas=await original(method,params);
        if(mutation==='state')p.state=2n;
        if(mutation==='actionsHash')p.actionsHash='0x'+'55'.repeat(32);
        if(mutation==='block')p.block=21n;
        return gas;
      }
      return original(method,params);
    };
    await assert.rejects(client(p).sendVote({proposalId:PROPOSAL,house:0,support:1}),/stale|commitment or snapshot changed/);
    assert.equal(p.sent.length,0,'no vote may broadcast on '+mutation+' drift');
  }
});


test('previously authorized secondary account cannot sign or confirm after the active Wallet account switches',async()=>{
  const BOB='0x3333333333333333333333333333333333333333';
  const provider=new FakeProvider({accounts:[BOB,ALICE]});
  const c=client(provider);
  await assert.rejects(c.verifySession(),/no longer authorized or active/);
  await assert.rejects(c.sendVote({proposalId:PROPOSAL,house:0,support:1}),/no longer authorized or active/);
  assert.equal(provider.sent.length,0,'secondary previously authorized EOA cannot submit a ballot');
  await assert.rejects(c.confirmVote({txHash:TX,nonce:5n},{attempts:1,delayMs:0}),/account changed/);
});

test('revoked active signer after nonce retrieval prevents Governance wallet approval',async()=>{
  const BOB='0x3333333333333333333333333333333333333333';
  const provider=new FakeProvider();
  const original=provider.request.bind(provider);
  provider.request=async(method,params=[])=>{
    const result=await original(method,params);
    if(method==='eth_getTransactionCount')provider.accounts=[BOB,ALICE];
    return result;
  };
  await assert.rejects(client(provider).sendVote({proposalId:PROPOSAL,house:0,support:1}),/no longer authorized or active/);
  assert.equal(provider.sent.length,0,'revoked account reached eth_sendTransaction');
});

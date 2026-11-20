import test from 'node:test';import assert from 'node:assert/strict';import {prepareParticipant,participantState,creatorRequest} from '../core/planner.mjs';import {wordUint,wordHex} from '../core/abi.mjs';
const runtime={allocationRegistryAddress:'0x0000000000000000000000000000000000001003',crowdfundingIntegrationAddress:'0x0000000000000000000000000000000000001004',saleRegistryAddress:'0x0000000000000000000000000000000000001002'};
const sale='0x'+'11'.repeat(32),payment='0x'+'22'.repeat(32),delivery='0x'+'33'.repeat(32),account='0x000000000000000000000000000000000000a11c';
class FakeRpc{async selector(sig){return {'contribute(bytes32,uint128,bytes32)':'0xaaaa0001','claim(bytes32,bytes32)':'0xaaaa0002','prepareRefund(bytes32)':'0xaaaa0003','recordRefund(bytes32,bytes32)':'0xaaaa0004','contributed(bytes32,address)':'0xbbbb0001','claimed(bytes32,address)':'0xbbbb0002','refunded(bytes32,address)':'0xbbbb0003'}[sig];}async ethCall(_to,data){const s=data.slice(0,10);if(s==='0xbbbb0001')return '0x'+wordUint(400);if(s==='0xbbbb0002')return '0x'+wordUint(25);if(s==='0xbbbb0003')return '0x'+wordUint(1);throw Error('unexpected read');}}
test('participant transaction planner binds exact canonical targets',async()=>{const rpc=new FakeRpc();const contribution=await prepareParticipant(rpc,runtime,'contribute',{saleId:sale,amount:'100',paymentId:payment});assert.equal(contribution.transaction.to,runtime.allocationRegistryAddress);assert.match(contribution.transaction.data,/^0xaaaa0001/);const claim=await prepareParticipant(rpc,runtime,'claim',{saleId:sale,deliveryCommitment:delivery});assert.equal(claim.transaction.to,runtime.allocationRegistryAddress);const refund=await prepareParticipant(rpc,runtime,'refund',{saleId:sale});assert.equal(refund.transaction.to,runtime.crowdfundingIntegrationAddress);const record=await prepareParticipant(rpc,runtime,'refund',{saleId:sale,refundCommitment:payment});assert.equal(record.transaction.to,runtime.allocationRegistryAddress);assert.match(record.transaction.data,/^0xaaaa0004/);});
test('participant status is read directly from allocation registry',async()=>{assert.deepEqual(await participantState(new FakeRpc(),runtime,sale,account),{contributed:'400',claimed:'25',refunded:true});});
test('creator workflow remains a governance request, not a direct transaction',()=>{const r=creatorRequest({action:'activate',account,saleId:sale},runtime);assert.equal(r.requiresGovernance,true);assert.equal(r.authorityTarget,runtime.saleRegistryAddress);assert.equal(r.transaction,undefined);assert.throws(()=>creatorRequest({action:'steal',account},runtime),/unsupported/);});

test('Identity, registered-intent, dispute-link and refund recovery reviews use canonical targets',async()=>{
  const selectors=new Map([
    ['bindIdentity(bytes32)','0x01020301'],['registerContributionIntent(bytes32,uint128,uint256)','0x01020302'],
    ['linkDispute(bytes32,bytes32)','0x01020303'],['publishFinalizedDisputeOutcome(bytes32,address)','0x01020304'],
    ['reconcileUnallocatedRefund(bytes32,bytes32)','0x01020305'],['reconcileRecordedRefund(bytes32)','0x01020306']
  ]);
  const rpc={selector:async name=>selectors.get(name)};
  const expected=[
    ['bind-identity',{profileId:payment},'0x01020301',runtime.crowdfundingIntegrationAddress],
    ['register-intent',{amount:'40',nonce:'9'},'0x01020302',runtime.crowdfundingIntegrationAddress],
    ['link-dispute',{caseId:payment},'0x01020303',runtime.crowdfundingIntegrationAddress],
    ['publish-outcome',{},'0x01020304',runtime.crowdfundingIntegrationAddress],
    ['recover-unallocated',{paymentId:payment},'0x01020305',runtime.crowdfundingIntegrationAddress],
    ['reconcile-refund',{paymentId:payment},'0x01020306',runtime.crowdfundingIntegrationAddress]
  ];
  for(const [kind,payload,selector,target] of expected){
    const result=await prepareParticipant(rpc,runtime,kind,{saleId:sale,account,...payload});
    assert.equal(result.transaction.to,target);assert.ok(result.transaction.data.startsWith(selector));
    assert.equal(result.canonical,true);
  }
  await assert.rejects(()=>prepareParticipant(rpc,runtime,'register-intent',{saleId:sale,account,amount:'0',nonce:'9'}),/invalid contribution intent/);
  await assert.rejects(()=>prepareParticipant(rpc,runtime,'register-intent',{saleId:sale,account,amount:'1',nonce:'0'}),/invalid contribution intent/);
});

test('Arbitration case opening requires active canonical policy and nonzero evidence',async()=>{
  const domain='0x'+'dd'.repeat(32),project='0x'+'44'.repeat(32),token='0x0000000000000000000000000000000000000022',
    controller='0x000000000000000000000000000000000000c111',
    cases='0x0000000000000000000000000000000000001010',
    policies='0x0000000000000000000000000000000000001011';
  const selectors=new Map(),reverse=new Map(),encode=(...args)=>'0x'+args.map(x=>
    typeof x==='string'&&x.startsWith('0x')?wordHex(x):wordUint(x)).join('');
  let active=true;
  const rpc={
    async selector(name){if(!selectors.has(name)){const id='0x'+(selectors.size+1).toString(16).padStart(8,'0');selectors.set(name,id);reverse.set(id,name);}return selectors.get(name);},
    async ethCall(to,data){const name=reverse.get(data.slice(0,10));
      switch(name){
        case 'sale(bytes32)':return encode(project,token,controller,20,100,80,10,100,200,210,domain,project,12,2,1);
        case 'project(bytes32)':return encode(controller,token,project,project,1,1);
        case 'CROWDFUNDING_DOMAIN()':return encode(domain);
        case 'arbitrationCases()':return encode(cases);
        case 'policies()':return encode(policies);
        case 'getPolicy(bytes32)':return encode(controller,controller,600,600,0,active?1:0,1);
        default:throw Error('unexpected call '+name+' to '+to);
      }
    },
    async call(method){if(method==='web3_sha3')return '0x'+'99'.repeat(32);throw Error('unexpected '+method);}
  };
  const rt={...runtime,projectRegistryAddress:'0x0000000000000000000000000000000000001005'};
  const request={saleId:sale,account,claimHash:payment,requestedRemedyHash:delivery};
  const r=await prepareParticipant(rpc,rt,'open-dispute',request);
  assert.equal(r.transaction.to,cases);assert.ok(r.transaction.data.startsWith(await rpc.selector('openCase(bytes32,address,bytes32,bytes32,bytes32,bytes32)')));
  active=false;
  await assert.rejects(()=>prepareParticipant(rpc,rt,'open-dispute',request),/policy is inactive/);
  active=true;
  await assert.rejects(()=>prepareParticipant(rpc,rt,'open-dispute',{...request,claimHash:'0x'+'0'.repeat(64)}),/nonzero dispute/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BONG_GOGGLES_REWARD_DEPENDENCIES,
  BONG_GOGGLES_REWARD_SCHEMA,
} from '../src/rewardProductionConfig.js';
import {
  buildBongGogglesCampaignPlans,
  preflightCampaignPlan,
} from '../src/rewardCampaignPlans.js';

const address=(n)=>`0x${n.toString(16).padStart(40,'0')}`;

function config(){
  return {
    schema:BONG_GOGGLES_REWARD_SCHEMA,
    environment:'production',
    contracts:Object.fromEntries(BONG_GOGGLES_REWARD_DEPENDENCIES.map((name,index)=>[name,address(index+1)])),
    campaigns:[
      {contributionType:'POST',enabled:true,scorer:address(50),policy:address(60),maxRewardPerContribution:10,maxRewardPerAccount:100,totalBudget:1000,startsAt:100,endsAt:200},
      {contributionType:'REVIEW',enabled:true,scorer:address(51),policy:null,maxRewardPerContribution:5,maxRewardPerAccount:50,totalBudget:500,startsAt:100,endsAt:200},
      {contributionType:'PHOTO',enabled:false,scorer:null,policy:null,maxRewardPerContribution:0,maxRewardPerAccount:0,totalBudget:0,startsAt:0,endsAt:0},
    ],
  };
}

function profiles(){
  return {
    scorerProfiles:[
      {contract:address(50),interface:'IRewardScorer420',replaceable:true},
      {contract:address(51),interface:'IRewardScorer420',replaceable:true},
    ],
    policyProfiles:[
      {contract:address(60),interface:'IRewardPolicy420',replaceable:true,objectiveGates:['UNIQUE_SOURCE'],canRedirectBeneficiary:false,canRewriteEvidence:false},
    ],
  };
}

test('BG-18.4 builds deterministic plans only for enabled contribution campaigns',()=>{
  const set=buildBongGogglesCampaignPlans(config(),profiles());
  assert.deepEqual(set.plans.map((plan)=>plan.contributionType),['POST','REVIEW']);
  assert.equal(set.environment,'production');
  assert.equal(set.createsCampaigns,false);
  assert.equal(set.fundsCampaigns,false);
  assert.equal(set.activatesCampaigns,false);
});

test('BG-18.4 binds each plan to Bong Goggles app and exactly one contribution type',()=>{
  const post=buildBongGogglesCampaignPlans(config(),profiles()).plans[0];
  assert.equal(post.appIdSymbol,'APP_ID_BONG_GOGGLES');
  assert.equal(post.appIdPreimage,'420/APP/BONG_GOGGLES/V1');
  assert.equal(post.contributionType,'POST');
  assert.equal(post.contributionTypePreimage,'420/BONG_GOGGLES/REWARD/POST/V1');
  assert.equal(post.registryMethod,'createCampaign');
});

test('BG-18.4 carries scorer policy caps budget and campaign window into plan',()=>{
  const post=buildBongGogglesCampaignPlans(config(),profiles()).plans[0];
  assert.equal(post.scorer,address(50));
  assert.equal(post.policy,address(60));
  assert.equal(post.maxRewardPerContribution,10);
  assert.equal(post.maxRewardPerAccount,100);
  assert.equal(post.totalBudget,1000);
  assert.equal(post.startsAt,100);
  assert.equal(post.endsAt,200);
  assert.equal(post.sponsorControlsActivation,true);
});

test('BG-18.4 preflight rejects tampered app or contribution bindings',()=>{
  const post=buildBongGogglesCampaignPlans(config(),profiles()).plans[0];
  assert.throws(()=>preflightCampaignPlan({...post,appIdPreimage:'wrong'}),/app binding mismatch/);
  assert.throws(()=>preflightCampaignPlan({...post,contributionTypePreimage:'wrong'}),/contribution binding mismatch/);
});

test('BG-18.4 preflight rejects unsafe caps budget or windows',()=>{
  const post=buildBongGogglesCampaignPlans(config(),profiles()).plans[0];
  assert.throws(()=>preflightCampaignPlan({...post,maxRewardPerAccount:9}),/account cap unsafe/);
  assert.throws(()=>preflightCampaignPlan({...post,totalBudget:9}),/total budget unsafe/);
  assert.throws(()=>preflightCampaignPlan({...post,endsAt:100}),/window unsafe/);
});

test('BG-18.4 plans remain inspection-only before canonical sponsor action',()=>{
  const post=buildBongGogglesCampaignPlans(config(),profiles()).plans[0];
  const result=preflightCampaignPlan(post);
  assert.equal(result.valid,true);
  assert.equal(result.sponsorControlsActivation,true);
  assert.equal(result.createsCampaign,false);
  assert.equal(result.fundsCampaign,false);
  assert.equal(result.activatesCampaign,false);
  assert.equal(result.authoritative,false);
});

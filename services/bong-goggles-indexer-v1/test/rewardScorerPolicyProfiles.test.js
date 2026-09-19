import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BONG_GOGGLES_REWARD_DEPENDENCIES,
  BONG_GOGGLES_REWARD_SCHEMA,
} from '../src/rewardProductionConfig.js';
import {
  buildRewardScorerPolicyProfiles,
  evaluateBoundedScorerResult,
  validatePolicyDecision,
} from '../src/rewardScorerPolicyProfiles.js';

const address=(n)=>`0x${n.toString(16).padStart(40,'0')}`;
function config(){
  return {
    schema:BONG_GOGGLES_REWARD_SCHEMA,
    environment:'production',
    contracts:Object.fromEntries(BONG_GOGGLES_REWARD_DEPENDENCIES.map((name,index)=>[name,address(index+1)])),
    campaigns:[
      {contributionType:'POST',enabled:true,scorer:address(50),policy:address(60),maxRewardPerContribution:10,maxRewardPerAccount:100,totalBudget:1000,startsAt:1,endsAt:100},
      {contributionType:'REVIEW',enabled:true,scorer:address(51),policy:null,maxRewardPerContribution:5,maxRewardPerAccount:50,totalBudget:500,startsAt:1,endsAt:100},
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
      {contract:address(60),interface:'IRewardPolicy420',replaceable:true,objectiveGates:['ACCOUNT_AGE','VERIFIED_PROFILE','COOLDOWN'],canRedirectBeneficiary:false,canRewriteEvidence:false},
    ],
  };
}

test('BG-18.3 maps enabled contribution types to replaceable scorer/policy profiles',()=>{
  const result=buildRewardScorerPolicyProfiles(config(),profiles());
  const post=result.profiles.find((row)=>row.contributionType==='POST');
  const review=result.profiles.find((row)=>row.contributionType==='REVIEW');
  const photo=result.profiles.find((row)=>row.contributionType==='PHOTO');
  assert.equal(post.scorer.interface,'IRewardScorer420');
  assert.equal(post.scorer.replaceable,true);
  assert.deepEqual(post.policy.objectiveGates,['ACCOUNT_AGE','VERIFIED_PROFILE','COOLDOWN']);
  assert.equal(review.policy,null);
  assert.equal(photo.enabled,false);
  assert.equal(result.authoritative,false);
});

test('BG-18.3 fails closed when enabled campaigns have missing or invalid scorer profiles',()=>{
  const missing=profiles();
  missing.scorerProfiles=missing.scorerProfiles.filter((row)=>row.contract!==address(50));
  assert.throws(()=>buildRewardScorerPolicyProfiles(config(),missing),/missing scorer profile/);

  const invalid=profiles();
  invalid.scorerProfiles[0]={...invalid.scorerProfiles[0],interface:'OtherScorer'};
  assert.throws(()=>buildRewardScorerPolicyProfiles(config(),invalid),/IRewardScorer420/);
});

test('BG-18.3 rejects non-objective or authority-expanding policy profiles',()=>{
  const nonObjective=profiles();
  nonObjective.policyProfiles[0]={...nonObjective.policyProfiles[0],objectiveGates:['POPULARITY_SCORE']};
  assert.throws(()=>buildRewardScorerPolicyProfiles(config(),nonObjective),/non-objective/);

  const redirect=profiles();
  redirect.policyProfiles[0]={...redirect.policyProfiles[0],canRedirectBeneficiary:true};
  assert.throws(()=>buildRewardScorerPolicyProfiles(config(),redirect),/cannot redirect beneficiary/);
});

test('BG-18.3 scorer outputs are bounded by campaign max and zero means no accrual',()=>{
  const result=buildRewardScorerPolicyProfiles(config(),profiles());
  const post=result.profiles.find((row)=>row.contributionType==='POST');
  assert.deepEqual(evaluateBoundedScorerResult({profile:post,amount:0}),{
    eligible:false,amount:0,reason:'ZERO_SCORE',accrualRequested:false,authoritative:false,
  });
  const ok=evaluateBoundedScorerResult({profile:post,amount:10});
  assert.equal(ok.eligible,true);
  assert.equal(ok.amount,10);
  assert.equal(ok.accrualRequested,false);
  assert.throws(()=>evaluateBoundedScorerResult({profile:post,amount:11}),/exceeds maxRewardPerContribution/);
});

test('BG-18.3 scorer and policy profiles deny popularity/ranking/local engagement authority',()=>{
  const result=buildRewardScorerPolicyProfiles(config(),profiles());
  const post=result.profiles.find((row)=>row.contributionType==='POST');
  assert.equal(post.popularityAuthoritative,false);
  assert.equal(post.recommendationRankAuthoritative,false);
  assert.equal(post.localEngagementAuthoritative,false);
});

test('BG-18.3 policy decisions cannot redirect beneficiary or rewrite canonical evidence',()=>{
  const result=buildRewardScorerPolicyProfiles(config(),profiles());
  const post=result.profiles.find((row)=>row.contributionType==='POST');
  const contribution={contributionId:'c1',beneficiary:address(77),contentHash:'0xevidence'};
  const decision=validatePolicyDecision({profile:post,canonicalContribution:contribution,decision:true});
  assert.equal(decision.eligible,true);
  assert.equal(decision.beneficiary,address(77));
  assert.equal(decision.evidenceRewritten,false);
  assert.equal(decision.beneficiaryRedirected,false);
});

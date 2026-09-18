import test from 'node:test';
import assert from 'node:assert/strict';
import { createRewardLifecycleProjection, applyRewardLifecycleEvent } from '../src/rewardLifecycleProjection.js';
import { buildRewardAccountingProjection } from '../src/rewardAccountingReconciliation.js';
import { assessRewardAbuseScenario } from '../src/rewardEconomicHardening.js';

function canonicalPostFlow(){
  return [
    {replayKey:'post:1',name:'ContributionPublished',contributionId:'c-post',appId:'APP_ID_BONG_GOGGLES',contributionType:'POST',publisher:'adapter',beneficiary:'alice',contentHash:'hash',nullifier:'nullifier'},
    {replayKey:'post:2',name:'RewardAccrued',rewardId:'r-post',campaignId:'camp-post',contributionId:'c-post',beneficiary:'alice',amount:10},
    {replayKey:'post:3',name:'RewardReserved',rewardId:'r-post',campaignId:'camp-post',amount:10},
    {replayKey:'post:4',name:'RewardReleased',rewardId:'r-post',campaignId:'camp-post',beneficiary:'alice',amount:10},
    {replayKey:'post:5',name:'RewardClaimed',rewardId:'r-post',beneficiary:'alice',amount:10},
  ];
}

test('BG-18.12 drill: canonical post contribution accrual reserve claim release closes PAID',()=>{
  const state=createRewardLifecycleProjection();
  for(const event of canonicalPostFlow()) applyRewardLifecycleEvent(state,event);
  const reward=state.rewards.get('r-post');
  assert.equal(reward.status,'PAID');
  assert.equal(reward.released,true);
  assert.equal(reward.claimed,true);
});

test('BG-18.12 drill: review and discovery contribution accounting remain distinct and bounded',()=>{
  const events=[
    {replayKey:'d1',name:'ContributionPublished',contributionId:'c-discovery',appId:'APP_ID_BONG_GOGGLES',contributionType:'DISCOVERY',publisher:'adapter',beneficiary:'alice',contentHash:'hd',nullifier:'nd'},
    {replayKey:'d2',name:'RewardAccrued',rewardId:'r-discovery',campaignId:'camp-discovery',contributionId:'c-discovery',beneficiary:'alice',amount:5},
    {replayKey:'r1',name:'ContributionPublished',contributionId:'c-review',appId:'APP_ID_BONG_GOGGLES',contributionType:'REVIEW',publisher:'adapter',beneficiary:'bob',contentHash:'hr',nullifier:'nr'},
    {replayKey:'r2',name:'RewardAccrued',rewardId:'r-review',campaignId:'camp-review',contributionId:'c-review',beneficiary:'bob',amount:7},
  ];
  const projection=buildRewardAccountingProjection({
    events,
    campaignBudgets:{'camp-discovery':50,'camp-review':70},
  });
  assert.equal(projection.submittedContributions,2);
  assert.equal(projection.accruedRewards,2);
  assert.equal(projection.byCampaign['camp-discovery'].remainingBudget,45);
  assert.equal(projection.byCampaign['camp-review'].remainingBudget,63);
});

test('BG-18.12 drill: cap and budget exhaustion remain fail-closed accounting conditions',()=>{
  assert.throws(()=>buildRewardAccountingProjection({
    events:[
      {replayKey:'1',name:'ContributionPublished',contributionId:'c1',appId:'APP_ID_BONG_GOGGLES',contributionType:'POST',publisher:'adapter',beneficiary:'alice',contentHash:'h',nullifier:'n'},
      {replayKey:'2',name:'RewardAccrued',rewardId:'r1',campaignId:'camp',contributionId:'c1',beneficiary:'alice',amount:11},
    ],
    campaignBudgets:{camp:10},
  }),/accrued exceeds canonical budget/);
});

test('BG-18.12 drill: replay rejection signals duplicate source without becoming canonical authority',()=>{
  const risk=assessRewardAbuseScenario({
    contributionType:'POST',
    sourceKey:'post:canonical-source',
    account:'alice',
    now:100,
    recentSubmissions:[
      {contributionType:'POST',sourceKey:'post:canonical-source',account:'alice',at:90},
    ],
  });
  assert.equal(risk.riskDetected,true);
  assert.equal(risk.flags.includes('DUPLICATE_SOURCE'),true);
  assert.equal(risk.authoritative,false);
});

test('BG-18.12 drill: restart and replay produce identical paid totals',()=>{
  const events=canonicalPostFlow();
  const a=buildRewardAccountingProjection({events,campaignBudgets:{'camp-post':100}});
  const b=buildRewardAccountingProjection({events:[...events,events[1],events[3]],campaignBudgets:{'camp-post':100}});
  assert.equal(a.paidAmount,b.paidAmount);
  assert.equal(a.accruedAmount,b.accruedAmount);
  assert.deepEqual(a.byCampaign,b.byCampaign);
});

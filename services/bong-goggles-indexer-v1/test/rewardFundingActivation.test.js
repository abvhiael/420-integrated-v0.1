import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCampaignActivationWorkflow, prepareCampaignFundingIntent, prepareCampaignActivationIntent } from '../src/rewardFundingActivation.js';

const address=(n)=>`0x${n.toString(16).padStart(40,'0')}`;

function plan(){
  return {
    schema:'bg-reward-campaign-plan-v1',
    appIdSymbol:'APP_ID_BONG_GOGGLES',
    appIdPreimage:'420/APP/BONG_GOGGLES/V1',
    contributionType:'POST',
    contributionTypePreimage:'420/BONG_GOGGLES/REWARD/POST/V1',
    scorer:address(50),
    policy:address(60),
    maxRewardPerContribution:10,
    maxRewardPerAccount:100,
    totalBudget:1000,
    startsAt:100,
    endsAt:200,
    sponsorControlsActivation:true,
  };
}
function canonical(active=false){
  return {
    exists:true,
    active,
    appIdSymbol:'APP_ID_BONG_GOGGLES',
    contributionType:'POST',
    scorer:address(50),
    policy:address(60),
    maxRewardPerContribution:10,
    maxRewardPerAccount:100,
    totalBudget:1000,
    startsAt:100,
    endsAt:200,
  };
}

test('BG-18.5 enforces create validate fund verify activate production sequence',()=>{
  const workflow=buildCampaignActivationWorkflow({plan:plan(),campaignId:'camp1',canonicalCampaign:canonical(false),poolState:{funded:1000,reserved:100}});
  assert.deepEqual(workflow.sequence,['CREATE_CAMPAIGN','VALIDATE_CANONICAL_CAMPAIGN','FUND_REWARD_POOL','VERIFY_POOL_BALANCES','ACTIVATE_CAMPAIGN']);
  assert.equal(workflow.available,900);
  assert.equal(workflow.fullyFunded,true);
  assert.equal(workflow.activationReady,true);
  assert.equal(workflow.nextAction,'ACTIVATE');
});

test('BG-18.5 underfunded campaigns fail activation readiness and request funding/top-up',()=>{
  const empty=buildCampaignActivationWorkflow({plan:plan(),campaignId:'camp1',canonicalCampaign:canonical(false),poolState:{funded:0,reserved:0}});
  assert.equal(empty.activationReady,false);
  assert.equal(empty.nextAction,'FUND');

  const partial=buildCampaignActivationWorkflow({plan:plan(),campaignId:'camp1',canonicalCampaign:canonical(false),poolState:{funded:500,reserved:0}});
  assert.equal(partial.activationReady,false);
  assert.equal(partial.nextAction,'TOP_UP');
});

test('BG-18.5 rejects canonical campaign drift before funding or activation',()=>{
  assert.throws(()=>buildCampaignActivationWorkflow({plan:plan(),campaignId:'camp1',canonicalCampaign:{...canonical(),totalBudget:999},poolState:{funded:1000,reserved:0}}),/budget mismatch/);
  assert.throws(()=>buildCampaignActivationWorkflow({plan:plan(),campaignId:'camp1',canonicalCampaign:{...canonical(),contributionType:'REVIEW'},poolState:{funded:1000,reserved:0}}),/contribution mismatch/);
});

test('BG-18.5 exposes funded reserved and available balances and rejects impossible pool state',()=>{
  const workflow=buildCampaignActivationWorkflow({plan:plan(),campaignId:'camp1',canonicalCampaign:canonical(),poolState:{funded:1000,reserved:250}});
  assert.equal(workflow.funded,1000);
  assert.equal(workflow.reserved,250);
  assert.equal(workflow.available,750);
  assert.throws(()=>buildCampaignActivationWorkflow({plan:plan(),campaignId:'camp1',canonicalCampaign:canonical(),poolState:{funded:10,reserved:11}}),/reserved exceeds funded/);
});

test('BG-18.5 funding intent is Wallet-bound and does not custody funds in Bong Goggles',()=>{
  const workflow=buildCampaignActivationWorkflow({plan:plan(),campaignId:'camp1',canonicalCampaign:canonical(),poolState:{funded:0,reserved:0}});
  const intent=prepareCampaignFundingIntent({workflow,rewardPool:address(70),value:1000});
  assert.equal(intent.method,'fund');
  assert.deepEqual(intent.args,['camp1']);
  assert.equal(intent.value,1000);
  assert.equal(intent.requiresWalletConfirmation,true);
  assert.equal(intent.applicationCustodiesFunds,false);
});

test('BG-18.5 activation requires readiness while deactivation remains reversible',()=>{
  const under=buildCampaignActivationWorkflow({plan:plan(),campaignId:'camp1',canonicalCampaign:canonical(),poolState:{funded:500,reserved:0}});
  assert.throws(()=>prepareCampaignActivationIntent({workflow:under,campaignRegistry:address(71),active:true}),/not funding-ready/);

  const ready=buildCampaignActivationWorkflow({plan:plan(),campaignId:'camp1',canonicalCampaign:canonical(true),poolState:{funded:1000,reserved:100}});
  const pause=prepareCampaignActivationIntent({workflow:ready,campaignRegistry:address(71),active:false});
  assert.equal(pause.method,'setActive');
  assert.deepEqual(pause.args,['camp1',false]);
  assert.equal(pause.deactivationPreservesPriorRewards,true);
  assert.equal(pause.requiresWalletConfirmation,true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { assessRewardAbuseScenario, verifyRewardPoolInvariant } from '../src/rewardEconomicHardening.js';

test('BG-18.9 detects same-source replay and cross-account farming without becoming reward authority',()=>{
  const result=assessRewardAbuseScenario({
    contributionType:'REVIEW',
    sourceKey:'subject:alice',
    account:'0xALICE',
    now:100,
    recentSubmissions:[
      {contributionType:'REVIEW',sourceKey:'subject:alice',account:'0xBOB',at:90},
    ],
  });
  assert.equal(result.riskDetected,true);
  assert.deepEqual(result.flags,['DUPLICATE_SOURCE','CROSS_ACCOUNT_SOURCE_REPLAY']);
  assert.equal(result.requiresCanonicalPolicyDecision,true);
  assert.equal(result.blocksCanonicalAccrual,false);
  assert.equal(result.authoritative,false);
});

test('BG-18.9 detects rapid post review correction style farming bursts and cooldown violations',()=>{
  const recent=Array.from({length:5},(_,index)=>({
    contributionType:'CORRECTION',
    sourceKey:`correction-${index}`,
    account:'0xFARMER',
    at:95-index,
  }));
  const result=assessRewardAbuseScenario({
    contributionType:'CORRECTION',
    sourceKey:'correction-new',
    account:'0xFARMER',
    now:100,
    recentSubmissions:recent,
    cooldownSeconds:30,
    rapidWindowSeconds:60,
    rapidLimit:5,
  });
  assert.equal(result.flags.includes('COOLDOWN_VIOLATION'),true);
  assert.equal(result.flags.includes('RAPID_SUBMISSION_BURST'),true);
  assert.equal(result.requiresCanonicalPolicyDecision,true);
});

test('BG-18.9 clean activity remains a non-authoritative preflight signal',()=>{
  const result=assessRewardAbuseScenario({
    contributionType:'POST',
    sourceKey:'post-new',
    account:'0xUSER',
    now:1000,
    recentSubmissions:[
      {contributionType:'POST',sourceKey:'post-old',account:'0xUSER',at:100},
    ],
    cooldownSeconds:30,
  });
  assert.equal(result.riskDetected,false);
  assert.deepEqual(result.flags,[]);
  assert.equal(result.authoritative,false);
});

test('BG-18.9 funded reserved available invariant fails closed',()=>{
  assert.deepEqual(verifyRewardPoolInvariant({funded:1000,reserved:250}),{
    funded:1000,reserved:250,available:750,invariantHolds:true,authoritative:false,
  });
  assert.throws(()=>verifyRewardPoolInvariant({funded:10,reserved:11}),/reserved exceeds funded/);
});

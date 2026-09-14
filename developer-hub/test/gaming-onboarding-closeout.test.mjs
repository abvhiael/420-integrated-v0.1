import test from 'node:test';
import assert from 'node:assert/strict';
import { createGamingOnboardingCloseout420, GamingOnboardingCloseoutError420 } from '../src/gaming-onboarding-closeout.mjs';

const gameId='420/GAMING/GAME/HIGH_COUNTRY/V1';
const applicationId='420-gaming-game-high_country-v1';
const phases=['GP-17.1','GP-17.2','GP-17.3','GP-17.4','GP-17.5','GP-17.6','GP-17.7','GP-17.8','GP-17.9','GP-17.10'];
const input=(overrides={})=>({schemaVersion:'1.0.0',gameId,applicationId,completedPhases:phases,documentation:true,troubleshooting:true,examples:true,exactHeadQualification:true,developerHubAuthority:false,liveNetworkClaimsRequireEvidence:true,...overrides});

test('GP-17.10 accepts complete non-authoritative closeout',()=>{
  const result=createGamingOnboardingCloseout420(input());
  assert.equal(result.status,'READY_FOR_GP17_CLOSEOUT');
  assert.equal(result.developerHubAuthority,false);
  assert.equal(result.canonicalRegistrationCreated,false);
  assert.equal(result.canonicalGrantCreated,false);
  assert.equal(result.securityCertification,false);
});

test('GP-17.10 requires every phase in canonical order',()=>{
  assert.throws(()=>createGamingOnboardingCloseout420(input({completedPhases:phases.slice(0,-1)})),/all GP-17 phases must be complete in order/);
  assert.throws(()=>createGamingOnboardingCloseout420(input({completedPhases:[...phases].reverse()})),/all GP-17 phases must be complete in order/);
});

test('GP-17.10 requires docs troubleshooting and examples',()=>{
  assert.throws(()=>createGamingOnboardingCloseout420(input({documentation:false})),/documentation must be complete/);
  assert.throws(()=>createGamingOnboardingCloseout420(input({troubleshooting:false})),/troubleshooting coverage must be complete/);
  assert.throws(()=>createGamingOnboardingCloseout420(input({examples:false})),/examples must be complete/);
});

test('GP-17.10 requires exact-head qualification',()=>{
  assert.throws(()=>createGamingOnboardingCloseout420(input({exactHeadQualification:false})),/exact-head qualification evidence is required/);
});

test('GP-17.10 never promotes Developer Hub into authority',()=>{
  assert.throws(()=>createGamingOnboardingCloseout420(input({developerHubAuthority:true})),/must remain non-authoritative/);
});

test('GP-17.10 preserves live-network evidence boundary',()=>{
  assert.throws(()=>createGamingOnboardingCloseout420(input({liveNetworkClaimsRequireEvidence:false})),/live-network claims must require live-network evidence/);
});

test('GP-17.10 binds closeout to canonical game and application identity',()=>{
  assert.throws(()=>createGamingOnboardingCloseout420(input({gameId:'420/GAMING/GAME/OTHER/V1'})),/applicationId must match canonical game identity/);
  assert.throws(()=>createGamingOnboardingCloseout420(input({applicationId:'other'})),GamingOnboardingCloseoutError420);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSecurityQualificationReport420, createSecurityQualificationView420, SecurityQualificationError420 } from '../src/security-qualification.mjs';

const profile=JSON.parse(await readFile(new URL('../qualification/profile.v1.json',import.meta.url),'utf8'));
const evidence=JSON.parse(await readFile(new URL('../qualification/evidence.example.json',import.meta.url),'utf8'));
const local={chainIdDecimal:'420',environment:'local'};
const clone=(value)=>structuredClone(value);

test('fully evidenced local candidate qualifies without gaining authority',()=>{
  const report=createSecurityQualificationReport420({profile,evidence,network:local});
  assert.equal(report.result,'PASS');
  assert.equal(report.qualifiedForDeveloperRelease,true);
  assert.equal(report.canonicalAuthority,false);
  assert.equal(report.securityCertification,false);
  assert.equal(report.checks.find(c=>c.id==='production-https').status,'NOT_APPLICABLE');
});

test('missing required evidence blocks qualification',()=>{
  const candidate=clone(evidence);candidate.checks=candidate.checks.filter(c=>c.id!=='tests-qualified');
  const report=createSecurityQualificationReport420({profile,evidence:candidate,network:local});
  assert.equal(report.result,'BLOCKED');
  assert.equal(report.qualifiedForDeveloperRelease,false);
});

test('explicit failure outranks blocked evidence',()=>{
  const candidate=clone(evidence);candidate.checks=candidate.checks.filter(c=>c.id!=='dependency-review');candidate.checks.find(c=>c.id==='secret-material').status='FAIL';
  assert.equal(createSecurityQualificationReport420({profile,evidence:candidate,network:local}).result,'FAIL');
});

test('chain and environment mismatch fail closed',()=>{
  const wrongChain=clone(evidence);wrongChain.network.chainId='421';
  assert.throws(()=>createSecurityQualificationReport420({profile,evidence:wrongChain,network:local}),SecurityQualificationError420);
  const wrongEnv=clone(evidence);wrongEnv.network.environment='testnet';
  assert.throws(()=>createSecurityQualificationReport420({profile,evidence:wrongEnv,network:local}),/environment does not match/);
});

test('raw secret-shaped fields are rejected anywhere in evidence',()=>{
  const candidate=clone(evidence);candidate.privateKey='0xdeadbeef';
  assert.throws(()=>createSecurityQualificationReport420({profile,evidence:candidate,network:local}),/raw secret-shaped field/);
  const nested=clone(evidence);nested.checks[0].evidence={bearerToken:'do-not-track'};
  assert.throws(()=>createSecurityQualificationReport420({profile,evidence:nested,network:local}),/raw secret-shaped field/);
});

test('mainnet requires production transport evidence',()=>{
  const candidate=clone(evidence);candidate.network.environment='mainnet';
  const report=createSecurityQualificationReport420({profile,evidence:candidate,network:{chainIdDecimal:'420',environment:'mainnet'}});
  assert.equal(report.result,'BLOCKED');
  assert.equal(report.checks.find(c=>c.id==='production-https').status,'BLOCKED');
});

test('unknown or duplicate checks fail closed',()=>{
  const unknown=clone(evidence);unknown.checks.push({id:'invented-check',status:'PASS',source:'nowhere'});
  assert.throws(()=>createSecurityQualificationReport420({profile,evidence:unknown,network:local}),/unknown qualification check/);
  const duplicate=clone(evidence);duplicate.checks.push(clone(duplicate.checks[0]));
  assert.throws(()=>createSecurityQualificationReport420({profile,evidence:duplicate,network:local}),/duplicate evidence check/);
});

test('control view states non-authority semantics',()=>{
  const view=createSecurityQualificationView420(profile);
  assert.equal(view.canonicalAuthority,false);
  assert.equal(view.securityCertification,false);
  assert.ok(view.requiredChecks.includes('authority-boundaries'));
});

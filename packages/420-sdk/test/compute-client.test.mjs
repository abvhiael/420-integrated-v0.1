import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createComputeSdk420, ComputeSdkConfigurationError420 } from '../dist/index.js';

const fixturePath=resolve(import.meta.dirname,'fixtures/compute-request-vector.json');
function hydrate(raw){const r=structuredClone(raw); r.terms.capacityUnits=BigInt(r.terms.capacityUnits); r.terms.deadline=BigInt(r.terms.deadline); r.terms.expiresAt=BigInt(r.terms.expiresAt); r.terms.maximumPrice=BigInt(r.terms.maximumPrice); r.createdAt=BigInt(r.createdAt); r.revision=BigInt(r.revision); return r;}
async function request(){return hydrate(JSON.parse(await readFile(fixturePath,'utf8')).request);}
function host(contract=true){return {network:{chainId:420n,chainIdDecimal:'420'},contract(name){if(!contract||name!=='ComputeRequestRegistry420') return null; return {name,address:'0x0000000000000000000000000000000000000042',version:'1',verified:true};}};}

test('CMP-7.1 Compute SDK prepares an unsigned canonical job-submission intent',async()=>{const sdk=createComputeSdk420(host()); const r=await request(); const intent=sdk.prepareJobSubmission('0x'+'11'.repeat(32),r); assert.equal(intent.chainId,'420'); assert.equal(intent.target.name,'ComputeRequestRegistry420'); assert.equal(intent.method,'createRequest'); assert.equal(intent.canonicalAuthority,false); assert.equal(intent.requiresWalletAuthorization,true); assert.equal(intent.secretMaterialManaged,false);});
test('CMP-7.1 validates request expiry and payer maximum before handoff',async()=>{const sdk=createComputeSdk420(host()); const r=await request(); assert.throws(()=>sdk.validateRequest(r,900n),/expired/); assert.throws(()=>sdk.validateRequest(r,200n,9999n),/signed maximum price/);});
test('CMP-7.1 fails closed when the canonical request registry is unavailable',async()=>{const sdk=createComputeSdk420(host(false)); const r=await request(); assert.throws(()=>sdk.prepareJobSubmission('0x'+'11'.repeat(32),r),ComputeSdkConfigurationError420);});
test('CMP-7.1 rejects malformed request ids before producing an intent',async()=>{const sdk=createComputeSdk420(host()); const r=await request(); assert.throws(()=>sdk.prepareJobSubmission('0x1234',r),/bytes32/);});

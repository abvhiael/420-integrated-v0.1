import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {verifyJurisdictionAdmission,jurisdictionGates} from '../src/jurisdiction-acceptance.mjs';
const now=1000,request={country:'CA',region:'BC',municipality:'Vancouver',service:'liftd-passenger',operatorRef:'operator_1',driverId:'driver_1',vehicleId:'vehicle_1',routeScopeRef:'vancouver_core',deploymentDigest:'a'.repeat(64)};
const keys=Object.fromEntries(jurisdictionGates.map(g=>[g,generateKeyPairSync('ed25519')]));
const authorities=Object.fromEntries(jurisdictionGates.map(g=>[g,{issuer:'issuer_'+g,publicKey:keys[g].publicKey,independentlyApproved:true}]));
const fields=['gate','country','region','municipality','service','operatorRef','driverId','vehicleId','policyRef','routeScopeRef','issuer','issuedAt','expiresAt','revoked','approved','evidenceDigest','deploymentDigest'];
const record=g=>{const a={...request,gate:g,policyRef:'policy_'+g,issuer:'issuer_'+g,issuedAt:900,expiresAt:1100,revoked:false,approved:true,evidenceDigest:'b'.repeat(64)};a.signature=sign(null,Buffer.from(JSON.stringify(fields.map(k=>a[k]))),keys[g].privateKey).toString('base64url');return a};
const records=jurisdictionGates.map(record);
const verify=(overrides={})=>verifyJurisdictionAdmission({records,authorities,request,clock:()=>now,...overrides});
test('five independently keyed, current, bound approvals technically verify without granting production',()=>{
 assert.deepEqual(verify(),{technicallyVerified:true,productionAuthorized:false,scope:'Vancouver-BC',gates:5});
});
test('reject missing, duplicate, revoked, expired and stale approvals',()=>{
 for(const changed of [records.slice(1),[records[0],records[0],...records.slice(2)],records.map((a,i)=>i===2?{...a,revoked:true}:a),records.map((a,i)=>i===0?{...a,expiresAt:999}:a)])
 assert.throws(()=>verify({records:changed}),e=>e.code==='JURISDICTION_ADMISSION_DENIED');
});
test('reject tampered issuer, insurance, driver, route or deployment and untrusted keys',()=>{
 for(const changed of [records.map((a,i)=>i===3?{...a,policyRef:'forged'}:a),records.map((a,i)=>i===1?{...a,driverId:'other_driver'}:a),records.map((a,i)=>i===4?{...a,routeScopeRef:'YVR'}:a),records.map((a,i)=>i===0?{...a,signature:'ABC'}:a)])
 assert.throws(()=>verify({records:changed}));
 assert.throws(()=>verify({authorities:{...authorities,insurance:{...authorities.insurance,independentlyApproved:false}}}),e=>e.code==='JURISDICTION_AUTHORITY_UNVERIFIED');
 assert.throws(()=>verify({request:{...request,municipality:'Richmond'}}),e=>e.code==='JURISDICTION_ADMISSION_DENIED');
});

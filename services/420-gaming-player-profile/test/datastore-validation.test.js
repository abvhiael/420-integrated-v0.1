import test from 'node:test';
import assert from 'node:assert/strict';
import { decimal,PostgresGamingRepository420,migrationIntentDigest,saveScopeDigest } from '../src/postgres-repository.js';
const h=n=>'0x'+String(n).repeat(64),w=n=>'0x'+String(n).repeat(40);
const intent={migrationId:'m1',consentId:'c1',sourceCommitment:h(1),sourceRevision:'18446744073709551615',
  payloadHash:h(2),policyHash:h(3),rulesetId:h(4),claimSchemaVersion:'4294967295',chainId:'420',
  registry:w(1),targetWallet:w(2),targetGrower:'18446744073709551615'};
test('decimal wire values preserve uint64/uint32 boundaries without Number rounding',()=>{
  assert.equal(decimal('18446744073709551615'),'18446744073709551615');
  assert.equal(decimal('4294967295',32),'4294967295');
  for(const v of [1,1n,'01','+1','-0','1e3',' 1','1.5','18446744073709551616','0'.repeat(300)])assert.throws(()=>decimal(v));
  assert.throws(()=>decimal('4294967296',32));assert.throws(()=>decimal('0',64,true));
});
test('private migration intent digest binds every economic target and source fact',()=>{
  const d=migrationIntentDigest('a',h(8),intent);
  assert.equal(d,migrationIntentDigest('a',h(8),{...intent,migrationId:'retry-id',consentId:'retry-consent'}));
  for(const [k,v] of Object.entries({sourceRevision:'2',payloadHash:h(9),policyHash:h(9),rulesetId:h(9),
    claimSchemaVersion:'1',chainId:'421',registry:w(3),targetWallet:w(3),targetGrower:'2'}))
    assert.notEqual(d,migrationIntentDigest('a',h(8),{...intent,[k]:v}));
  assert.notEqual(d,migrationIntentDigest('b',h(8),intent));assert.notEqual(d,migrationIntentDigest('a',h(9),intent));
});
test('unknown properties, zero hashes, malformed targets and raw save inputs fail closed',()=>{
  for(const x of [{...intent,email:'private'},{...intent,rawSave:{}},{...intent,targetWallet:'0xabc'},
    {...intent,payloadHash:'0x'+'0'.repeat(64)},{...intent,sourceRevision:1}])assert.throws(()=>migrationIntentDigest('a',h(8),x));
  assert.throws(()=>saveScopeDigest('email@example.com',h(8),h(4)));
});
test('repository construction cannot substitute caller wallet or missing authenticated scope',()=>{
  const pool={connect(){throw Error('should not connect');}};
  for(const bad of [{},{pool},{pool,accountId:'a',gameId:h(8),expectedEpoch:'0'},
    {pool,accountId:'a',gameId:'game-a',expectedEpoch:'0',expectedIssuerRef:'issuer1'}])
    assert.throws(()=>new PostgresGamingRepository420(bad));
});

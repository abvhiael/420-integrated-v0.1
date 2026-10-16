import test from 'node:test';
import assert from 'node:assert/strict';
import {createLocalHighCountryIssuer420} from '../src/highcountry-local-issuer.js';
const game='0x'+'a'.repeat(64);
test('local issuer: provision, login, logout, tamper, expiration and revocation',async()=>{
 let time=1000;const accounts=new Map();
 const issuer=createLocalHighCountryIssuer420({gameId:game,now:()=>time,ttlMs:1000,
  provisionAccount:async a=>{accounts.set(a.accountId,a);}});
 const account=await issuer.register({username:'testplayer',password:'a-long-local-password'});
 assert.equal(accounts.has(account.accountId),true);
 await assert.rejects(issuer.register({username:'testplayer',password:'a-long-local-password'}),/identity-already-exists/);
 assert.throws(()=>issuer.login({username:'testplayer',password:'wrong'}),/authentication-denied/);
 const first=issuer.login({username:'testplayer',password:'a-long-local-password'});
 assert.equal(issuer.verifyToken(first.token).sub,account.accountId);
 assert.throws(()=>issuer.verifyToken(first.token+'tampered'),/authentication-denied/);
 issuer.logout(first.token);assert.throws(()=>issuer.verifyToken(first.token),/authentication-denied/);
 const second=issuer.login({username:'testplayer',password:'a-long-local-password'});
 time=2001;assert.throws(()=>issuer.verifyToken(second.token),/authentication-denied/);
 const third=issuer.login({username:'testplayer',password:'a-long-local-password'});
 issuer.revokeAccount('testplayer');assert.throws(()=>issuer.verifyToken(third.token),/authentication-denied/);
});

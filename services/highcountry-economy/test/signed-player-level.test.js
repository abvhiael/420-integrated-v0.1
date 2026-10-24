import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createSignedPlayerLevelProvider} from '../src/signed-player-level.js';
const gameId='0x'+'11'.repeat(32);
test('trusted signed level binds game chain issuer player freshness and exact integer',async()=>{
 const keys=generateKeyPairSync('ed25519');let now=1000,claim={};
 const fetchImpl=async()=>{const body=Buffer.from(JSON.stringify({
  domain:'HC.PLAYER.LEVEL.V1',issuer:'approved-levels',principal:'alice',gameId,chainId:420,
  level:2,expiresAt:now+30000,...claim
 }));
  return {ok:true,json:async()=>({payload:body.toString('base64url'),
   signature:sign(null,body,keys.privateKey).toString('base64url')})};
 };
 const source=createSignedPlayerLevelProvider({url:'https://levels.example/api/',publicKey:keys.publicKey,
  issuer:'approved-levels',gameId,chainId:420,clock:()=>now,fetchImpl});
 assert.equal(await source({principal:'alice'}),2);
 for(const bad of [{issuer:'forged'},{principal:'victim'},{chainId:421},{gameId:'0x'+'ee'.repeat(32)},
  {level:101},{level:-1},{expiresAt:1000}]){
  claim=bad;await assert.rejects(source({principal:'alice'}),/stale or wrong player level/);
 }
 claim={};
 assert.throws(()=>createSignedPlayerLevelProvider({url:'http://localhost:3000',publicKey:keys.publicKey,
  issuer:'approved-levels',gameId,chainId:420}),/untrusted level provider/);
});

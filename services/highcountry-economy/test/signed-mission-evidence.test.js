import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createSignedMissionEvidence} from '../src/signed-mission-evidence.js';
test('signed mission evidence rejects forgery, wrong game, wrong objective, expiry and private key',async()=>{
 const keys=generateKeyPairSync('ed25519'),gameId='0x'+'11'.repeat(32);let now=1000;
 const args={publicKey:keys.publicKey,issuer:'approved-missions',gameId,chainId:420,clock:()=>now};
 const verify=createSignedMissionEvidence(args);
 function envelope(overrides={}){
  const claim={domain:'HC.MISSION.EVIDENCE.V1',issuer:'approved-missions',principal:'alice',
   missionId:'journal-first-steps',objective:'verified-journal-entry',version:'HC-MISSIONS-V1',
   amount:1,sourceEvent:'verified-event-1',gameId,chainId:420,expiresAt:now+10000,...overrides};
  const p=Buffer.from(JSON.stringify(claim));
  return Buffer.from(JSON.stringify({payload:p.toString('base64url'),signature:sign(null,p,keys.privateKey).toString('base64url')})).toString('base64url');
 }
 const inputs={principal:'alice',missionId:'journal-first-steps',objective:'verified-journal-entry',
  version:'HC-MISSIONS-V1',amount:1};
 assert.deepEqual(await verify({...inputs,evidence:envelope()}),{sourceEvent:'verified-event-1'});
 const pemVerifier=createSignedMissionEvidence({...args,publicKey:keys.publicKey.export({format:'pem',type:'spki'})});
 assert.deepEqual(await pemVerifier({...inputs,evidence:envelope()}),{sourceEvent:'verified-event-1'});
 assert.throws(()=>createSignedMissionEvidence({...args,publicKey:keys.privateKey}),/invalid mission public key/);
 for(const bad of [{principal:'bob'},{chainId:421},{missionId:'other'},{amount:2},
  {objective:'self-trade'},{gameId:'0x'+'22'.repeat(32)},{issuer:'unapproved'},{expiresAt:now}]){
  assert.equal(await verify({...inputs,evidence:envelope(bad)}),false);
 }
 assert.equal(await verify({...inputs,evidence:'fake'}),false);
});

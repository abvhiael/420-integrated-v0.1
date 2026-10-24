import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {createSignedProgressionEvidence} from '../src/signed-progression-evidence.js';
test('signed progression proof binds principal, track, version, points and globally unique source event',async()=>{
 const keys=generateKeyPairSync('ed25519');
 let now=10000;
 const verify=createSignedProgressionEvidence({publicKey:keys.publicKey,issuer:'approved-quest-service',clock:()=>now});
 function envelope(overrides={}){
  const claim={domain:'HC.PROGRESSION.EVIDENCE.V1',issuer:'approved-quest-service',principal:'alice',
   trackId:'archive-index-I',version:'HC-SKILL-RESEARCH-V1',points:1,sourceEvent:'server-event-12',expiresAt:now+60000,...overrides};
  const bytes=Buffer.from(JSON.stringify(claim));
  return Buffer.from(JSON.stringify({payload:bytes.toString('base64url'),
   signature:sign(null,bytes,keys.privateKey).toString('base64url')})).toString('base64url');
 }
 const params={principal:'alice',trackId:'archive-index-I',version:'HC-SKILL-RESEARCH-V1',points:1};
 assert.deepEqual(await verify({...params,evidence:envelope()}),{sourceEvent:'server-event-12'});
 for(const change of [{principal:'bob'},{trackId:'different'},{version:'other'},{points:2}])
  assert.equal(await verify({...params,...change,evidence:envelope()}),false);
 assert.equal(await verify({...params,evidence:envelope({issuer:'forged'})}),false);
 assert.equal(await verify({...params,evidence:envelope({domain:'HC.CANONICAL.MINT'})}),false);
 assert.equal(await verify({...params,evidence:'tampered'}),false);
 now+=60001;
 assert.equal(await verify({...params,evidence:envelope({expiresAt:10001})}),false);
});

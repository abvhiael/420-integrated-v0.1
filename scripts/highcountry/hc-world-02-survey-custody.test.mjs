import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {approvalMessage,verifyCustodiedWorldSurvey} from './hc-world-02-survey-custody.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
test('unavailable terrain sources cannot certify 31,260 parcels',()=>{
 assert.throws(()=>verifyCustodiedWorldSurvey({world:{regions:[]},sources:[],approvals:[],approvedKeys:{}}),/complete three-region survey/);
});
test('approval messages are domain-separated and bind map, region and survey',()=>{
 const m={regionId:1,sourceTerrainSHA256:'a'.repeat(64),surveySHA256:'b'.repeat(64),approverKeyId:'owner-1'};
 const original=approvalMessage(m);
 assert.notDeepEqual(original,approvalMessage({...m,regionId:2}));
 assert.notDeepEqual(original,approvalMessage({...m,surveySHA256:'c'.repeat(64)}));
});
test('fake terrain bytes cannot pass their advertised hash',()=>{
 const r={schema:'HC.WORLD.REGIONAL.SURVEY.V1',regionId:1,status:'OWNER_APPROVED',approvalEvidence:'test',sourceTerrainSHA256:'a'.repeat(64)};
 const w={regions:[r,{...r,regionId:2},{...r,regionId:3}]};
 assert.throws(()=>verifyCustodiedWorldSurvey({world:w,sources:[{regionId:1,bytes:Buffer.from('not approved')},{regionId:2,bytes:Buffer.from('x')},{regionId:3,bytes:Buffer.from('x')}],approvals:[{regionId:1},{regionId:2},{regionId:3}],approvedKeys:{}}),/terrain source hash mismatch/);
});
test('forged owner signature fails despite valid terrain source hash',()=>{
 const source=Buffer.from('tile data');
 const {publicKey,privateKey}=generateKeyPairSync('ed25519');
 const r={schema:'HC.WORLD.REGIONAL.SURVEY.V1',regionId:1,status:'OWNER_APPROVED',approvalEvidence:'owner-signed',sourceTerrainSHA256:hash(source)};
 const unsigned={...r};delete unsigned.status;delete unsigned.approvalEvidence;
 const message=approvalMessage({regionId:1,sourceTerrainSHA256:r.sourceTerrainSHA256,surveySHA256:hash(Buffer.from(JSON.stringify(unsigned))),approverKeyId:'owner'});
 const signature=sign(null,message,privateKey);
 const world={regions:[r,{...r,regionId:2},{...r,regionId:3}]};
 assert.throws(()=>verifyCustodiedWorldSurvey({world,sources:[1,2,3].map(regionId=>({regionId,bytes:source})),approvals:[{regionId:1,approvalId:'owner-signed',approverKeyId:'owner',signatureBase64:Buffer.alloc(64).toString('base64')},{regionId:2},{regionId:3}],approvedKeys:{owner:publicKey.export({type:'spki',format:'pem'})}}),/invalid terrain approval signature/);
 assert.equal(signature.length,64);
});

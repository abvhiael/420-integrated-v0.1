// Independent custody boundary for HC-WORLD-02 final survey admission.
// Calling verifyWorldSurvey() alone tests geometry; it does not establish
// actual source-file custody, approval authenticity or evidence provenance.
import {createHash, createPublicKey, verify as cryptoVerify} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {verifyWorldSurvey} from './hc-world-02-full-survey.mjs';
const sha256=buffer=>createHash('sha256').update(buffer).digest('hex');
const hex64=value=>typeof value==='string'&&/^[a-f0-9]{64}$/i.test(value);
export function approvalMessage({regionId,sourceTerrainSHA256,surveySHA256,approverKeyId}){
 if(!Number.isSafeInteger(regionId)||!hex64(sourceTerrainSHA256)||!hex64(surveySHA256)||!approverKeyId)throw Error('invalid approval message fields');
 return Buffer.from(['HC-WORLD-02-TERRAIN-APPROVAL-V1',String(regionId),sourceTerrainSHA256.toLowerCase(),surveySHA256.toLowerCase(),approverKeyId].join('\n')+'\n','utf8');
}
export function verifyCustodiedWorldSurvey({world,sources,approvals,approvedKeys},baseline){
 if(!world||!Array.isArray(world.regions)||world.regions.length!==3)throw Error('complete three-region survey required');
 if(!Array.isArray(sources)||sources.length!==3||!Array.isArray(approvals)||approvals.length!==3)throw Error('complete evidence required');
 if(!approvedKeys||typeof approvedKeys!=='object')throw Error('trusted approval keyring required');
 const seen=new Set();
 const clone=structuredClone(world);
 // Never trust approval flags from the submitted JSON. Signature validation
 // is performed against the region payload WITHOUT its approval fields.
 for(const region of clone.regions){
  if(seen.has(region.regionId))throw Error('duplicate region');seen.add(region.regionId);
  const source=sources.find(x=>x.regionId===region.regionId);
  const approval=approvals.find(x=>x.regionId===region.regionId);
  if(!source||!approval||!(source.bytes instanceof Uint8Array))throw Error('missing actual source bytes or approval');
  const actualSourceSHA256=sha256(source.bytes);
  if(!hex64(region.sourceTerrainSHA256)||actualSourceSHA256!==region.sourceTerrainSHA256.toLowerCase())throw Error('terrain source hash mismatch');
  if(region.status!=='OWNER_APPROVED')throw Error('unapproved region');
  if(region.approvalEvidence!==approval.approvalId)throw Error('approval ID mismatch');
  const keyPem=approvedKeys[approval.approverKeyId];
  if(!keyPem||!approval.approvalId||!approval.signatureBase64||!approval.approverKeyId)throw Error('missing trusted signed approval');
  const signature=Buffer.from(approval.signatureBase64,'base64');
  if(!signature.length||signature.toString('base64')!==approval.signatureBase64)throw Error('invalid approval signature encoding');
  const unsigned=structuredClone(region);
  delete unsigned.status;delete unsigned.approvalEvidence;
  const surveySHA256=sha256(Buffer.from(JSON.stringify(unsigned)));
  const message=approvalMessage({regionId:region.regionId,sourceTerrainSHA256:actualSourceSHA256,surveySHA256,approverKeyId:approval.approverKeyId});
  const publicKey=createPublicKey(keyPem);
  if(publicKey.asymmetricKeyType!=='ed25519'||!cryptoVerify(null,message,publicKey,signature))throw Error('invalid terrain approval signature');
 }
 // Final geometry checks are still authoritative and cannot be overridden
 // by any approval signature. A signature is not a substitute for road access.
 return {...verifyWorldSurvey(clone,baseline),status:'CUSTODIED_APPROVED_SURVEY_GEOMETRY_VALID',sourceProvenance:'BYTE_HASHED_AND_ED25519_APPROVED'};
}
export function verifySurveyBundleFiles({worldPath,sourceFiles,approvalPath,keyringPath},baseline){
 const world=JSON.parse(readFileSync(worldPath,'utf8'));
 const approvals=JSON.parse(readFileSync(approvalPath,'utf8'));
 const approvedKeys=JSON.parse(readFileSync(keyringPath,'utf8'));
 const sources=sourceFiles.map(({regionId,path})=>({regionId,bytes:readFileSync(path)}));
 return verifyCustodiedWorldSurvey({world,sources,approvals,approvedKeys},baseline);
}

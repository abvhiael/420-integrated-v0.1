const CHANNEL_RE=/^[A-Z0-9][A-Z0-9_-]{0,63}$/;
const ID_RE=/^[a-z0-9][a-z0-9._-]{0,127}$/;
export class ReleaseCandidateCloseoutError420 extends Error{constructor(message){super(message);this.name='ReleaseCandidateCloseoutError420';}}
function assert420(condition,message){if(!condition)throw new ReleaseCandidateCloseoutError420(message);}
function plain420(value){return value&&typeof value==='object'&&!Array.isArray(value);}
function sha420(value,name){assert420(typeof value==='string'&&/^[0-9a-f]{40}$/.test(value),`${name} must be a lowercase 40-hex commit SHA`);return value;}
function iso420(value,name){assert420(typeof value==='string'&&!Number.isNaN(Date.parse(value)),`${name} must be an ISO timestamp`);return new Date(value).toISOString();}
export function validateReleaseCandidate420(candidate){
  assert420(plain420(candidate),'release candidate descriptor is required');
  assert420(candidate.schemaVersion==='1.0.0','unsupported release candidate schemaVersion');
  assert420(typeof candidate.candidateId==='string'&&ID_RE.test(candidate.candidateId),'candidateId is invalid');
  sha420(candidate.commitSha,'candidate commitSha');
  assert420(typeof candidate.releaseChannel==='string'&&CHANNEL_RE.test(candidate.releaseChannel),'releaseChannel is invalid');
  iso420(candidate.createdAt,'createdAt');
  assert420(candidate.canonicalAuthority===false,'release candidate must declare canonicalAuthority false');
  return candidate;
}
export function createReleaseCandidateCloseout420({candidate,readiness}){
  validateReleaseCandidate420(candidate);
  assert420(plain420(readiness),'production readiness report is required');
  assert420(readiness.canonicalAuthority===false,'production readiness must remain noncanonical');
  assert420(readiness.securityCertification===false,'production readiness must not claim security certification');
  const candidateSha=sha420(candidate.commitSha,'candidate commitSha');
  const readinessSha=sha420(readiness.candidateCommitSha,'readiness candidateCommitSha');
  assert420(candidateSha===readinessSha,'release candidate commit does not match readiness evidence');
  assert420(candidate.releaseChannel===readiness.releaseChannel,'release candidate channel does not match readiness evidence');
  const state=readiness.result==='FAIL'?'FAIL':readiness.result==='READY'&&readiness.readyForProductionLaunch===true?'READY':'BLOCKED';
  return Object.freeze({schemaVersion:'1.0.0',candidateId:candidate.candidateId,commitSha:candidateSha,releaseChannel:candidate.releaseChannel,createdAt:new Date(candidate.createdAt).toISOString(),state,closeoutReady:state==='READY',publicTestnetReady:readiness.publicTestnetReady===true,canonicalAuthority:false,securityCertification:false,readinessResult:readiness.result,securityRule:'release-candidate closeout binds one exact commit and release channel to DEVHUB-19 evidence; it cannot deploy, activate a network, approve governance, sign releases, certify security, or override repository release readiness'});
}
export function createReleaseCandidateCloseoutView420(){return Object.freeze({title:'release candidate closeout',canonicalAuthority:false,securityCertification:false,requiresExactCommitBinding:true,requiresExactReleaseChannel:true,states:Object.freeze(['READY','BLOCKED','FAIL']),securityRule:'closeout is a provenance-bound release gate only; evidence from another commit or channel is never reusable'});}

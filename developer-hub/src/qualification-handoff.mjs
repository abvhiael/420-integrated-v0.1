const SHA_RE=/^[0-9a-f]{40}$/;
const REQUIRED_RUNS=Object.freeze(['420 Developer Hub','420Docs Qualification','420 Integrated Qualification']);

export class QualificationHandoffError420 extends Error{constructor(message){super(message);this.name='QualificationHandoffError420';}}
function assert420(condition,message){if(!condition)throw new QualificationHandoffError420(message);}
function plain420(value){return value&&typeof value==='object'&&!Array.isArray(value);}
function time420(value,name){assert420(typeof value==='string'&&!Number.isNaN(Date.parse(value)),`${name} must be an ISO timestamp`);return new Date(value).toISOString();}

export function createQualificationEvidenceHandoff420({report,evidence,expectedCommitSha,now=new Date().toISOString(),maxAgeSeconds=86400}){
  assert420(plain420(report),'qualification report is required');
  assert420(report.canonicalAuthority===false,'qualification report must remain noncanonical');
  assert420(report.securityCertification===false,'qualification report must remain non-certifying');
  assert420(plain420(evidence),'qualification evidence is required');
  assert420(plain420(evidence.provenance),'qualification provenance is required');
  const provenance=evidence.provenance;
  assert420(provenance.provider==='github-actions','unsupported qualification provenance provider');
  assert420(typeof provenance.repository==='string'&&/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(provenance.repository),'qualification repository is invalid');
  assert420(typeof provenance.commitSha==='string'&&SHA_RE.test(provenance.commitSha),'qualification commitSha must be a lowercase 40-hex SHA');
  assert420(typeof expectedCommitSha==='string'&&SHA_RE.test(expectedCommitSha),'expected commit SHA must be a lowercase 40-hex SHA');
  assert420(provenance.commitSha===expectedCommitSha,'qualification evidence commit does not match release candidate');
  const observedAt=time420(evidence.observedAt,'observedAt');
  const nowIso=time420(now,'now');
  assert420(Number.isInteger(maxAgeSeconds)&&maxAgeSeconds>0,'maxAgeSeconds must be a positive integer');
  const ageMs=new Date(nowIso).getTime()-new Date(observedAt).getTime();
  assert420(ageMs>=0,'qualification evidence cannot be from the future');
  assert420(ageMs<=maxAgeSeconds*1000,'qualification evidence is stale');
  assert420(Array.isArray(provenance.runs),'qualification workflow runs are required');
  const byName=new Map();
  for(const run of provenance.runs){
    assert420(plain420(run),'qualification workflow run is invalid');
    assert420(typeof run.name==='string'&&run.name.length>0,'qualification workflow name is required');
    assert420(!byName.has(run.name),`duplicate qualification workflow: ${run.name}`);
    assert420(Number.isInteger(run.runId)&&run.runId>0,`qualification runId is invalid for ${run.name}`);
    assert420(run.conclusion==='success',`qualification workflow is not successful: ${run.name}`);
    assert420(typeof run.commitSha==='string'&&SHA_RE.test(run.commitSha),`qualification workflow commitSha is invalid for ${run.name}`);
    assert420(run.commitSha===expectedCommitSha,`qualification workflow is bound to another commit: ${run.name}`);
    byName.set(run.name,run);
  }
  for(const name of REQUIRED_RUNS)assert420(byName.has(name),`missing required qualification workflow: ${name}`);
  const releaseEvidenceReady=report.result==='PASS'&&report.qualifiedForDeveloperRelease===true;
  return Object.freeze({
    schemaVersion:'1.0.0',provider:'github-actions',repository:provenance.repository,commitSha:expectedCommitSha,observedAt,
    workflowRuns:Object.freeze(REQUIRED_RUNS.map(name=>Object.freeze({name,runId:byName.get(name).runId,conclusion:'success'}))),
    qualificationResult:report.result,releaseEvidenceReady,canonicalAuthority:false,securityCertification:false,
    securityRule:'CI provenance proves only that required qualification workflows succeeded for this exact candidate SHA; it grants no protocol, Registry, Wallet, governance, Identity, verification, settlement, or finality authority'
  });
}

export function createQualificationHandoffView420(){
  return Object.freeze({title:'qualification CI evidence handoff',requiredWorkflows:REQUIRED_RUNS,canonicalAuthority:false,securityCertification:false,requiresExactCommitBinding:true,requiresFreshEvidence:true,securityRule:'workflow success is release evidence only and never protocol authority'});
}

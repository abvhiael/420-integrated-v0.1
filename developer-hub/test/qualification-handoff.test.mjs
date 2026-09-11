import test from 'node:test';
import assert from 'node:assert/strict';
import { createQualificationEvidenceHandoff420, createQualificationHandoffView420, QualificationHandoffError420 } from '../src/qualification-handoff.mjs';

const sha='1111111111111111111111111111111111111111';
const other='2222222222222222222222222222222222222222';
function report(result='PASS'){return {result,qualifiedForDeveloperRelease:result==='PASS',canonicalAuthority:false,securityCertification:false};}
function evidence(overrides={}){return {observedAt:'2026-09-11T17:00:00.000Z',provenance:{provider:'github-actions',repository:'abvhiael/420-integrated-v0.1',commitSha:sha,runs:[
  {name:'420 Developer Hub',runId:1,conclusion:'success',commitSha:sha},
  {name:'420Docs Qualification',runId:2,conclusion:'success',commitSha:sha},
  {name:'420 Integrated Qualification',runId:3,conclusion:'success',commitSha:sha}
]},...overrides};}

test('exact fresh successful workflow evidence is release-ready only for a PASS report',()=>{
  const handoff=createQualificationEvidenceHandoff420({report:report(),evidence:evidence(),expectedCommitSha:sha,now:'2026-09-11T17:30:00.000Z'});
  assert.equal(handoff.releaseEvidenceReady,true);
  assert.equal(handoff.commitSha,sha);
  assert.equal(handoff.canonicalAuthority,false);
  assert.equal(handoff.securityCertification,false);
});

test('valid CI evidence does not upgrade a BLOCKED qualification report',()=>{
  const handoff=createQualificationEvidenceHandoff420({report:report('BLOCKED'),evidence:evidence(),expectedCommitSha:sha,now:'2026-09-11T17:30:00.000Z'});
  assert.equal(handoff.releaseEvidenceReady,false);
});

test('evidence from another commit fails closed',()=>{
  assert.throws(()=>createQualificationEvidenceHandoff420({report:report(),evidence:evidence(),expectedCommitSha:other,now:'2026-09-11T17:30:00.000Z'}),QualificationHandoffError420);
});

test('stale evidence fails closed',()=>{
  assert.throws(()=>createQualificationEvidenceHandoff420({report:report(),evidence:evidence(),expectedCommitSha:sha,now:'2026-09-13T17:00:01.000Z',maxAgeSeconds:86400}),/stale/);
});

test('missing required workflow fails closed',()=>{
  const value=evidence();value.provenance.runs=value.provenance.runs.slice(0,2);
  assert.throws(()=>createQualificationEvidenceHandoff420({report:report(),evidence:value,expectedCommitSha:sha,now:'2026-09-11T17:30:00.000Z'}),/missing required qualification workflow/);
});

test('failed workflow cannot be handoff evidence',()=>{
  const value=evidence();value.provenance.runs[0]={...value.provenance.runs[0],conclusion:'failure'};
  assert.throws(()=>createQualificationEvidenceHandoff420({report:report(),evidence:value,expectedCommitSha:sha,now:'2026-09-11T17:30:00.000Z'}),/not successful/);
});

test('handoff view explicitly remains non-authoritative',()=>{
  const view=createQualificationHandoffView420();
  assert.equal(view.canonicalAuthority,false);assert.equal(view.securityCertification,false);assert.equal(view.requiresExactCommitBinding,true);
});

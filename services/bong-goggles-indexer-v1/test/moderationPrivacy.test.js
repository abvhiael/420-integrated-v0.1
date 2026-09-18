import test from 'node:test';
import assert from 'node:assert/strict';
import { BongGogglesModerationOperationsProjection } from '../src/moderationOperations.js';
import { buildModerationCaseDetail } from '../src/moderationCaseDetail.js';
import { buildModerationAuditTimeline, buildOperatorAnnotations } from '../src/moderationPolicyAudit.js';
import {
  sanitizeModerationTelemetry,
  buildLeastDataModerationQueues,
  buildModerationAuditExport,
  assertOpaqueEvidenceReferences,
} from '../src/moderationPrivacy.js';

function log(eventName,args,n=1){
  return {eventName,args,chainId:420,blockNumber:n,blockHash:`0xblock${n}`,transactionHash:`0xtx${n}`,transactionIndex:0,logIndex:0};
}
function projection(){
  const p=new BongGogglesModerationOperationsProjection();
  p.apply(log('ReportSubmitted',{reportId:'r1',reporter:'0xr',subjectAccount:'0xs',targetType:'POST',targetId:'p1',reasonCode:'spam'},1));
  p.apply(log('CaseOpened',{caseId:'c1',reportId:'r1',operator:'0xo',policyVersion:'v1'},2));
  return p;
}

test('telemetry redacts secrets and rejects private Messenger payloads', () => {
  const safe=sanitizeModerationTelemetry({
    event:'case-view',token:'abc',nested:{secret:'hidden',caseId:'c1'},
  });
  assert.equal(safe.token,'[REDACTED]');
  assert.equal(safe.nested.secret,'[REDACTED]');
  assert.equal(safe.nested.caseId,'c1');
  assert.throws(()=>sanitizeModerationTelemetry({
    event:'message',messengerPayload:{messageBody:'private text'},
  }),/private Messenger payloads/);
});

test('least-data queues omit reporter, provenance and unrelated fields', () => {
  const p=projection();
  const queues=buildLeastDataModerationQueues(p.operatorQueues());
  assert.equal(queues.untriagedReports[0].reportId,'r1');
  assert.equal('reporter' in queues.untriagedReports[0],false);
  assert.equal('provenance' in queues.untriagedReports[0],false);
  assert.equal(queues.leastData,true);
});

test('opaque evidence assertions reject embedded content fields', () => {
  assert.equal(assertOpaqueEvidenceReferences([
    {source:'REPORT',reference:'0xhash',contentIncluded:false},
  ]),true);
  assert.throws(()=>assertOpaqueEvidenceReferences([
    {source:'REPORT',reference:'0xhash',contentIncluded:false,content:'private'},
  ]),/private content field/);
});

test('audit export keeps only opaque evidence references and redacts sensitive metadata', () => {
  const p=projection();
  const detail=buildModerationCaseDetail(p.snapshot(),'c1',{
    report:{reportId:'r1',subjectAccount:'0xs',targetId:'p1',evidenceHash:'0xevidence'},
    caseRecord:{caseId:'c1',reportId:'r1',subjectAccount:'0xs',targetId:'p1'},
  });
  const timeline=buildModerationAuditTimeline(p.snapshot());
  const annotations=buildOperatorAnnotations({caseId:'c1',notes:[{text:'local note'}],labels:['review']});
  const exported=buildModerationAuditExport({
    timeline,
    evidence:detail.evidence,
    annotations,
    metadata:{token:'secret-token',requestId:'req-1'},
  });
  assert.deepEqual(exported.evidence.map((item)=>item.reference),['0xevidence']);
  assert.ok(exported.evidence.every((item)=>item.contentIncluded===false));
  assert.equal(exported.metadata.token,'[REDACTED]');
  assert.equal(exported.metadata.requestId,'req-1');
  assert.equal(exported.secretsIncluded,false);
  assert.equal(exported.privatePayloadsIncluded,false);
  assert.equal(exported.rawPayloadsIncluded,false);
});

test('audit export rejects private Messenger material instead of serializing it', () => {
  assert.throws(()=>buildModerationAuditExport({
    timeline:[],
    evidence:[],
    metadata:{decryptedContent:'private dm'},
  }),/private Messenger payloads/);
});

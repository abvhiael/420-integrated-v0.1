function required(value, field) {
  if (value === undefined || value === null || value === '') throw new Error(`${field} is required`);
  return value;
}

const SENSITIVE_KEYS = new Set([
  'secret','secrets','token','tokens','accessToken','refreshToken','authorization',
  'privateKey','seed','mnemonic','password','cookie','cookies','session','sessionId',
  'payload','rawPayload','messageBody','body','content','plaintext','decrypted',
  'decryptedContent','privateMessage','messengerPayload',
]);

const PRIVATE_MESSENGER_KEYS = new Set([
  'messageBody','plaintext','decrypted','decryptedContent','privateMessage','messengerPayload',
]);

function redactValue(value) {
  if (Array.isArray(value)) return value.map(redactValue);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(key)) {
      out[key] = '[REDACTED]';
      continue;
    }
    out[key] = redactValue(item);
  }
  return out;
}

function containsPrivateMessengerPayload(value) {
  if (Array.isArray(value)) return value.some(containsPrivateMessengerPayload);
  if (!value || typeof value !== 'object') return false;
  for (const [key, item] of Object.entries(value)) {
    if (PRIVATE_MESSENGER_KEYS.has(key)) return true;
    if (containsPrivateMessengerPayload(item)) return true;
  }
  return false;
}

export function sanitizeModerationTelemetry(event) {
  if (!event || typeof event !== 'object') throw new Error('telemetry event required');
  if (containsPrivateMessengerPayload(event)) {
    throw new Error('private Messenger payloads are not permitted in moderation telemetry');
  }
  return Object.freeze({
    ...redactValue(event),
    redacted: true,
    authoritative: false,
  });
}

export function buildLeastDataModerationQueues(queues) {
  if (!queues || queues.authoritative !== false) throw new Error('non-authoritative moderation queues required');
  const untriagedReports = (queues.untriagedReports ?? []).map((report) => Object.freeze({
    reportId:String(required(report.reportId,'reportId')),
    subjectAccount:String(required(report.subjectAccount,'subjectAccount')),
    targetType:String(required(report.targetType,'targetType')),
    targetId:String(required(report.targetId,'targetId')),
    reasonCode:String(required(report.reasonCode,'reasonCode')),
    triageState:String(required(report.triageState,'triageState')),
    authoritative:false,
  }));
  const openCases = (queues.openCases ?? []).map((item) => Object.freeze({
    caseId:String(required(item.caseId,'caseId')),
    reportId:String(required(item.reportId,'reportId')),
    subjectAccount:String(required(item.subjectAccount,'subjectAccount')),
    targetType:String(required(item.targetType,'targetType')),
    targetId:String(required(item.targetId,'targetId')),
    state:String(required(item.state,'state')),
    authoritative:false,
  }));
  const pendingAppeals = (queues.pendingAppeals ?? []).map((appeal) => Object.freeze({
    appealId:String(required(appeal.appealId,'appealId')),
    caseId:String(required(appeal.caseId,'caseId')),
    state:String(required(appeal.state,'state')),
    authoritative:false,
  }));
  return Object.freeze({
    untriagedReports:Object.freeze(untriagedReports),
    openCases:Object.freeze(openCases),
    pendingAppeals:Object.freeze(pendingAppeals),
    counts:Object.freeze({
      untriagedReports:untriagedReports.length,
      openCases:openCases.length,
      pendingAppeals:pendingAppeals.length,
    }),
    leastData:true,
    authoritative:false,
  });
}

export function buildModerationAuditExport({
  timeline = [],
  evidence = [],
  annotations = null,
  metadata = {},
} = {}) {
  if (!Array.isArray(timeline) || !Array.isArray(evidence)) throw new Error('timeline and evidence arrays required');
  if (containsPrivateMessengerPayload(metadata) || containsPrivateMessengerPayload(annotations)) {
    throw new Error('private Messenger payloads are not permitted in moderation audit exports');
  }

  const safeTimeline = timeline.map((item) => redactValue({
    source:item.source,
    id:item.id,
    provenance:item.provenance,
    canonicalEvent:item.canonicalEvent === true,
  }));
  const safeEvidence = evidence.map((item) => Object.freeze({
    source:String(required(item.source,'evidence source')),
    reference:String(required(item.reference,'evidence reference')),
    actionId:item.actionId === undefined ? null : String(item.actionId),
    contentIncluded:false,
    authoritative:false,
  }));

  return Object.freeze({
    timeline:Object.freeze(safeTimeline.map((item)=>Object.freeze(item))),
    evidence:Object.freeze(safeEvidence),
    annotations:annotations ? Object.freeze(redactValue(annotations)) : null,
    metadata:Object.freeze(redactValue(metadata)),
    secretsIncluded:false,
    tokensIncluded:false,
    privatePayloadsIncluded:false,
    rawPayloadsIncluded:false,
    authoritative:false,
  });
}

export function assertOpaqueEvidenceReferences(evidence) {
  if (!Array.isArray(evidence)) throw new Error('evidence array required');
  for (const item of evidence) {
    required(item.reference,'evidence reference');
    if (item.contentIncluded !== false) throw new Error('evidence content must remain excluded');
    for (const forbidden of ['content','body','payload','messageBody','plaintext','decryptedContent','rationale']) {
      if (Object.prototype.hasOwnProperty.call(item, forbidden)) throw new Error('evidence reference contains private content field');
    }
  }
  return true;
}

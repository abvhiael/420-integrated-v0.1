function required(value, field) {
  if (value === undefined || value === null || value === '') throw new Error(`${field} is required`);
  return value;
}

function normalizeTime(value, field) {
  const n = Number(required(value, field));
  if (!Number.isFinite(n) || n < 0) throw new Error(`${field} must be a non-negative number`);
  return n;
}

function freezeClone(value) {
  return Object.freeze(structuredClone(value));
}

export function projectOperatorCapabilities({
  requirements = [],
  grants = [],
  now,
} = {}) {
  if (!Array.isArray(requirements)) throw new Error('requirements must be an array');
  if (!Array.isArray(grants)) throw new Error('grants must be an array');
  const currentTime = normalizeTime(now, 'now');

  const index = new Map();
  for (const grant of grants) {
    const actionId = String(required(grant.actionId, 'actionId'));
    const scope = String(required(grant.scope, 'scope'));
    index.set(`${actionId}|${scope}`, grant);
  }

  const capabilities = requirements.map((requirement) => {
    const actionId = String(required(requirement.actionId, 'actionId'));
    const scope = String(required(requirement.scope, 'scope'));
    const grant = index.get(`${actionId}|${scope}`) ?? null;
    let authorized = false;
    let denialReason = null;
    let expiresAt = null;

    if (!grant) {
      denialReason = 'MISSING_CAPABILITY';
    } else {
      expiresAt = grant.expiresAt === undefined || grant.expiresAt === null ? null : Number(grant.expiresAt);
      if (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt < 0)) throw new Error('capability expiresAt must be non-negative');
      if (grant.revoked === true) denialReason = 'REVOKED_CAPABILITY';
      else if (expiresAt !== null && expiresAt <= currentTime) denialReason = 'EXPIRED_CAPABILITY';
      else authorized = true;
    }

    return Object.freeze({
      actionId,
      scope,
      authorized,
      denialReason,
      expiresAt,
      authoritative: false,
    });
  }).sort((a,b)=>a.actionId.localeCompare(b.actionId)||a.scope.localeCompare(b.scope));

  return Object.freeze({ capabilities:Object.freeze(capabilities), now:currentTime, authoritative:false });
}

export function buildModerationAuditTimeline(snapshot) {
  if (!snapshot || snapshot.authoritative !== false) throw new Error('non-authoritative moderation snapshot required');
  const sources = ['reports','cases','actions','appeals','emergencyHides'];
  const events = [];
  for (const source of sources) {
    if (!Array.isArray(snapshot[source])) throw new Error(`${source} projections required`);
    for (const [, item] of snapshot[source]) {
      if (item?.provenance) events.push({source,id:item.reportId??item.caseId??item.actionId??item.appealId??item.targetScope,provenance:item.provenance});
      if (item?.revocationProvenance) events.push({source,id:item.actionId,provenance:item.revocationProvenance});
      if (item?.resolutionProvenance) events.push({source,id:item.appealId,provenance:item.resolutionProvenance});
      if (item?.closedProvenance) events.push({source,id:item.caseId,provenance:item.closedProvenance});
    }
  }
  events.sort((a,b)=>
    Number(a.provenance.blockNumber)-Number(b.provenance.blockNumber) ||
    Number(a.provenance.transactionIndex)-Number(b.provenance.transactionIndex) ||
    Number(a.provenance.logIndex)-Number(b.provenance.logIndex) ||
    String(a.provenance.eventName).localeCompare(String(b.provenance.eventName))
  );
  return Object.freeze(events.map((event)=>Object.freeze({
    source:event.source,
    id:String(required(event.id,'audit id')),
    provenance:freezeClone(event.provenance),
    canonicalEvent:true,
    authoritative:false,
  })));
}

export function buildOperatorAnnotations({ caseId, notes = [], labels = [] } = {}) {
  if (!Array.isArray(notes) || !Array.isArray(labels)) throw new Error('notes and labels must be arrays');
  return Object.freeze({
    caseId:String(required(caseId,'caseId')),
    notes:Object.freeze(notes.map((note)=>Object.freeze({text:String(required(note.text,'note text')),localOnly:true,authoritative:false}))),
    labels:Object.freeze(labels.map((label)=>Object.freeze({value:String(required(label,'label')),localOnly:true,authoritative:false}))),
    canonicalEvidenceIncluded:false,
    canonicalDecisionIncluded:false,
    authoritative:false,
  });
}

export function buildCanonicalWriteLinks(intent, {
  walletBaseUrl,
  explorerBaseUrl,
  transactionHash = null,
} = {}) {
  if (!intent || intent.authoritative !== false) throw new Error('non-authoritative canonical-write intent required');
  const contract = String(required(intent.contract,'contract'));
  const method = String(required(intent.method,'method'));
  const walletBase = String(required(walletBaseUrl,'walletBaseUrl')).replace(/\/$/,'');
  const explorerBase = String(required(explorerBaseUrl,'explorerBaseUrl')).replace(/\/$/,'');
  const wallet = `${walletBase}/confirm?contract=${encodeURIComponent(contract)}&method=${encodeURIComponent(method)}`;
  const explorer = transactionHash
    ? `${explorerBase}/tx/${encodeURIComponent(String(transactionHash))}`
    : `${explorerBase}/contract/${encodeURIComponent(contract)}`;

  return Object.freeze({
    wallet,
    explorer,
    transactionHash:transactionHash ? String(transactionHash) : null,
    canonicalWrite:true,
    authoritative:false,
  });
}

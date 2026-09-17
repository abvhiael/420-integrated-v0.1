const SECRET_KEYS = new Set([
  'body', 'message', 'plaintext', 'ciphertext', 'privateKey', 'sessionSecret', 'credential',
  'token', 'cookie', 'authorization', 'signedUrl', 'privateUrl', 'providerUrl', 'payload',
  'attachmentKey', 'decryptionKey', 'epochMaterial'
]);

export const CLOSEOUT_DRILLS = Object.freeze([
  'transport-loss',
  'duplicate-replay',
  'stale-epoch',
  'device-loss',
  'blocked-peer',
  'attachment-failure'
]);

function required(value, field) {
  if (value === undefined || value === null || value === '') throw new Error(`missing ${field}`);
  return value;
}

function boundedInteger(value, field, min, max) {
  const n = Number(required(value, field));
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error(`invalid ${field}`);
  return n;
}

export function redactTelemetry(value) {
  if (Array.isArray(value)) return value.map(redactTelemetry);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_KEYS.has(key)) out[key] = '[REDACTED]';
    else out[key] = redactTelemetry(item);
  }
  return out;
}

export function buildMessagingMetric({ operation, outcome, latencyMs, retries = 0, reason = null, labels = {} }) {
  const op = String(required(operation, 'operation')).trim();
  const result = String(required(outcome, 'outcome')).trim().toLowerCase();
  if (!['success', 'failure', 'denied'].includes(result)) throw new Error('invalid outcome');
  return redactTelemetry({
    subsystem: 'bong-goggles-messaging',
    operation: op,
    outcome: result,
    latencyMs: boundedInteger(latencyMs, 'latencyMs', 0, 300000),
    retries: boundedInteger(retries, 'retries', 0, 100),
    reason: reason === null ? null : String(reason).slice(0, 160),
    labels
  });
}

export function qualifyDrill({ name, expected, observed }) {
  if (!CLOSEOUT_DRILLS.includes(name)) throw new Error('unknown closeout drill');
  const exp = String(required(expected, 'expected')).trim();
  const obs = String(required(observed, 'observed')).trim();
  return { name, expected: exp, observed: obs, passed: exp === obs };
}

export function buildLoadQualification(input = {}) {
  return {
    inboxConversations: boundedInteger(input.inboxConversations ?? 500, 'inboxConversations', 1, 5000),
    sends: boundedInteger(input.sends ?? 1000, 'sends', 1, 10000),
    receipts: boundedInteger(input.receipts ?? 2000, 'receipts', 1, 20000),
    attachments: boundedInteger(input.attachments ?? 250, 'attachments', 1, 2000),
    concurrency: boundedInteger(input.concurrency ?? 20, 'concurrency', 1, 100)
  };
}

export function evaluateCloseoutReadiness({ drills, load, telemetryRedactionVerified, runbookPresent }) {
  const normalizedDrills = Array.isArray(drills) ? drills : [];
  const byName = new Map(normalizedDrills.map((d) => [d.name, d]));
  const missingDrills = CLOSEOUT_DRILLS.filter((name) => !byName.has(name));
  const failedDrills = CLOSEOUT_DRILLS.filter((name) => byName.has(name) && byName.get(name).passed !== true);
  const loadQualified = Boolean(load && load.passed === true);
  const ready = missingDrills.length === 0 && failedDrills.length === 0 && loadQualified && telemetryRedactionVerified === true && runbookPresent === true;
  return {
    ready,
    missingDrills,
    failedDrills,
    loadQualified,
    telemetryRedactionVerified: telemetryRedactionVerified === true,
    runbookPresent: runbookPresent === true
  };
}

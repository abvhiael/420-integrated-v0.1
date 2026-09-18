export const CLIENT_SCHEMA = Object.freeze({ major: 14, minor: 0 });
export const MAX_PAGE_SIZE = 100;
export const MAX_STALE_SECONDS = 30;

export class ExchangeApiError extends Error {
  constructor(code, message, { status = 0, stableId = null } = {}) {
    super(message);
    this.name = 'ExchangeApiError';
    this.code = code;
    this.status = status;
    this.stableId = stableId;
  }
}

function requireObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ExchangeApiError('MALFORMED_QUERY', `invalid ${label}`);
  }
  return value;
}

function requireId(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new ExchangeApiError('MALFORMED_QUERY', `missing ${label}`);
  }
  return value;
}

function assertApiVersion(headers) {
  const major = Number(headers?.get?.('x-420-api-major') ?? 13);
  const minor = Number(headers?.get?.('x-420-api-minor') ?? 6);
  if (major !== 13 || minor > 6 || !Number.isInteger(minor)) {
    throw new ExchangeApiError('UNSUPPORTED_VERSION', 'unsupported Exchange API version', { status: 406 });
  }
}

async function decodeResponse(response) {
  assertApiVersion(response.headers);
  let body;
  try {
    body = await response.json();
  } catch {
    throw new ExchangeApiError('MALFORMED_QUERY', 'invalid JSON response', { status: response.status });
  }
  if (!response.ok) {
    const error = body?.error ?? {};
    throw new ExchangeApiError(
      error.code ?? 'MALFORMED_QUERY',
      error.message ?? `Exchange API request failed: ${response.status}`,
      { status: response.status, stableId: error.stableId ?? null },
    );
  }
  return body;
}

export function validateSnapshot(snapshot) {
  requireObject(snapshot, 'snapshot');
  requireId(snapshot.marketSubjectId, 'marketSubjectId');
  requireId(snapshot.snapshotId, 'snapshotId');
  if (!Number.isInteger(snapshot.canonicalHead) || snapshot.canonicalHead <= 0) {
    throw new ExchangeApiError('MALFORMED_QUERY', 'invalid canonicalHead');
  }
  if (typeof snapshot.canonicality !== 'string') {
    throw new ExchangeApiError('MALFORMED_QUERY', 'missing canonicality');
  }
  return snapshot;
}

export function validateHistoryPage(page) {
  requireObject(page, 'history page');
  if (!Array.isArray(page.records)) throw new ExchangeApiError('MALFORMED_QUERY', 'history records must be an array');
  if (page.records.length > MAX_PAGE_SIZE) throw new ExchangeApiError('PAGE_LIMIT_EXCEEDED', 'history page exceeds V13.4 bound');
  for (const record of page.records) {
    requireId(record.recordId, 'recordId');
    requireId(record.subjectId, 'subjectId');
    if (typeof record.active !== 'boolean') throw new ExchangeApiError('MALFORMED_QUERY', 'history active flag missing');
  }
  if (typeof page.nextCursor !== 'string') throw new ExchangeApiError('MALFORMED_QUERY', 'history cursor missing');
  return page;
}

export function validateStreamEvent(event) {
  requireObject(event, 'stream event');
  if (!Number.isInteger(event.sequence) || event.sequence <= 0) throw new ExchangeApiError('MALFORMED_QUERY', 'invalid stream sequence');
  if (!['DATA', 'HEARTBEAT', 'REORG', 'REPLACEMENT'].includes(event.kind)) {
    throw new ExchangeApiError('MALFORMED_QUERY', 'unknown stream event kind');
  }
  if (!Number.isInteger(event.canonicalHead) || event.canonicalHead <= 0) {
    throw new ExchangeApiError('MALFORMED_QUERY', 'invalid stream canonicalHead');
  }
  if (event.kind === 'REORG') requireId(event.affectedRecordId, 'affectedRecordId');
  if (event.kind === 'REPLACEMENT') {
    requireId(event.affectedRecordId, 'affectedRecordId');
    requireId(event.replacementRecordId, 'replacementRecordId');
    if (event.affectedRecordId === event.replacementRecordId) {
      throw new ExchangeApiError('MALFORMED_QUERY', 'replacement IDs must differ');
    }
  }
  return event;
}

export class ExchangeClient {
  constructor({ baseUrl, fetchImpl = globalThis.fetch } = {}) {
    if (!baseUrl || typeof baseUrl !== 'string') throw new Error('Exchange baseUrl required');
    if (typeof fetchImpl !== 'function') throw new Error('fetch implementation required');
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.fetchImpl = fetchImpl;
  }

  async snapshot(subjectId) {
    requireId(subjectId, 'subjectId');
    const response = await this.fetchImpl(`${this.baseUrl}/v13/markets/${encodeURIComponent(subjectId)}/snapshot`, {
      headers: { 'accept': 'application/json', 'x-420-client-schema': '14.0' },
    });
    return validateSnapshot((await decodeResponse(response)).snapshot);
  }

  async history({ kind, subjectId = null, activeOnly = true, cursor = '', limit = 50 } = {}) {
    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
      throw new ExchangeApiError('PAGE_LIMIT_EXCEEDED', 'history limit must be 1..100');
    }
    requireId(kind, 'history kind');
    const url = new URL(`${this.baseUrl}/v13/history`);
    url.searchParams.set('kind', kind);
    url.searchParams.set('activeOnly', String(Boolean(activeOnly)));
    url.searchParams.set('limit', String(limit));
    if (subjectId) url.searchParams.set('subjectId', subjectId);
    if (cursor) url.searchParams.set('cursor', cursor);
    const response = await this.fetchImpl(url, {
      headers: { 'accept': 'application/json', 'x-420-client-schema': '14.0' },
    });
    return validateHistoryPage(await decodeResponse(response));
  }
}

import {createPublicKey, verify, createHash, randomBytes} from 'node:crypto';

export class AuthError extends Error {
  constructor(code, status = 401) { super(code); this.name = 'AuthError'; this.code = code; this.status = status; }
}
const deny = (code, status) => { throw new AuthError(code, status); };
const opaque = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const integer = value => Number.isSafeInteger(value) && value >= 0;
export function record(value, allowed) {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value)) ||
    Reflect.ownKeys(value).some(key => !allowed.includes(key) || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'))) deny('INVALID_REQUEST', 400);
}
function root(config) {
  if (!config || typeof config.issuer !== 'string' || !config.issuer || config.audience !== 'liftd-api' ||
    !config.keys || Object.keys(config.keys).length === 0) deny('AUTHORITY_UNAVAILABLE', 503);
  const keys = new Map();
  for (const [kid, pem] of Object.entries(config.keys)) {
    if (!opaque(kid)) deny('AUTHORITY_UNAVAILABLE', 503);
    let key;
    try { key = createPublicKey(pem); } catch { deny('AUTHORITY_UNAVAILABLE', 503); }
    if (key.asymmetricKeyType !== 'rsa' || key.asymmetricKeyDetails.modulusLength < 2048) deny('AUTHORITY_UNAVAILABLE', 503);
    keys.set(kid, key);
  }
  return {issuer: config.issuer, audience: config.audience, keys};
}
function decode(segment) {
  if (!/^[A-Za-z0-9_-]+$/.test(segment)) deny('INVALID_PROOF');
  const bytes = Buffer.from(segment, 'base64url');
  if (bytes.toString('base64url') !== segment) deny('INVALID_PROOF');
  try { return JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes)); }
  catch { deny('INVALID_PROOF'); }
}
function proof(token, trust, purpose, now, maxAge, fields = null) {
  if (typeof token !== 'string' || token.length > 32768) deny('INVALID_PROOF');
  const parts = token.split('.');
  if (parts.length !== 3) deny('INVALID_PROOF');
  const header = decode(parts[0]);
  record(header, ['alg', 'typ', 'kid']);
  if (header.alg !== 'RS256' || header.typ !== 'JWT' || !trust.keys.has(header.kid) || !/^[A-Za-z0-9_-]+$/.test(parts[2])) deny('INVALID_PROOF');
  const sig = Buffer.from(parts[2], 'base64url');
  if (sig.toString('base64url') !== parts[2] || !verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), trust.keys.get(header.kid), sig)) deny('INVALID_PROOF');
  const claims = decode(parts[1]);
  record(claims, fields === null ? ['iss', 'aud', 'sub', 'iat', 'nbf', 'exp', 'jti', 'purpose', 'sessionId', 'deviceId',
    'accountId', 'recoveryEpoch', 'nonce', 'tokenDigest', 'active', 'deviceActive', 'tokenActive', 'grants'] :
    ['iss', 'aud', 'sub', 'iat', 'nbf', 'exp', 'jti', 'purpose', ...fields]);
  if (claims.iss !== trust.issuer || claims.aud !== trust.audience || claims.purpose !== purpose ||
    !opaque(claims.sub) || !opaque(claims.jti) || ![claims.iat, claims.nbf, claims.exp].every(integer) ||
    claims.iat > now || claims.nbf < claims.iat || claims.nbf > now || claims.exp <= now ||
    claims.exp <= claims.nbf || claims.exp - claims.iat > maxAge || now - claims.iat > maxAge) deny('INVALID_PROOF');
  if (fields === null) {
    for (const field of ['sessionId', 'deviceId', 'accountId']) if (!opaque(claims[field])) deny('INVALID_PROOF');
    if (!integer(claims.recoveryEpoch)) deny('INVALID_PROOF');
  }
  return claims;
}
const capabilities = Object.freeze({
  rider: new Set(['trip.create', 'trip.read', 'trip.cancel', 'route.prepare', 'quote.create', 'quote.accept', 'quote.read']),
  driver: new Set(['trip.read', 'trip.arrive', 'trip.start', 'trip.complete', 'trip.cancel', 'availability.set']),
  operator: new Set(['trip.assign', 'trip.expire']),
});
export function validateSessionGrants(grants) {
  if (!Array.isArray(grants) || grants.length > 32) deny('INVALID_PROOF');
  for (const grant of grants) {
        record(grant, ['role', 'actions', 'resource', 'expiresAt', 'revoked']);
        if (!Object.hasOwn(capabilities, grant.role) || !Array.isArray(grant.actions) || grant.actions.length > 8 ||
          grant.actions.some(a => !capabilities[grant.role].has(a)) || typeof grant.resource !== 'string' ||
          !/^(account|trip):[A-Za-z0-9_-]{1,128}$/.test(grant.resource) || !integer(grant.expiresAt) ||
          typeof grant.revoked !== 'boolean') deny('INVALID_PROOF');
  }
  return grants;
}
export function createAuthenticator({identity, sessionAuthority, resolveSession, clock = () => Math.floor(Date.now() / 1000)}) {
  const identityRoot = root(identity), sessionRoot = root(sessionAuthority);
  if (identityRoot.issuer === sessionRoot.issuer || [...identityRoot.keys.values()].some(a =>
    [...sessionRoot.keys.values()].some(b => a.export({type: 'spki', format: 'der'}).equals(b.export({type: 'spki', format: 'der'}))))) deny('SEPARATE_AUTHORITY_REQUIRED', 503);
  if (typeof resolveSession !== 'function') deny('AUTHORITY_UNAVAILABLE', 503);
  return Object.freeze({
    async authorize(token, {action, resource}) {
      if (typeof action !== 'string' || typeof resource !== 'string' || !/^(account|trip):[A-Za-z0-9_-]{1,128}$/.test(resource)) deny('INVALID_PERMISSION', 403);
      const now = clock();
      if (!integer(now)) deny('AUTHORITY_UNAVAILABLE', 503);
      const access = proof(token, identityRoot, 'liftd_access', now, 3600);
      // Roles in access tokens are rejected. Only fresh independent session grants authorize actions.
      if ('grants' in access || 'nonce' in access || 'active' in access) deny('INVALID_PROOF');
      const nonce = randomBytes(24).toString('base64url');
      const tokenDigest = createHash('sha256').update(token).digest('hex');
      let signedStatus;
      try { signedStatus = await resolveSession(Object.freeze({nonce, tokenDigest, subject: access.sub,
        sessionId: access.sessionId, deviceId: access.deviceId, accountId: access.accountId})); }
      catch { deny('SESSION_AUTHORITY_UNAVAILABLE', 503); }
      const checkedAt = clock();
      if (!integer(checkedAt) || checkedAt < now) deny('AUTHORITY_UNAVAILABLE', 503);
      // Revalidate access after I/O; slow status lookups cannot extend credential life.
      proof(token, identityRoot, 'liftd_access', checkedAt, 3600);
      const status = proof(signedStatus, sessionRoot, 'liftd_session_status', checkedAt, 30);
      if (status.nonce !== nonce || status.tokenDigest !== tokenDigest || status.sub !== access.sub ||
        status.sessionId !== access.sessionId || status.deviceId !== access.deviceId || status.accountId !== access.accountId ||
        status.recoveryEpoch !== access.recoveryEpoch) deny('SESSION_BINDING_MISMATCH');
      if (status.active !== true || status.deviceActive !== true || status.tokenActive !== true) deny('SESSION_REVOKED');
      validateSessionGrants(status.grants);
      const matches = [];
      for (const grant of status.grants) {
        if (!grant.revoked && grant.expiresAt > checkedAt && grant.actions.includes(action) && grant.resource === resource) matches.push(grant);
      }
      if (matches.length !== 1) deny('PERMISSION_DENIED', 403);
      if (['trip.create','route.prepare','availability.set','quote.create','quote.accept','quote.read'].includes(action) && resource !== `account:${access.sub}`) deny('PERMISSION_DENIED', 403);
      return Object.freeze({subject: access.sub, accountId: access.accountId, sessionId: access.sessionId,
        deviceId: access.deviceId, recoveryEpoch: access.recoveryEpoch, role: matches[0].role,
        action, resource, expiresAt: Math.min(access.exp, status.exp, matches[0].expiresAt)});
    },
  });
}

// Trusted server assembly only: fixed purpose/schema, same strict signed-proof verifier.
export function createAuthorityVerifier(config, {purpose, fields, maxAge = 30}) {
  const trust = root(config);
  if (typeof purpose !== 'string' || !purpose.startsWith('liftd_') || !Array.isArray(fields) ||
    !fields.every(field => typeof field === 'string') || !integer(maxAge) || maxAge < 1 || maxAge > 30) deny('AUTHORITY_UNAVAILABLE', 503);
  const schema = Object.freeze([...fields]);
  return (token, now) => {
    if (!integer(now)) deny('AUTHORITY_UNAVAILABLE', 503);
    return proof(token, trust, purpose, now, maxAge, schema);
  };
}

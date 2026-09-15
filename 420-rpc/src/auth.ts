import { createHash, timingSafeEqual } from 'node:crypto';
import { classifyRpcMethod420, type RpcMethodProfile420 } from './methods.js';

export type RpcScope420 = 'rpc:read' | 'rpc:submit' | 'rpc:subscribe' | 'rpc:derived' | 'rpc:admin';
export type RpcCredentialStatus420 = 'ACTIVE' | 'ROTATED' | 'REVOKED';

export interface RpcCredentialRecord420 {
  schemaVersion: '1.0.0';
  applicationId: string;
  credentialId: string;
  chainId: string;
  environment: string;
  audience: string;
  scopes: readonly string[];
  issuedAt: string;
  expiresAt: string;
  secretSha256: string;
  status: RpcCredentialStatus420;
  revision: number;
  supersedesCredentialId?: string | null;
  terminalAt?: string | null;
  terminalReason?: string | null;
}

export interface RpcAuthPolicy420 {
  expectedChainId: bigint;
  environment: string;
  audience: string;
  anonymousScopes: readonly RpcScope420[];
  maxCredentials: number;
}

export interface RpcPrincipal420 {
  kind: 'anonymous' | 'credential';
  principalId: string;
  clientKey: string;
  applicationId: string | null;
  credentialId: string | null;
  scopes: readonly RpcScope420[];
  authenticated: boolean;
}

export interface RpcAuthenticationDecision420 {
  authenticated: boolean;
  principal: RpcPrincipal420 | null;
  reason: string | null;
}

export interface RpcAuthorizationDecision420 {
  allowed: boolean;
  requiredScope: RpcScope420 | null;
  reason: string | null;
}

export const DEFAULT_RPC9_AUTH_POLICY_420: RpcAuthPolicy420 = {
  expectedChainId: 420n,
  environment: 'testnet',
  audience: '420rpc',
  anonymousScopes: ['rpc:read'],
  maxCredentials: 10_000,
};

const ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const SCOPE_RE = /^[a-z0-9][a-z0-9:._/-]{0,127}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const KNOWN_SCOPES = new Set<RpcScope420>(['rpc:read', 'rpc:submit', 'rpc:subscribe', 'rpc:derived', 'rpc:admin']);

function isoMs(value: string): number | null {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function assertPolicy(policy: RpcAuthPolicy420): void {
  if (policy.expectedChainId <= 0n) throw new Error('expectedChainId must be positive');
  if (!ID_RE.test(policy.environment)) throw new Error('environment is invalid');
  if (!ID_RE.test(policy.audience)) throw new Error('audience is invalid');
  if (!Number.isInteger(policy.maxCredentials) || policy.maxCredentials <= 0) throw new Error('maxCredentials must be a positive integer');
  if (new Set(policy.anonymousScopes).size !== policy.anonymousScopes.length) throw new Error('anonymousScopes must be unique');
  for (const scope of policy.anonymousScopes) if (!KNOWN_SCOPES.has(scope)) throw new Error(`unknown anonymous scope: ${scope}`);
}

export function validateRpcCredentialRecord420(record: RpcCredentialRecord420, policy: RpcAuthPolicy420 = DEFAULT_RPC9_AUTH_POLICY_420): string[] {
  const errors: string[] = [];
  if (record.schemaVersion !== '1.0.0') errors.push('unsupported credential schemaVersion');
  if (!ID_RE.test(record.applicationId)) errors.push('applicationId is invalid');
  if (!ID_RE.test(record.credentialId)) errors.push('credentialId is invalid');
  if (!/^[1-9][0-9]*$/.test(record.chainId)) errors.push('chainId must be a positive decimal string');
  else if (BigInt(record.chainId) !== policy.expectedChainId) errors.push('credential is bound to the wrong chain');
  if (record.environment !== policy.environment) errors.push('credential is bound to the wrong environment');
  if (record.audience !== policy.audience) errors.push('credential audience is not 420RPC');
  if (!Array.isArray(record.scopes) || record.scopes.length === 0 || record.scopes.length > 32) errors.push('credential scopes must contain 1 to 32 entries');
  else {
    if (new Set(record.scopes).size !== record.scopes.length) errors.push('credential scopes must be unique');
    for (const scope of record.scopes) {
      if (typeof scope !== 'string' || !SCOPE_RE.test(scope)) errors.push(`invalid credential scope: ${String(scope)}`);
      else if (!KNOWN_SCOPES.has(scope as RpcScope420)) errors.push(`unsupported 420RPC credential scope: ${scope}`);
    }
  }
  const issued = isoMs(record.issuedAt);
  const expires = isoMs(record.expiresAt);
  if (issued === null) errors.push('issuedAt must be an ISO date-time');
  if (expires === null) errors.push('expiresAt must be an ISO date-time');
  if (issued !== null && expires !== null && expires <= issued) errors.push('expiresAt must be after issuedAt');
  if (!SHA256_RE.test(record.secretSha256)) errors.push('secretSha256 must be a lowercase SHA-256 digest');
  if (!['ACTIVE', 'ROTATED', 'REVOKED'].includes(record.status)) errors.push('credential status is invalid');
  if (!Number.isInteger(record.revision) || record.revision < 1 || record.revision > 0xffffffff) errors.push('revision must be a positive uint32 integer');
  const terminal = record.status !== 'ACTIVE';
  if (terminal && (!record.terminalAt || !record.terminalReason)) errors.push('terminal credential requires terminalAt and terminalReason');
  if (!terminal && (record.terminalAt != null || record.terminalReason != null)) errors.push('active credential cannot carry terminal metadata');
  return errors;
}

export function parseBearerAuthorization420(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value.length < 8 || value.length > 4096) return null;
  const match = /^Bearer ([A-Za-z0-9._~+\/-]+)$/.exec(value);
  return match?.[1] ?? null;
}

export function digestBearerSecret420(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

function digestMatches420(actualHex: string, expectedHex: string): boolean {
  if (!SHA256_RE.test(actualHex) || !SHA256_RE.test(expectedHex)) return false;
  return timingSafeEqual(Buffer.from(actualHex, 'hex'), Buffer.from(expectedHex, 'hex'));
}

export class RpcCredentialRegistry420 {
  private readonly records = new Map<string, RpcCredentialRecord420>();

  constructor(readonly policy: RpcAuthPolicy420 = DEFAULT_RPC9_AUTH_POLICY_420, initial: readonly RpcCredentialRecord420[] = []) {
    assertPolicy(policy);
    for (const record of initial) this.install(record);
  }

  install(record: RpcCredentialRecord420): void {
    const errors = validateRpcCredentialRecord420(record, this.policy);
    if (errors.length > 0) throw new Error(`invalid 420RPC credential: ${errors.join('; ')}`);
    const existing = this.records.get(record.credentialId);
    if (!existing && this.records.size >= this.policy.maxCredentials) throw new Error('credential registry capacity exhausted');
    if (existing && record.revision < existing.revision) throw new Error('credential revision cannot regress');
    if (existing && record.applicationId !== existing.applicationId) throw new Error('credential application binding cannot change');
    this.records.set(record.credentialId, Object.freeze({ ...record, scopes: Object.freeze([...record.scopes]) }));
  }

  remove(credentialId: string): boolean {
    return this.records.delete(credentialId);
  }

  authenticate(secret: string | null, nowMs: number): RpcAuthenticationDecision420 {
    if (!Number.isFinite(nowMs) || nowMs < 0) return { authenticated: false, principal: null, reason: 'invalid authentication time' };
    if (secret === null) return { authenticated: false, principal: this.anonymousPrincipal(), reason: null };
    if (typeof secret !== 'string' || secret.length < 16 || secret.length > 4096) return { authenticated: false, principal: null, reason: 'invalid bearer credential' };
    const digest = digestBearerSecret420(secret);
    let matched: RpcCredentialRecord420 | null = null;
    for (const record of this.records.values()) {
      if (digestMatches420(digest, record.secretSha256)) matched = record;
    }
    if (!matched) return { authenticated: false, principal: null, reason: 'invalid bearer credential' };
    if (matched.status !== 'ACTIVE') return { authenticated: false, principal: null, reason: `credential is ${matched.status.toLowerCase()}` };
    const issued = Date.parse(matched.issuedAt);
    const expires = Date.parse(matched.expiresAt);
    if (nowMs < issued) return { authenticated: false, principal: null, reason: 'credential is not active yet' };
    if (nowMs >= expires) return { authenticated: false, principal: null, reason: 'credential is expired' };
    const scopes = matched.scopes as RpcScope420[];
    return {
      authenticated: true,
      principal: {
        kind: 'credential',
        principalId: `app:${matched.applicationId}:credential:${matched.credentialId}`,
        clientKey: `credential:${matched.credentialId}`,
        applicationId: matched.applicationId,
        credentialId: matched.credentialId,
        scopes: Object.freeze([...scopes]),
        authenticated: true,
      },
      reason: null,
    };
  }

  snapshot(): { credentials: number; audience: string; environment: string; expectedChainId: string; storesBearerSecrets: false } {
    return { credentials: this.records.size, audience: this.policy.audience, environment: this.policy.environment, expectedChainId: this.policy.expectedChainId.toString(), storesBearerSecrets: false };
  }

  private anonymousPrincipal(): RpcPrincipal420 {
    return { kind: 'anonymous', principalId: 'anonymous', clientKey: 'anonymous', applicationId: null, credentialId: null, scopes: Object.freeze([...this.policy.anonymousScopes]), authenticated: false };
  }
}

export function scopeForRpcProfile420(profile: RpcMethodProfile420): RpcScope420 {
  if (profile === 'submit') return 'rpc:submit';
  if (profile === 'subscription') return 'rpc:subscribe';
  return 'rpc:read';
}

export function authorizeRpcMethod420(principal: RpcPrincipal420, method: string): RpcAuthorizationDecision420 {
  const classified = classifyRpcMethod420(method);
  if (!classified.supported || classified.definition === null) return { allowed: false, requiredScope: null, reason: classified.reason ?? 'unsupported RPC method' };
  const requiredScope = scopeForRpcProfile420(classified.definition.profile);
  if (!principal.scopes.includes(requiredScope) && !principal.scopes.includes('rpc:admin')) return { allowed: false, requiredScope, reason: `principal lacks ${requiredScope}` };
  return { allowed: true, requiredScope, reason: null };
}

export function authorizeDerivedRead420(principal: RpcPrincipal420): RpcAuthorizationDecision420 {
  const requiredScope: RpcScope420 = 'rpc:derived';
  if (!principal.scopes.includes(requiredScope) && !principal.scopes.includes('rpc:admin')) return { allowed: false, requiredScope, reason: `principal lacks ${requiredScope}` };
  return { allowed: true, requiredScope, reason: null };
}

import { createHash, timingSafeEqual } from 'node:crypto';
import type { AutomationJobDefinition420 } from './jobs.js';

export type AutomationApiScope420 = 'automation:read' | 'automation:submit' | 'automation:manage' | 'automation:admin';
export type AutomationCredentialStatus420 = 'ACTIVE' | 'ROTATED' | 'REVOKED';

export interface AutomationCredentialRecord420 {
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
  status: AutomationCredentialStatus420;
  revision: number;
  supersedesCredentialId?: string | null;
  terminalAt?: string | null;
  terminalReason?: string | null;
}

export interface AutomationApplicationBinding420 {
  applicationId: string;
  ownerIds: readonly string[];
  protocolIds: readonly string[];
}

export interface AutomationAuthPolicy420 {
  expectedChainId: bigint;
  environment: string;
  audience: string;
  maxCredentials: number;
  applicationBindings: readonly AutomationApplicationBinding420[];
}

export interface AutomationApiPrincipal420 {
  principalId: string;
  applicationId: string;
  credentialId: string;
  clientKey: string;
  scopes: readonly AutomationApiScope420[];
  ownerIds: readonly string[];
  protocolIds: readonly string[];
  authenticated: true;
}

export interface AutomationAuthenticationDecision420 {
  authenticated: boolean;
  principal: AutomationApiPrincipal420 | null;
  reason: string | null;
}

export const DEFAULT_AUT9_AUTH_POLICY_420: AutomationAuthPolicy420 = {
  expectedChainId: 420n,
  environment: 'testnet',
  audience: '420automation',
  maxCredentials: 10_000,
  applicationBindings: [],
};

const ID_RE = /^[a-z0-9][a-z0-9._-]{0,63}$/;
const RESOURCE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const SCOPE_RE = /^[a-z0-9][a-z0-9:._/-]{0,127}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const KNOWN_SCOPES = new Set<AutomationApiScope420>(['automation:read', 'automation:submit', 'automation:manage', 'automation:admin']);
const CREDENTIAL_KEYS = new Set([
  'schemaVersion', 'applicationId', 'credentialId', 'chainId', 'environment', 'audience', 'scopes', 'issuedAt', 'expiresAt',
  'secretSha256', 'status', 'revision', 'supersedesCredentialId', 'terminalAt', 'terminalReason',
]);

function isoMs(value: string): number | null {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function uniqueIds(values: readonly string[], label: string): readonly string[] {
  if (!Array.isArray(values) || values.length > 256) throw new Error(`${label} must contain at most 256 entries`);
  if (new Set(values).size !== values.length) throw new Error(`${label} must be unique`);
  for (const value of values) if (typeof value !== 'string' || !RESOURCE_ID_RE.test(value)) throw new Error(`${label} contains an invalid id`);
  return Object.freeze([...values]);
}

function validatePolicy420(policy: AutomationAuthPolicy420): void {
  if (policy.expectedChainId <= 0n) throw new Error('expectedChainId must be positive');
  if (!ID_RE.test(policy.environment)) throw new Error('environment is invalid');
  if (!ID_RE.test(policy.audience)) throw new Error('audience is invalid');
  if (!Number.isInteger(policy.maxCredentials) || policy.maxCredentials <= 0) throw new Error('maxCredentials must be positive');
  const apps = new Set<string>();
  for (const binding of policy.applicationBindings) {
    if (!ID_RE.test(binding.applicationId)) throw new Error('application binding id is invalid');
    if (apps.has(binding.applicationId)) throw new Error('application binding ids must be unique');
    apps.add(binding.applicationId);
    uniqueIds(binding.ownerIds, 'ownerIds');
    uniqueIds(binding.protocolIds, 'protocolIds');
  }
}

export function validateAutomationCredentialRecord420(record: AutomationCredentialRecord420, policy: AutomationAuthPolicy420 = DEFAULT_AUT9_AUTH_POLICY_420): string[] {
  const errors: string[] = [];
  for (const key of Object.keys(record as object)) if (!CREDENTIAL_KEYS.has(key)) errors.push(`unknown credential field: ${key}`);
  if (record.schemaVersion !== '1.0.0') errors.push('unsupported credential schemaVersion');
  if (!ID_RE.test(record.applicationId)) errors.push('applicationId is invalid');
  if (!ID_RE.test(record.credentialId)) errors.push('credentialId is invalid');
  if (!/^[1-9][0-9]*$/.test(record.chainId)) errors.push('chainId must be a positive decimal string');
  else if (BigInt(record.chainId) !== policy.expectedChainId) errors.push('credential is bound to the wrong chain');
  if (record.environment !== policy.environment) errors.push('credential is bound to the wrong environment');
  if (record.audience !== policy.audience) errors.push('credential audience is not 420Automation');
  if (!Array.isArray(record.scopes) || record.scopes.length === 0 || record.scopes.length > 32) errors.push('credential scopes must contain 1 to 32 entries');
  else {
    if (new Set(record.scopes).size !== record.scopes.length) errors.push('credential scopes must be unique');
    for (const scope of record.scopes) {
      if (typeof scope !== 'string' || !SCOPE_RE.test(scope)) errors.push(`invalid credential scope: ${String(scope)}`);
      else if (!KNOWN_SCOPES.has(scope as AutomationApiScope420)) errors.push(`unsupported Automation scope: ${scope}`);
    }
  }
  const issued = isoMs(record.issuedAt);
  const expires = isoMs(record.expiresAt);
  if (issued === null) errors.push('issuedAt must be an ISO date-time');
  if (expires === null) errors.push('expiresAt must be an ISO date-time');
  if (issued !== null && expires !== null && expires <= issued) errors.push('expiresAt must be after issuedAt');
  if (!SHA256_RE.test(record.secretSha256)) errors.push('secretSha256 must be a lowercase SHA-256 digest');
  if (!['ACTIVE', 'ROTATED', 'REVOKED'].includes(record.status)) errors.push('credential status is invalid');
  if (!Number.isInteger(record.revision) || record.revision < 1 || record.revision > 0xffffffff) errors.push('revision must be a positive uint32');
  const terminal = record.status !== 'ACTIVE';
  if (terminal && (!record.terminalAt || !record.terminalReason)) errors.push('terminal credential requires terminal metadata');
  if (!terminal && (record.terminalAt != null || record.terminalReason != null)) errors.push('active credential cannot carry terminal metadata');
  if (!policy.applicationBindings.some((binding) => binding.applicationId === record.applicationId)) errors.push('credential application has no Automation binding');
  return errors;
}

export function parseAutomationBearer420(value: string | null | undefined): string | null {
  if (typeof value !== 'string' || value.length < 8 || value.length > 4096) return null;
  return /^Bearer ([A-Za-z0-9._~+\/-]+)$/.exec(value)?.[1] ?? null;
}

export function digestAutomationBearer420(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

function digestMatches420(actualHex: string, expectedHex: string): boolean {
  if (!SHA256_RE.test(actualHex) || !SHA256_RE.test(expectedHex)) return false;
  return timingSafeEqual(Buffer.from(actualHex, 'hex'), Buffer.from(expectedHex, 'hex'));
}

export class AutomationCredentialRegistry420 {
  private readonly records = new Map<string, AutomationCredentialRecord420>();
  private readonly bindings = new Map<string, AutomationApplicationBinding420>();

  constructor(readonly policy: AutomationAuthPolicy420 = DEFAULT_AUT9_AUTH_POLICY_420, initial: readonly AutomationCredentialRecord420[] = []) {
    validatePolicy420(policy);
    for (const binding of policy.applicationBindings) this.bindings.set(binding.applicationId, {
      applicationId: binding.applicationId,
      ownerIds: uniqueIds(binding.ownerIds, 'ownerIds'),
      protocolIds: uniqueIds(binding.protocolIds, 'protocolIds'),
    });
    for (const record of initial) this.install(record);
  }

  install(record: AutomationCredentialRecord420): void {
    const errors = validateAutomationCredentialRecord420(record, this.policy);
    if (errors.length > 0) throw new Error(`invalid Automation credential: ${errors.join('; ')}`);
    const existing = this.records.get(record.credentialId);
    if (!existing && this.records.size >= this.policy.maxCredentials) throw new Error('credential registry capacity exhausted');
    if (existing && record.revision < existing.revision) throw new Error('credential revision cannot regress');
    if (existing && record.applicationId !== existing.applicationId) throw new Error('credential application binding cannot change');
    this.records.set(record.credentialId, Object.freeze({ ...record, scopes: Object.freeze([...record.scopes]) }));
  }

  authenticate(secret: string | null, nowMs: number): AutomationAuthenticationDecision420 {
    if (!Number.isFinite(nowMs) || nowMs < 0) return { authenticated: false, principal: null, reason: 'invalid authentication time' };
    if (typeof secret !== 'string' || secret.length < 16 || secret.length > 4096) return { authenticated: false, principal: null, reason: 'bearer credential required' };
    const digest = digestAutomationBearer420(secret);
    let matched: AutomationCredentialRecord420 | null = null;
    for (const record of this.records.values()) if (digestMatches420(digest, record.secretSha256)) matched = record;
    if (!matched) return { authenticated: false, principal: null, reason: 'invalid bearer credential' };
    if (matched.status !== 'ACTIVE') return { authenticated: false, principal: null, reason: `credential is ${matched.status.toLowerCase()}` };
    const issued = Date.parse(matched.issuedAt);
    const expires = Date.parse(matched.expiresAt);
    if (nowMs < issued) return { authenticated: false, principal: null, reason: 'credential is not active yet' };
    if (nowMs >= expires) return { authenticated: false, principal: null, reason: 'credential is expired' };
    const binding = this.bindings.get(matched.applicationId);
    if (!binding) return { authenticated: false, principal: null, reason: 'credential application binding is unavailable' };
    return {
      authenticated: true,
      principal: {
        principalId: `app:${matched.applicationId}:credential:${matched.credentialId}`,
        applicationId: matched.applicationId,
        credentialId: matched.credentialId,
        clientKey: `automation-credential:${matched.credentialId}`,
        scopes: Object.freeze([...(matched.scopes as AutomationApiScope420[])]),
        ownerIds: binding.ownerIds,
        protocolIds: binding.protocolIds,
        authenticated: true,
      },
      reason: null,
    };
  }

  snapshot(): { credentials: number; applications: number; audience: string; environment: string; expectedChainId: string; storesBearerSecrets: false } {
    return { credentials: this.records.size, applications: this.bindings.size, audience: this.policy.audience, environment: this.policy.environment, expectedChainId: this.policy.expectedChainId.toString(), storesBearerSecrets: false };
  }
}

export function hasAutomationScope420(principal: AutomationApiPrincipal420, scope: AutomationApiScope420): boolean {
  return principal.scopes.includes(scope) || principal.scopes.includes('automation:admin');
}

export function principalCanAccessJob420(principal: AutomationApiPrincipal420, job: Pick<AutomationJobDefinition420, 'ownerId' | 'protocolId'>): boolean {
  if (principal.scopes.includes('automation:admin')) return true;
  return principal.ownerIds.includes(job.ownerId) || principal.protocolIds.includes(job.protocolId);
}

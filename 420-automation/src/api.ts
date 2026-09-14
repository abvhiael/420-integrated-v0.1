import type { AutomationJobDefinition420, AutomationJobRegistryEntry420, AutomationJobStatus420 } from './jobs.js';
import { AutomationJobRegistry420 } from './jobs.js';
import { hasAutomationScope420, principalCanAccessJob420, type AutomationApiPrincipal420, type AutomationApiScope420 } from './auth.js';

export type AutomationApiOperation420 = 'service.inspect' | 'jobs.list' | 'jobs.get' | 'jobs.register' | 'jobs.set-status';

export type AutomationApiRequest420 =
  | { operation: 'service.inspect' }
  | { operation: 'jobs.list'; status?: AutomationJobStatus420 }
  | { operation: 'jobs.get'; jobId: string }
  | { operation: 'jobs.register'; job: AutomationJobDefinition420 }
  | { operation: 'jobs.set-status'; jobId: string; status: AutomationJobStatus420 };

export interface AutomationApiSuccess420<T = unknown> {
  ok: true;
  operation: AutomationApiOperation420;
  data: T;
}

export interface AutomationApiFailure420 {
  ok: false;
  operation: AutomationApiOperation420 | null;
  code: 'AUT9_REQUEST_INVALID' | 'AUT9_UNAUTHORIZED' | 'AUT9_FORBIDDEN' | 'AUT9_NOT_FOUND' | 'AUT9_CONFLICT';
  reason: string;
}

export type AutomationApiResponse420<T = unknown> = AutomationApiSuccess420<T> | AutomationApiFailure420;

export interface AutomationApiServiceSnapshot420 {
  service: '420Automation';
  chainId: '420';
  canonicalProtocolAuthority: false;
  storesBearerSecrets: false;
  supportedOperations: readonly AutomationApiOperation420[];
  requiredScopes: Readonly<Record<AutomationApiOperation420, AutomationApiScope420>>;
}

const HASH32 = /^0x[0-9a-fA-F]{64}$/;
const OPERATIONS: readonly AutomationApiOperation420[] = ['service.inspect', 'jobs.list', 'jobs.get', 'jobs.register', 'jobs.set-status'];
const REQUIRED_SCOPE: Readonly<Record<AutomationApiOperation420, AutomationApiScope420>> = Object.freeze({
  'service.inspect': 'automation:read',
  'jobs.list': 'automation:read',
  'jobs.get': 'automation:read',
  'jobs.register': 'automation:submit',
  'jobs.set-status': 'automation:manage',
});

function failure(operation: AutomationApiOperation420 | null, code: AutomationApiFailure420['code'], reason: string): AutomationApiFailure420 {
  return { ok: false, operation, code, reason };
}

function validStatus(status: unknown): status is AutomationJobStatus420 {
  return status === 'enabled' || status === 'disabled';
}

function parseRequest420(input: unknown): AutomationApiRequest420 | null {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return null;
  const value = input as Record<string, unknown>;
  if (typeof value.operation !== 'string' || !OPERATIONS.includes(value.operation as AutomationApiOperation420)) return null;
  const operation = value.operation as AutomationApiOperation420;
  const keys = Object.keys(value);
  if (operation === 'service.inspect') return keys.length === 1 ? { operation } : null;
  if (operation === 'jobs.list') {
    if (keys.some((key) => !['operation', 'status'].includes(key))) return null;
    if (value.status !== undefined && !validStatus(value.status)) return null;
    return value.status === undefined ? { operation } : { operation, status: value.status as AutomationJobStatus420 };
  }
  if (operation === 'jobs.get') {
    if (keys.some((key) => !['operation', 'jobId'].includes(key)) || typeof value.jobId !== 'string' || !HASH32.test(value.jobId)) return null;
    return { operation, jobId: value.jobId.toLowerCase() };
  }
  if (operation === 'jobs.register') {
    if (keys.some((key) => !['operation', 'job'].includes(key)) || typeof value.job !== 'object' || value.job === null || Array.isArray(value.job)) return null;
    return { operation, job: value.job as AutomationJobDefinition420 };
  }
  if (keys.some((key) => !['operation', 'jobId', 'status'].includes(key)) || typeof value.jobId !== 'string' || !HASH32.test(value.jobId) || !validStatus(value.status)) return null;
  return { operation: 'jobs.set-status', jobId: value.jobId.toLowerCase(), status: value.status };
}

function visibleEntry420(principal: AutomationApiPrincipal420, entry: AutomationJobRegistryEntry420): boolean {
  return principalCanAccessJob420(principal, entry.job);
}

export class AutomationApiService420 {
  constructor(private readonly jobs: AutomationJobRegistry420) {}

  snapshot(): AutomationApiServiceSnapshot420 {
    return {
      service: '420Automation',
      chainId: '420',
      canonicalProtocolAuthority: false,
      storesBearerSecrets: false,
      supportedOperations: Object.freeze([...OPERATIONS]),
      requiredScopes: REQUIRED_SCOPE,
    };
  }

  handle(principal: AutomationApiPrincipal420 | null, input: unknown, nowMs: number): AutomationApiResponse420 {
    const request = parseRequest420(input);
    if (!request) return failure(null, 'AUT9_REQUEST_INVALID', 'invalid Automation API request');
    if (!principal?.authenticated) return failure(request.operation, 'AUT9_UNAUTHORIZED', 'authenticated Automation credential required');
    const requiredScope = REQUIRED_SCOPE[request.operation];
    if (!hasAutomationScope420(principal, requiredScope)) return failure(request.operation, 'AUT9_FORBIDDEN', `principal lacks ${requiredScope}`);
    if (!Number.isSafeInteger(nowMs) || nowMs < 0) return failure(request.operation, 'AUT9_REQUEST_INVALID', 'invalid request time');

    try {
      if (request.operation === 'service.inspect') return { ok: true, operation: request.operation, data: this.snapshot() };
      if (request.operation === 'jobs.list') {
        const entries = this.jobs.list(request.status).filter((entry) => visibleEntry420(principal, entry));
        return { ok: true, operation: request.operation, data: entries };
      }
      if (request.operation === 'jobs.get') {
        const entry = this.jobs.get(request.jobId);
        if (!entry || !visibleEntry420(principal, entry)) return failure(request.operation, 'AUT9_NOT_FOUND', 'job not found');
        return { ok: true, operation: request.operation, data: entry };
      }
      if (request.operation === 'jobs.register') {
        if (!principalCanAccessJob420(principal, request.job)) return failure(request.operation, 'AUT9_FORBIDDEN', 'application binding does not permit this owner or protocol');
        const entry = this.jobs.register(request.job);
        return { ok: true, operation: request.operation, data: entry };
      }
      const existing = this.jobs.get(request.jobId);
      if (!existing || !visibleEntry420(principal, existing)) return failure(request.operation, 'AUT9_NOT_FOUND', 'job not found');
      const entry = this.jobs.setStatus(request.jobId, request.status, nowMs);
      return { ok: true, operation: request.operation, data: entry };
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Automation API operation failed';
      if (reason.includes('ALREADY_EXISTS')) return failure(request.operation, 'AUT9_CONFLICT', reason);
      return failure(request.operation, 'AUT9_REQUEST_INVALID', reason);
    }
  }
}

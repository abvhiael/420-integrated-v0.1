import { authorizeRpcMethod420, type RpcPrincipal420 } from './auth.js';
import { RpcAdmissionController420, type RpcAdmissionDecision420 } from './resource-controls.js';
import { validateRpcRequest420, type RpcRequestPolicyDecision420 } from './request-policy.js';

export interface RpcSecurityPolicy420 {
  maxJsonDepth: number;
  maxJsonNodes: number;
  maxStringBytes: number;
  maxObjectKeys: number;
}

export const DEFAULT_RPC11_SECURITY_POLICY_420: RpcSecurityPolicy420 = {
  maxJsonDepth: 24,
  maxJsonNodes: 4096,
  maxStringBytes: 256 * 1024,
  maxObjectKeys: 128,
};

export type RpcSecurityRejection420 =
  | 'invalid-structure'
  | 'forbidden-object-key'
  | 'invalid-request'
  | 'unauthorized'
  | 'resource-rejected';

export interface RpcSecurityDecision420 {
  allowed: boolean;
  reason: RpcSecurityRejection420 | null;
  detail: string | null;
  admission: RpcAdmissionDecision420 | null;
  validated: readonly RpcRequestPolicyDecision420[];
}

const FORBIDDEN_OBJECT_KEYS = new Set(['__proto__', 'prototype', 'constructor']);
const ENVELOPE_KEYS = new Set(['jsonrpc', 'id', 'method', 'params']);

function assertPolicy(policy: RpcSecurityPolicy420): void {
  for (const [name, value] of Object.entries(policy)) {
    if (!Number.isInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer`);
  }
}

function reject(reason: RpcSecurityRejection420, detail: string, validated: readonly RpcRequestPolicyDecision420[] = []): RpcSecurityDecision420 {
  return { allowed: false, reason, detail, admission: null, validated };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function inspectRpcJsonStructure420(input: unknown, policy: RpcSecurityPolicy420 = DEFAULT_RPC11_SECURITY_POLICY_420): string[] {
  assertPolicy(policy);
  const errors: string[] = [];
  let nodes = 0;
  let stringBytes = 0;
  const stack: Array<{ value: unknown; depth: number; path: string }> = [{ value: input, depth: 0, path: '$' }];

  while (stack.length > 0 && errors.length < 32) {
    const current = stack.pop()!;
    nodes += 1;
    if (nodes > policy.maxJsonNodes) {
      errors.push(`JSON node count exceeds ${policy.maxJsonNodes}`);
      break;
    }
    if (current.depth > policy.maxJsonDepth) {
      errors.push(`${current.path} exceeds maximum JSON depth ${policy.maxJsonDepth}`);
      continue;
    }

    if (typeof current.value === 'string') {
      stringBytes += Buffer.byteLength(current.value, 'utf8');
      if (stringBytes > policy.maxStringBytes) {
        errors.push(`aggregate JSON string bytes exceed ${policy.maxStringBytes}`);
        break;
      }
      continue;
    }
    if (current.value === null || typeof current.value === 'boolean') continue;
    if (typeof current.value === 'number') {
      if (!Number.isFinite(current.value)) errors.push(`${current.path} contains a non-finite number`);
      continue;
    }
    if (Array.isArray(current.value)) {
      for (let index = current.value.length - 1; index >= 0; index -= 1) {
        stack.push({ value: current.value[index], depth: current.depth + 1, path: `${current.path}[${index}]` });
      }
      continue;
    }
    if (isRecord(current.value)) {
      const keys = Object.keys(current.value);
      if (keys.length > policy.maxObjectKeys) errors.push(`${current.path} contains more than ${policy.maxObjectKeys} object keys`);
      for (const key of keys) {
        if (FORBIDDEN_OBJECT_KEYS.has(key)) errors.push(`${current.path} contains forbidden object key ${key}`);
        stringBytes += Buffer.byteLength(key, 'utf8');
        if (stringBytes > policy.maxStringBytes) {
          errors.push(`aggregate JSON string bytes exceed ${policy.maxStringBytes}`);
          break;
        }
        stack.push({ value: current.value[key], depth: current.depth + 1, path: `${current.path}.${key}` });
      }
      continue;
    }
    errors.push(`${current.path} contains unsupported non-JSON value`);
  }

  return errors;
}

export function validateRpcEnvelopeShape420(input: unknown): string[] {
  const entries = Array.isArray(input) ? input : [input];
  const errors: string[] = [];
  entries.forEach((entry, index) => {
    if (!isRecord(entry)) return;
    for (const key of Object.keys(entry)) {
      if (!ENVELOPE_KEYS.has(key)) errors.push(`${Array.isArray(input) ? `batch[${index}]` : 'request'} contains unexpected top-level key ${key}`);
    }
  });
  return errors;
}

function validateEntries(input: unknown): RpcRequestPolicyDecision420[] {
  if (Array.isArray(input)) return input.map((entry) => validateRpcRequest420(entry));
  return [validateRpcRequest420(input)];
}

export function secureAdmitRpcEnvelope420(args: {
  envelope: unknown;
  encodedBytes: number;
  nowMs: number;
  principal: RpcPrincipal420;
  admissionController: RpcAdmissionController420;
  securityPolicy?: RpcSecurityPolicy420;
}): RpcSecurityDecision420 {
  const structural = inspectRpcJsonStructure420(args.envelope, args.securityPolicy ?? DEFAULT_RPC11_SECURITY_POLICY_420);
  if (structural.length > 0) {
    const forbidden = structural.some((error) => error.includes('forbidden object key'));
    return reject(forbidden ? 'forbidden-object-key' : 'invalid-structure', structural.join('; '));
  }
  const shape = validateRpcEnvelopeShape420(args.envelope);
  if (shape.length > 0) return reject('invalid-structure', shape.join('; '));

  const validated = validateEntries(args.envelope);
  const invalid = validated.find((decision) => !decision.allowed);
  if (invalid) return reject('invalid-request', invalid.reason ?? 'request failed RPC-5 policy', validated);

  for (const decision of validated) {
    const authorization = authorizeRpcMethod420(args.principal, decision.method!);
    if (!authorization.allowed) return reject('unauthorized', authorization.reason ?? 'request is not authorized', validated);
  }

  const admission = args.admissionController.admit({
    clientKey: args.principal.clientKey,
    envelope: args.envelope,
    encodedBytes: args.encodedBytes,
    nowMs: args.nowMs,
  });
  if (!admission.allowed) {
    return { allowed: false, reason: 'resource-rejected', detail: admission.detail ?? admission.reason, admission, validated };
  }
  return { allowed: true, reason: null, detail: null, admission, validated };
}

import { validateComputeRequest420, type ComputeRequest420, type Hex420 } from './compute.js';

export const COMPUTE_SDK_SCHEMA_420 = '420-compute-sdk-v1' as const;

export interface ComputeSdkContract420 {
  readonly name: string;
  readonly address: string;
  readonly version: string;
  readonly verified: true;
}

export interface ComputeSdkHost420 {
  readonly network: { readonly chainId: bigint; readonly chainIdDecimal: string };
  contract(name: string): ComputeSdkContract420 | null;
}

export interface ComputeWriteIntent420 {
  readonly schemaVersion: typeof COMPUTE_SDK_SCHEMA_420;
  readonly chainId: string;
  readonly target: ComputeSdkContract420;
  readonly method: string;
  readonly args: readonly unknown[];
  readonly canonicalAuthority: false;
  readonly requiresWalletAuthorization: true;
  readonly secretMaterialManaged: false;
}

export interface ComputeSdkClient420 {
  readonly schemaVersion: typeof COMPUTE_SDK_SCHEMA_420;
  readonly chainId: string;
  validateRequest(request: ComputeRequest420, now?: bigint, signedMaximumPrice?: bigint): ComputeRequest420;
  prepareJobSubmission(requestId: Hex420, request: ComputeRequest420): ComputeWriteIntent420;
  prepareRequestCancellation(requestId: Hex420): ComputeWriteIntent420;
}

export class ComputeSdkConfigurationError420 extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ComputeSdkConfigurationError420';
  }
}

function requireBytes32420(value: string, label: string): asserts value is Hex420 {
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) throw new ComputeSdkConfigurationError420(`${label} must be bytes32 hex`);
}

function requireContract420(host: ComputeSdkHost420, name: string): ComputeSdkContract420 {
  const contract = host.contract(name);
  if (!contract || contract.verified !== true || !/^0x[0-9a-fA-F]{40}$/.test(contract.address)) {
    throw new ComputeSdkConfigurationError420(`canonical Compute contract unavailable: ${name}`);
  }
  return contract;
}

function writeIntent420(host: ComputeSdkHost420, target: ComputeSdkContract420, method: string, args: readonly unknown[]): ComputeWriteIntent420 {
  return Object.freeze({
    schemaVersion: COMPUTE_SDK_SCHEMA_420,
    chainId: host.network.chainIdDecimal,
    target,
    method,
    args,
    canonicalAuthority: false,
    requiresWalletAuthorization: true,
    secretMaterialManaged: false
  });
}

export function createComputeSdk420(host: ComputeSdkHost420): ComputeSdkClient420 {
  if (host.network.chainId <= 0n || host.network.chainIdDecimal !== host.network.chainId.toString()) {
    throw new ComputeSdkConfigurationError420('invalid Compute SDK chain identity');
  }
  return Object.freeze({
    schemaVersion: COMPUTE_SDK_SCHEMA_420,
    chainId: host.network.chainIdDecimal,
    validateRequest: (request: ComputeRequest420, now?: bigint, signedMaximumPrice?: bigint) =>
      validateComputeRequest420(request, undefined, now, signedMaximumPrice),
    prepareJobSubmission: (requestId: Hex420, request: ComputeRequest420) => {
      requireBytes32420(requestId, 'requestId');
      validateComputeRequest420(request);
      return writeIntent420(host, requireContract420(host, 'ComputeRequestRegistry420'), 'createRequest', [requestId, request]);
    },
    prepareRequestCancellation: (requestId: Hex420) => {
      requireBytes32420(requestId, 'requestId');
      return writeIntent420(host, requireContract420(host, 'ComputeRequestRegistry420'), 'cancelRequest', [requestId]);
    }
  });
}

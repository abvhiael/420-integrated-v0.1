export const RPC_ARCHITECTURE_VERSION_420 = 'rpc-0-v1' as const;

export type RpcTransport420 = 'http' | 'https' | 'ws' | 'wss';
export type RpcUpstreamClass420 = 'execution-rpc' | 'indexer-api';
export type RpcTrustSurface420 = 'public' | 'authenticated' | 'internal-management';

export interface RpcUpstream420 {
  id: string;
  class: RpcUpstreamClass420;
  transport: RpcTransport420;
  expectedChainId: bigint;
  authoritative: boolean;
  allowsTransactionSubmission: boolean;
}

export interface RpcArchitecture420 {
  version: typeof RPC_ARCHITECTURE_VERSION_420;
  serviceName: '420RPC';
  expectedChainId: bigint;
  publicTransports: readonly RpcTransport420[];
  upstreams: readonly RpcUpstream420[];
  engineApiExposed: false;
  signsTransactions: false;
  storesWalletKeys: false;
  decidesFinality: false;
  rewritesSignedTransactions: false;
  indexerResponsesAreDerived: true;
  finalizedDisagreementPolicy: 'fail-closed';
}

export interface RpcArchitectureValidation420 {
  valid: boolean;
  errors: string[];
}

const PUBLIC_TRANSPORTS = new Set<RpcTransport420>(['https', 'wss']);

export const RPC0_ARCHITECTURE_420: RpcArchitecture420 = {
  version: RPC_ARCHITECTURE_VERSION_420,
  serviceName: '420RPC',
  expectedChainId: 420n,
  publicTransports: ['https', 'wss'],
  upstreams: [
    {
      id: 'node420-primary',
      class: 'execution-rpc',
      transport: 'http',
      expectedChainId: 420n,
      authoritative: true,
      allowsTransactionSubmission: true,
    },
    {
      id: '420indexer-primary',
      class: 'indexer-api',
      transport: 'http',
      expectedChainId: 420n,
      authoritative: false,
      allowsTransactionSubmission: false,
    },
  ],
  engineApiExposed: false,
  signsTransactions: false,
  storesWalletKeys: false,
  decidesFinality: false,
  rewritesSignedTransactions: false,
  indexerResponsesAreDerived: true,
  finalizedDisagreementPolicy: 'fail-closed',
};

export function validateRpcArchitecture420(architecture: RpcArchitecture420): RpcArchitectureValidation420 {
  const errors: string[] = [];

  if (architecture.expectedChainId <= 0n) errors.push('expected chain ID must be positive');
  if (architecture.engineApiExposed) errors.push('public 420RPC must never expose the Engine API');
  if (architecture.signsTransactions) errors.push('420RPC must not sign transactions');
  if (architecture.storesWalletKeys) errors.push('420RPC must not store wallet signing keys');
  if (architecture.decidesFinality) errors.push('420RPC must not decide chain finality');
  if (architecture.rewritesSignedTransactions) errors.push('420RPC must not rewrite signed transaction bytes');
  if (!architecture.indexerResponsesAreDerived) errors.push('420Indexer responses must remain explicitly derived');
  if (architecture.finalizedDisagreementPolicy !== 'fail-closed') errors.push('finalized-state disagreement must fail closed');

  const seenIds = new Set<string>();
  let executionUpstreams = 0;
  for (const upstream of architecture.upstreams) {
    if (!upstream.id.trim()) errors.push('upstream IDs must be non-empty');
    if (seenIds.has(upstream.id)) errors.push(`duplicate upstream ID: ${upstream.id}`);
    seenIds.add(upstream.id);

    if (upstream.expectedChainId !== architecture.expectedChainId) {
      errors.push(`upstream ${upstream.id} is pinned to the wrong chain ID`);
    }

    if (upstream.class === 'execution-rpc') {
      executionUpstreams += 1;
      if (!upstream.authoritative) errors.push(`execution upstream ${upstream.id} must represent canonical execution reads`);
    }

    if (upstream.class === 'indexer-api') {
      if (upstream.authoritative) errors.push(`indexer upstream ${upstream.id} must be non-authoritative`);
      if (upstream.allowsTransactionSubmission) errors.push(`indexer upstream ${upstream.id} must not accept transaction submission`);
    }
  }

  if (executionUpstreams === 0) errors.push('at least one execution-rpc upstream is required');
  if (architecture.publicTransports.length === 0) errors.push('at least one public transport is required');
  for (const transport of architecture.publicTransports) {
    if (!PUBLIC_TRANSPORTS.has(transport)) errors.push(`public transport ${transport} is not TLS-protected`);
  }

  return { valid: errors.length === 0, errors };
}

export function assertRpcArchitecture420(architecture: RpcArchitecture420): void {
  const result = validateRpcArchitecture420(architecture);
  if (!result.valid) throw new Error(`invalid 420RPC architecture: ${result.errors.join('; ')}`);
}

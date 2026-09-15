import type { RpcUpstreamCapability420, RpcUpstreamDiscovery420 } from './upstreams.js';

export type RpcMethodProfile420 = 'metadata' | 'read' | 'submit' | 'subscription';
export type RpcMethodTransport420 = 'http' | 'websocket' | 'both';

export interface RpcMethodDefinition420 {
  method: string;
  profile: RpcMethodProfile420;
  transport: RpcMethodTransport420;
  requiredCapabilities: readonly RpcUpstreamCapability420[];
  mutatesChain: boolean;
  requiresUserSignature: boolean;
}

const DEFINITIONS: readonly RpcMethodDefinition420[] = [
  { method: 'web3_clientVersion', profile: 'metadata', transport: 'both', requiredCapabilities: ['client-version'], mutatesChain: false, requiresUserSignature: false },
  { method: 'net_version', profile: 'metadata', transport: 'both', requiredCapabilities: ['chain-identity'], mutatesChain: false, requiresUserSignature: false },
  { method: 'eth_chainId', profile: 'metadata', transport: 'both', requiredCapabilities: ['chain-identity'], mutatesChain: false, requiresUserSignature: false },
  { method: 'eth_syncing', profile: 'read', transport: 'both', requiredCapabilities: ['head-read'], mutatesChain: false, requiresUserSignature: false },
  { method: 'eth_blockNumber', profile: 'read', transport: 'both', requiredCapabilities: ['head-read'], mutatesChain: false, requiresUserSignature: false },
  { method: 'eth_getBalance', profile: 'read', transport: 'both', requiredCapabilities: ['head-read'], mutatesChain: false, requiresUserSignature: false },
  { method: 'eth_getCode', profile: 'read', transport: 'both', requiredCapabilities: ['head-read'], mutatesChain: false, requiresUserSignature: false },
  { method: 'eth_getStorageAt', profile: 'read', transport: 'both', requiredCapabilities: ['head-read'], mutatesChain: false, requiresUserSignature: false },
  { method: 'eth_getTransactionCount', profile: 'read', transport: 'both', requiredCapabilities: ['head-read'], mutatesChain: false, requiresUserSignature: false },
  { method: 'eth_getBlockByHash', profile: 'read', transport: 'both', requiredCapabilities: ['head-read'], mutatesChain: false, requiresUserSignature: false },
  { method: 'eth_getBlockByNumber', profile: 'read', transport: 'both', requiredCapabilities: ['head-read'], mutatesChain: false, requiresUserSignature: false },
  { method: 'eth_getBlockTransactionCountByHash', profile: 'read', transport: 'both', requiredCapabilities: ['head-read'], mutatesChain: false, requiresUserSignature: false },
  { method: 'eth_getBlockTransactionCountByNumber', profile: 'read', transport: 'both', requiredCapabilities: ['head-read'], mutatesChain: false, requiresUserSignature: false },
  { method: 'eth_getTransactionByHash', profile: 'read', transport: 'both', requiredCapabilities: ['head-read'], mutatesChain: false, requiresUserSignature: false },
  { method: 'eth_getTransactionByBlockHashAndIndex', profile: 'read', transport: 'both', requiredCapabilities: ['head-read'], mutatesChain: false, requiresUserSignature: false },
  { method: 'eth_getTransactionByBlockNumberAndIndex', profile: 'read', transport: 'both', requiredCapabilities: ['head-read'], mutatesChain: false, requiresUserSignature: false },
  { method: 'eth_getTransactionReceipt', profile: 'read', transport: 'both', requiredCapabilities: ['head-read'], mutatesChain: false, requiresUserSignature: false },
  { method: 'eth_getLogs', profile: 'read', transport: 'both', requiredCapabilities: ['head-read'], mutatesChain: false, requiresUserSignature: false },
  { method: 'eth_call', profile: 'read', transport: 'both', requiredCapabilities: ['head-read'], mutatesChain: false, requiresUserSignature: false },
  { method: 'eth_estimateGas', profile: 'read', transport: 'both', requiredCapabilities: ['head-read'], mutatesChain: false, requiresUserSignature: false },
  { method: 'eth_gasPrice', profile: 'read', transport: 'both', requiredCapabilities: ['head-read'], mutatesChain: false, requiresUserSignature: false },
  { method: 'eth_maxPriorityFeePerGas', profile: 'read', transport: 'both', requiredCapabilities: ['head-read'], mutatesChain: false, requiresUserSignature: false },
  { method: 'eth_feeHistory', profile: 'read', transport: 'both', requiredCapabilities: ['head-read'], mutatesChain: false, requiresUserSignature: false },
  { method: 'eth_sendRawTransaction', profile: 'submit', transport: 'both', requiredCapabilities: ['transaction-submission'], mutatesChain: true, requiresUserSignature: true },
  { method: 'eth_subscribe', profile: 'subscription', transport: 'websocket', requiredCapabilities: ['subscriptions'], mutatesChain: false, requiresUserSignature: false },
  { method: 'eth_unsubscribe', profile: 'subscription', transport: 'websocket', requiredCapabilities: ['subscriptions'], mutatesChain: false, requiresUserSignature: false },
] as const;

export const RPC2_METHODS_420 = DEFINITIONS;

const BY_METHOD = new Map(DEFINITIONS.map((definition) => [definition.method, definition] as const));
const FORBIDDEN_PREFIXES = ['engine_', 'admin_', 'personal_', 'debug_', 'miner_', 'txpool_'] as const;
const EXPLICITLY_FORBIDDEN = new Set(['eth_sendTransaction', 'eth_sign', 'eth_signTransaction', 'eth_accounts', 'eth_coinbase']);

export interface RpcMethodDecision420 {
  method: string;
  supported: boolean;
  definition: RpcMethodDefinition420 | null;
  reason: string | null;
}

export function classifyRpcMethod420(method: string): RpcMethodDecision420 {
  if (!method.trim()) return { method, supported: false, definition: null, reason: 'RPC method must be non-empty' };
  if (EXPLICITLY_FORBIDDEN.has(method)) return { method, supported: false, definition: null, reason: `${method} requires node-managed accounts or signing and is not exposed by 420RPC` };
  const forbidden = FORBIDDEN_PREFIXES.find((prefix) => method.startsWith(prefix));
  if (forbidden) return { method, supported: false, definition: null, reason: `${forbidden} namespace is outside the public 420RPC surface` };
  const definition = BY_METHOD.get(method) ?? null;
  if (!definition) return { method, supported: false, definition: null, reason: `${method} is not in the RPC-2 compatibility profile` };
  return { method, supported: true, definition, reason: null };
}

export function methodsForProfile420(profile: RpcMethodProfile420): RpcMethodDefinition420[] {
  return DEFINITIONS.filter((definition) => definition.profile === profile);
}

export function upstreamSupportsMethod420(discovery: RpcUpstreamDiscovery420, method: string): RpcMethodDecision420 {
  const decision = classifyRpcMethod420(method);
  if (!decision.supported || decision.definition === null) return decision;
  if (!discovery.eligible) return { ...decision, supported: false, reason: `upstream ${discovery.id} is not eligible` };
  if (discovery.class !== 'execution-rpc') return { ...decision, supported: false, reason: `${method} requires an execution-rpc upstream` };
  const capabilities = new Set(discovery.capabilities);
  const missing = decision.definition.requiredCapabilities.filter((capability) => !capabilities.has(capability));
  if (missing.length > 0) return { ...decision, supported: false, reason: `upstream ${discovery.id} lacks required capabilities: ${missing.join(', ')}` };
  return decision;
}

export function validateRpc2MethodProfile420(): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const definition of DEFINITIONS) {
    if (seen.has(definition.method)) errors.push(`duplicate RPC method: ${definition.method}`);
    seen.add(definition.method);
    if (FORBIDDEN_PREFIXES.some((prefix) => definition.method.startsWith(prefix))) errors.push(`forbidden namespace exposed: ${definition.method}`);
    if (EXPLICITLY_FORBIDDEN.has(definition.method)) errors.push(`forbidden signing/account method exposed: ${definition.method}`);
    if (definition.profile === 'submit' && !definition.requiresUserSignature) errors.push(`submission method ${definition.method} must require a user signature`);
    if (definition.profile === 'subscription' && definition.transport !== 'websocket') errors.push(`subscription method ${definition.method} must be websocket-only`);
    if (definition.method === 'eth_sendRawTransaction' && !definition.requiredCapabilities.includes('transaction-submission')) errors.push('eth_sendRawTransaction must require transaction-submission capability');
  }
  return errors;
}

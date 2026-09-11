import { classifyRpcMethod420, type RpcMethodProfile420 } from './methods.js';

export type JsonRpcId420 = string | number | null;
export type JsonRpcParams420 = readonly unknown[] | Record<string, unknown>;

export interface JsonRpcRequest420 {
  jsonrpc: '2.0';
  id?: JsonRpcId420;
  method: string;
  params?: JsonRpcParams420;
}

export interface RpcRequestPolicy420 {
  allowNotifications: boolean;
  requireArrayParams: boolean;
}

export interface RpcRequestPolicyDecision420 {
  allowed: boolean;
  method: string | null;
  profile: RpcMethodProfile420 | null;
  code: -32600 | -32601 | -32602 | null;
  reason: string | null;
  request: JsonRpcRequest420 | null;
}

export const DEFAULT_RPC5_REQUEST_POLICY_420: RpcRequestPolicy420 = {
  allowNotifications: false,
  requireArrayParams: true,
};

const HEX_DATA = /^0x(?:[0-9a-fA-F]{2})*$/;
const HEX_QUANTITY = /^0x(?:0|[1-9a-fA-F][0-9a-fA-F]*)$/;
const HASH32 = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS20 = /^0x[0-9a-fA-F]{40}$/;
const BLOCK_TAGS = new Set(['latest', 'earliest', 'pending', 'safe', 'finalized']);

function fail(code: -32600 | -32601 | -32602, reason: string, method: string | null = null, profile: RpcMethodProfile420 | null = null): RpcRequestPolicyDecision420 {
  return { allowed: false, method, profile, code, reason, request: null };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isHexData(value: unknown): boolean {
  return typeof value === 'string' && HEX_DATA.test(value);
}

function isHexQuantity(value: unknown): boolean {
  return typeof value === 'string' && HEX_QUANTITY.test(value);
}

function isHash(value: unknown): boolean {
  return typeof value === 'string' && HASH32.test(value);
}

function isAddress(value: unknown): boolean {
  return typeof value === 'string' && ADDRESS20.test(value);
}

function isBlockSelector(value: unknown): boolean {
  return isHexQuantity(value) || (typeof value === 'string' && BLOCK_TAGS.has(value));
}

function isBoolean(value: unknown): boolean {
  return typeof value === 'boolean';
}

function validateTxObject(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const addressFields = ['from', 'to'];
  for (const key of addressFields) if (value[key] !== undefined && !isAddress(value[key])) return false;
  const quantityFields = ['gas', 'gasPrice', 'maxFeePerGas', 'maxPriorityFeePerGas', 'value', 'nonce'];
  for (const key of quantityFields) if (value[key] !== undefined && !isHexQuantity(value[key])) return false;
  const data = value.data ?? value.input;
  if (data !== undefined && !isHexData(data)) return false;
  return true;
}

function validateLogFilter(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (value.fromBlock !== undefined && !isBlockSelector(value.fromBlock)) return false;
  if (value.toBlock !== undefined && !isBlockSelector(value.toBlock)) return false;
  if (value.blockHash !== undefined && !isHash(value.blockHash)) return false;
  if (value.blockHash !== undefined && (value.fromBlock !== undefined || value.toBlock !== undefined)) return false;
  if (value.address !== undefined) {
    if (typeof value.address === 'string') {
      if (!isAddress(value.address)) return false;
    } else if (Array.isArray(value.address)) {
      if (!value.address.every(isAddress)) return false;
    } else return false;
  }
  if (value.topics !== undefined && !Array.isArray(value.topics)) return false;
  return true;
}

function validateSubscriptionParams(params: readonly unknown[]): string | null {
  if (params.length < 1 || params.length > 2) return 'eth_subscribe expects one or two parameters';
  const kind = params[0];
  if (kind !== 'newHeads' && kind !== 'logs' && kind !== 'newPendingTransactions' && kind !== 'syncing') return 'unsupported eth_subscribe subscription type';
  if (kind === 'logs' && params[1] !== undefined && !validateLogFilter(params[1])) return 'invalid logs subscription filter';
  if (kind !== 'logs' && params.length > 1) return `${kind} subscription does not accept a filter parameter`;
  return null;
}

function validateMethodParams(method: string, params: readonly unknown[]): string | null {
  switch (method) {
    case 'web3_clientVersion':
    case 'net_version':
    case 'eth_chainId':
    case 'eth_syncing':
    case 'eth_blockNumber':
    case 'eth_gasPrice':
    case 'eth_maxPriorityFeePerGas':
      return params.length === 0 ? null : `${method} expects no parameters`;
    case 'eth_getBalance':
    case 'eth_getCode':
    case 'eth_getTransactionCount':
      return params.length === 2 && isAddress(params[0]) && isBlockSelector(params[1]) ? null : `${method} expects [address, block]`;
    case 'eth_getStorageAt':
      return params.length === 3 && isAddress(params[0]) && isHexQuantity(params[1]) && isBlockSelector(params[2]) ? null : 'eth_getStorageAt expects [address, position, block]';
    case 'eth_getBlockByHash':
      return params.length === 2 && isHash(params[0]) && isBoolean(params[1]) ? null : 'eth_getBlockByHash expects [hash, fullTransactions]';
    case 'eth_getBlockByNumber':
      return params.length === 2 && isBlockSelector(params[0]) && isBoolean(params[1]) ? null : 'eth_getBlockByNumber expects [block, fullTransactions]';
    case 'eth_getBlockTransactionCountByHash':
    case 'eth_getTransactionByHash':
    case 'eth_getTransactionReceipt':
      return params.length === 1 && isHash(params[0]) ? null : `${method} expects [hash]`;
    case 'eth_getBlockTransactionCountByNumber':
      return params.length === 1 && isBlockSelector(params[0]) ? null : 'eth_getBlockTransactionCountByNumber expects [block]';
    case 'eth_getTransactionByBlockHashAndIndex':
      return params.length === 2 && isHash(params[0]) && isHexQuantity(params[1]) ? null : 'eth_getTransactionByBlockHashAndIndex expects [hash, index]';
    case 'eth_getTransactionByBlockNumberAndIndex':
      return params.length === 2 && isBlockSelector(params[0]) && isHexQuantity(params[1]) ? null : 'eth_getTransactionByBlockNumberAndIndex expects [block, index]';
    case 'eth_getLogs':
      return params.length === 1 && validateLogFilter(params[0]) ? null : 'eth_getLogs expects one valid filter object';
    case 'eth_call':
      return (params.length === 2 || params.length === 3) && validateTxObject(params[0]) && isBlockSelector(params[1]) ? null : 'eth_call expects [transaction, block] with optional state override';
    case 'eth_estimateGas':
      return (params.length === 1 || params.length === 2) && validateTxObject(params[0]) && (params[1] === undefined || isBlockSelector(params[1])) ? null : 'eth_estimateGas expects [transaction] with optional block';
    case 'eth_feeHistory':
      if (params.length !== 3 || !isHexQuantity(params[0]) || !isBlockSelector(params[1]) || !Array.isArray(params[2])) return 'eth_feeHistory expects [blockCount, newestBlock, rewardPercentiles]';
      return params[2].every((value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100) ? null : 'eth_feeHistory reward percentiles must be finite numbers from 0 to 100';
    case 'eth_sendRawTransaction':
      return params.length === 1 && isHexData(params[0]) && (params[0] as string).length > 2 ? null : 'eth_sendRawTransaction expects one non-empty signed transaction byte string';
    case 'eth_subscribe':
      return validateSubscriptionParams(params);
    case 'eth_unsubscribe':
      return params.length === 1 && typeof params[0] === 'string' && params[0].length > 0 ? null : 'eth_unsubscribe expects one subscription ID';
    default:
      return 'method has no RPC-5 parameter policy';
  }
}

export function validateRpcRequest420(input: unknown, policy: RpcRequestPolicy420 = DEFAULT_RPC5_REQUEST_POLICY_420): RpcRequestPolicyDecision420 {
  if (!isRecord(input)) return fail(-32600, 'JSON-RPC request must be an object');
  if (input.jsonrpc !== '2.0') return fail(-32600, 'jsonrpc must equal 2.0');
  if (typeof input.method !== 'string' || input.method.length === 0) return fail(-32600, 'method must be a non-empty string');
  const method = input.method;

  if ('id' in input) {
    const id = input.id;
    if (!(id === null || typeof id === 'string' || (typeof id === 'number' && Number.isFinite(id)))) return fail(-32600, 'id must be a string, finite number, or null', method);
  } else if (!policy.allowNotifications) {
    return fail(-32600, 'notifications are disabled by RPC-5 policy', method);
  }

  const classified = classifyRpcMethod420(method);
  if (!classified.supported || classified.definition === null) return fail(-32601, classified.reason ?? 'method is not allowed', method);

  const rawParams = input.params ?? [];
  if (policy.requireArrayParams && !Array.isArray(rawParams)) return fail(-32602, 'public 420RPC requires positional array params', method, classified.definition.profile);
  if (!Array.isArray(rawParams)) return fail(-32602, 'RPC-5 currently validates positional array params only', method, classified.definition.profile);

  const paramError = validateMethodParams(method, rawParams);
  if (paramError) return fail(-32602, paramError, method, classified.definition.profile);

  const request: JsonRpcRequest420 = { jsonrpc: '2.0', method, params: rawParams };
  if ('id' in input) request.id = input.id as JsonRpcId420;
  return { allowed: true, method, profile: classified.definition.profile, code: null, reason: null, request };
}

export function validateRpcBatchEnvelope420(input: unknown): string[] {
  if (!Array.isArray(input)) return ['batch request must be an array'];
  if (input.length === 0) return ['batch request must not be empty'];
  return input.map((entry, index) => validateRpcRequest420(entry)).flatMap((decision, index) => decision.allowed ? [] : [`batch[${index}]: ${decision.reason}`]);
}

const MAX_UINT256 = (1n << 256n) - 1n;
const SELECTOR_APPROVE = '0x095ea7b3';
const SELECTOR_TRANSFER = '0xa9059cbb';

function rpcError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function address(value, label = 'address') {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{40}$/.test(value)) throw rpcError(-32602, `valid ${label} required`);
  return value.toLowerCase();
}

function quantity(value, label = 'quantity') {
  if (value == null) return 0n;
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === 'string' && /^0x[0-9a-fA-F]+$/.test(value)) return BigInt(value);
  throw rpcError(-32602, `valid ${label} required`);
}

function chainId(value) {
  if (value == null) return null;
  const n = quantity(value, 'chain id');
  if (n <= 0n) throw rpcError(-32602, 'positive chain id required');
  return `0x${n.toString(16)}`;
}

function calldata(value) {
  if (value == null || value === '') return '0x';
  if (typeof value !== 'string' || !/^0x(?:[0-9a-fA-F]{2})*$/.test(value)) throw rpcError(-32602, 'valid calldata required');
  return value.toLowerCase();
}

function word(data, index) {
  const start = 10 + index * 64;
  const hex = data.slice(start, start + 64);
  if (hex.length !== 64) throw rpcError(-32602, 'malformed ABI calldata');
  return hex;
}

function decodeKnownCall(data) {
  if (data === '0x') return Object.freeze({ kind: 'native-transfer', selector: null, warnings: [] });
  if (data.length < 10) return Object.freeze({ kind: 'unknown-calldata', selector: data, warnings: ['unknown-calldata'] });
  const selector = data.slice(0, 10);
  if (selector === SELECTOR_APPROVE && data.length === 138) {
    const spender = address(`0x${word(data, 0).slice(24)}`, 'approval spender');
    const amount = BigInt(`0x${word(data, 1)}`);
    const unlimited = amount === MAX_UINT256;
    return Object.freeze({ kind: 'erc20-approve', selector, spender, amount, unlimited, warnings: unlimited ? ['unlimited-token-approval'] : [] });
  }
  if (selector === SELECTOR_TRANSFER && data.length === 138) {
    const recipient = address(`0x${word(data, 0).slice(24)}`, 'token recipient');
    const amount = BigInt(`0x${word(data, 1)}`);
    return Object.freeze({ kind: 'erc20-transfer', selector, recipient, amount, warnings: [] });
  }
  return Object.freeze({ kind: 'unknown-calldata', selector, warnings: ['unknown-calldata'] });
}

function assertGranted(account, accounts = []) {
  const normalized = address(account, 'signer account');
  const granted = accounts.map((item) => address(item, 'granted account'));
  if (!granted.includes(normalized)) throw rpcError(4100, 'signer account is not granted to requesting origin');
  return normalized;
}

function parseTypedData(value) {
  let parsed = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch { throw rpcError(-32602, 'valid EIP-712 typed data JSON required'); }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw rpcError(-32602, 'valid EIP-712 typed data required');
  if (!parsed.domain || typeof parsed.domain !== 'object' || Array.isArray(parsed.domain)) throw rpcError(-32602, 'EIP-712 domain required');
  return parsed;
}

export function buildSigningReview420(request = {}, context = {}) {
  const method = request.method;
  const params = Array.isArray(request.params) ? request.params : [];
  const origin = typeof context.origin === 'string' ? context.origin : null;
  const accounts = Array.isArray(context.accounts) ? context.accounts : [];
  const activeChainId = chainId(context.chainId);

  if (method === 'eth_sendTransaction') {
    const tx = params[0];
    if (!tx || typeof tx !== 'object' || Array.isArray(tx)) throw rpcError(-32602, 'transaction object required');
    const from = assertGranted(tx.from, accounts);
    const to = address(tx.to, 'transaction target');
    const value = quantity(tx.value, 'transaction value');
    const data = calldata(tx.data ?? tx.input ?? '0x');
    const requestedChainId = chainId(tx.chainId);
    if (activeChainId && requestedChainId && activeChainId !== requestedChainId) throw rpcError(4901, 'transaction chain does not match active wallet network');
    const decoded = decodeKnownCall(data);
    return Object.freeze({ method, origin, account: from, chainId: requestedChainId ?? activeChainId, target: to, value, data, ...decoded });
  }

  if (method === 'personal_sign') {
    if (params.length < 2) throw rpcError(-32602, 'personal_sign message and signer required');
    const signerIndex = typeof params[0] === 'string' && /^0x[0-9a-fA-F]{40}$/.test(params[0]) ? 0 : 1;
    const account = assertGranted(params[signerIndex], accounts);
    const message = params[signerIndex === 0 ? 1 : 0];
    if (typeof message !== 'string') throw rpcError(-32602, 'personal_sign message required');
    return Object.freeze({ method, origin, account, chainId: activeChainId, message, warnings: ['opaque-message-signature'] });
  }

  if (method === 'eth_signTypedData_v4') {
    if (params.length < 2) throw rpcError(-32602, 'typed data and signer required');
    const signerIndex = typeof params[0] === 'string' && /^0x[0-9a-fA-F]{40}$/.test(params[0]) ? 0 : 1;
    const account = assertGranted(params[signerIndex], accounts);
    const typedData = parseTypedData(params[signerIndex === 0 ? 1 : 0]);
    const domainChainId = chainId(typedData.domain.chainId);
    if (activeChainId && domainChainId && activeChainId !== domainChainId) throw rpcError(4901, 'EIP-712 domain chain does not match active wallet network');
    if (typedData.domain.verifyingContract != null) address(typedData.domain.verifyingContract, 'EIP-712 verifying contract');
    return Object.freeze({
      method,
      origin,
      account,
      chainId: domainChainId ?? activeChainId,
      domain: Object.freeze({
        name: typeof typedData.domain.name === 'string' ? typedData.domain.name : null,
        version: typeof typedData.domain.version === 'string' ? typedData.domain.version : null,
        chainId: domainChainId,
        verifyingContract: typedData.domain.verifyingContract ? address(typedData.domain.verifyingContract, 'EIP-712 verifying contract') : null,
      }),
      primaryType: typeof typedData.primaryType === 'string' ? typedData.primaryType : null,
      warnings: domainChainId == null ? ['typed-data-without-chain-binding'] : [],
    });
  }

  throw rpcError(4200, `unsupported signing review method: ${method}`);
}

export const MAX_UINT256_420 = MAX_UINT256;

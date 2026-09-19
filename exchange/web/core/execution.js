import {
  addressWord,
  bytes32Word,
  encodeCancelOrder,
  encodeInitiateOutbound,
  encodeIsQualified,
  encodeSwapExactInputNativePath,
  encodeSwapExactInputPath,
  encodeSwapExactInputPathForNative,
  uintWord,
} from './abi.js';
import { normalizeChainId } from './wallet-session.js';

const MODES = Object.freeze(['ERC20_TO_ERC20','NATIVE_TO_ERC20','ERC20_TO_NATIVE']);

function requireRuntime(runtime) {
  if (!runtime?.deployment || runtime.deployment.status !== 'RESOLVED') throw new Error('Exchange deployment is not resolved');
  const chainId = normalizeChainId(runtime.network?.chainId);
  return { chainId, contracts: runtime.contracts ?? {} };
}
function txAddress(value, label) {
  try { addressWord(value); return value; } catch { throw new Error(`invalid ${label}`); }
}
function bytes32(value, label) {
  try { bytes32Word(value); return value; } catch { throw new Error(`invalid ${label}`); }
}
function rawAmount(value, label) {
  try {
    const word = uintWord(value);
    if (BigInt(value) <= 0n) throw new Error('zero');
    return { word, value: BigInt(value).toString(10) };
  } catch {
    throw new Error(`invalid ${label}`);
  }
}
function sameAddress(left, right) {
  return typeof left === 'string' && typeof right === 'string' && left.toLowerCase() === right.toLowerCase();
}
function sameId(left, right) {
  return typeof left === 'string' && typeof right === 'string' && left.toLowerCase() === right.toLowerCase();
}
function transactionEnvelope({chainId, from, to, data, value = '0x0', kind}) {
  txAddress(from, 'transaction sender');
  txAddress(to, 'transaction target');
  if (typeof data !== 'string' || !/^0x[0-9a-f]+$/i.test(data)) throw new Error('invalid transaction calldata');
  return Object.freeze({
    kind,
    chainId,
    request: Object.freeze({ from: from.toLowerCase(), to, data, value }),
  });
}

export function buildSwapTransaction({ runtime, account, reviewedIntent, execution }) {
  const { chainId, contracts } = requireRuntime(runtime);
  if (!reviewedIntent || reviewedIntent.kind !== 'EXACT_INPUT_PATH') throw new Error('reviewed swap intent required');
  const mode = execution?.mode ?? 'ERC20_TO_ERC20';
  if (!MODES.includes(mode)) throw new Error('unsupported swap execution mode');

  const tokenIn = txAddress(execution?.tokenIn, 'swap tokenIn');
  const recipient = txAddress(execution?.recipient, 'swap recipient');
  if (!sameAddress(recipient, reviewedIntent.recipient)) throw new Error('swap recipient changed after review');

  const amountInRaw = rawAmount(execution?.amountInRaw, 'swap raw input amount').value;
  const minFinalAmountOutRaw = rawAmount(execution?.minFinalAmountOutRaw, 'swap raw minimum output').value;
  const expectedPathHash = bytes32(execution?.expectedPathHash, 'swap path hash');

  if (reviewedIntent.routeCommitment && !sameId(expectedPathHash, reviewedIntent.routeCommitment)) {
    throw new Error('swap route commitment changed after review');
  }

  if (!Array.isArray(execution?.hops) || execution.hops.length !== reviewedIntent.hops?.length) {
    throw new Error('swap hop count changed after review');
  }

  const hops = execution.hops.map((hop, index) => {
    const reviewed = reviewedIntent.hops[index];
    const marketId = bytes32(hop.marketId, `swap hop ${index} marketId`);
    const routeId = bytes32(hop.routeId, `swap hop ${index} routeId`);
    const tokenOut = txAddress(hop.tokenOut, `swap hop ${index} tokenOut`);
    const minAmountOutRaw = rawAmount(hop.minAmountOutRaw, `swap hop ${index} raw minimum output`).value;
    if (reviewed.marketId?.startsWith('0x') && !sameId(reviewed.marketId, marketId)) throw new Error(`swap hop ${index} market changed after review`);
    if (reviewed.outputToken?.startsWith('0x') && !sameAddress(reviewed.outputToken, tokenOut)) throw new Error(`swap hop ${index} output token changed after review`);
    return { marketId, routeId, tokenOut, minAmountOutRaw, routeData: hop.routeData ?? '0x' };
  });

  const router = txAddress(contracts.ExchangeAtomicRouter420, 'ExchangeAtomicRouter420');
  let data;
  let value = '0x0';
  if (mode === 'NATIVE_TO_ERC20') {
    const encoded = encodeSwapExactInputNativePath({ amountInRaw, minFinalAmountOutRaw, recipient, expectedPathHash, hops });
    data = encoded.data;
    value = encoded.value;
  } else if (mode === 'ERC20_TO_NATIVE') {
    data = encodeSwapExactInputPathForNative({ tokenIn, amountInRaw, minFinalAmountOutRaw, recipient, expectedPathHash, hops });
  } else {
    data = encodeSwapExactInputPath({ tokenIn, amountInRaw, minFinalAmountOutRaw, recipient, expectedPathHash, hops });
  }

  return transactionEnvelope({ chainId, from: account, to: router, data, value, kind: 'SWAP' });
}

export function buildLimitOrderTypedData({ runtime, reviewedOrder, execution }) {
  const { chainId, contracts } = requireRuntime(runtime);
  if (!reviewedOrder) throw new Error('reviewed limit order required');

  const order = Object.freeze({
    maker: txAddress(execution?.maker, 'limit order maker'),
    sellToken: txAddress(execution?.sellToken, 'limit order sellToken'),
    buyToken: txAddress(execution?.buyToken, 'limit order buyToken'),
    sellAmountRaw: rawAmount(execution?.sellAmountRaw, 'limit order raw sell amount').value,
    minBuyAmountRaw: rawAmount(execution?.minBuyAmountRaw, 'limit order raw minimum buy amount').value,
    recipient: txAddress(execution?.recipient, 'limit order recipient'),
    marketId: bytes32(execution?.marketId, 'limit order marketId'),
    nonce: BigInt(execution?.nonce).toString(10),
    expiry: BigInt(execution?.expiry).toString(10),
    allowPartial: execution?.allowPartial === true,
  });

  if (reviewedOrder.maker?.startsWith('0x') && !sameAddress(reviewedOrder.maker, order.maker)) throw new Error('limit order maker changed after review');
  if (reviewedOrder.recipient?.startsWith('0x') && !sameAddress(reviewedOrder.recipient, order.recipient)) throw new Error('limit order recipient changed after review');
  if (reviewedOrder.primaryMarket?.startsWith('0x') && !sameId(reviewedOrder.primaryMarket, order.marketId)) throw new Error('limit order market changed after review');
  if (Number.isInteger(reviewedOrder.nonce) && BigInt(reviewedOrder.nonce) !== BigInt(order.nonce)) throw new Error('limit order nonce changed after review');
  if (Number.isInteger(reviewedOrder.expiry) && BigInt(reviewedOrder.expiry) !== BigInt(order.expiry)) throw new Error('limit order expiry changed after review');
  if (Boolean(reviewedOrder.allowPartial) !== order.allowPartial) throw new Error('limit order partial-fill policy changed after review');

  const verifyingContract = txAddress(contracts.ExchangeLimitOrderSettlement420, 'ExchangeLimitOrderSettlement420');
  return Object.freeze({
    kind: 'LIMIT_ORDER',
    account: order.maker.toLowerCase(),
    chainId,
    method: 'eth_signTypedData_v4',
    typedData: Object.freeze({
      domain: Object.freeze({
        name: '420Exchange Limit Orders',
        version: '1',
        chainId,
        verifyingContract,
      }),
      primaryType: 'LimitOrder',
      types: Object.freeze({
        EIP712Domain: Object.freeze([
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ]),
        LimitOrder: Object.freeze([
          { name: 'maker', type: 'address' },
          { name: 'sellToken', type: 'address' },
          { name: 'buyToken', type: 'address' },
          { name: 'sellAmount', type: 'uint128' },
          { name: 'minBuyAmount', type: 'uint128' },
          { name: 'recipient', type: 'address' },
          { name: 'marketId', type: 'bytes32' },
          { name: 'nonce', type: 'uint256' },
          { name: 'expiry', type: 'uint64' },
          { name: 'allowPartial', type: 'bool' },
        ]),
      }),
      message: Object.freeze({
        maker: order.maker,
        sellToken: order.sellToken,
        buyToken: order.buyToken,
        sellAmount: order.sellAmountRaw,
        minBuyAmount: order.minBuyAmountRaw,
        recipient: order.recipient,
        marketId: order.marketId,
        nonce: order.nonce,
        expiry: order.expiry,
        allowPartial: order.allowPartial,
      }),
    }),
    order,
  });
}

export function buildLimitOrderCancelTransaction({ runtime, account, signedOrder }) {
  const { chainId, contracts } = requireRuntime(runtime);
  if (!signedOrder) throw new Error('signed order required');
  const maker = txAddress(signedOrder.maker, 'limit order maker');
  if (!sameAddress(account, maker)) throw new Error('only the maker may cancel the order');
  const settlement = txAddress(contracts.ExchangeLimitOrderSettlement420, 'ExchangeLimitOrderSettlement420');
  const data = encodeCancelOrder(signedOrder);
  return transactionEnvelope({ chainId, from: account, to: settlement, data, kind: 'ORDER_CANCEL' });
}

export function buildBridgeQualificationCall({ runtime, exchangeAssetId }) {
  const { chainId, contracts } = requireRuntime(runtime);
  const target = txAddress(contracts.ExchangeBridgeQualification420, 'ExchangeBridgeQualification420');
  const asset = bytes32(exchangeAssetId, 'exchange bridge assetId');
  return Object.freeze({
    kind: 'BRIDGE_QUALIFICATION',
    chainId,
    request: Object.freeze({ to: target, data: encodeIsQualified(asset) }),
  });
}

export function buildBridgeOutboundTransaction({ runtime, account, reviewedIntent, execution }) {
  const { chainId, contracts } = requireRuntime(runtime);
  if (!reviewedIntent || reviewedIntent.kind !== 'BRIDGE_WITHDRAWAL') throw new Error('reviewed outbound bridge intent required');
  const gateway = txAddress(contracts.GatewayRouter420, 'GatewayRouter420');

  const adapterId = bytes32(execution?.adapterId, 'bridge adapterId');
  const routeId = bytes32(execution?.routeId, 'bridge routeId');
  const assetId = bytes32(execution?.assetId, 'bridge assetId');
  if (reviewedIntent.adapterId?.startsWith('0x') && !sameId(reviewedIntent.adapterId, adapterId)) throw new Error('bridge adapter changed after review');
  if (reviewedIntent.routeId?.startsWith('0x') && !sameId(reviewedIntent.routeId, routeId)) throw new Error('bridge route changed after review');
  if (reviewedIntent.exchangeAssetId?.startsWith('0x') && !sameId(reviewedIntent.exchangeAssetId, assetId)) throw new Error('bridge asset changed after review');

  const amountRaw = rawAmount(execution?.amountRaw, 'bridge raw amount').value;
  const feeValueWei = execution?.feeValueWei === undefined ? 0n : BigInt(execution.feeValueWei);
  if (feeValueWei < 0n) throw new Error('invalid bridge fee value');

  const data = encodeInitiateOutbound({
    adapterId,
    routeId,
    assetId,
    recipientBytes: execution?.recipientBytes,
    amountRaw,
    extra: execution?.extra ?? '0x',
  });

  return transactionEnvelope({
    chainId,
    from: account,
    to: gateway,
    data,
    value: '0x' + feeValueWei.toString(16),
    kind: 'BRIDGE',
  });
}

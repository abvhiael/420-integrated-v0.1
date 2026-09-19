import test from 'node:test';
import assert from 'node:assert/strict';
import {
  functionSelector,
  keccak256,
} from '../core/abi.js';
import {
  buildBridgeOutboundTransaction,
  buildBridgeQualificationCall,
  buildLimitOrderCancelTransaction,
  buildLimitOrderTypedData,
  buildSwapTransaction,
} from '../core/execution.js';

const address = (n) => '0x' + BigInt(n).toString(16).padStart(40, '0');
const id = (n) => '0x' + BigInt(n).toString(16).padStart(64, '0');

const runtime = {
  deployment: { schema:'420-exchange-testnet-runtime-v15.1', environment:'testnet', status:'RESOLVED' },
  network: { chainId:'0x420' },
  contracts: {
    ExchangeAtomicRouter420: address(100),
    ExchangeLimitOrderSettlement420: address(101),
    ExchangeBridgeQualification420: address(102),
    GatewayRouter420: address(103),
  },
};

test('Ethereum keccak and selector implementation matches canonical vectors', () => {
  assert.equal(
    keccak256(''),
    '0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470',
  );
  assert.equal(functionSelector('transfer(address,uint256)'), '0xa9059cbb');
});

test('builds deterministic exact-input swap calldata from raw reviewed execution data', () => {
  const reviewedIntent = {
    kind:'EXACT_INPUT_PATH',
    recipient:address(2),
    routeCommitment:id(900),
    hops:[{ marketId:id(10), outputToken:address(4) }],
  };
  const execution = {
    mode:'ERC20_TO_ERC20',
    tokenIn:address(3),
    recipient:address(2),
    amountInRaw:'1000000000000000000',
    minFinalAmountOutRaw:'4100000',
    expectedPathHash:id(900),
    hops:[{
      marketId:id(10),
      routeId:id(11),
      tokenOut:address(4),
      minAmountOutRaw:'4100000',
      routeData:'0x1234',
    }],
  };
  const tx = buildSwapTransaction({ runtime, account:address(1), reviewedIntent, execution });
  assert.equal(tx.kind, 'SWAP');
  assert.equal(tx.chainId, '0x420');
  assert.equal(tx.request.to, runtime.contracts.ExchangeAtomicRouter420);
  assert.equal(tx.request.value, '0x0');
  assert.ok(tx.request.data.startsWith(functionSelector('swapExactInputPath(address,uint256,uint256,address,bytes32,(bytes32,bytes32,address,uint256,bytes)[])')));
});

test('rejects floating-point and post-review swap mutations', () => {
  const base = {
    reviewedIntent:{ kind:'EXACT_INPUT_PATH', recipient:address(2), routeCommitment:id(20), hops:[{ marketId:id(21), outputToken:address(4) }] },
    execution:{
      mode:'ERC20_TO_ERC20', tokenIn:address(3), recipient:address(2), amountInRaw:'100',
      minFinalAmountOutRaw:'90', expectedPathHash:id(20),
      hops:[{ marketId:id(21), routeId:id(22), tokenOut:address(4), minAmountOutRaw:'90', routeData:'0x' }],
    },
  };
  const decimal = structuredClone(base);
  decimal.execution.amountInRaw = '1.5';
  assert.throws(() => buildSwapTransaction({ runtime, account:address(1), ...decimal }), /raw input amount/);

  const changed = structuredClone(base);
  changed.execution.recipient = address(9);
  assert.throws(() => buildSwapTransaction({ runtime, account:address(1), ...changed }), /recipient changed after review/);
});

test('builds EIP-712 limit-order payload bound to chain and settlement contract', () => {
  const reviewedOrder = {
    maker:address(1), recipient:address(1), primaryMarket:id(50), nonce:7, expiry:2000000000, allowPartial:true,
  };
  const execution = {
    maker:address(1), sellToken:address(5), buyToken:address(6),
    sellAmountRaw:'10000000000000000000', minBuyAmountRaw:'42000000',
    recipient:address(1), marketId:id(50), nonce:7, expiry:2000000000, allowPartial:true,
  };
  const request = buildLimitOrderTypedData({ runtime, reviewedOrder, execution });
  assert.equal(request.method, 'eth_signTypedData_v4');
  assert.equal(request.typedData.domain.name, '420Exchange Limit Orders');
  assert.equal(request.typedData.domain.version, '1');
  assert.equal(request.typedData.domain.chainId, '0x420');
  assert.equal(request.typedData.domain.verifyingContract, runtime.contracts.ExchangeLimitOrderSettlement420);
  assert.equal(request.typedData.message.sellAmount, execution.sellAmountRaw);
  assert.equal(request.typedData.message.minBuyAmount, execution.minBuyAmountRaw);
  assert.equal(request.typedData.message.marketId, execution.marketId);
});

test('builds maker-only on-chain order cancellation calldata', () => {
  const signedOrder = {
    maker:address(1), sellToken:address(5), buyToken:address(6),
    sellAmountRaw:'10', minBuyAmountRaw:'42', recipient:address(1),
    marketId:id(50), nonce:'7', expiry:'2000000000', allowPartial:true,
  };
  const tx = buildLimitOrderCancelTransaction({ runtime, account:address(1), signedOrder });
  assert.equal(tx.request.to, runtime.contracts.ExchangeLimitOrderSettlement420);
  assert.ok(tx.request.data.startsWith(functionSelector('cancelOrder((address,address,address,uint128,uint128,address,bytes32,uint256,uint64,bool))')));
  assert.throws(
    () => buildLimitOrderCancelTransaction({ runtime, account:address(9), signedOrder }),
    /only the maker may cancel/,
  );
});

test('builds bridge qualification read and outbound GatewayRouter transaction', () => {
  const qualification = buildBridgeQualificationCall({ runtime, exchangeAssetId:id(70) });
  assert.equal(qualification.request.to, runtime.contracts.ExchangeBridgeQualification420);
  assert.ok(qualification.request.data.startsWith(functionSelector('isQualified(bytes32)')));

  const reviewedIntent = {
    kind:'BRIDGE_WITHDRAWAL',
    routeId:id(71),
    exchangeAssetId:id(72),
    adapterId:id(73),
  };
  const tx = buildBridgeOutboundTransaction({
    runtime,
    account:address(1),
    reviewedIntent,
    execution:{
      adapterId:id(73), routeId:id(71), assetId:id(72),
      recipientBytes:'0x00112233445566778899aabbccddeeff00112233',
      amountRaw:'1000000000000000000',
      extra:'0x',
      feeValueWei:'420',
    },
  });
  assert.equal(tx.request.to, runtime.contracts.GatewayRouter420);
  assert.equal(tx.request.value, '0x1a4');
  assert.ok(tx.request.data.startsWith(functionSelector('initiateOutbound(bytes32,bytes32,bytes32,bytes,uint256,bytes)')));
});

test('all transaction construction fails closed when deployment is unresolved', () => {
  const unresolved = { ...runtime, deployment:{ ...runtime.deployment, status:'UNRESOLVED_UNTIL_DEPLOYMENT' } };
  assert.throws(
    () => buildBridgeQualificationCall({ runtime:unresolved, exchangeAssetId:id(1) }),
    /deployment is not resolved/,
  );
});

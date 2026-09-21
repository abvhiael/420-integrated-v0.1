import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reconcileNativeSettlement420 } from '../src/native-settlement-reconciliation.js';
import type { NativeSettlementEvidence420, NativeSettlementExpected420, NativeSettlementRoute420 } from '../src/native-settlement-reconciliation.js';
import type { Hex32 } from '../src/types.js';

const id = (n: number) => `0x${n.toString(16).padStart(64, '0')}` as Hex32;
const payer = '0x000000000000000000000000000000000000beef';
const provider = '0x000000000000000000000000000000000000d00d';
const native = '0x0000000000000000000000000000000000000000';
function fixture(route: NativeSettlementRoute420) {
  const split = route === 'PARTIAL_SPLIT';
  const refund = route === 'PAYER_REFUND';
  const expected: NativeSettlementExpected420 = {
    route, jobId: id(1), fundingRef: id(2), vaultRef: id(3), settlementRef: id(4),
    txHash: id(5), originalObligation: id(6), payer, provider, total: 100n,
    providerAmount: split ? 37n : undefined,
    replacementObligations: split ? [id(7), id(8)] : refund ? [id(7)] : [],
    claimOperations: split ? [id(9), id(10)] : [id(9)],
  };
  const amounts = split ? [37n, 63n] : [100n];
  const recipients = split ? [provider, payer] : [refund ? payer : provider];
  const evidence: NativeSettlementEvidence420 = {
    route, chainId: 420n, expectedChainId: 420n, deploymentCodeHash: id(20),
    expectedDeploymentCodeHash: id(20), jobId: expected.jobId, fundingRef: expected.fundingRef,
    vaultRef: expected.vaultRef, settlementRef: expected.settlementRef,
    expectedSettlementRef: expected.settlementRef, txHash: expected.txHash,
    transaction: 'FINAL_SUCCESS', escrowState: 'CLOSED',
    managerState: refund ? 'REFUNDED' : 'SETTLED', payer, provider, total: 100n,
    original: { id: expected.originalObligation, fundingRef: expected.fundingRef,
      vaultRef: expected.vaultRef, beneficiary: provider, asset: native, amount: 100n,
      state: refund || split ? 'CANCELLED' : 'CLAIMED' },
    replacements: expected.replacementObligations.map((obligation, i) => ({
      id: obligation, fundingRef: expected.fundingRef, vaultRef: expected.vaultRef,
      beneficiary: recipients[i], asset: native, amount: amounts[i], state: 'CLAIMED' as const,
    })),
    transfers: expected.claimOperations.map((op, i) => ({ operationId: op,
      obligationId: split || refund ? expected.replacementObligations[i] : expected.originalObligation,
      recipient: recipients[i], amount: amounts[i], txHash: expected.txHash,
      canonicalFinalizedReceipt: true, nativeBalanceDeltaVerified: true,
    })),
  };
  return { expected, evidence };
}
for (const route of ['PROVIDER_FULL', 'PAYER_REFUND', 'PARTIAL_SPLIT'] as const) {
  test(`${route}: accepts independently verified canonical terminal evidence`, () => {
    const { expected, evidence } = fixture(route);
    assert.equal(reconcileNativeSettlement420(expected, evidence), 'FINAL_PAID');
  });
  test(`${route}: timeout, unfinalized, reorg and lost balance proof never count as paid`, () => {
    for (const transaction of ['PENDING', 'UNKNOWN', 'FINAL_REVERT'] as const) {
      const { expected, evidence } = fixture(route);
      evidence.transaction = transaction;
      assert.equal(reconcileNativeSettlement420(expected, evidence), 'RECONCILE');
    }
    const { expected, evidence } = fixture(route);
    evidence.transfers[0].nativeBalanceDeltaVerified = false;
    assert.equal(reconcileNativeSettlement420(expected, evidence), 'RECONCILE');
    evidence.transfers[0].nativeBalanceDeltaVerified = true;
    evidence.chainId = 421n;
    assert.equal(reconcileNativeSettlement420(expected, evidence), 'RECONCILE');
  });
  test(`${route}: wrong job, emitter binding, amount, operation or receipt rejects paid`, () => {
    const mutations: Array<(e: NativeSettlementEvidence420) => void> = [
      e => { e.jobId = id(40); }, e => { e.deploymentCodeHash = id(41); },
      e => { e.transfers[0].amount = 1n; }, e => { e.transfers[0].operationId = id(42); },
      e => { e.transfers[0].canonicalFinalizedReceipt = false; },
      e => { e.escrowState = 'FUNDED'; }, e => { e.original.fundingRef = id(43); },
    ];
    for (const mutate of mutations) {
      const { expected, evidence } = fixture(route);
      mutate(evidence);
      assert.equal(reconcileNativeSettlement420(expected, evidence), 'RECONCILE');
    }
  });
}
test('refund cannot be certified by original provider obligation CLAIMED', () => {
  const { expected, evidence } = fixture('PAYER_REFUND');
  evidence.original.state = 'CLAIMED';
  assert.equal(reconcileNativeSettlement420(expected, evidence), 'RECONCILE');
});
test('split cannot be certified when only one replacement is claimed', () => {
  const { expected, evidence } = fixture('PARTIAL_SPLIT');
  evidence.replacements[1].state = 'RESERVED';
  assert.equal(reconcileNativeSettlement420(expected, evidence), 'RECONCILE');
});
test('a forged second transfer or duplicate operation cannot certify split', () => {
  const { expected, evidence } = fixture('PARTIAL_SPLIT');
  evidence.transfers[1].operationId = evidence.transfers[0].operationId;
  assert.equal(reconcileNativeSettlement420(expected, evidence), 'RECONCILE');
});

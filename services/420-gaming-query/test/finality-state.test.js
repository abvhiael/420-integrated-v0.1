import test from "node:test";
import assert from "node:assert/strict";
import { evaluateFinalityState420, FinalityDecision420 } from "../src/finality-state.js";

const base = Object.freeze({
  expectedChainId: 420,
  rpcChainId: 420,
  txStatus: "success",
  receiptBlockNumber: 100,
  receiptBlockHash: "0xabc",
  canonicalBlockHash: "0xabc",
  canonicalHeadNumber: 103,
  finalizedHeadNumber: 103,
  indexerHeadNumber: 103,
  confirmationsRequired: 3
});

test("submitted transaction is pending until receipt/finality exists", () => {
  const result = evaluateFinalityState420({ ...base, receiptBlockNumber: undefined, receiptBlockHash: undefined });
  assert.equal(result.canonical, false);
  assert.equal(result.state, FinalityDecision420.PENDING);
});

test("reverted optimistic transaction fails closed", () => {
  const result = evaluateFinalityState420({ ...base, txStatus: "reverted" });
  assert.equal(result.state, FinalityDecision420.REVERTED);
  assert.equal(result.canonical, false);
});

test("short reorg invalidates optimistic ownership state", () => {
  const result = evaluateFinalityState420({ ...base, canonicalBlockHash: "0xdef" });
  assert.equal(result.state, FinalityDecision420.REORGED);
  assert.equal(result.canonical, false);
});

test("RPC unavailability fails closed", () => {
  assert.equal(evaluateFinalityState420({ ...base, rpcChainId: undefined }).state, FinalityDecision420.RPC_UNAVAILABLE);
  assert.equal(evaluateFinalityState420({ ...base, canonicalBlockHash: undefined }).state, FinalityDecision420.RPC_UNAVAILABLE);
});

test("chain id mismatch fails closed", () => {
  const result = evaluateFinalityState420({ ...base, rpcChainId: 1 });
  assert.equal(result.state, FinalityDecision420.CHAIN_MISMATCH);
  assert.equal(result.canonical, false);
});

test("indexer ahead or behind canonical RPC is rejected", () => {
  assert.equal(evaluateFinalityState420({ ...base, indexerHeadNumber: 102 }).state, FinalityDecision420.INDEXER_BEHIND);
  assert.equal(evaluateFinalityState420({ ...base, indexerHeadNumber: 104 }).state, FinalityDecision420.INDEXER_AHEAD);
});

test("duplicate event delivery is non-canonical for state application", () => {
  const seen = new Set(["event-1"]);
  const result = evaluateFinalityState420({ ...base, eventId: "event-1", seenEventIds: seen });
  assert.equal(result.state, FinalityDecision420.DUPLICATE_EVENT);
  assert.equal(result.canonical, false);
});

test("confirmation threshold transitions pending to finalized", () => {
  const pending = evaluateFinalityState420({ ...base, finalizedHeadNumber: 101 });
  assert.equal(pending.state, FinalityDecision420.PENDING);
  assert.equal(pending.confirmations, 2);

  const finalized = evaluateFinalityState420({ ...base, finalizedHeadNumber: 102 });
  assert.equal(finalized.state, FinalityDecision420.FINALIZED);
  assert.equal(finalized.canonical, true);
  assert.equal(finalized.finalized, true);
  assert.equal(finalized.confirmations, 3);
});

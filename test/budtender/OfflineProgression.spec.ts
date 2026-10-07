import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import {
  MAX_OFFLINE_ELAPSED_MS,
  calculateOfflineProgression,
} from "../../src/budtender/OfflineProgression.ts";

const HOUR = 60 * 60 * 1000;

describe("Budtender offline progression", () => {
  it("is deterministic from stored state plus elapsed time", () => {
    const input = {
      lastProcessedAtMs: 1_000,
      nowMs: 1_000 + 3 * HOUR,
      incomeSources: [{
        id: "passive-income",
        intervalMs: HOUR,
        cashPerInterval: 7,
        remainingCashCap: 100,
        enabled: true,
      }],
    };

    assert.deepEqual(calculateOfflineProgression(input), calculateOfflineProgression(input));
    assert.equal(calculateOfflineProgression(input).totalCash, 21);
  });

  it("uses complete intervals only", () => {
    const result = calculateOfflineProgression({
      lastProcessedAtMs: 0,
      nowMs: HOUR - 1,
      incomeSources: [{
        id: "passive-income",
        intervalMs: HOUR,
        cashPerInterval: 10,
        remainingCashCap: 100,
        enabled: true,
      }],
    });

    assert.equal(result.totalCash, 0);
    assert.equal(result.grants[0]?.intervals, 0);
  });

  it("caps elapsed accumulation at 24 hours and discards excess time", () => {
    const result = calculateOfflineProgression({
      lastProcessedAtMs: 0,
      nowMs: 72 * HOUR,
      incomeSources: [{
        id: "passive-income",
        intervalMs: HOUR,
        cashPerInterval: 1,
        remainingCashCap: 100,
        enabled: true,
      }],
    });

    assert.equal(result.rawElapsedMs, 72 * HOUR);
    assert.equal(result.effectiveElapsedMs, MAX_OFFLINE_ELAPSED_MS);
    assert.equal(result.discardedElapsedMs, 48 * HOUR);
    assert.equal(result.totalCash, 24);
    assert.equal(result.nextLastProcessedAtMs, 72 * HOUR);
  });

  it("enforces a per-source cash cap", () => {
    const result = calculateOfflineProgression({
      lastProcessedAtMs: 0,
      nowMs: 10 * HOUR,
      incomeSources: [{
        id: "capped-income",
        intervalMs: HOUR,
        cashPerInterval: 10,
        remainingCashCap: 25,
        enabled: true,
      }],
    });

    assert.equal(result.totalCash, 25);
    assert.equal(result.grants[0]?.cash, 25);
  });

  it("does not award disabled sources", () => {
    const result = calculateOfflineProgression({
      lastProcessedAtMs: 0,
      nowMs: 5 * HOUR,
      incomeSources: [{
        id: "disabled-income",
        intervalMs: HOUR,
        cashPerInterval: 10,
        remainingCashCap: 100,
        enabled: false,
      }],
    });

    assert.equal(result.totalCash, 0);
  });

  it("fails closed on clock rollback and preserves the prior cursor", () => {
    const result = calculateOfflineProgression({
      lastProcessedAtMs: 10 * HOUR,
      nowMs: 9 * HOUR,
      incomeSources: [{
        id: "passive-income",
        intervalMs: HOUR,
        cashPerInterval: 10,
        remainingCashCap: 100,
        enabled: true,
      }],
    });

    assert.equal(result.clockRollbackDetected, true);
    assert.equal(result.totalCash, 0);
    assert.equal(result.nextLastProcessedAtMs, 10 * HOUR);
  });

  it("makes repeated processing at the same timestamp replay-safe", () => {
    const first = calculateOfflineProgression({
      lastProcessedAtMs: 0,
      nowMs: 72 * HOUR,
      incomeSources: [{
        id: "passive-income",
        intervalMs: HOUR,
        cashPerInterval: 1,
        remainingCashCap: 100,
        enabled: true,
      }],
    });

    const replay = calculateOfflineProgression({
      lastProcessedAtMs: first.nextLastProcessedAtMs,
      nowMs: 72 * HOUR,
      incomeSources: [{
        id: "passive-income",
        intervalMs: HOUR,
        cashPerInterval: 1,
        remainingCashCap: 100,
        enabled: true,
      }],
    });

    assert.equal(first.totalCash, 24);
    assert.equal(replay.totalCash, 0);
    assert.equal(replay.rawElapsedMs, 0);
  });

  it("rejects duplicate source ids and malformed source economics", () => {
    assert.throws(() => calculateOfflineProgression({
      lastProcessedAtMs: 0,
      nowMs: HOUR,
      incomeSources: [
        { id: "dup", intervalMs: HOUR, cashPerInterval: 1, remainingCashCap: 10, enabled: true },
        { id: "dup", intervalMs: HOUR, cashPerInterval: 1, remainingCashCap: 10, enabled: true },
      ],
    }), /duplicate/);

    assert.throws(() => calculateOfflineProgression({
      lastProcessedAtMs: 0,
      nowMs: HOUR,
      incomeSources: [{
        id: "bad",
        intervalMs: 0,
        cashPerInterval: 1,
        remainingCashCap: 10,
        enabled: true,
      }],
    }), /interval/);
  });

  it("rejects unsafe integer timestamps and reward overflow", () => {
    assert.throws(() => calculateOfflineProgression({
      lastProcessedAtMs: -1,
      nowMs: 0,
    }), /timestamp/);

    assert.throws(() => calculateOfflineProgression({
      lastProcessedAtMs: 0,
      nowMs: MAX_OFFLINE_ELAPSED_MS,
      incomeSources: [{
        id: "overflow",
        intervalMs: 1,
        cashPerInterval: Number.MAX_SAFE_INTEGER,
        remainingCashCap: Number.MAX_SAFE_INTEGER,
        enabled: true,
      }],
    }), /safe integer range/);
  });

  it("has zero economic effect when no canonical offline-capable sources are supplied", () => {
    const result = calculateOfflineProgression({
      lastProcessedAtMs: 0,
      nowMs: 12 * HOUR,
    });

    assert.equal(result.totalCash, 0);
    assert.deepEqual(result.grants, []);
  });
});

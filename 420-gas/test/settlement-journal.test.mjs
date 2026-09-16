import assert from 'node:assert/strict';
import test from 'node:test';
import { GasSettlementJournal420, GasSettlementJournalError420 } from '../src/settlement-journal.mjs';

const hash = (n) => `0x${n.toString(16).padStart(64, '0')}`;

test('GAS-10.3 records bounded non-authoritative settlement observations', () => {
  const journal = new GasSettlementJournal420({ maxEntries: 2 });
  const entry = journal.append({
    settlementCommitment: hash(1),
    reservedWei: 100n,
    actualCostWei: 80n,
    outcome: 'success',
    confirmation: 'finalized',
    observedAt: '2026-09-15T20:30:00Z',
  });
  assert.equal(entry.discrepancy, 'none');
  assert.equal(entry.authority, 'projection-only');
  assert.equal(entry.settlementAuthority, false);
  assert.equal(entry.accountingAuthority, false);
  assert.equal(entry.executionAuthorization, false);
});

test('GAS-10.3 flags impossible observed cost without changing accounting truth', () => {
  const journal = new GasSettlementJournal420();
  const entry = journal.append({
    settlementCommitment: hash(2),
    reservedWei: 100n,
    actualCostWei: 101n,
    outcome: 'reverted',
    confirmation: 'observed',
    observedAt: '2026-09-15T20:31:00Z',
  });
  assert.equal(entry.discrepancy, 'actual_exceeds_reserved');
  assert.equal(journal.summary().discrepancyCount, 1);
});

test('GAS-10.3 evicts oldest entries at capacity and bounds identifier retention', () => {
  const journal = new GasSettlementJournal420({ maxEntries: 2 });
  journal.append({ settlementCommitment: hash(10), reservedWei: 10n, actualCostWei: 9n, observedAt: '2026-09-15T20:32:00Z' });
  journal.append({ settlementCommitment: hash(11), reservedWei: 10n, actualCostWei: 8n, observedAt: '2026-09-15T20:33:00Z' });
  journal.append({ settlementCommitment: hash(12), reservedWei: 10n, actualCostWei: 7n, observedAt: '2026-09-15T20:34:00Z' });
  assert.equal(journal.snapshot().length, 2);
  assert.equal(journal.get(hash(10)), null);
  assert.equal(journal.get(hash(12)).actualCostWei, 7n);
});

test('GAS-10.3 rejects duplicate or malformed observations', () => {
  const journal = new GasSettlementJournal420();
  journal.append({ settlementCommitment: hash(20), reservedWei: 10n, actualCostWei: 10n, observedAt: '2026-09-15T20:35:00Z' });
  assert.throws(() => journal.append({ settlementCommitment: hash(20), reservedWei: 10n, actualCostWei: 10n, observedAt: '2026-09-15T20:35:01Z' }), /GAS10_SETTLEMENT_DUPLICATE/);
  assert.throws(() => journal.append({ settlementCommitment: 'bad', reservedWei: 10n, actualCostWei: 10n, observedAt: '2026-09-15T20:35:01Z' }), GasSettlementJournalError420);
  assert.throws(() => journal.append({ settlementCommitment: hash(21), reservedWei: 10n, actualCostWei: -1n, observedAt: '2026-09-15T20:35:01Z' }), /GAS10_SETTLEMENT_ACTUAL_INVALID/);
  assert.throws(() => journal.append({ settlementCommitment: hash(21), reservedWei: 10n, actualCostWei: 1n, outcome: 'paid', observedAt: '2026-09-15T20:35:01Z' }), /GAS10_SETTLEMENT_OUTCOME_INVALID/);
});

test('GAS-10.3 summary is diagnostic aggregation only', () => {
  const journal = new GasSettlementJournal420();
  journal.append({ settlementCommitment: hash(30), reservedWei: 100n, actualCostWei: 80n, confirmation: 'finalized', observedAt: '2026-09-15T20:36:00Z' });
  journal.append({ settlementCommitment: hash(31), reservedWei: 50n, actualCostWei: 50n, confirmation: 'observed', observedAt: '2026-09-15T20:37:00Z' });
  const summary = journal.summary();
  assert.equal(summary.entries, 2);
  assert.equal(summary.finalizedCount, 1);
  assert.equal(summary.observedReservedWei, 150n);
  assert.equal(summary.observedActualCostWei, 130n);
  assert.equal(summary.authority, 'projection-only');
  assert.equal(summary.settlementAuthority, false);
  assert.equal(summary.accountingAuthority, false);
});

# ORACLE-AUDIT-6 durable qualification evidence

- Roadmap step: **ORACLE-AUDIT-6 — cross-application consumer qualification**
- Qualification level: **Level 2 — app integration milestone**
- Implementation SHA: `e97958eda4dbf230d1f5add8e3adc8cc40d70e43`
- Reconciliation/base `main` SHA: `edfd0752e825fc5379700851358e8398efb0b9c5`
- Audit branch: `audit/oracle-interface-layer-remediation-20261002`
- Pull request: **#497**
- Branch divergence at qualification: **14 ahead / 0 behind main**
- Completion state: **COMPLETE**

## Canonical consumer boundary established

Repository inspection found the following actual Oracle relationships:

1. **420Automation — canonical Oracle application consumer.**
   - Consumes provider-neutral canonical Oracle facts corresponding to runtime `IOracle420.readNumeric/readResult` metadata.
   - Enforces chain/router/feed-type identity, freshness, confidence, quorum, spread, result-hash shape, and exact input fields.
   - Oracle facts remain eligibility evidence only and do not grant execution authority.

2. **420Swap — upstream Oracle source, not a direct `IOracle420` consumer.**
   - `TWAPOracleSourceAdapter420` implements the read-only `IOracleSourceAdapter420` boundary over Swap `TWAPOracle.readObservation`.
   - Adapter/source behavior remains fail closed on stale/unhealthy observations.

3. **420Exchange — separate reference-price consumer, not a direct `IOracle420` consumer.**
   - `ExchangeOracleGuard420` consumes `IExchangeReferenceOracle420.referencePrice` for a fail-closed circuit-breaker reference.
   - The current Exchange production surface does not import or call `IOracle420.readNumeric/readResult`.

4. **420Pay — no direct Oracle consumer exists in the current production source tree.**
   - No Oracle integration was invented for qualification.

5. **Frozen Genesis `IOracle420` — no production consumer import.**
   - The legacy `price/isFresh/isSafe` ABI remains contained and is not silently used as the runtime consumer surface.

## Implementation added for this step

- `scripts/verify-420oracle-consumers.py`
  - binds Automation envelope fields to the canonical runtime Oracle read model;
  - verifies Swap adapter/source boundary presence and retained integration coverage;
  - classifies Exchange's separate `referencePrice` boundary;
  - fails if Pay becomes a direct Oracle consumer without explicit qualification;
  - fails if production contracts import the frozen legacy Genesis Oracle ABI.
- `.github/workflows/420oracle-audit.yml`
  - adds exact-head `consumer-boundaries` qualification;
  - runs the structural consumer verifier;
  - builds and tests 420Automation;
  - runs focused `SwapTWAPOracle420.t.sol` integration.

No Oracle protocol semantics, authorization rules, aggregation rules, or frozen interfaces were weakened or changed.

## Authoritative exact-head qualification

Workflow: **420Oracle audit qualification**

Run **37094115610** — **PASS** on exact implementation SHA `e97958eda4dbf230d1f5add8e3adc8cc40d70e43`.

### consumer-boundaries — job 111120426674 — PASS

- exact-head checkout: PASS
- `scripts/verify-420oracle-consumers.py`: PASS
- 420Automation build and retained suite: **126 passed / 0 failed**
- Swap-to-Oracle source adapter integration: **9 passed / 0 failed / 0 skipped**

The Swap integration specifically retained coverage for:

- source provenance and observation-window metadata;
- cumulative TWAP resistance to instant spot replacement;
- canonical source changes invalidating prior TWAP;
- minimum-window fail-closed behavior;
- inactive market/system pause fail-closed behavior;
- Exchange guard consumption of real Swap TWAP;
- governance-only policy configuration with permissionless publication;
- overlong-window reseed/invalidation;
- stale direct and adapter reads failing closed.

### audit-state — job 111120426766 — PASS

- exact-head checkout: PASS
- Oracle repository model verifier: PASS
- frozen Genesis interface-layer verifier: PASS

### oracle-contracts — job 111120426775 — PASS

- exact-head checkout: PASS
- Oracle audit formatting gate: PASS
- Oracle release-graph build: PASS
- retained Oracle suites: **18 passed / 0 failed / 0 skipped**
- Oracle static security scan: PASS

Retained Oracle coverage continues to protect provider authorization, replay protection, monotonic timestamps, freshness/quorum, exact-result ambiguity, confidence/deviation policy, circuit breaker, epoch invalidation, bounded sources, invalid observation envelopes, inactive feeds, and ProtocolRegistry deployment binding.

## Same-SHA supplemental repository evidence

The automatically triggered **Solidity Contracts** workflow run **37094115528** also completed successfully on the same implementation SHA.

This is supplemental same-SHA evidence only. ORACLE-AUDIT-6 does **not** treat it as a Level 3 app-phase closeout and does not claim that skipped Genesis, Docs, Indexer, Registry, or unrelated workflows passed.

## Security / integration conclusions

- Automation cannot smuggle provider-specific authority through its canonical read envelope.
- Wrong chain/router/feed-type, stale/future reads, insufficient confidence/quorum, excessive spread, malformed result hashes, and provider-shaped extra fields fail closed in the retained Automation suite/consumer layer.
- Swap adapter behavior is qualified against the actual Swap TWAP source.
- Exchange's distinct reference-price interface is documented rather than falsely claimed as an `IOracle420` consumer.
- No Pay runtime integration exists to qualify.
- No production path was found that imports the frozen legacy Oracle ABI.

## Level 3 intentionally deferred

The complete repository-wide Solidity inventory ownership, Genesis/address-authority qualification, 420 Integrated/global qualification, Docs/global reconciliation, and other full phase-closeout inventories remain reserved for the final app-phase closeout. Their absence here is intentional and not a blocker for this Level 2 milestone.

## Limitations / blockers

No repository blocker remains for ORACLE-AUDIT-6.

Live chain deployment, governance addresses, live ProtocolRegistry publication, provider/feed/source provisioning, operator credentials/security, monitoring, and production-equivalent testnet evidence remain requirements of the next canonical step.

## Exit criteria

- Canonical consumer rule identified: PASS
- Actual consumer/source relationships inventoried without invention: PASS
- Automation runtime-read compatibility structurally verified: PASS
- Automation retained app suite: PASS
- Swap source-adapter integration: PASS
- Exchange boundary classified and retained: PASS
- Pay direct consumer absence verified: PASS
- Frozen legacy ABI production imports excluded: PASS
- Retained Oracle exact-head suite/build/verifiers/static checks: PASS
- Exact implementation SHA tied to all required evidence: PASS
- Level 2 milestone qualification: PASS
- Level 3 correctly deferred: PASS
- Durable evidence recorded: PASS

**ORACLE-AUDIT-6 is COMPLETE.**

Next canonical roadmap step: **ORACLE-AUDIT-7 — production-equivalent testnet deployment**.

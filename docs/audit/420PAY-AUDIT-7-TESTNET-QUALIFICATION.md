# PAY-AUDIT-7 — Production-equivalent testnet qualification

**Status:** NOT YET COMPLETE — BLOCKED ON APPROVED LIVE PUBLIC TESTNET  
**Repository-side qualification harness:** IMPLEMENTED — Level 1 qualification pending  
**Canonical roadmap:** `docs/audit/420PAY-AUDIT-REMEDIATION-ROADMAP.md`

## Canonical live requirement

PAY-AUDIT-7 requires qualification against one approved production-equivalent public-testnet candidate. Repository/local-EVM/CI fixtures may qualify the harness, but they cannot satisfy the live exit criterion.

Required retained live evidence:

- exact release repository SHA, chain ID, Genesis hash, evidence block and block hash;
- all nine Registry-resolved Pay deployment addresses and exact runtime hashes;
- ProtocolRegistry ACTIVE/version/runtime identity;
- GovernanceTimelock immutable/binding;
- PaymentRouter -> SettlementAdapter -> CanonicalSwapExecutor trust graph;
- PaymentRouter/SettlementRouter split bindings;
- RefundManager -> PaymentRegistry binding;
- PAY_SETTLEMENT replay-domain binding;
- canonical settlement asset/fee/health dependencies;
- invoice creation, payment creation/finalization/settlement and partial/full refund paths;
- direct and swap-backed split settlement;
- GasSponsor authorized-relayer reimbursement;
- accounting-export reconciliation;
- unauthorized/failure-path rejection including direct adapter bypass, replay, over-refund, unauthorized sponsor, stale quote and atomic swap failure;
- 420Indexer lifecycle reconstruction against the same chain;
- Indexer restart/idempotence, bounded-reorg recovery and deep-reorg fail-closed behavior;
- non-secret receipts/logs/manifests tied to the exact release SHA.

## Current external blocker

Repository truth does not describe a launched public testnet:

- `config/protocol.json` keeps `public_testnet_live` false;
- `testnet/public/metadata/chain.json` marks chain ID 420 as `CANDIDATE_UNTIL_FINAL_PREFLIGHT_FREEZE`;
- RPC, WS, Explorer, Faucet and Status endpoints remain `REPLACE_*` placeholders;
- Genesis digests and the release checksum remain placeholders;
- the Step 4.9 release-candidate document explicitly states that an RC is not public-launch authorization.

Therefore no live Pay address, transaction, Registry revision, block/hash, Indexer recovery result or PASS evidence may be fabricated.

Expected readiness result while this blocker remains:

```
PAY_AUDIT_7_READINESS=BLOCKED_PUBLIC_TESTNET_NOT_LIVE
liveQualificationComplete=false
```

## Repository-side implementation

- `docs/audit/420PAY-AUDIT-7-LIVE-EVIDENCE-DRAFT.example.json` — hostile-by-default template requiring real non-secret live evidence.
- `scripts/qualify-420pay-testnet.py` — manual live verifier for chain/genesis identity, evidence block, exact deployed runtime hashes, successful transaction receipts and reviewed binding/failure/accounting/Indexer evidence.
- `scripts/verify-420pay-audit-7-testnet-readiness.py` — fail-closed boundary verifier. It rejects retained PASS evidence while the public testnet is not live/frozen, and requires PASS evidence once the canonical live metadata is real.
- `.github/workflows/420pay-live-testnet.yml` — `workflow_dispatch` only; consumes the official live metadata and reviewed evidence draft and retains the generated live artifact.
- `.github/workflows/420pay-audit-7.yml` — targeted Level 1 repository-harness qualification; exact-head, Python syntax, readiness verifier, retained PAY-AUDIT-6 deployment package verification/smoke, and manual-live-workflow/template safety checks.

## Live exit-criterion status

| Criterion | Status |
| --- | --- |
| approved production-equivalent public testnet exists | **BLOCKED** |
| chain ID / Genesis identity verified live | **NOT RUN — BLOCKED** |
| nine Pay deployment addresses/runtime hashes verified | **NOT RUN — BLOCKED** |
| Registry ACTIVE/version/runtime identity | **NOT RUN — BLOCKED** |
| GovernanceTimelock and wiring graph | **NOT RUN — BLOCKED** |
| canonical asset/fee/health dependencies | **NOT RUN — BLOCKED** |
| invoice/payment/refund journeys | **NOT RUN — BLOCKED** |
| split settlement | **NOT RUN — BLOCKED** |
| GasSponsor reimbursement | **NOT RUN — BLOCKED** |
| accounting export reconciliation | **NOT RUN — BLOCKED** |
| replay/authorization/failure-path evidence | **NOT RUN — BLOCKED** |
| atomic swap-failure rollback | **NOT RUN — BLOCKED** |
| Indexer reconstruction/restart/reorg | **NOT RUN — BLOCKED** |
| retained receipts/logs/manifests tied to exact release SHA | **NOT RUN — BLOCKED** |
| repository live-qualification harness | **IMPLEMENTED — LEVEL 1 PENDING** |
| TESTNET READY = YES | **NO** |

## Exact continuation when the public testnet exists

1. Freeze one approved release SHA and public-testnet metadata set.
2. Deploy the nine Pay residents from the PAY-AUDIT-6 package and retain actual addresses/transactions.
3. Complete SUSPENDED -> governed wiring/verification -> ACTIVE Registry publication.
4. Execute representative invoice/payment/settlement/refund/split/sponsorship journeys with disposable testnet accounts.
5. Execute the required rejected/atomic-failure paths and retain reviewed non-secret evidence.
6. Produce one canonical accounting export record and reconcile refund/finality fields.
7. Run 420Indexer testnet smoke, restart/idempotence, bounded-reorg and deep-reorg rejection against the same candidate.
8. Populate `420PAY-AUDIT-7-LIVE-EVIDENCE-DRAFT.json`.
9. Dispatch **420Pay live testnet qualification** on the exact release SHA.
10. Retain the generated PASS artifact as `docs/audit/420PAY-AUDIT-7-LIVE-TESTNET-EVIDENCE.json` after review.
11. Rerun the readiness verifier.
12. Only then set `deployment_binding_verified: true`, `live_qualified: true`, **TESTNET READY = YES**, and mark PAY-AUDIT-7 COMPLETE.

## Level 2 / Level 3 disposition

Repository harness work is Level 1. The real PAY-AUDIT-7 execution is itself a material cross-component live integration event; no synthetic Level 2 run can substitute for it.

Level 3 remains deferred to complete app-phase reconciliation/merge closeout and must not be used as a substitute for the missing live PAY-AUDIT-7 criterion.

## Current roadmap state

PAY-AUDIT-7 remains the active canonical roadmap step until the live criteria pass.

PAY-AUDIT-8 is not eligible to close PAY-AUDIT-7 by substitution.

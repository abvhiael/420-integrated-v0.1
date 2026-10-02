# 420Treasury audit/remediation roadmap

Status: ACTIVE  
Repository: `abvhiael/420-integrated-v0.1`  
Audit branch: `audit/420treasury-complete-20261001`  
Baseline main: `27ae1873edcca8fb05dec9f4e70af9832b5dafe2`

This roadmap records additive audit/remediation work for the canonical 420Treasury covered protocol. It does not redefine the frozen public Genesis application catalog.

## TREASURY-AUDIT-1 — canonical definition and authority reconciliation — COMPLETE
- Established Treasury as a governed budget/disbursement control plane over 420Vault custody.
- Confirmed it is a covered protocol, not a standalone public Genesis user application.
- Confirmed TreasuryRouter420 is registry-resolved and has no fixed Genesis address.
- Confirmed GovernanceTimelock/Civic owns budget creation, scheduling and cancellation; scoped capabilities gate execution.

## TREASURY-AUDIT-2 — contract lifecycle and fail-closed hardening — COMPLETE
- Prevent scheduled disbursements from outliving parent-budget validity.
- Re-check parent-budget effectiveness at execution.
- Re-check current Treasury asset policy and single-disbursement allowance at execution.
- Keep router executable-state reporting aligned with the write path.
- Expanded focused tests for policy revocation, epoch limits, budget-window escape, zero release commitment, cancellation accounting, replay, authorization and timing.
- Level 1 exact-head qualification **PASS** on implementation SHA `56429210af5738114b47a1aa658509ee19a3b440`.
- Treasury qualification workflow run `36967108988`, job `110713142223`: formatting PASS; Treasury build PASS; 9/9 focused tests PASS; Treasury authority/config boundary PASS; forbidden-primitive scan PASS.
- Durable evidence: `docs/audit/420TREASURY-AUDIT-2-QUALIFICATION.md` introduced by evidence commit `bd55b7cd06381a8e398b73196c9bc23e104efeec`.
- Broad Genesis/global inventory qualification remains intentionally deferred to its canonical Level 3 owners; it is not required for this Level 1 step.

## TREASURY-AUDIT-3 — security/property/invariant expansion — COMPLETE
- Added fuzz/property coverage for reserve/settle/release conservation across mixed schedule/execute/cancel sequences.
- Proved `executed <= committed <= ceiling` and router remaining-budget reconciliation throughout arbitrary tested lifecycle transitions.
- Added canonical-ID field-binding and replay fuzz coverage.
- Qualified policy revision and epoch-boundary behavior.
- Remediated the epoch-bucket reset risk by making `epochSeconds` immutable after an asset policy's initial revision while preserving ordinary policy-cap revisions.
- Added fail-closed external capability-dependency revert coverage with no accounting/state mutation.
- Added targeted Treasury Slither qualification and retained forbidden-primitive scanning.
- Level 1 exact-head qualification **PASS** on implementation SHA `0ace5e5a8e64c2ce56b5f51e793fb7dfc4cc1468`.
- Treasury qualification workflow run `36970820536`, job `110724220149`: formatting PASS; build PASS; lifecycle suite **9/9 PASS**; security/property suite **5/5 PASS**; authority/config verifier PASS; targeted Slither **0 high-severity findings**; forbidden-primitive scan PASS.
- Durable evidence: `docs/audit/420TREASURY-AUDIT-3-QUALIFICATION.md`, introduced by evidence commit `e4e1b10c0741037037fe797e81a9f812068ae10b`.
- Level 2 was not required for this ordinary app-scoped step; full repository-wide Level 3 closeout remains intentionally deferred to the canonical phase closeout.

## TREASURY-AUDIT-4 — Vault release evidence model — COMPLETE
- Reconciled PR #25's "atomic reserve/settle/release accounting" language with the implemented Treasury budget-accounting lifecycle and the current no-custody architecture.
- Adopted and froze `420/TREASURY/VAULT_RELEASE_COMMITMENT/V1` in `AUTHORIZED_EXECUTOR_COMMITMENT_ONLY` mode.
- Confirmed Treasury does **not** cryptographically verify the underlying Vault release and does not become custody; `420Vault VAULT_TREASURY` remains the custody/release authority.
- Documented the explicit executor trust assumption: exact-disbursement authorization plus a nonzero commitment is Treasury completion evidence, not independent proof that Vault transferred assets.
- Required production-equivalent qualification to correlate the retained `vaultReleaseHash` with actual canonical Vault transaction/event/receipt evidence.
- Qualified 420Grants so an `EXECUTED` Treasury disbursement with a zero release commitment cannot finalize a milestone as `PAID`; the positive path requires `EXECUTED + nonzero vaultReleaseHash`.
- Qualified the runtime consumer inventory: only Treasury's disbursement registry and Grants' milestone registry reference `vaultReleaseHash` on the exact candidate head.
- Level 1 exact-head qualification **PASS** on implementation SHA `afc1e8d7c6742b6568db9170decc70d7eadbc763`.
- Treasury qualification workflow run `36972209878`, job `110728359462`: build PASS; lifecycle **9/9 PASS**; security/property **5/5 PASS**; Grants consumer suite **4/4 PASS**; authority/config verifier PASS; consumer inventory PASS; targeted Slither **0 high-severity findings**; forbidden-primitive scan PASS.
- Durable evidence: `docs/audit/420TREASURY-AUDIT-4-QUALIFICATION.md`, introduced by evidence commit `5bf95794a3bccb9b6b105db5305a888e1aad9c53`.
- Architecture decision: `docs/architecture/decisions/TREASURY-AUDIT-4-VAULT-RELEASE-EVIDENCE-MODEL.md`.
- Level 2 was not required; the directly affected Grants consumer was included in the Level 1 gate. Full Level 3 closeout remains deferred.

## TREASURY-AUDIT-5 — Indexer/Explorer/Analytics integration — COMPLETE
- Closed the modern Treasury event-reconstruction gap by adding `metadataHash` to `BudgetCreated` and `purposeHash` to `DisbursementScheduled`, allowing complete derived reconstruction from canonical event history.
- Added an address-unbound modern Treasury descriptor covering `TreasuryPolicyRegistry420`, `TreasuryBudgetRegistry420` and `TreasuryDisbursementRegistry420`.
- Added a retained compiled-ABI verifier so event signatures, field types and indexed flags cannot drift silently from the Indexer descriptor.
- Added deterministic non-authoritative Indexer reconstruction for Treasury budget and disbursement state, including fail-closed accounting-corruption and terminal-replay checks.
- Added stable public Indexer routes:
  - `GET /v1/treasury/budgets/:id?chainId=...`
  - `GET /v1/treasury/disbursements/:id?chainId=...`
- Qualified rebuild/reorg/replay behavior, including idempotent projection, block-bounded rollback and canonical replay after rollback.
- Qualified Analytics against the same public Indexer boundary; Analytics rejects wrong-chain or authority-claiming Treasury responses and remains non-canonical.
- Did not invent live Treasury deployment addresses. Runtime address binding remains assigned to TREASURY-AUDIT-6 because the modern Treasury family is registry-resolved.
- Level 1 exact-head qualification **PASS** on implementation SHA `8f184754c2497dd5add35e9d5f3e97555a1d8883`.
- Treasury qualification workflow run `37038055729`, job `110941058630`: build PASS; compiled-ABI descriptor verifier PASS; lifecycle **9/9 PASS**; security/property **5/5 PASS** with **2,500 runs per fuzz property**; Grants **4/4 PASS**; affected 420Indexer build PASS; Treasury Indexer descriptor/read/reorg/API qualification **18 tests PASS**; affected Analytics qualification PASS; authority/config verifier PASS; release-evidence consumer inventory PASS; targeted Slither **0 high-severity findings**; forbidden-primitive scan PASS.
- Durable evidence: `docs/audit/420TREASURY-AUDIT-5-QUALIFICATION.md`, introduced by evidence commit `a119b7a09a6515b192f9b5442d682431a2f1446a`.
- Level 2 was not separately required because all directly affected Treasury/Indexer/Analytics boundaries were included in the exact-head Level 1 gate. Full Level 3 closeout remains deferred.

## TREASURY-AUDIT-6 — deployment, registry publication and release materialization — PARTIAL
Current:
- TreasuryRouter420 is listed as `REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS`;
- no new frozen predeploy is required.

Required:
- define deterministic deployment order and constructor bindings for Authorization, Policy, Budget, Disbursement and Router;
- retain deployment artifact/runtime hashes for the release candidate;
- publish the canonical router/service through ProtocolRegistry;
- retain deployed addresses, chain/genesis identity and verification evidence.

## TREASURY-AUDIT-7 — documentation/operator closeout — PARTIAL
Required:
- app/protocol-specific operator runbook;
- deployment/configuration reference;
- roles/permissions and incident/recovery procedures;
- event/error/API reference;
- explicit known-limitations section covering the Vault release evidence model;
- exact test/build commands and qualification evidence links.

A standalone public-facing Treasury website is not required by the current canonical classification.

## TREASURY-AUDIT-8 — production-equivalent testnet qualification — BLOCKED UNTIL TESTNET
Required live evidence:
- chain ID/network/genesis identity;
- deployed code/runtime hashes and constructor bindings;
- ProtocolRegistry publication;
- governed budget creation;
- disbursement scheduling/cancellation;
- capability-scoped execution;
- policy-revocation fail-closed behavior;
- budget expiry behavior;
- epoch-cap enforcement;
- Vault release evidence according to the adopted TREASURY-AUDIT-4 model;
- Indexer/Analytics/Explorer agreement;
- restart/reorg/replay/rebuild drills.

## TREASURY-AUDIT-9 — external security review and Genesis/production closeout — BLOCKED
After the release candidate is frozen:
- external review of Treasury + Vault boundary;
- remediate findings;
- rerun exact-head qualification;
- reconcile final deployment/evidence records;
- separately declare CODE, BUILD, CONTRACT, TEST, DOCUMENTATION, INTEGRATION, SECURITY, TESTNET, GENESIS and PRODUCTION readiness.

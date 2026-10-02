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

## TREASURY-AUDIT-2 — contract lifecycle and fail-closed hardening — IMPLEMENTED, QUALIFICATION PENDING
- Prevent scheduled disbursements from outliving parent-budget validity.
- Re-check parent-budget effectiveness at execution.
- Re-check current Treasury asset policy and single-disbursement allowance at execution.
- Keep router executable-state reporting aligned with the write path.
- Expand tests for policy revocation, epoch limits, budget-window escape, zero release commitment, cancellation accounting, replay, authorization and timing.

## TREASURY-AUDIT-3 — security/property/invariant expansion — PARTIAL
Required:
- add fuzz/property coverage for reserve/settle/release conservation;
- prove `executed <= committed <= ceiling` across arbitrary schedules/cancels/executes;
- fuzz canonical-ID collision/replay boundaries;
- prove policy-revision and epoch-boundary behavior;
- test external dependency failure/revert behavior;
- perform Slither/static analysis on the exact candidate head;
- retain exact-head evidence.

## TREASURY-AUDIT-4 — Vault release evidence model — BLOCKED ON CANONICAL DECISION
Current Treasury execution accepts a nonzero `vaultReleaseHash` from an authorized executor and records it as an audit commitment. It does not cryptographically verify a Vault release inside Treasury.

Required:
- reconcile the original PR language ("atomic reserve/settle/release accounting") with the current architecture text ("nonzero Vault release commitment");
- either freeze the commitment-only model and document the executor trust assumption, or introduce an adopted Vault receipt/verifier interface without creating a second custody authority;
- qualify Grants and other consumers against the adopted model.

## TREASURY-AUDIT-5 — Indexer/Explorer/Analytics integration — PARTIAL
Current:
- generic `idx_treasury_events` projection exists;
- Analytics contains Treasury budget/disbursement projections;
- legacy `AttentionTreasury` and `DevelopmentTreasury` are mapped to 420Treasury in the Genesis ABI manifest.

Required:
- add/qualify event descriptors for the modern Treasury contract family once registry-resolved deployment identities are materialized;
- prove rebuild/reorg/replay behavior;
- expose budget/disbursement state in Explorer or another qualified read surface if required by the release architecture;
- preserve the rule that derived services never become Treasury authority.

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

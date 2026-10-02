# BRIDGE-AUDIT-7 — Security, adapter and invariant completion qualification

**Status:** COMPLETE  
**Qualification level:** Level 1 step-specific  
**Qualified implementation SHA:** `33f5a376d17478cea68cdafd04144498b6f4fe4b`  
**Audit branch / PR:** `audit/420bridge-complete-20261001` / PR #463  
**Qualification-only branch / PR:** `qualification/bridge-a7-finality-20261002` / PR #481 — DO NOT MERGE independently  
**Current-main reconciliation parent used for A7:** `27ae1873edcca8fb05dec9f4e70af9832b5dafe2`

## Qualified outcome

BRIDGE-AUDIT-7 closes the repository-side security, adapter and invariant completion step for the canonical 420Bridge architecture.

The qualified implementation establishes and verifies:

- adapter-route binding and canonical chain-identity enforcement;
- canonical transfer lifecycle and terminal-state safety;
- accounting-health gating and monotonic recovery evidence;
- replay protection and cross-adapter/domain separation;
- risk/TVL rollback when downstream adapter execution fails;
- fail-closed behavior for malformed proofs, invalid recipients, verifier rotation, emergency controls and router bypass attempts;
- canonical verifier interfaces and explicit chain-specific finality/proof semantics for all 12 production adapters;
- retained fuzz/property/invariant coverage for replay identities, malformed proof/recipient inputs, accounting recovery and security transitions;
- static security verification over the production Bridge core and canonical adapter inventory;
- explicit separation of accepted design risks, deferred live-testnet evidence and unresolved repository defects.

## Canonical adapter/finality authority

A7 pins the canonical production-adapter security inventory in:

- `contracts/config/bridge/security-hardening-v1.json`
- `scripts/verify-bridge-audit-7-security.py`

The manifest/verifier pair covers the canonical Solana, BNB Chain, Ethereum, Dogecoin, Tron, Potcoin, Dobbscoin, Curecoin, Pirate Chain, Litecoin, Bitcoin and XRPL adapters.

The verifier requires each canonical adapter to remain bound to its declared verifier interface and to expose the chain-specific finality/proof semantics recorded in the security manifest. Legacy CADC LayerZero, USDC CCTP, ETH proof and BTC light-client scaffolds remain disabled/non-authoritative.

## Security and invariant implementation evidence

A7 retained or added focused security coverage including:

- downstream adapter failure atomically rolling back route/asset risk and transfer registration;
- stale or duplicate accounting observations being unable to replace newer qualified evidence;
- cross-adapter replay isolation and outbound domain separation;
- verifier rotation authorization and fail-closed verifier behavior;
- directional emergency pause controls;
- malformed-proof and malformed-recipient fuzz coverage;
- domain/nonce/router-bypass hardening;
- governance/accounting/recovery hardening;
- canonical chain-specific finality/proof marker verification for all production adapters.

The Bridge Fast workflow was also corrected during qualification so the retained security suites are reliably executable: the job timeout was increased from 30 to 60 minutes and the seven retained hardening suites were consolidated into one Foundry invocation, eliminating repeated full-tree recompilation. A subsequent shell-quoting defect in that consolidated command was corrected before final qualification.

## Exact-head Level 1 evidence

The implementation SHA `33f5a376d17478cea68cdafd04144498b6f4fe4b` received two independent successful exact-head Bridge Fast qualifications:

| Workflow | Run | Job | Result |
| --- | ---: | ---: | --- |
| 420Bridge Fast Qualification | #60 / `37058372514` | `bridge-fast` / `111008585707` | PASS |
| 420Bridge Fast Qualification | #61 / `37058375444` | `bridge-fast` / `111008904225` | PASS |
| Solidity Contracts | #4228 / `37058372855` | workflow result | PASS |
| Solidity Contracts | #4229 / `37058375313` | workflow result | PASS |

Both Bridge Fast runs passed all directly applicable A7 gates:

- exact qualification-head checkout and verification;
- Bridge hardening verifier;
- BRIDGE-AUDIT-6 deployment verifier;
- BRIDGE-AUDIT-7 security verifier;
- Bridge contract tests;
- canonical production adapter suites;
- retained cross-adapter security hardening suites;
- affected Exchange Bridge qualification tests;
- Pay/Swap/Bridge cross-suite integration.

The Solidity #4228 and #4229 workflow runs completed successfully on the exact A7 head. Their PR-shard jobs were skipped by classifier design and are therefore recorded only as supplemental workflow success, not as substitutes for Bridge Fast's exact-head contract/security qualification.

Earlier cancelled or superseded Bridge Fast attempts are intentionally excluded from qualification evidence. In particular, cancelled runs do not count as passes, and pre-`33f5a376...` heads are not treated as authoritative for final A7 closeout.

## Accepted risks, unresolved defects and deferred evidence

The canonical A7 security manifest records accepted design risks separately from unresolved defects.

At repository closeout:

- unresolved repository defects recorded by the A7 security manifest: none;
- disabled legacy adapter/verifier scaffolds remain non-production/non-authoritative;
- live external-chain verifier behavior, production finality observation, real proof acquisition and live cross-chain settlement evidence remain outside this repository-only qualification.

Those live deployment/proof/finality requirements remain reserved for **BRIDGE-AUDIT-9**.

## Qualification scope

This is a **Level 1** repository-side qualification.

A7 does **not** claim:

- live production-equivalent testnet deployment;
- live external-chain proof acquisition;
- real external-chain finality/reorg behavior;
- production verifier deployments or credentials;
- live cross-chain transaction/settlement evidence.

Level 2 remains planned after BRIDGE-AUDIT-8.  
Level 3 remains BRIDGE-AUDIT-10.

## Exit decision

**BRIDGE-AUDIT-7 COMPLETE.**

Next canonical step: **BRIDGE-AUDIT-8 — Documentation, ABI, Indexer and cross-app integration reconciliation.**

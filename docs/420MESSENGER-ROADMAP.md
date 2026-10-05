# 420Messenger audit/remediation roadmap

This roadmap audits the existing canonical Messenger protocol without redefining it. Repository/current `main`, the frozen Messenger Genesis profile, architecture documentation, Genesis contract map, Registry/service IDs and address namespace are authoritative.

## MESSENGER-AUDIT-1 — Canonical definition and inventory
- reconcile purpose, authority/privacy boundary and all `MSG-INV-001..012`;
- inventory the eight canonical Messenger source files, focused tests, Registry/service entry and address policy;
- classify frontend/backend/indexer requirements according to the canonical architecture rather than inventing a standalone app.
**Exit:** complete requirement/file matrix and no unexplained canonical-source conflicts.

## MESSENGER-AUDIT-2 — Contract and authorization hardening
- verify exact account/action/component capability scoping;
- verify endpoint revision/deactivation, bilateral block dominance and terminal conversation lifecycle;
- verify deterministic conversation/message identity, independent sender sequences and receipt authorization;
- review external calls, timestamp assumptions, reentrancy, DoS, funds/custody and upgrade/admin surfaces.
**Exit:** focused adversarial tests and no unresolved repository-local high/critical defect.

## MESSENGER-AUDIT-3 — Genesis/Registry/address integration
- enforce Messenger profile/invariants in `verify-genesis-dapps.py`;
- enforce exact Genesis contract-map inventory and canonical service ID;
- reconcile Registry-resolved/no-fixed-address policy;
- freeze deploy dependency/publication graph without inventing live addresses.
**Exit:** shared Genesis verifier fails on Messenger drift.

## MESSENGER-AUDIT-4 — Documentation and operational contract
- provide app/protocol reference, deployment graph, build/test instructions, recovery/security assumptions and known limitations;
- record explicit boundaries with Wallet/CapabilityRegistry, Registry, Commons, Resource, Notifications and consuming applications.
**Exit:** unfamiliar developer can build, test, deploy and integrate the repository implementation.

## MESSENGER-AUDIT-5 — Dedicated exact-head qualification
- dedicated workflow checks exact SHA;
- `forge fmt --check`, build and focused Messenger tests;
- shared Genesis verifier;
- Messenger audit verifier;
- Slither focused on Messenger contracts, with findings reviewed rather than silently ignored.
**Exit:** exact candidate head has durable green CI evidence.

## MESSENGER-AUDIT-6 — Repository closeout
- reconcile audit branch to then-current `main`;
- rerun MESSENGER-AUDIT-5 on the reconciled exact head;
- update audit/readiness evidence with SHA/run/job IDs and formal repository-complete status.
**Exit:** CODE/BUILD/CONTRACT/TEST/DOCUMENTATION repository gates complete; no uncommitted required work.

## MESSENGER-AUDIT-7 — Production-equivalent public-testnet qualification
Blocked until the approved testnet and deployment infrastructure are live. Retain one exact release/deployment lineage proving:
1. chain/network/genesis identity and exact repository SHA;
2. all seven deployed contract addresses/runtime hashes plus canonical CapabilityRegistry and ProtocolRegistry identities;
3. constructor/immutable dependency graph and Registry resolution of `420/service/messenger/v1`;
4. live endpoint/request/accept/send/receipt/block/close flows and unauthorized/wrong-scope/replay/sequence failure paths;
5. Wallet/client network validation and reviewed authorization flows;
6. real encrypted transport/storage with no plaintext/private key leakage into chain, logs, public APIs or Indexer;
7. restart/provider failure/reorg/RPC disagreement/rebuild behavior;
8. Resource-backed transport/storage if enabled, without authority escalation;
9. Notifications/consumer integrations using metadata only;
10. retained deployment manifests, transactions, receipts/logs, runtime hashes and endpoint/config identity.
**Exit:** TESTNET READY may become YES only after this evidence exists.

## MESSENGER-AUDIT-8 — Genesis/production release closeout
- reconcile live deployment with Genesis inventory and service publication;
- final monitoring, incident response, recovery/rollback and operator documentation;
- final security review/external review or approved release exception;
- production endpoints/secrets/key-custody procedures;
- exact release/evidence reconciliation and separate readiness declarations.
**Exit:** GENESIS READY / PRODUCTION READY only after all applicable gates pass.

## MESSENGER-AUDIT-6 reconciliation candidate

- reconciled base: `b338b9c9c140957b0ea8619b0b20bfed415f2c6d`
- branch is 0 commits behind `main` at reconciliation
- exact-head qualification: pending on this reconciled PR candidate

## Repository closeout / testnet handoff

- **MESSENGER-AUDIT-1 through MESSENGER-AUDIT-6: COMPLETE.**
- Exact repository qualification head: `8133318b4958eceb197dc2aa9c7026eeb46c2ac2`.
- Exact-head qualification: 420Messenger Audit Qualification run `37274317403` (#26), contract-core `111647872131` PASS, security `111647872463` PASS.
- **MESSENGER-AUDIT-7/8 testnet handoff recorded** in `docs/ROADMAP.md`; no live-testnet, Genesis-ready or production-ready claim is made by this repository closeout.

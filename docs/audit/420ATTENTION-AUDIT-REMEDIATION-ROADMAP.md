# 420Attention / Cannaseur audit remediation roadmap

Authority: complete repository-grounded audit initiated 2026-10-06 against current `main`.

Do not renumber, collapse, or silently redefine these steps. Repository truth and frozen Genesis authority control closeout.

## ATTENTION-AUDIT-1 — Canonical definition and inventory
- Freeze the authoritative source list for 420 Attention / Cannaseur.
- Reconcile Genesis application classification, service IDs, fixed addresses, registry-resolved router, contract map, invariants, architecture, docs, tests, and deployment records.
- Record complete file/component inventory and stale/orphaned items.
- **Status: COMPLETE repository-side.**

## ATTENTION-AUDIT-2 — Contract authority and invariant reconciliation
- Verify all eight canonical Attention contracts.
- Reconcile consent, campaign, verifier, proof/nullifier, reward, sponsor-liability, refund, and narrow-delegation boundaries.
- Remove authority identifiers that contradict the frozen delegation model.
- **Status: COMPLETE repository-side.**

## ATTENTION-AUDIT-3 — Negative/security test expansion
- Add direct tests for campaign-specific consent override, delegated consent, out-of-window proof rejection, cumulative reward cap, reserved-reward refund blocking, delegated canonical-recipient claim, and cancellation/refund accounting.
- Preserve existing Genesis tests.
- **Status: COMPLETE repository-side.**

## ATTENTION-AUDIT-4 — Exact-head build and security qualification
- Add an Attention-specific workflow that pins checkout to the exact PR/push SHA.
- Run Foundry formatting, targeted build, all Attention tests, shared Genesis verification, Attention audit verification, forbidden-primitive checks, and targeted Slither High/Critical gating.
- **Status: COMPLETE. Exact-head qualification passed at `7f1a91ab1312847f16a1de1abc38c7a04ff521ad`.**

## ATTENTION-AUDIT-5 — Documentation and operator reference
- Verify application overview, getting started, user guide, concepts, architecture, permissions, fees/rewards, security/privacy, troubleshooting, FAQ, and shared architecture.
- Add durable complete-audit record and this remediation roadmap.
- **Status: COMPLETE repository-side.**

## ATTENTION-AUDIT-6 — User-facing application implementation
- Implement the deployable 420 Attention / Cannaseur user-facing client defined by canonical docs.
- Required workflows: Wallet/network connection, consent management, campaign inspection, sponsor campaign lifecycle/funding, proof/reward inspection, reward claiming, explicit transaction/error states, accessibility/responsive basics, and production configuration.
- Do not substitute documentation pages for the application.
- **Status: COMPLETE. Level 1 qualified at implementation SHA `9babc92f5b1a5abdf7e9f0c2f956df170baa5546` (workflow run `37571023849`).**

## ATTENTION-AUDIT-7 — Indexer/API/service projection
- Define and implement only the non-canonical projection/API actually required by the user-facing client.
- Preserve raw Attention telemetry and private audience data exclusions.
- Include reorg/rebuild behavior, bounded retries/idempotency where applicable, and canonical-source provenance.
- **Status: IMPLEMENTED; awaiting exact-head Level 1 service qualification and Level 2 Attention app-integration qualification.**

## ATTENTION-AUDIT-8 — Testnet deployment and integration qualification
- Deploy fixed Genesis predeploys and registry-resolved Attention components in the production-equivalent testnet environment.
- Verify exact addresses, storage initialization/bindings, service registration, Wallet capability integration, native 420 funding/accounting, Explorer/Indexer visibility, Notifications privacy boundary, and recovery behavior.
- Publish readiness/deployment evidence tied to exact deployed bytecode and chain state.
- **Status: BLOCKED on production-equivalent testnet and ATTENTION-AUDIT-7.**

## ATTENTION-AUDIT-9 — Genesis closeout
- Re-run exact-head repository qualification after all executable changes.
- Verify testnet evidence, deployment order, constructor/storage-init arguments, authority transfers, smoke tests, monitoring, rollback/recovery, frontend production configuration, DNS/service discovery, and committed qualification evidence.
- Mark Genesis-ready only when repository and live-environment evidence agree.
- **Status: BLOCKED on ATTENTION-AUDIT-7 through ATTENTION-AUDIT-8.**

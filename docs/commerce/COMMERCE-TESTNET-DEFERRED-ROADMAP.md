# 420CommerceProtocol — testnet and release deferred work roadmap

**Status: TESTNET-GATED / OPEN.** Repository-side COM-1–COM-7 qualification is complete; COM-7 qualified executable SHA `2648c0b6df52a375c2d6bdbd2839cdbc607ff113`, evidence-only SHA `855ca1e26f2004f6a726ec69a1421eb792970988`, PR #594. This document transfers ownership of unfinished work; it does not qualify live integrations or release.

Canonical phase names remain **COM-8 — Testnet handoff** and **COM-9 — independent security / production release acceptance**. Preserve COM-T01–COM-T16, canonical financial authority and existing closeout evidence.

## COM-8 — operational testnet acceptance (OPEN)
1. Approve and freeze the real network/genesis/chain ID, RPC endpoints, deployed release SHA, trusted Registry/Wallet/Identity/Market/Pay/Arbitration addresses, ABI/code hashes and manifests. Reconcile PAY-AUDIT-6 frozen release identities; no guessed address, unauthorized deploy, or synthetic successful binding.
2. Deploy the actual Commerce API, datastore/migrations, storefront/merchant builder, Indexer/SDK, edge/TLS and authorization configuration, with secrets/issuer revocation/key rotation under approved operator control. Prove multi-instance/storage boundaries; existing SQLite/shared-connection crash drills only qualify one service process and not distributed multi-writer readiness.
3. Demonstrate real buyer/merchant Wallet permissions and sessions, merchant registration, listing, inventory reservation, native test-$420 payment, canonical Pay→Market settlement reporter authority and finalized on-chain receipt, signed tenant-scoped APIs, event indexing and replay-safe state changes. Preserve transaction hashes and buyer/merchant/order/asset/invoice reconciliation.
4. Demonstrate genuinely funded governed Pay refunds, including partial refund, actual payer fund return, canonical Market accounting, duplicate/late/failed reporter, finality/reorg/restart and rollback recovery. A Market refund state transition alone is not payout evidence.
5. Evaluate Swap routes only if governance-approved and supported; otherwise explicitly retain fail-closed unsupported routes. Verify no secondary Commerce custody, settlement or price authority.
6. Validate deployed service/API/browser/mobile/accessibility, CSP/CORS/TLS/rate limits/webhooks, external service outage/secret rotation, backups, telemetry, alerts, incident response, canary, rollback and sustained recovery against real endpoints.
7. Retain non-secret release manifests, deployment and CI job identifiers, testnet transaction hashes, chain height/finality, security and adversarial outcomes, runbooks, independent observations and explicit operator go/no-go. Do not infer live acceptance from repository CI or local fixtures.

## COM-9 — security and production acceptance (OPEN; separately gated)
- Commission independent external security review and track findings, fixes and requalification against an exact deployable lineage, including custody boundaries, economic settlement, tenant auth, signatures/replay, refund fraud, dependency/secret and operational failure paths.
- Require production-grade infrastructure, authorization, data-protection/legal/compliance review, recovery/failover, monitoring/SLO, credential/key ceremonies, upgrade/rollback, release manifests and final governance/operator approval.
- Separate CODE, BUILD, CONTRACT, TEST, DOCUMENTATION, INTEGRATION, SECURITY, TESTNET and PRODUCTION readiness. Do not claim external signoff, testnet, mainnet or production go-live until each actual gate is satisfied.

## Qualification policy and evidence
- Preserve COM-7 Level 3 at exact executable SHA, plus its evidence-only inheritance; do not rerun global Foundry/Genesis/Docs/integration solely because a roadmap was written.
- On substantive implementation changes, run affected Level 1 / milestone Level 2, with once-per-phase Level 3 when required by canonical phase policy. Solidity owns full Foundry; Genesis owns address authority, not duplicate Foundry.
- COM-8/9 acceptance must be derived from genuine live deployments and approvals, not invented fixtures.
- See `docs/commerce/COM-1-ARCHITECTURE-AND-ROADMAP.md`, `docs/commerce/COM-7-LEVEL3-QUALIFICATION-STATUS.json` and `docs/commerce/COM-7-LEVEL3-TEST-INVENTORY.json`.

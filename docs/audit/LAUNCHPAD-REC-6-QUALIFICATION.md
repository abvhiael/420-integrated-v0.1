# LAUNCHPAD-REC-6 — final local pre-testnet qualification

**Status:** PENDING EXACT-HEAD REC-6 QUALIFICATION. This document is updated only after the new deterministic release, standalone application and service workflow passes.

## Scope and frozen authority

- Authority: `abvhiael/420-integrated-v0.1`. Current baseline at assignment: `main@0f7c978a8904303816bd52551ef711355fc9d5e2`, containing merged PR #1271 (REC-5).
- Frozen `contracts/foundry.toml` settings: solc 0.8.24, Cancun, optimizer 200, via IR.
- Six contracts: `LaunchpadAuthorization420`, `LaunchpadProjectRegistry420`, `LaunchpadSaleRegistry420`, `LaunchpadAllocationRegistry420`, `LaunchpadCrowdfundingIntegration420`, `LaunchpadRouter420`.
- Canonical component: `420/COMPONENT/LAUNCHPAD/V1`; service: `420/service/launchpad/v1`.
- Canonical ProtocolRegistry authority: `0x0000000000000000000000000000000000000434`. Router is **Registry-resolved**, with no fixed predeploy. Historical `0x000000000000000000000000000000000000045c` is superseded.
- Local `LaunchpadDeploymentBinding420Test` verifies one-shot bindings, real deployed immutable getters, active Registry service/component and exact Router runtime EXTCODEHASH. Local governance marker commitments (metadata/manifest/interface) are *not* hashes of live canonical release-document bytes; live commitments remain testnet-owned.
- The REC-6 artifact attestation records source commit, canonical ABI SHA-256, constructor ABI, creation code SHA-256, runtime-template SHA-256 and actual byte counts. The job rebuilds from a fully clean Foundry output and compares both manifest files byte-for-byte. Runtime-template SHA-256 is neither a deployed runtime Keccak EXTCODEHASH nor a live transaction receipt.
- Standalone web build is checked from clean checkout against the source copy, exact SHA in `build-meta.json`, correct security headers, and a fail-closed unset `runtime-config.json`. Actual local `launchpad/service` tests include Registry/RPC identity, API ingress and deterministic projection recovery.
- The current machine-readable states in `contracts/config/420launchpad-genesis.json`, `contracts/config/launchpad/launchpad-audit-4-release-materialization.json` and `testnet/public-services/launchpad/readiness.json` must agree: repository-qualified locally **true**; live-qualified, Genesis-ready and production-ready **false**.
- Recovery and rollback procedures: [Launchpad deployment and operations](../apps/launchpad/deployment-operations.md). No live chain, funded production contribution, Cloudflare deployment, live indexing/reorg, deployed hash, Genesis-readiness claim or independent external audit claimed here.

## Qualification evidence (to be filled from confirmed workflow results)

- Exact executable SHA: pending.
- `LAUNCHPAD-REC-6 final pre-testnet closeout` workflow run and job IDs: pending.
- Deterministic two-pass compiler/ABI/runtime/constructor attestation: pending.
- ABI/compiler tamper adversarial checks: pending.
- Real local Registry/constructor wiring regression: pending.
- Clean standalone production application build, web regression and static-output source matching: pending.
- Full Launchpad service regression: pending.
- Machine-readable readiness, Audit-4/Audit-5 retained verifier gates: pending.
- Previously qualified REC-5 real multi-system local-EVM and downstream consumer evidence: [REC-5](LAUNCHPAD-REC-5-QUALIFICATION.md); executable SHA `1531a8ada470a3f79e36ca9879502a4a39760ffc`, [run #44849506236](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44849506236). Existing merged Launchpad audit 48+3 / 420Indexer CI evidence remains retained independently.

## Live-only handoff

**Next canonical roadmap step: `LAUNCHPAD-AUDIT-6 — production-equivalent testnet qualification`, BLOCKED until the approved running public testnet exists.** At that time obtain real chain/genesis identity, production deployment addresses/receipts/EXTCODEHASH, actual governance-approved Registry service commitments, funded 420Pay/Wallet contributions, cancellations and refund/claim evidence, actual Notifications/Reputation consumption, and live chain/indexer/reorg recovery. Do not convert local artifact or mock EVM results into live evidence. Existing LAUNCHPAD-AUDIT-7 and LAUNCHPAD-AUDIT-8 remain downstream gates, not new REC-6 work.

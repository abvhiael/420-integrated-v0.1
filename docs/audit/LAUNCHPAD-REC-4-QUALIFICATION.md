# LAUNCHPAD-REC-4 — Wallet, API and indexer hardening qualification

Status: **COMPLETE — locally executable pre-testnet scope qualified**. Public testnet was **not** required or used. This evidence does not claim a deployed public service, real signed transaction, external security audit or production approval.

## Repository provenance

- Repository: `abvhiael/420-integrated-v0.1`.
- Scope: `LAUNCHPAD-REC-4 — Wallet, API and indexer hardening`.
- Base `main` at implementation start: `e6c815437ee44b60e66472492d0ed0056b7dcbdc` (contains merged REC-3 / PR #1268).
- Feature branch: `feature/launchpad-rec-4-hardening`.
- PR: [#1270](https://github.com/abvhiael/420-integrated-v0.1/pull/1270).
- **Exact executable qualification SHA:** `ed8b9fe06466a3d772cec7b0a15d91be7fe49a33`.
- PR merge status at qualification: **OPEN — not merged**. No merge requested.

## Scope implemented

1. Browser Wallet validates account/chain immediately before transmission; a two-minute reviewed transaction identity binds exact requested sale, account, kind, selector, argument words, destination and zero value. Any unsupported calldata, changed form, network, account, stale review or unrecognized Registry-derived target fails closed.
2. Before calling `eth_sendTransaction`, the browser fetches the latest ProtocolRegistry-derived runtime, re-prepares the original exact operation and compares calldata/target/value, and checks current on-chain position against campaign and account identity. Conversion checkout and approval reviews are bound to the verified quote or require refresh.
3. Service resolves the frozen `420/service/launchpad/v1` through ProtocolRegistry `resolveActive` and `getService`, verifies active version/router and the router's published runtime code hash. It checks the complete Router/Sale/Allocation/Crowdfunding/Project reverse dependency bindings and that required nodes have contract runtime code.
4. Discovery snapshots require a canonical chain ID, block height/hash, contract graph and bounded height lag; each API read compares the stored hash to the live chain at the same height and rejects malformed campaign identities/economic fields, wrong networks, outdated or orphaned history, stale cursors and substituted contract addresses.
5. Local reconstruction replays bounded `SaleCreated` logs from the Registry-attested sale contract, validates canonical block provenance and sale/project/mode details, rejects duplicate/removed/malformed/replayed logs, detects a changing head, writes atomically and rebuilds from original on-chain history to recover from a reorganization. No off-chain editorial metadata is considered authoritative.
6. HTTP ingress implements exact-origin policy, request size, JSON shape/depth, method and duplicate-query validation, per-IP rate and concurrency bounds, server timeouts, safe failure status and response redaction. RPC transport applies HTTPS/localhost-only policy, timeout and size limits, method allowlist, response ID/version/envelope validation and strict malformed-response checks.
7. Adversarial browser, malformed runtime/configuration, malicious RPC/service, HTTP ingress, provenance, fork/reorg and reconstruction tests were added. No contracts, economic constants, system service IDs, privileged operations or Genesis address policy were changed.

## Exact-head qualification

- [420Launchpad app workflow **44846847080**](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44846847080): **PASS**, exact-head verification, retained Audit-5 application boundary verifier, browser check/build, **15/15 browser tests**, **44/44 service tests**, clean production artifact verification and static security/authority scan.
- [420Launchpad audit workflow **44846847017**](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/44846847017): **PASS**, exact-head verification, **48/48 Level-1 Foundry tests** and **3/3 deployment/Registry-binding tests**, retained model/deployment/static authority gates.
- Tests were executed on commit `ed8b9fe06466a3d772cec7b0a15d91be7fe49a33`. Documentation/evidence-only descendants change no executable source or test assertion and inherit the above executable exact-head evidence without pretending to re-qualify a different program.
- The reorg recovery checks are deterministic local fixtures plus in-memory canonical RPC simulation. These do **not** substitute for a later production-equivalent live testnet reorganization drill.

## Operations and deferred boundaries

- Service requires configured `LAUNCHPAD_RPC_URL`, `LAUNCHPAD_CHAIN_ID` and `LAUNCHPAD_PROJECTION_FILE`; browser-origin requests require `LAUNCHPAD_CORS_ORIGIN` set to the exact permitted HTTPS origin.
- The independent local rebuilding command uses `LAUNCHPAD_INDEX_FROM_BLOCK` set to the actual deployment start block; replay produces a new canonical projection and must be rerun after orphaned data/restart. See [deployment operations](../apps/launchpad/deployment-operations.md).
- The default browser remains execution-disabled until real canonical runtime values are configured. No public testnet is available/claimed in this qualification.
- Further original roadmap `LAUNCHPAD-AUDIT-6` public-testnet qualification remains **BLOCKED — LIVE TESTNET REQUIRED**.
- Previously proposed next remediation phase: **LAUNCHPAD-REC-5 — Ecosystem integration qualification**; not initiated by REC-4.

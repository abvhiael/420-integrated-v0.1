# 420Bridge complete audit — 2026-10-01

## Application
**420Bridge**

## Audit baseline
- Repository: `abvhiael/420-integrated-v0.1`
- Baseline `main`: `98e545225d54379086f0c520afcb84b4d4d97288`
- Audit branch: `audit/420bridge-complete-20261001`
- Canonical sources reviewed include the Bridge app manual/architecture/developer/security/troubleshooting documentation, value-movement architecture, frozen Genesis address authority, Genesis dApp inventory, Bridge risk policy, Bridge contracts/interfaces, bridge adapter manifests/tests, Indexer consumers and prior interface-hardening evidence.
- Repository truth overrides earlier conversational descriptions.

## Canonical purpose and trust boundary
420Bridge is the canonical cross-chain ingress/egress protocol/application. It admits explicit external chain identities, bridge asset representations, routes, adapters/verifiers, risk limits, replay-protected transfer identities and reconciliation evidence. Foreign proof validity is necessary but not sufficient: local route, asset, direction, risk, replay, safety and settlement policy must also pass.

Bridge is not general Oracle authority, Exchange price/market authority, arbitrary governance authority or an accounting-based supply-repair mechanism.

## Architecture discovered

### Core contracts
- `VerifiedGateway420` — fixed Genesis proof-oriented gateway anchor.
- `BridgeChainRegistry420` — canonical external-network identity and route-chain mapping.
- `BridgeAssetRegistry` — local canonical representation qualification.
- `BridgeRouteRegistry` — route identity/configuration/direction/status.
- `BridgeRiskManager` — route/asset single/hour/day/TVL limits plus shared risk.
- `BridgeTransferRegistry` — replay-protected transfer identity and lifecycle record.
- `GatewayRouter420` — adapter registry and inbound/outbound execution boundary.
- `BridgeAccountingRegistry` — monotonic authorized/observed supply reconciliation evidence.
- `CADCBridgeIntegration` and multiple chain-specific adapters/verifiers.

### Shared dependencies
ProtocolRegistry/GenesisResident access, governance/timelock authority, canonical asset registry, system safety/pause, shared replay protection, settlement health and shared risk limits.

### Application/read surfaces
There is no standalone `bridge/` web package or dedicated deployable 420Bridge frontend in the repository. Bridge UX exists primarily through the 420Exchange `/bridge` surface and related Wallet/Indexer integration. This conflicts with documentation metadata that describes 420Bridge itself as a user-facing application unless the composed Wallet/Exchange presentation is explicitly made canonical.

## Material findings and remediation performed

### FIXED — route adapter authority bypass
The pre-audit `GatewayRouter420` accepted a caller-selected registered `adapterId_` and validated route asset/status/direction, but did not require that adapter ID to equal the route's configured `adapterId`. A different registered adapter could therefore attempt to execute a route it did not own if it returned matching route/asset transfer data.

Audit remediation:
- route validation now requires `configuredAdapter == adapterId_`;
- both inbound and outbound paths pass the selected adapter ID into route validation;
- focused negative tests prove another registered adapter cannot execute the route and cannot consume risk;
- the bridge hardening verifier checks for this invariant.

Disposition: **mitigated risk**, pending exact-head CI.

### FIXED — stale Genesis Bridge component inventory
`BridgeChainRegistry420` is canonical in Bridge architecture, IDs, tests, Exchange qualification and launch manifests, but it was omitted from the 420Bridge entry in `contracts/config/genesis-dapp-contract-map.json`.

Audit remediation:
- added `BridgeChainRegistry420.sol` to the 420Bridge Genesis dApp contract inventory;
- added the chain registry and asset registry to the required bridge-hardening component inventory;
- added `BridgeChainRegistry420.t.sol` to the hardening test inventory.

Disposition: **documentation/configuration drift corrected**, pending exact-head CI.

## Unresolved canonical gaps

### 1. Chain registry is not authoritative to core Bridge route admission — PARTIAL
`BridgeChainRegistry420` exists and is used by Exchange-side bridge qualification, but core `BridgeRouteRegistry` / `GatewayRouter420` do not resolve or validate `BridgeIds420.CHAIN_REGISTRY`. The architecture says route chain identity is canonical and must distinguish forks/testnets; the core Bridge execution path currently relies on numeric route chain IDs embedded in route state without proving they are active canonical chain-registry identities.

Required remediation: BRIDGE-AUDIT-2.

### 2. Documented transfer lifecycle is not enforced — BROKEN
`BridgeTransferRegistry` enumerates the documented lifecycle states but exposes a generic governance `setStatus(id,status)` that allows arbitrary jumps and terminal-state reopening. No guarded transition graph, per-transition actor/evidence authority or terminal-state invariant is enforced.

Inbound execution verifies proof first and then creates a transfer in `CREATED`, so the source/proof lifecycle states are not presently the authoritative path described in documentation.

Required remediation: BRIDGE-AUDIT-3.

### 3. Outbound movement lacks canonical transfer registration — PARTIAL
`GatewayRouter420.initiateOutbound` consumes risk and calls the adapter, then emits `OutboundInitiated`, but does not create/update a canonical `BridgeTransferRegistry` record equivalent to inbound movement. The documented lifecycle therefore cannot consistently track outbound source/destination completion and retry/recovery state.

Required remediation: BRIDGE-AUDIT-3.

### 4. Accounting-health evidence is not an execution gate — PARTIAL
`BridgeAccountingRegistry` records monotonic health evidence and the documentation says accounting incidents should halt/escalate safely. No core router reference to the accounting registry was found. Route settlement health is checked, but the relationship between unhealthy bridge reconciliation and admission of new movement is not explicitly enforced by Bridge core.

Required remediation: BRIDGE-AUDIT-4.

### 5. User-facing application claim is not reconciled with deployable source — PARTIAL
The docs classify Bridge as user-facing and provide user/developer/security/troubleshooting guides, but no dedicated Bridge frontend/backend package was found. 420Exchange contains the current bridge UI/read/execution surface. The repository must either make that composition the explicit canonical Bridge UI contract or implement a dedicated Bridge application.

Required remediation: BRIDGE-AUDIT-5.

### 6. Deployment/initialization evidence is incomplete for the full modern Bridge stack — PARTIAL
`VerifiedGateway420` is a frozen fixed Genesis anchor at `0x0000000000000000000000000000000000000438`. `GatewayRouter420` is registry-resolved. Historical candidate reservations for route/risk/transfer/accounting components are explicitly nonfrozen/nondeployment evidence. A complete modern Bridge deployment/init manifest tying chain registry, asset registry, route registry, router, risk, transfer, accounting, adapters, verifier configuration and trust bindings to final Registry publication was not established by this audit.

Required remediation: BRIDGE-AUDIT-6 and live BRIDGE-AUDIT-9.

## Requirement matrix

| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| Explicit chain identity/fingerprint | Bridge architecture/integration docs | BridgeChainRegistry420 exists; core route admission does not consume it | chain-registry unit tests | present | PARTIAL | BRIDGE-AUDIT-2 |
| Canonical asset qualification | value-movement architecture | BridgeAssetRegistry + shared canonical-asset checks | integration/adapters | present | COMPLETE | retain |
| Route status/direction | value-movement architecture | BridgeRouteRegistry + router checks | BridgeGenesisIntegration | present | COMPLETE | retain |
| Route-bound adapter authority | security docs / route model | fixed in audit branch | new inbound/outbound negative tests | present | COMPLETE | exact-head CI |
| Verifier/proof boundary | route/adapters/manifests | chain-specific adapters/verifiers exist with activation gates | numerous adapter suites | present | PARTIAL | adapter-by-adapter BRIDGE-AUDIT-7 + live proof evidence |
| Risk limits | frozen bridge risk limits | route + asset + shared risk enforcement | integration, fuzz, invariant | present | COMPLETE | exact-head CI |
| Replay protection | value-movement architecture | transfer-local + shared replay; adapter-specific replay varies | integration/adapters | present | PARTIAL | full adapter/retry lifecycle audit |
| Canonical transfer state machine | app/user architecture | enum exists; generic unconstrained status setter | no complete transition suite | docs overstate | BROKEN | BRIDGE-AUDIT-3 |
| Outbound canonical lifecycle | app/user architecture | event/message only; no transfer record | partial outbound integration | docs imply lifecycle | PARTIAL | BRIDGE-AUDIT-3 |
| Reconciliation evidence | architecture | monotonic BridgeAccountingRegistry | accounting hardening tests exist | present | COMPLETE | retain |
| Reconciliation safety gating | security/troubleshooting | not explicitly wired to router admission | not established | docs imply halt/escalate | PARTIAL | BRIDGE-AUDIT-4 |
| User-facing frontend | app metadata/manual | Exchange supplies bridge UX; no dedicated Bridge app | Exchange web tests | Bridge docs present | PARTIAL | BRIDGE-AUDIT-5 |
| Backend/API/indexing | developer/API docs | shared Indexer + Exchange read service consume Bridge events | Exchange/Indexer tests | partial | PARTIAL | BRIDGE-AUDIT-8 |
| Genesis fixed address authority | frozen address maps | VerifiedGateway420 = 0x0438; router registry-resolved | address authority CI | present | COMPLETE | retain |
| Modern Bridge component inventory | dApp map / architecture | chain registry omission fixed in audit branch | hardening gate updated | corrected | COMPLETE | exact-head CI |
| Deployment/init/Registry publication | Genesis/deployment requirements | fragmented/candidate data; no complete modern Bridge release manifest proven | partial | partial | PARTIAL | BRIDGE-AUDIT-6 |
| Production-equivalent testnet proof | release requirement | not available | mocked/repository tests only | live Exchange bridge runbook exists | BLOCKED | BRIDGE-AUDIT-9 |
| Production readiness | release requirement | external verifiers/gateways/routes and live operations not proven | no production evidence | partial | BLOCKED | post-testnet/production deployment |

## Files

### Present
Core Bridge Solidity, interface, adapters/verifiers, risk/config manifests, frozen address authority, app/user/developer/security/troubleshooting documentation, bridge hardening verifier, focused integration/fuzz/invariant tests, Indexer and Exchange bridge consumers.

### Corrected in audit branch
- `contracts/src/bridge/GatewayRouter420.sol`
- `contracts/test/BridgeGenesisIntegration420.t.sol`
- `scripts/verify-bridge-hardening.py`
- `contracts/config/genesis-dapp-contract-map.json`

### Missing or incomplete as release artifacts
- enforced canonical transfer transition machinery;
- outbound canonical transfer registration;
- core chain-registry admission enforcement;
- explicit accounting-health execution policy;
- reconciled canonical Bridge UI/service ownership;
- complete deployment/init/Registry publication manifest for the modern Bridge stack;
- production-equivalent live-testnet evidence.

## Security disposition
- **Verified/mitigated:** shared safety checks; governed adapter registration with self-reported ID check; route/asset/direction checks; route/asset/shared risk; atomic rollback on failed inbound replay; replay-protected inbound transfer identity; monotonic accounting observations; adapter-route binding fixed in this audit.
- **Accepted design risk:** external-chain proof/finality correctness necessarily depends on route-specific verifier families and external infrastructure; activation manifests keep several routes inactive until production verifier/gateway requirements are met.
- **Unresolved vulnerabilities/assurance gaps:** generic lifecycle mutation, absent outbound canonical transfer lifecycle, absent core chain-registry binding, and unresolved accounting-health admission semantics.

## Readiness state
- CODE COMPLETE: **NO** — lifecycle, outbound registry, chain admission and accounting-safety integration remain.
- BUILD COMPLETE: **NO** — exact-head CI for this audit branch is not yet recorded and the full release surface is incomplete.
- CONTRACT COMPLETE: **NO** — canonical Bridge state-machine/integration gaps remain.
- TEST COMPLETE: **NO** — missing transition graph, chain admission, accounting gate and full adapter/live tests.
- DOCUMENTATION COMPLETE: **NO** — current docs overstate lifecycle enforcement and do not resolve the canonical user-facing deployment surface.
- INTEGRATION COMPLETE: **NO** — core chain registry/accounting policy and canonical frontend/service ownership remain incomplete.
- SECURITY QUALIFIED: **NO** — material state-machine and execution-policy gaps remain even after the adapter-binding fix.
- TESTNET READY: **NO** — repository work above must close before production-equivalent qualification.
- GENESIS READY: **NO** — fixed gateway authority exists, but the modern Bridge stack is not fully deployment/init/operation qualified.
- PRODUCTION READY: **NO** — live external verifier/gateway/route operations and production evidence are absent.

## Final determination
420Bridge is a substantial and actively integrated protocol stack, but it is **not genuinely complete** at the audited baseline. Green historical tests are insufficient to qualify it because important documented guarantees are not yet enforced by the exact core contracts. The audit branch closes one concrete route-authority vulnerability and one canonical inventory drift issue, but the remaining work must proceed through the numbered `BRIDGE-AUDIT` roadmap before Bridge can be declared code-complete, testnet-ready or Genesis-ready.

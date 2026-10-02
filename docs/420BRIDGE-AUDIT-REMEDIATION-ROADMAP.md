# 420Bridge audit remediation roadmap

**Established:** 2026-10-01  
**Authority:** derived from the complete repository-grounded 420Bridge audit against current canonical architecture/specification. This roadmap does not redefine Bridge architecture; it orders the unresolved audit findings so they can be remediated without collapsing requirements.

## Qualification model

- **Level 1:** focused qualification for each remediation step: affected Solidity build/tests, negative/adversarial checks, bridge static verifier, ABI/config/address checks, and directly applicable CI.
- **Level 2:** broader Bridge application milestone qualification after BRIDGE-AUDIT-8.
- **Level 3:** one comprehensive repository/Genesis/docs/integration closeout at BRIDGE-AUDIT-10 after all repository-remediable work and live-testnet evidence exist.

## Roadmap

### BRIDGE-AUDIT-1 — Canonical inventory and route/adapter authority hardening — COMPLETE IN AUDIT BRANCH
Purpose: reconcile the canonical Bridge component inventory and close the route adapter-binding bypass.

Required outcome:
- canonical core inventory includes BridgeChainRegistry420;
- GatewayRouter420 accepts inbound/outbound execution only through the adapter ID configured on the selected route;
- negative tests prove another registered adapter cannot execute the route;
- bridge hardening verifier checks the canonical core inventory and adapter binding;
- Genesis dApp inventory no longer omits BridgeChainRegistry420.

### BRIDGE-AUDIT-2 — Chain identity enforcement in canonical route admission — COMPLETE
Purpose: make BridgeChainRegistry420 authoritative to Bridge execution rather than only Exchange qualification/documentation.

Required outcome:
- define and enforce how local 420 and external route-chain IDs map to active BridgeChainRegistry420 records;
- BridgeRouteRegistry activation fails closed for unknown/inactive/mismatched source or destination chain identities;
- route changes cannot retain a stale chain binding;
- tests cover forks/testnets, duplicate route-chain IDs, inactive chains, rebinding and direction-specific routes;
- deployment/bootstrap data includes every Genesis/testnet route-chain identity.

**Durable qualification:** `docs/audit/BRIDGE-AUDIT-2-QUALIFICATION.md`  
**Qualified implementation SHA:** `fdb6c49217b0e9626c2de1f0664a20be2b90767a`  
**Level 1:** PASS — Bridge fast qualification and all four real Solidity PR shards passed on the exact implementation SHA.

### BRIDGE-AUDIT-3 — Canonical transfer lifecycle and outbound registration — COMPLETE
Purpose: make the documented transfer lifecycle an enforced on-chain state machine.

Required outcome:
- replace generic unconstrained governance status mutation with named/guarded transition authority;
- define allowed normal and exceptional transitions for CREATED, SOURCE_PENDING, SOURCE_FINALIZED, PROOF_PENDING, VERIFIED, DESTINATION_PENDING, COMPLETED, FAILED, RETRYABLE, EXPIRED, PAUSED, DISPUTED and REFUNDED;
- bind actor/capability/evidence requirements to each transition;
- record outbound initiation as a canonical transfer/operation identity instead of emitting only an adapter message event;
- prevent terminal-state reopening, arbitrary completion/refund, duplicate destination release and replay across retry paths;
- tests cover every permitted transition and every prohibited edge.

**Durable qualification:** `docs/audit/BRIDGE-AUDIT-3-QUALIFICATION.md`  
**Qualified implementation SHA:** `42060ec5c0ea5efde0c527b38333381c44fb5f59`  
**Level 1:** PASS — Bridge fast qualification and all four real Solidity PR shards passed on the exact implementation SHA.

### BRIDGE-AUDIT-4 — Accounting-health enforcement and recovery boundary — COMPLETE
Purpose: reconcile BridgeAccountingRegistry evidence with the execution safety boundary.

Required outcome:
- define which unhealthy reconciliation states halt new inbound/outbound movement and which recovery/withdrawal actions remain permitted;
- wire canonical accounting health into router/settlement admission where required by architecture;
- preserve the rule that accounting evidence cannot mint, burn, confiscate or repair balances;
- prove stale/duplicate reconciliation evidence cannot restore health;
- prove recovery requires newer qualified evidence and does not rewrite settled history.

**Durable qualification:** `docs/audit/BRIDGE-AUDIT-4-QUALIFICATION.md`  
**Qualified implementation SHA:** `52f5aadbe89b52697df7bb91bd461f2008ce03e2`  
**Level 1:** PASS — Bridge fast qualification and all four real Solidity PR shards passed on the exact implementation SHA.

### BRIDGE-AUDIT-5 — Bridge application/service surface completion
Purpose: reconcile the repository claim that 420Bridge is a user-facing Genesis application with the actual deployable application surface.

Required outcome:
- choose and document the canonical user surface: dedicated Bridge web app, Wallet-integrated surface, Exchange `/bridge` surface, or an explicitly composed combination;
- if a dedicated Bridge app is required, implement its deployable frontend/runtime config/build/tests;
- if Bridge is intentionally surfaced through Wallet/Exchange, update app documentation and discovery metadata so it does not imply a nonexistent standalone production site;
- canonical reads use 420Indexer/RPC with reorg/finality/freshness handling and safe canonical fallback;
- transaction review shows exact source/destination chain, canonical asset, route, adapter/verifier identity, amount, recipient, limits and pending/finality state;
- errors/retries are replay-safe and do not manufacture success.

### BRIDGE-AUDIT-6 — Deployment, initialization and Registry publication closure
Purpose: make every required Bridge component deployable and reproducibly initialized.

Required outcome:
- deployment order and constructor/init arguments for core registries/router/gateway are explicit;
- ProtocolRegistry component IDs and published addresses are complete;
- fixed `VerifiedGateway420` at 0x0438 remains consistent with frozen Genesis authority;
- registry-resolved Bridge components use authorized nonfixed addresses and no retired candidate address as authority;
- router trust bindings, adapters, routes, assets, chain identities, limits and verifier configuration are initialized reproducibly;
- post-deployment governance/timelock ownership and emergency authority are verified;
- smoke/rollback/recovery runbook exists.

### BRIDGE-AUDIT-7 — Security, adapter and invariant completion
Purpose: close remaining security/testing coverage for the complete Bridge architecture.

Required outcome:
- focused tests for adapter-route binding, chain identity, lifecycle, accounting-health gating, replay/domain separation, risk rollback, external-call failure and terminal state safety;
- audit all production adapters/verifiers against launch manifests and required finality/proof semantics;
- fuzz/property/invariant coverage for risk windows/TVL, replay identities, transition graph and accounting monotonicity;
- static/security tooling covers all Bridge production contracts and reports accepted design risks separately from unresolved defects.

### BRIDGE-AUDIT-8 — Documentation, ABI, Indexer and cross-app integration reconciliation
Purpose: close repository-side integration and documentation before live deployment.

Required outcome:
- generated/current ABIs and Indexer decoding cover canonical Bridge events/contracts;
- Wallet/Exchange/Explorer/Notifications/Analytics consumers agree on event names and lifecycle semantics;
- app/developer/security/troubleshooting/operator/deployment documentation matches implementation;
- requirement matrix has no repository-remediable PARTIAL/MISSING/BROKEN/STALE items;
- Level 2 Bridge milestone qualification is green on the exact implementation SHA.

### BRIDGE-AUDIT-9 — Production-equivalent live testnet deployment qualification
Purpose: prove real cross-chain operation rather than mocked repository behavior.

Required outcome:
- deploy exact qualified Bridge stack to production-equivalent 420 testnet;
- publish/verify canonical Registry entries and runtime code hashes;
- configure at least one qualified external-chain route with real verifier/proof path and disposable test assets;
- execute outbound, source finality, proof acquisition/verification, inbound/destination settlement, retry/reorg/failure and recovery drills;
- preserve redacted durable evidence with exact source SHA, addresses, chain IDs, tx/message/transfer IDs and final states;
- no production credential or private-key material is committed.

### BRIDGE-AUDIT-10 — Final Level 3 phase closeout
Purpose: make the final readiness determination against the exact reconciled head.

Required outcome:
- reconcile with current `main`;
- run complete applicable Solidity/Genesis/420 Integrated/Docs/Indexer/security qualification once;
- confirm clean working tree, branch divergence, exact-head evidence and no stale audit claims;
- issue final code/build/contract/test/docs/integration/security/testnet/Genesis/production readiness matrix;
- merge only when all release-stage requirements are satisfied or explicitly recorded as external production gates.

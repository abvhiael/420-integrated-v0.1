# 420Token audit remediation roadmap

Status: **ACTIVE**
Audit baseline: `main@f6a426fc386b21f871b1805e00a57b1dad2bf902`
Historical implementation: PR #36, merged as `5dfb7dfecc0e14df0f7745f374395a4c7bba04d8`

This audit preserves the frozen Genesis definition in `config/genesis-applications.json`, `contracts/config/420token-genesis.json`, the Genesis address namespace, and the shared Pay/Token/Exchange/Bridge architecture. It does not redefine 420Token around the files that happen to exist.

## TOKEN-AUDIT-1 — canonical definition and repository inventory
- Reconcile every authoritative Token source, contract, service ID, address rule, documentation surface and historical PR.
- Record the exact repository baseline and classify every expected component.
- Freeze the requirement matrix used by later steps.
- **Finding at intake:** core contracts exist, but Token has no app-specific audit workflow, exact-head qualification record, release/deployment materialization, or Wallet transaction/runtime binding. The public-service readiness record still says `IMPLEMENTED_PENDING_EXACT_HEAD_QUALIFICATION`.

## TOKEN-AUDIT-2 — contract invariant and adversarial qualification
- Expand tests for all `TOK-INV-001` through `TOK-INV-010`.
- Cover exact fee, Treasury atomicity, disabled/unknown templates, deterministic creator-nonce isolation, provenance, ownership/custody boundaries, caps/burn/permit/votes, safe NFT/multi-token transfers, governance-only disablement and downstream non-endorsement boundaries.
- Add malformed-signature/replay/expiry, authorization and boundary-value tests.
- Add a Token-owned CI gate with exact-head checking, formatting/build/tests and targeted static analysis.

## TOKEN-AUDIT-3 — real Treasury/Vault integration
- Replace mock-only economic confidence with a retained integration test against the real Vault registry/accounting/deposit path.
- Prove the configured fee sink is the canonical token-creation community-revenue vault identity and the full 42 native 420 enters Vault accounting atomically.
- Document the deployment trust boundary: vault ID validation alone is not live deployment identity proof; release qualification must bind the factory constructor to the verified registered Vault address/code/config.

## TOKEN-AUDIT-4 — deployment, Registry and address materialization
- Preserve `REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS`; never allocate or resurrect historical candidate address `0x0455`.
- Materialize constructor/dependency order, GovernanceTimelock authority for the template registry, community Treasury Vault dependency, canonical component/service IDs, ProtocolRegistry publication requirements and release evidence fields.
- Add executable repository verification for namespace, service ID, deployment graph and no-hard-coded-address rules.
- Live deployed addresses/code hashes remain testnet evidence, not repository fiction.

## TOKEN-AUDIT-5 — Wallet-integrated user path
- Implement a fail-closed Wallet runtime/handoff for `420/service/token/v1`.
- Require verified chain/service/factory/template-registry/Vault identity before preparing a deployment.
- Preserve SmartAccount420 as transaction authority; Token code must not acquire an independent signer.
- Enforce exact 42 native 420 value and reviewed Token factory target/calldata.
- Cover wrong-chain, unresolved/zero-code, wrong-service, aliased dependency, wrong-fee and empty-calldata failures.

## TOKEN-AUDIT-6 — documentation and integration reconciliation
- Expand architecture, developer, user, security, troubleshooting and deployment/operator documentation to match the exact implementation.
- Document Registry, Wallet, Treasury/Vault, Explorer/Indexer/Search/Analytics and downstream Swap/Exchange/Launchpad/Bridge/Pay boundaries.
- Explicitly distinguish deployment provenance from endorsement/listing/liquidity/legal or investment status.
- Record that the Development Compensation Vault is **not** part of Token V1 fee routing; the canonical Token exception routes the full creation fee to the community Treasury Vault.

## TOKEN-AUDIT-7 — repository exact-head closeout
- Reconcile against then-current `main`.
- Run Token audit qualification, retained Solidity contracts, Genesis/address-authority, 420 Integrated and 420Docs gates as applicable against one exact implementation head.
- Record exact SHA, run/job IDs, residual accepted risks and all repository-complete statuses.
- Do not promote a documentation-only head using results from an earlier implementation SHA.

## TOKEN-AUDIT-8 — production-equivalent testnet qualification
**BLOCKED until the approved production-equivalent 420Integrated testnet and its real Vault/Registry/Wallet infrastructure exist.**
- Deploy the exact qualified release candidate.
- Bind chain/genesis identity, GovernanceTimelock, TokenTemplateRegistry420, the registered community Treasury Vault and TokenFactory420.
- Publish/resolve the canonical Token component/service through ProtocolRegistry.
- Exercise all eight templates through the real Wallet path; retain tx hashes, receipts/logs, addresses, runtime code hashes, Registry evidence, Vault-accounting evidence and failure-path evidence.
- Exercise wrong-chain/RPC disagreement, disabled template, bad fee, Treasury failure, restart/reorg/indexer rebuild and derived-service consistency.
- Repository CI or local EVM evidence must not be promoted to this live gate.

## TOKEN-AUDIT-9 — Genesis / production release gate
**BLOCKED until TOKEN-AUDIT-8 is complete.**
- Reconcile all Token audit evidence with the final Genesis release manifest.
- Confirm production Registry/Vault/Wallet/Explorer/Indexer/Search endpoints and operations/monitoring/recovery procedures.
- Complete independent external security review or approved release exception where required by the global launch gate.
- Declare CODE, BUILD, CONTRACT, TEST, DOCUMENTATION, INTEGRATION, SECURITY, TESTNET, GENESIS and PRODUCTION readiness separately.

Numbering is frozen. Unfinished work moves forward under these IDs; steps are not renumbered or silently collapsed.

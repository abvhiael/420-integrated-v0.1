# 420Token audit remediation roadmap

Status: **CURRENT RECONCILIATION RECORDED — TOKEN-AUDIT-2 CONTRACT, TOKEN-AUDIT-3 ECONOMIC AND TOKEN-AUDIT-4 DEPLOYMENT QUALIFICATION COMPLETE; TOKEN-AUDIT-5 THROUGH TOKEN-AUDIT-7 REQUALIFICATION REQUIRED; TOKEN-AUDIT-8/9 REMAIN LIVE GATES**

Current baseline and remediation ledger: `docs/audit/420TOKEN-AUDIT-1-CURRENT-RECONCILIATION.md`. October completion below is retained historical evidence, not a current release qualification claim. TOKEN-AUDIT-1 current reconciliation, TOKEN-AUDIT-2 contract qualification, TOKEN-AUDIT-3 economic qualification and TOKEN-AUDIT-4 deployment preparation are complete; TOKEN-AUDIT-5 remains open; assigned substeps 5.1 (shared application architecture and SDK), 5.2 (verified Registry and Wallet runtime discovery), 5.3 (template catalogue and availability), 5.4 (ERC20 creation wizard), 5.5 (ERC721 collection creation wizard) and 5.6 (ERC1155 multi-token creation wizard) are qualified.
Audit baseline: `main@f6a426fc386b21f871b1805e00a57b1dad2bf902`
Historical implementation: PR #36, merged as `5dfb7dfecc0e14df0f7745f374395a4c7bba04d8`

This audit preserves the frozen Genesis definition in `config/genesis-applications.json`, `contracts/config/420token-genesis.json`, the Genesis address namespace, and the shared Pay/Token/Exchange/Bridge architecture. It does not redefine 420Token around the files that happen to exist.

## TOKEN-AUDIT-1 — canonical definition and repository inventory
- Reconcile every authoritative Token source, contract, service ID, address rule, documentation surface and historical PR.
- Record the exact repository baseline and classify every expected component.
- Freeze the requirement matrix used by later steps.
- **Finding at intake:** core contracts exist, but Token has no app-specific audit workflow, exact-head qualification record, release/deployment materialization, or Wallet transaction/runtime binding. The public-service readiness record still says `IMPLEMENTED_PENDING_EXACT_HEAD_QUALIFICATION`.

## TOKEN-AUDIT-2 — contract invariant and adversarial qualification — **COMPLETE (CURRENT REQUALIFICATION)**
- Expand tests for all `TOK-INV-001` through `TOK-INV-010`.
- Cover exact fee, Treasury atomicity, disabled/unknown templates, deterministic creator-nonce isolation, provenance, ownership/custody boundaries, caps/burn/permit/votes, safe NFT/multi-token transfers, governance-only disablement and downstream non-endorsement boundaries.
- Add malformed-signature/replay/expiry, authorization and boundary-value tests.
- Add a Token-owned CI gate with exact-head checking, formatting/build/tests and targeted static analysis.
- Current qualification: `d31f48de7956a25196f84019574c06fba402d855`, PR #1235, Token run 44629627298, qualify 135932626685 and security 135932626096 both PASS. Dynamic chain permit domain, ERC721 approval existence, ERC1155 `uri(uint256)` and retained legacy getter corrected. 30/30 tests in each profile; four fuzz properties at 2,500/100,000 runs each; three invariant campaigns at 128/4,096 runs each with zero reverts. Slither high-severity gate PASS. Evidence: `docs/audit/420TOKEN-AUDIT-2-QUALIFICATION.json`. No testnet or overall repository-release qualification claimed.

## TOKEN-AUDIT-3 — real Treasury/Vault integration — **COMPLETE (CURRENT REQUALIFICATION)**
- Replace mock-only economic confidence with a retained integration test against the real Vault registry/accounting/deposit path.
- Prove the configured fee sink is the canonical token-creation community-revenue vault identity and the full 42 native 420 enters Vault accounting atomically.
- Document the deployment trust boundary: vault ID validation alone is not live deployment identity proof; release qualification must bind the factory constructor to the verified registered Vault address/code/config.
- Current qualification: `a7ce71b366804631a422388eb7dbbf9ca1ddffd4`, PR #1236, economic workflow run 44631438474 / job 135938798869 PASS. All 10 scoped tests passed, including 50,000 fuzz cases; all eight templates reconciled exact 42 native 420 against the real Vault registry, authorization, accounting, capability registry and deposit implementation. Evidence: `docs/audit/420TOKEN-AUDIT-3-QUALIFICATION.json`. No production contract change was required, no prior passing suite repeated. Live deployment identity remains TOKEN-AUDIT-4/8.

## TOKEN-AUDIT-4 — deployment, Registry and address materialization — **COMPLETE (CURRENT REQUALIFICATION)**
- Preserve `REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS`; never allocate or resurrect historical candidate address `0x0455`.
- Materialize constructor/dependency order, GovernanceTimelock authority for the template registry, community Treasury Vault dependency, canonical component/service IDs, ProtocolRegistry publication requirements and release evidence fields.
- Add executable repository verification for namespace, service ID, deployment graph and no-hard-coded-address rules.
- Live deployed addresses/code hashes remain testnet evidence, not repository fiction.
- Current qualification: `7ba349ad6f232034a4e789f8c6448f80a9097e3f`, PR #1237, deployment workflow run 44634134888 / job 135948178120 PASS. Frozen V3 authority and fixed anchor ABI, storage and executable bytes verified; 14 artifact commitments materialized reproducibly from 23 source/config inputs. Two independent local Anvil Cancun rehearsals produced identical deployment addresses, runtime hashes and Registry commitments; all eight templates reproduced their CREATE2 addresses and exact fee accounting in each run. Read-only unsigned planner and publication tooling: `scripts/token/deployment.py`. Durable evidence: `docs/audit/420TOKEN-AUDIT-4-QUALIFICATION.json`. Local evidence is not live approval.

## TOKEN-AUDIT-5 — Wallet-integrated user path
- Implement a fail-closed Wallet runtime/handoff for `420/service/token/v1`.
- Require verified chain/service/factory/template-registry/Vault identity before preparing a deployment.
- Preserve SmartAccount420 as transaction authority; Token code must not acquire an independent signer.
- Enforce exact 42 native 420 value and reviewed Token factory target/calldata.
- Cover wrong-chain, unresolved/zero-code, wrong-service, aliased dependency, wrong-fee and empty-calldata failures.
- **Assigned substep 5.1 — Shared Token application architecture and SDK: COMPLETE.** Exact tested implementation `dd4e778ce7be964a75a99df0e3d3c39ba4a053f2`, PR #1238, Token workflow 44636056332, Wallet SDK job 135955021351 PASS (29/29, zero failures/skips); evidence `docs/audit/420TOKEN-AUDIT-5.1-QUALIFICATION.json`. Shared browser-safe catalog and typed drafts for all eight profiles; canonical ABI/config commitments; full release/Registry/Vault verification and review-only SmartAccount preparation. Retained deployment dependency root reproduced exactly. Aggregate TOKEN-AUDIT-5 remains open; actual application wiring, final user-flow qualification and live release approval are not asserted here.
- **Assigned substep 5.2 — Verified Registry and Wallet runtime discovery: COMPLETE.** Exact tested implementation `44da87e1e8e2d6999a6742428059f2511dd5adae`, PR #1239, Token workflow 44638784126, Wallet SDK job 135964436735 PASS (84/84, zero failures/skips); full automatically triggered Wallet regression 629/629 and browser accessibility PASS. Evidence: `docs/audit/420TOKEN-AUDIT-5.2-QUALIFICATION.json`. Wallet generator selects only bound verified deployment inventory, clears stale base pins, and reconciles the selected chain/environment/Registry/CapabilityRegistry. Wallet host verifies canonical Registry release and fresh SmartAccount via read-only connected provider, discards stale generations, and the catalogue presents discovery-only status without a manifest-only launch link. No live pin or Wallet creation/confirmation/submission flow is claimed. Aggregate TOKEN-AUDIT-5 remains open.
- **Assigned substep 5.3 — Template catalogue and availability: COMPLETE.** Exact tested implementation `2bc303c9255cfc0a0e3cd04a2dbdf5239e9f55bc`, PR #1240, Token workflow 44643806079 / Wallet SDK job 135981460639 PASS (94/94, zero failures/skips); rendered browser workflow 44643806096 / job 135981196070 PASS at 1440, 1024, 768, 390 and 320 pixels, zero Axe violations and no horizontal overflow. Evidence: `docs/audit/420TOKEN-AUDIT-5.3-QUALIFICATION.json`. Actual Wallet Apps catalogue presents all eight frozen profiles, exact fee, governance enablement at a verified block, unknown states, and account readiness separately. Selection and refresh reverify the same host-approved runtime; invalidation clears stale choices. Selection grants no signing or spending authority. Creation forms/review/submission and aggregate TOKEN-AUDIT-5 remain open.
- **Assigned substep 5.4 — ERC20 creation wizard: COMPLETE.** Exact tested implementation `f017d44633f29d1e7758618c1188fc2e001e6b64`, PR #1242, Token workflow 44646220685 / Wallet SDK job 135989683837 PASS (105/105, zero failures/skips), rendered browser workflow 44646220776 / job 135989370849 PASS at 1440, 1024, 768, 390 and 320 pixels, zero Axe violations and horizontal overflow. Evidence: `docs/audit/420TOKEN-AUDIT-5.4-QUALIFICATION.json`. Actual Wallet wizard supports all six ERC20 profiles, exact 18-decimal supply and cap conversion, secure bytes32 salt, metadata and uint208 vote supply bound, verified SmartAccount ownership, fresh release/template verification and immutable canonical draft. Invalid/stale form or account changes clear or reject the draft. Draft-only authority; no simulation, signing, gas estimation or submission. Aggregate TOKEN-AUDIT-5 remains open.
- **Assigned substep 5.5 — ERC721 collection creation wizard: COMPLETE.** Exact tested implementation `e68d2b853a12e71dbe831dae033a8e8f5b78229d`, PR #1243, Token workflow 44649279772 / Wallet SDK job 136000031783 PASS (115/115, zero failures/skips), rendered browser workflow 44649279771 / job 135999790220 PASS at 1440, 1024, 768, 390 and 320 pixels, zero Axe violations and no horizontal overflow. Evidence: `docs/audit/420TOKEN-AUDIT-5.5-QUALIFICATION.json`. Actual Wallet ERC721_COLLECTION wizard reuses the verified ERC20 draft lifecycle, validates name/symbol/optional exact base URI and bytes32 salt, documents zero minted NFTs and immutable shared URI semantics of the frozen contract, binds the verified SmartAccount owner, and prepares an immutable canonical request with exact fee. Unsafe URI input, stale or unavailable release/profile/account and arbitrary transaction or mint parameters fail closed. No metadata fetch, signing, simulation or submission. Aggregate TOKEN-AUDIT-5 remains open.
- **Assigned substep 5.6 — ERC1155 multi-token creation wizard: COMPLETE.** Exact tested implementation `6a12c33c9dafa43a7bd9add4e39be641f2b6a847`, PR #1244, Token workflow 44651731712 / Wallet SDK job 136008417160 PASS (125/125, zero failures/skips), rendered browser workflow 44651732336 / job 136008014443 PASS at 1440, 1024, 768, 390 and 320 pixels, zero Axe violations and horizontal overflow. Evidence: `docs/audit/420TOKEN-AUDIT-5.6-QUALIFICATION.json`. Actual Wallet ERC1155_MULTI wizard accepts only URI and secure bytes32 salt, explains zero initial balances, immutable stored URI and client-side literal {id} replacement with lowercase 64-digit hexadecimal uint256 IDs. Empty and shared URI warnings and inert preview; common ERC721 URI safeguards and shared draft lifecycle. Fresh Registry/release/owner verification prepares canonical exact-fee draft; invalid metadata, arbitrary mint/owner/transaction fields and stale runtime fail closed. All eight template profiles now have creation draft interfaces; simulation, final review, submission and live evidence remain open. Aggregate TOKEN-AUDIT-5 remains open.

## TOKEN-AUDIT-6 — documentation and integration reconciliation
- Expand architecture, developer, user, security, troubleshooting and deployment/operator documentation to match the exact implementation.
- Document Registry, Wallet, Treasury/Vault, Explorer/Indexer/Search/Analytics and downstream Swap/Exchange/Launchpad/Bridge/Pay boundaries.
- Explicitly distinguish deployment provenance from endorsement/listing/liquidity/legal or investment status.
- Record that the Development Compensation Vault is **not** part of Token V1 fee routing; the canonical Token exception routes the full creation fee to the community Treasury Vault.

## TOKEN-AUDIT-7 — repository exact-head closeout — **COMPLETE**
- Final current-main reconciliation head: `c0a82e5a7d281d5922b7d69baebd5ed57eea29af`, reconciled to `main@5367722febee6e5df18b1c0c45a142c59ea9f905` with behind=0.
- Immediately preceding exact implementation head `f0c3cf1d922bf7279f001cf1934b3c62e4509859` passed all required Level-3 owners: 420Token audit #32, Solidity Contracts #4813 (all four PR shards), 420 Integrated #6420, 420Docs #5314, Genesis Address Authority #1519 and Wallet Web #1608.
- The final three-main-commit reconciliation changed only `appstore/web/static/app.css`, `appstore/web/static/index.html` and `appstore/web/static/logo.svg`. Exact-head change-scope qualification proved zero 420Token contract/config/test/documentation/workflow/Wallet-token changes between the fully green Token head and `c0a82e5a...`.
- Per the closeout rule for unrelated-main-only reconciliation, Token tests were not repeated because no 420Token app code or integration surface changed.
- Repository-side CODE/BUILD/CONTRACT/TEST/DOCUMENTATION/INTEGRATION qualification is complete. Live deployment/security-boundary proof remains TOKEN-AUDIT-8; Genesis/production remains TOKEN-AUDIT-9.

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

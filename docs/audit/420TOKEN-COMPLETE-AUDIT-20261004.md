# 420Token complete repository audit — 2026-10-04

## Scope and authority

Repository: `abvhiael/420-integrated-v0.1`  
Working branch: `audit/420token-complete-20261004`  
Working PR: #521  
Audit intake `main`: `f6a426fc386b21f871b1805e00a57b1dad2bf902`  
Historical implementation PR: #36, merged as `5dfb7dfecc0e14df0f7745f374395a4c7bba04d8`

This audit treats repository sources, not conversational memory, as authority. The canonical Genesis definition is the combination of `config/genesis-applications.json`, `contracts/config/420token-genesis.json`, `docs/420TOKEN.md`, `docs/architecture/protocols/pay-token-exchange-bridge.md`, the Genesis address authorities, ProtocolRegistry/ServiceIds sources, Token contracts, Wallet Genesis catalogue and qualification evidence.

The prompt's reference to "Dev Compensation Vault" is not the canonical 420Token V1 design. Repository authority defines the complete 42-native-420 creation fee as an explicit exception routed to `420/treasury/vault/token-creation-community-revenue/v1`. DevelopmentCompensationVault420 is not a Token V1 dependency.

## Canonical application definition

420Token is a `GENESIS_PROTOCOL_AND_USER_APP` that provides self-service deployment from eight frozen V1 profiles: six ERC20 profiles, one ERC721 collection profile and one ERC1155 multi-token profile. The factory accepts no caller-supplied bytecode, records deployment provenance, charges exactly 42 native 420, atomically forwards that fee into the canonical community Treasury Vault, and retains no post-deployment ownership, mint authority or token custody.

TokenFactory420 is **Registry-resolved and has no fixed Genesis address**. The current address namespace explicitly supersedes historical proposals; the prior `0x0455` Token-factory candidate is not active authority.

## Intake findings

At intake the six core Token Solidity files and basic Genesis tests existed. The repository did **not** contain a Token-specific audit workflow, Token-specific exact-head qualification record, release/deployment materialization, real AssetVault420 fee-integration proof, ProtocolRegistry deployment-binding test, or a Token-specific Wallet runtime/SmartAccount transaction handoff. The Token readiness record remained `IMPLEMENTED_PENDING_EXACT_HEAD_QUALIFICATION`, and the documentation audit matrix still marked GEN-TOKEN `pending-audit`.

The original `TokenGenesis420.t.sol` covered the canonical service ID, exact fee to a mock Vault, wrong Vault ID, wrong fee, fixed-supply mint rejection, cap enforcement and creator ownership for NFT/multi-token profiles. It did not cover all TOK invariants, real Vault accounting, permit replay/expiry/malleability, governance-only disablement, Registry publication, failed Treasury rollback, safe receiver failures, vote checkpoints, Wallet identity validation or exact-head app-owned CI.

## Files and component inventory

| Component | Intake | Audit branch | Classification |
|---|---|---|---|
| TokenIds420.sol | present | verified | COMPLETE |
| TokenTemplateRegistry420.sol | present | verified | COMPLETE |
| TokenFactory420.sol | present | verified | COMPLETE |
| ERC20Template420.sol | present | permit hardened | COMPLETE pending final CI |
| ERC721Template420.sol | present | verified/adversarial test added | COMPLETE pending final CI |
| ERC1155Template420.sol | present | verified/adversarial test added | COMPLETE pending final CI |
| TokenGenesis420.t.sol | present | retained | COMPLETE |
| TokenAudit420.t.sol | missing | created | COMPLETE pending final CI |
| TokenVaultIntegration420.t.sol | missing | created | COMPLETE pending final CI |
| TokenDeploymentBinding420.t.sol | missing | created | COMPLETE pending final CI |
| token-audit release materialization | missing | created | COMPLETE pending final CI |
| Token-specific repository verifier | missing | created | COMPLETE pending final CI |
| Token-specific CI/security workflow | missing | created | COMPLETE pending final CI |
| Wallet token runtime binding | missing | created | COMPLETE pending final CI |
| Wallet SmartAccount token handoff | missing | created | COMPLETE pending final CI |
| Wallet token runtime tests | missing | created | COMPLETE pending final CI |
| standalone Token backend/API/worker | not canonically required | none | NOT APPLICABLE |
| dedicated Token database/migrations | not canonically required | none | NOT APPLICABLE |
| fixed TokenFactory predeploy | forbidden by address authority | none | NOT APPLICABLE |
| live testnet deployment evidence | absent | intentionally not invented | BLOCKED on official testnet |
| production deployment | absent | intentionally not invented | BLOCKED on TOKEN-AUDIT-8/9 |

## Contract review

### TokenTemplateRegistry420

The registry is initialized once with all eight frozen profiles. V1 has no post-deployment add/replace method. Governance can only toggle enablement through `onlyGovernance`. This satisfies the architecture requirement that an existing template ID/version cannot silently be substituted. Production deployment must instantiate it with the canonical GovernanceTimelock.

### TokenFactory420

The factory has immutable template-registry and community-Vault dependencies, no owner/admin setter, exact-fee enforcement, non-reentrancy around creation, frozen template admission, creator-scoped CREATE2 salt/nonces, deployment provenance, and atomic Treasury forwarding. A failed Vault deposit reverts the token creation, nonce increment and deployment record.

The constructor's Vault check verifies the canonical Vault ID but does not cryptographically prove that an arbitrary address returning that ID is the canonical deployed Vault. The audit does not alter the frozen architecture to add a new constructor dependency. Instead the release materialization and live qualification require the factory to be constructed with the verified registered AssetVault420 address/runtime identity. This is a deployment trust boundary and remains unqualified until live deployment evidence exists.

### ERC20Template420

Profile gates, cap enforcement, transfer/allowance semantics, mint/burn ownership, EIP-712 permit domain separation and delegated vote checkpoints are present. The audit hardened permits to reject non-27/28 `v` values and high-`s` signatures, in addition to existing deadline, recovered-signer and nonce replay checks.

### ERC721Template420 / ERC1155Template420

Creator ownership/mint authority, approvals/transfers, burns and safe receiver checks are present. The audit adds adversarial incompatible-receiver qualification. No factory admin authority remains after deployment.

## Security disposition

| Risk | Disposition |
|---|---|
| arbitrary factory bytecode | verified blocked by frozen factory paths |
| exact-fee bypass | verified by source + tests; exact final CI pending |
| fee stranding in factory | atomic forwarding design; rollback test added |
| mutable fee recipient | immutable constructor dependency |
| spoof same-ID Vault at deployment | deployment trust boundary; release binding added; live proof BLOCKED |
| factory custody/mint/seizure | no such authority; adversarial owner test added |
| template substitution | no V1 add/replace API |
| unauthorized template disable | SystemAccess governance-only |
| permit cross-chain/cross-contract replay | EIP-712 domain binds chain ID + verifying contract |
| permit nonce replay | monotonic nonce; adversarial replay test added |
| permit signature malleability | remediated with canonical v + low-s rule |
| ERC721/1155 unsafe recipient lock via safe transfer | receiver callbacks required; adversarial tests added |
| reentrancy on fee path | factory create methods use nonReentrant; external fee call occurs after local provenance writes but a failure reverts all state |
| dangerous delegatecall/selfdestruct/tx.origin | Token-specific CI rejects these primitives |
| front-running of deterministic address | salt includes creator and creator nonce; another caller cannot occupy the same creator-scoped derivation through the factory |
| MEV/listing endorsement | deployment alone has no listing/liquidity/bridge authority |
| upgrade/storage collision | Token contracts are non-proxy/non-upgradeable in V1; NOT APPLICABLE |

No unresolved repository-local critical/high vulnerability has been identified at this stage. Final SECURITY QUALIFIED remains NO until the exact final head passes Token hardening + targeted Slither and the live deployment trust boundary is qualified at TOKEN-AUDIT-8.

## Requirement matrix

| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| Genesis protocol/user app | genesis-applications | contracts + Wallet catalogue | Genesis test | architecture/user | COMPLETE | none |
| eight frozen V1 templates | 420token-genesis | registry + three template classes | catalog/adversarial suite | architecture/contracts | COMPLETE | final exact-head CI |
| exact 42 native 420 fee | Genesis rule + Token spec | factory constant/modifier | Genesis + audit suite | user/security | COMPLETE | final exact-head CI |
| canonical community Treasury Vault | Token spec | immutable dependency + Vault ID check | mock + real AssetVault integration | architecture/deployment | COMPLETE | live address/code/registration proof at TOKEN-AUDIT-8 |
| fee atomicity | Token spec | deployment + Vault deposit in one tx | Treasury-failure rollback test | security/troubleshooting | COMPLETE | final CI + live failure-path evidence |
| provenance | TOK-INV-003 | deployment array/mapping/events | provenance test | developer docs | COMPLETE | final CI |
| no factory custody/admin mint | TOK-INV-004 | creator owns template roles | adversarial owner test | security | COMPLETE | final CI |
| fixed/capped/burn semantics | TOK-INV-005 | ERC20 profile gates | expanded suite | contracts/user | COMPLETE | final CI |
| permit security | TOK-INV-006 | domain + nonce + canonical signature checks | replay/expiry/malformed tests | security | COMPLETE | final CI |
| vote checkpoints | TOK-INV-007 | delegation/checkpoints | current + historical vote test | contracts/user | COMPLETE | final CI |
| safe NFT/multi-token transfer | TOK-INV-008 | receiver checks | incompatible-recipient tests | troubleshooting/security | COMPLETE | final CI |
| governance disable/no substitution | TOK-INV-009 | onlyGovernance toggle; no replace API | auth/disable test | architecture | COMPLETE | final CI |
| downstream non-endorsement | TOK-INV-010 | no downstream privilege | structural | all app docs | COMPLETE | live cross-app observation at TOKEN-AUDIT-8 |
| Registry-resolved address | namespace authority | release materialization; no fixed address | deployment-binding test | deployment guide | COMPLETE | live Registry publication at TOKEN-AUDIT-8 |
| ProtocolRegistry publication | Registry architecture | component+service publication model | deployment-binding test | developer/deployment | COMPLETE | final CI; live publication later |
| Wallet verified runtime | Wallet Genesis rule | token-runtime.js | Node tests | architecture/user | COMPLETE | final CI; live binding later |
| Wallet execution authority | Wallet authority model | token-handoff.js -> SmartAccount420 | Node tests | developer/user | COMPLETE | final CI; live transaction later |
| dedicated Token backend/API | no canonical requirement | none | n/a | architecture | NOT APPLICABLE | none unless future version adds one |
| dedicated Token indexer | no canonical dedicated-service requirement | generic ecosystem indexing expected | no Token-specific projection | developer docs | NOT APPLICABLE | TOKEN-AUDIT-8 must still prove deployed events are observable/reconstructable |
| build reproducibility | Foundry config + CI | solc 0.8.24/cancun/viaIR/optimizer | Token workflow | deployment docs | PARTIAL | exact final CI must pass |
| Token static analysis | audit requirement | targeted Slither gate added | CI security job | security | PARTIAL | exact final CI must pass |
| developer/operator documentation | docs matrix | expanded + deployment guide | verifier checks presence | app docs | COMPLETE | final docs gate |
| exact-head qualification evidence | readiness policy | Token workflow added | pending | roadmap/report | PARTIAL | record successful final SHA/run IDs |
| production-equivalent testnet | TOKEN-AUDIT-8 | not deployed | not run | deployment guide | BLOCKED | official testnet + real infrastructure |
| Genesis release | TOKEN-AUDIT-9 | no final live release | not run | roadmap | BLOCKED | TOKEN-AUDIT-8 then final manifest/ops/security reconciliation |
| production release | global release gate | absent | not run | roadmap | BLOCKED | Genesis/live operations/external review or approved exception |

## Readiness classification before final exact-head qualification

- CODE COMPLETE: **YES**, subject to successful compile/test of the final head.
- BUILD COMPLETE: **NO** — final exact-head Token build has not yet passed.
- CONTRACT COMPLETE: **YES**, subject to exact-head qualification.
- TEST COMPLETE: **NO** — expanded tests exist but final exact-head execution evidence is pending.
- DOCUMENTATION COMPLETE: **YES** for repository-side Token scope, subject to final docs verification.
- INTEGRATION COMPLETE: **NO** — repository-level Registry/Vault/Wallet integrations are implemented, but live same-deployment integration is TOKEN-AUDIT-8.
- SECURITY QUALIFIED: **NO** — final hardening/Slither plus live deployment trust proof are pending.
- TESTNET READY: **NO** until repository qualification passes and a release candidate can be bound to official testnet infrastructure.
- GENESIS READY: **NO** — live testnet qualification is mandatory.
- PRODUCTION READY: **NO** — TOKEN-AUDIT-8/9 and global production release gates remain.

This record must be updated with the exact final implementation SHA and CI run/job IDs before TOKEN-AUDIT-7 can be marked COMPLETE. Results from an earlier implementation SHA must not be inherited by a later evidence/documentation commit.

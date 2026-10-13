# R04 accumulated canonical integration specification

This implements the existing R04.1–R04.14 milestone and its R05-owned authenticated/durable consumers. It adds no R04.15 and does not certify the complete R05 phase. Repository acceptance requires all four dedicated R04 Level 2 jobs on the same executable SHA. Development PRs remain unmerged until separate Level 3.

## Canonical competition and Cup

HarvestProductRegistry.registeredBlock records the actual product registration block. CanonicalCompetitionEvidence accepts only immutable canonical product records. The configured finality verifier supplies the actual registration-block hash after a deployment-selected confirmation interval of 1–255 blocks. An unconfirmed source beyond the EVM block-hash window fails closed; no timestamp fallback. Facts are bound to registry, chain, product, grower, quality and accepted timestamp. The configured adjudicator may permanently revoke a product. These are explicit trust roles, not live-network consensus-finality certification.

CanonicalCompetitionEntitlement resolves the actual address-owned GrowerProfile and existing GamingBridge/OptionalCompetitionAccess, and checks the shared game is active. No caller-supplied profile or wallet balance changes scoring. Competition revalidates evidence/entitlement at finalization and exposes resultIsCurrent. Cup finalization/issuance and its scoped consumer revalidate both semifinal winners and finalists; later revocation disables acceptance without rewriting historical commitments.

CanonicalCupAttestationConsumer requires actual Cup issuance AND independently authorized shared CrossGameRegistry provenance with the actual grower account. Its payload commits to chain, Cup address/ID, scope and result commitment. Existing game-operator authority controls shared issuance. Wrong scope/profile/source, unfinalized results, revoked evidence and replay never manufacture monetary prizes or protected-stat benefits.

## Emergency ingress and safe exits

Each new R04 consumer constructor pins the reviewed canonical authorization root. R04EmergencyConsumer requires a one-time deployer-and-capability-authorized binding to canonical EmergencyState. ActionIds.R04_EMERGENCY_BIND uses the existing EMERGENCY_STATE component and a chain/consumer/controller-specific scope. Unbound consumers reject risk ingress. Existing domain IDs remain unchanged.

| Domain | Risk operations blocked | Safe operations retained |
|---|---|---|
| MANUFACTURING | start/completion; equipment issue/place/use/repair; cultivation bridge | cancellation/refund, removal, retirement, single-use recycling |
| MARKET | escrow list/settle; runtime listing/prepare/submission | owner cancellation, expiry, manual resource recovery, finalized reconciliation or proven cancellation/refund |
| RIGHTS / LEASE / LICENSE | new grants/leases/licenses, transfer, unfreeze, disputed-lease restoration; usability fails closed | freeze/revoke/dispute/expiry, actual zero-plant exit reconciliation; no forced eviction |
| ORGANIZATION_GOVERNANCE | membership admission, new obligations/admin rotation, delegated and financial permission consumption, Treasury gateway | leave/removal, bilateral discharge, final exit, revocation |
| COOPERATIVE_GOVERNANCE | admission, proposals/votes/executor mutation | cancellation and read-only evidence; no arbitrary calls or spending |
| COMPETITION_ENTRY | competition create/enter/submit; Cup creation/issuance | independent adjudication and canonical result finalization |
| MISSION_ACTIVATION | mission activate/attest/claim; progression proof ingestion and runtime reward issuance | failure/expiry/completion reads; no automatic BUDS forfeiture |

All safe paths retain their original authorization, accounting and replay checks. R02 cultivation/breeding/randomness/module restrictions remain retained. Service-write checks do not substitute for on-chain enforcement. Actual council officers and per-domain controller restrict/release grants remain separate deployed acceptance.

## Equipment, lifecycle, land and rights

EquipmentCultivationBridge accepts only the actual plant grower/current canonical land operator, an owned/placed/unretired item and matching actual dependencies. Each update charges real lifecycle use and applies only that item's immutable six-control effects within CultivationEngine bounds. Breakage immediately disables the contribution; failure rolls back wear and environment atomically. No premium/wallet multiplier.

ManufacturedEquipmentIssuer pins an immutable reviewed recipe/output/type rule, accepts only the actual completed job owner, consumes that job's catalogue output through independently consented inventory operations, and issues one deterministic item/earning reference. Independent equipment-issuer authority remains revocable; failure rolls back output consumption and replay markers. Manufactured materials use the same InventoryRegistry/ResourceLedger as repair and recycling. Retained canonical lease/license admission tests share the actual CapabilityRegistry/HighCountryAuthorization/EmergencyState with LandRegistry/PlantRegistry. They exercise occupancy reference, restricted admission, revocation/non-eviction and terminal-only capacity release; retained term/expiry and handoff regressions complement those actual registry journeys. Updated emergency fixtures do not replace canonical plants with shadow counters.

## Treasury and Identity

CanonicalOrganizationTreasuryGateway binds only a permission contract naming this exact gateway. Its reviewed executor supplies independently accepted vault-release provenance. The gateway checks actual GameIdentity/active game, bounded organization permission, canonical TreasuryRouter executability, budget/policy and separately scoped TreasuryAuthorization. Permission consumption/disbursement execution are atomic; denial or revocation rolls back permission accounting. Execution is single-use.

The gateway holds no funds or allowances. Canonical Treasury retains its existing vault-release trust boundary. Actual funded vault movement and independent release receipts remain deployment/testnet acceptance; a fixture receipt is not proof of funded payment.

## Authenticated durable runtime

The composition uses the existing serializable BUDS namespace. Ed25519 issuer-signed sessions bind audience, game, principal, session, validity and durable revocation epoch. Privileged issuer/operator/admin permissions are configured per issuer AND principal; a signed ordinary login confers no financial operator role.

Wallet linkage uses one durable challenge binding origin/audience/chain/game/principal/wallet/nonce/expiry and link-only consent. Ethereum personal-message signatures use low-s EOA recovery or ERC1271. Current canonical GameIdentity and active game must independently agree. Unlink removes linkage/challenges while retaining ordinary registered internal balances; another principal cannot adopt the same wallet.

Gameplay rewards require independently source-signed short-lived envelopes with exact owner/wallet/game/chain/source/contract/objective/amount/epoch. Actual Mission claims or progression completion and reward metadata are read at finalized, code-hash-pinned EIP1898 anchors. Source/account epochs and wallet binding are rechecked in the credit transaction. Source revocation advances beyond the configured epoch, including nonzero deployment epochs. A canonical objective pays once regardless of changed envelope/signature/operation or source alias. Approved maximum/cumulative issuance caps are mandatory; production reward numbers are never guessed.

FinalizedRpc validates chain, configured runtime code hash, finalized header and canonical block-hash stability. Stale/reorged/unpinned/malformed replies fail closed; user-provided finalized flags are not authority. CanonicalRpcEscrowClient reads real state/logs behind that boundary. Deployment quorum/provider and consensus-finality policies remain independent operational acceptance.

composeSettlementRuntime binds logical principals to consented canonical addresses. Before external operator signing, it rechecks the durable intent, exact listing owner/asset/quantity, deterministic operation, designated operator, target/calldata/chain and zero native value. It holds no player keys. Intents retain verified immutable chain parties and their authorization epochs. New submissions require current matching bindings/epochs; finalized reconciliation and irreversible cancellation recovery use the durable parties even after unlink or revocation. Restarted workers preserve ambiguous holds and refund only irreversible cancellation. Canonical delivery already credits the on-chain inventory and creates no second spendable off-chain admission; resale requires a fresh verified escrow receipt.

Authenticated HTTP routes provide registration/link/unlink, reward, verified import/listing/prepare and operator reconciliation/revocation. Bounded bodies, origin checks, signed bearer sessions and sanitized failure states are mandatory. Contracts/sources come from protected configuration, never request JSON. Startup requires CA-verified TLS PostgreSQL and reviewed HTTPS origin; SIGTERM drains without discarding durable intents.

Migration 002_runtime_namespace_rls.sql enables role-named namespace isolation. Provisioning is separate. Runtime has SELECT/UPDATE only, without ownership, superuser/BYPASSRLS, insert/delete/truncate or schema mutation. Startup rejects unsafe privileges. Account bindings, nonces and epochs persist in the same serializable transaction state.

## Qualification and operational deferrals

Retained tests include real harvest/Cup/shared identity/attestation; manufacturing/material/lifecycle/cultivation; emergency recovery; and actual Treasury permission/budget execution. PostgreSQL checks concurrency, restart, nonce replay, least privilege and namespace isolation. A disposable actual Anvil + PostgreSQL + HTTP journey verifies EOA consent, canonical identity, claimed mission, BUDS, owner-approved escrow, operator signing, finalized receipt and restarted-worker settlement. CI wallets/catalogue amounts are fixtures.

All required jobs must pass one exact SHA. Genuine R07/R09 gates remain deployed code/address/grant manifests, production catalogues/issuers/signers, finality/reorg/quorum drills, funded Treasury/vault and independent identity/security approval, TLS/secrets/backup/failover and R07.5 replacement/migration/rollback rehearsal. Local success does not waive those gates or certify production readiness.

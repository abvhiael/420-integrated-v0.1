# High Country — R01.4 migration boundaries

Status: normative specification, Level 1. Existing contracts are foundations, not complete migration services. Sources: [HC-PA](HC-PA-PROGRESSIVE-ACCESS.md), [shared save migration](HC-GP-5-GUEST-MIGRATION.md), [architecture](ARCHITECTURE-AND-AUTHORITY.md), [types](TYPES-AND-UNITS.md), [scope](RELEASE-SCOPE.md), [audit](REPOSITORY-AUDIT-20261009.md). HC-PA.3 and HC-GP.5 remain separate flows; neither authorizes the other implicitly. R01.4 supplies consent, proof, eligibility, replay and recovery rules; production enforcement belongs to R02/R05.

## Common prerequisites: consent, proof and trusted source

Migration is optional, explicitly initiated by the player, and never required for core play. Explain selected objects/save revision, destination account/grower, public commitments, irreversible binding and separate asset effects before approval. Preserve the original save and allow cancellation before irreversible effects. Account linking, save migration and object canonicalization are separate consents; one does not authorize future unrelated assets or transfers.

Authenticate the conventional account and game scope. Guest source possession must be verified through a recoverable source credential/device secret or authenticated import challenge; possession of a copied save alone is not proof of ownership or earned progress. Wallet ownership requires a verified fresh challenge bound to game, service origin/audience, chain, verifying account/contract, source commitment, destination grower, selected manifest or payload, policy/schema version, nonce and expiry. Validate canonical SmartAccount provenance and its actual signature authorization; support canonical wallet signature semantics, not arbitrary self-reported views. Revoke/replay-protect consent nonces durably. Challenge/signature wire format is an implementation deliverable under R05, reviewed against the existing wallet protocol; no alternate wallet/signature scheme is created here.

The service validates source schema/units (R01.3), revisions, ownership and gameplay evidence under a named policy/ruleset. Client edits, unexplained resource/progression jumps, conflicting histories, duplicate lineage and fabricated results are rejected or quarantined. Guest-only unverified achievements cannot become championship proofs, shared balances or rewards. Anti-cheat proof is required for eligible promotion, never inferred from a hash. If evidence is insufficient, retain ordinary play/save and deny promotion with an explanation.

Trusted issuance policy is default deny: only reviewed eligible objects/payloads, approved source issuance records and exact destination scope can receive grants/claims. Store immutable source-evidence digest, policy/ruleset/schema, revision, target and consent record off-chain. Grant issuance/operator custody uses least privilege; the service never receives a player private key. Nonzero salted opaque commitments prevent direct conventional identifier exposure; publicly observable commitments may remain linkable, so consent must not promise anonymity. Raw saves, credentials, account IDs, email and device identifiers stay off-chain.

## A — HC-PA.3 guest-object manifest migration

Authoritative implementation: `contracts/src/highcountry/access/GuestProfileMigration.sol` and GrowerProfileRegistry. The account owning the existing grower profile must call claimProfile and consumeObject and must additionally hold `GUEST_MIGRATION_APPLY` under GUEST_MIGRATION with sourceProfileId scope. Permission is not granted merely by signing consent. Current contract checks the caller's grower ownership; it does not independently certify trusted manifest issuance or anti-cheat.

| State / transition | Actor and acceptance | Current guarantee / required delivery |
|---|---|---|
| SOURCE → VERIFIED | Service validates source possession, evidence, exact schema/revision and consent | Service policy missing; R05 |
| VERIFIED → APPROVED_MANIFEST | Trusted issuer approves eligible object list, root, policy and target; issues narrowly scoped capability | Issuer must bind approved root/target; source-scoped capability alone does not constrain root; enforcement R02/R05 |
| APPROVED_MANIFEST → PROFILE_CLAIMED | Grower account calls claimProfile(sourceProfileId, growerProfileId, manifestRoot, policyVersion) | Nonzero IDs/root/policy; profile exists/caller owns; one source↔one grower |
| PROFILE_CLAIMED → same claim | Same account, grower, root and policy | Exact replay returns false; conflicting replay rejects |
| PROFILE_CLAIMED → OBJECT_CONSUMED | Claimed account calls consumeObject with exact eligible proof/payload | At-most-once source/object key; malformed/wrong proof rejects; no asset mint |
| OBJECT_CONSUMED → CANONICAL_EFFECT_RECONCILED | Actual destination registry accepts exact immutable proof/receipt and unique operation | Not implemented; must prevent duplicate mint and stranded consumption |
| pre-claim → CANCELLED | Player cancels consent; issuer revokes unused grant | Off-chain policy; no claim reset contract path |

CanonicalObjectKind ordinals 0..8 are REGISTERED_CULTIVAR, SIGNIFICANT_GENETIC_LINEAGE, CHAMPIONSHIP_RESULT, MARKETPLACE_ASSET, TRANSFERABLE_SEED_OR_CLONE, CROSS_GAME_ASSET, ECOSYSTEM_REWARD, SIGNIFICANT_ACHIEVEMENT, LICENSING_RIGHT. Eligibility vocabulary is not a promise to promote every local object. Ordinary equipment, common inventory, ordinary progression and raw saves are not manifested canonical assets.

The exact leaf is keccak256(abi.encode("HC.PA.MIGRATION.OBJECT.V1", sourceProfileId, objectId, kind, payloadHash, policyVersion)). The consumed key is keccak256(abi.encode(sourceProfileId, objectId)); changing kind/payload cannot reuse that source/object. Proof pairs are sorted bytes32 and hashed with abi.encodePacked. Preserve these existing encodings. Local account identifiers must not be used directly as sourceProfileId. A registry/chain deployment namespace and service-global source/object issuance key are required to prevent alternate-registry/cross-chain promotion replay; V1 leaf itself does not include chain or registry.

The account-only consumeObject interface means a destination engine cannot simply call it as the player. Do not invent an atomic engine integration. R02 must implement a reviewed canonical wallet batch with atomic consume+destination effect where compatible, or an immutable consumed-receipt/destination deduplication protocol with recovery. Until then consumption alone must not be presented as successful asset creation. No new manifest/root amendment, profile rebinding or reset is allowed by V1; corrections require a reviewed future migration design, not overwriting the claim.

## B — HC-GP.5 shared save-claim migration

Authoritative implementations: `contracts/src/gaming/GameClaims420.sol`, `contracts/src/highcountry/player/HighCountryGamingBridge420.sol`, `contracts/src/highcountry/player/HighCountryMigration420.sol`. The shared profile/claim and HC grower binding are not the HC-PA object manifest.

| State / transition | Actor and acceptance | Recovery / rejection |
|---|---|---|
| SOURCE → PREPARED | Authenticated service verifies source/consent, immutable revision, commitments and target | Persist durable unique source revision/target operation; conflict rejects |
| PREPARED → CLAIM_ISSUED | Active game's canonical operator issues exact target/commitments/expiry | Unknown/duplicate claim ID rejects; lost response reconciles chain before reissuing |
| CLAIM_ISSUED → CONSUMED | Target wallet directly consumes; shared game profile exists | Wrong account, cancelled, already consumed or expired rejects |
| CLAIM_ISSUED → CANCELLED/EXPIRED | Operator cancels unconsumed claim or time passes | No save apply; never cancel consumed claim |
| CONSUMED → BOUND | Account with bound HC/shared profile calls bindConsumedMigrationClaim with exact payload | Other game/account/payload or already bound rejects |
| BOUND → APPLY_PENDING | Worker verifies finalized chain state and exact source/payload/destination | Stale/reorg/unknown chain blocks application; preserves source |
| APPLY_PENDING → DB_APPLIED_RECEIPT_PENDING | One DB transaction applies destination once, creates durable outbox and immutable operation row | Unique claim key and source key across all replicas; crash retries read same result |
| DB_APPLIED_RECEIPT_PENDING → RECEIPT_SUBMITTED | Authorized service calls markApplied for exact claim/grower/commitments | No duplicate save effect; query receipt after timeout before resubmit |
| RECEIPT_SUBMITTED → COMPLETE | Finalized receipt and durable DB record agree | Reorg enters reconciliation; no automatic second apply |

Source guest commitment: keccak256(abi.encode(keccak256("420/HC/GUEST_STATE/V1"), guestAccountCommitment, uint64 saveRevision, stateHash)). Payload commitment: keccak256(abi.encode(keccak256("420/HC/MIGRATION_PAYLOAD/V1"), guestStateCommitment, uint64 growerProfileId, uint32 schemaVersion, payloadBodyHash)). Preserve ABI types/order/domain. `highcountry-state-v1` is a transport label; the numerical claim schemaVersion must be an explicitly versioned registry mapping, not a string cast. Serialization/stateHash/payloadBodyHash encoding must be frozen with cross-language golden vectors before production issuance (R05). Unknown versions fail closed.

GameClaims validUntil=0 means no expiry; production issuance policy requires a bounded positive expiry. Exact block.timestamp==validUntil is currently consumable; later time rejects. Expiry is checked on consumption, not HC binding/receipt of a legitimately consumed claim. No new post-consumption expiry is invented. markApplied rejects repeat receipt with MigrationAlreadyApplied; it is at-most-once, not an idempotent successful return. Workers treat matching finalized receipt as reconciled success, mismatched receipt as quarantine. Nonzero claim/grower/commitments, exact bridge binding, consumed/noncancelled HC claim and capability scope claimId are required.

## Replay, concurrency and recovery policy

Durable keys include chainId, canonical registry/contract, gameId and claimId; additionally reserve source identity+revision+target and canonicalizable object identity across issuance so alternate claim IDs cannot repeat economic effects. All retries validate identical commitments/versions/target. Database unique constraints, transactional row locking or equivalent atomic compare-and-set protect multi-instance application; process-local Maps cannot provide this.

No atomic DB/chain transaction is claimed. Apply exactly once in a DB transaction and publish a durable outbox; finalized receipt reconciliation follows. If consumption/binding reorganizes before apply, pause without effects. If reorganized after DB apply, quarantine dependent canonical effects and reconcile the same operation under policy; do not delete/compensate already-spent assets blindly or issue another claim. Receipt-only reorg retries the same outbox after prerequisites return. Unexpected chain/DB disagreement requires operator investigation, immutable audit trail and an approved recovery; no discretionary duplicate mint or reassignment. Preserve original save backup and expose pending/recovery state to player.

Unlinking/revoking off-chain consent stops future preparations/issuance and revokes unused grants where possible; it cannot reverse consumed claims, immutable profile binding or existing canonical ownership. Recovery never substitutes a different wallet/grower silently. Bound retry attempts/backoff; dead-letter persistent failures and notify operator without logging secrets or raw saves. Indexer queries are projections; privileged decisions require canonical finality hooks.

## Required adversarial acceptance and existing gaps

| Scenario | Required result / qualification owner |
|---|---|
| Copied save, forged wallet/source proof, expired/reused nonce, wrong account/game | Deny issuance/promotion; R05 authentication tests |
| Invalid schema/unit, edited progress, fabricated championship, unknown object class | Retain save; deny canonicalization; R02/R05 |
| Changed root/policy/payload, duplicate object/source/claim | Contract replay rejection plus durable global issuance constraints; R02/R05 |
| Wrong proof/target/grower, zero identifiers/commitments, cancelled/unconsumed claim | Fail closed; existing contract regressions retained |
| Crash at DB commit/outbox/broadcast, concurrent replicas, duplicate job delivery | One save application/economic effect; matching receipt reconciliation; R05 |
| RPC timeout, stale adapter finality, reorg before/after apply, receipt mismatch | Pause/quarantine/reconcile same operation; no silent success; R05/R09 |
| Cancel/disconnect/unlink | Core play preserved; irreversible effects explained; no forced wallet use; R06 |

Current service only implements prepared/claim-issued/consumed process-local records and caller-supplied wallet links. It lacks authenticated source proof, durable constraints/outbox, apply/reorg recovery. Current object registry lacks approved-root issuer enforcement and downstream atomic effects. These remain implementation gaps, not R01.4 specification omissions or accepted security risks.

R01.4 exit criteria: both distinct state machines, caller/issuer/service permissions, consent/ownership verification, eligibility and anti-cheat, exact replay domains, expiry/cancellation and crash/reorg recovery are defined above. Qualification checks source/document agreement and retained boundary regressions; no production service guarantee is inferred. Level 2 remains R01.7; Level 3 remains app-phase closeout. Next: R01.5 — Deployment and trust.

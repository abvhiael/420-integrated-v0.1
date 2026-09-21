# CMP-0.2 — Canonical ComputeJob schema and validation contract

Status: **SPECIFICATION INCREMENT — schema defined for implementation; contracts, ABI and end-to-end runtime NOT implemented or certified by this document.** Inspected source baseline `main` `277395931f5419af0728f3ea801800401a8bb336`; drafted on `feature/cmp-0-protocol-specification`. Follow the [frozen ComputeMarket V1 architecture](../420-COMPUTE-MARKET-V1-ARCHITECTURE.md), [CMP-0 protocol overview](CMP-0-PROTOCOL-SPECIFICATION.md) and [CMP-0.1 source/integration audit](CMP-0.1-SOURCE-AND-INTEGRATION-AUDIT.md). The roadmap names CMP-0.2 *canonical job schema*: the earlier overview's heading `CMP-0.2 — Deterministic work-unit identity` is an internal section-number mismatch, **not** authorization to skip the job schema. Work-unit identity is roadmap CMP-0.3, signed manifests CMP-0.4. No fixed Genesis address, custody contract, registry publication or operational integration is created by this specification.

## 1. Authority and normalized data model

A canonical `ComputeJob` is **one execution commitment against exactly one canonical request and one immutable accepted match**, not a re-labeled AI job or Resource Protocol session. Each field has one authoritative owner. Preserve frozen canonical statuses `CREATED`, `FUNDED`, `MATCHED`, `ACCEPTED`, `RUNNING`, `RESULT_COMMITTED`, `VERIFIED`, `SETTLED`, and exceptional `CANCELLED`, `EXPIRED`, `FAILED`, `DISPUTED`, `REFUNDED`. Do not add scheduler sub-states or allow an arbitrary setter. `CREATED` may exist before a match; therefore a job must not carry a fabricated nonzero match/provider/resource/beneficiary before matching. References that become bound at a later transition are **write-once**, not mutable throughout the job lifecycle.

**Canonical identities and field ownership:**

| Logical item | Canonical authority | Job representation / invariant |
| --- | --- | --- |
| `jobId` | ComputeJobRegistry420 | Nonzero, unique, domain-separated ID for exactly one job. Bind registry/chain/schema in the later CMP-0.3 typed-ID spec; no arbitrary caller-chosen collision. |
| `requestId`, `requester`, `payer`, `workloadClass`, `inputCommitment`, `resourceRequirementId`, `maxAuthorizedSpend`, `deadline`, `privacyPolicyId`, `verificationProfileId`, provider/resource constraints, `fundingRef` | ComputeRequestRegistry420 and its authorized funding record | Store immutable nonzero `requestId` in job and resolve/request-snapshot a canonical **revision or commitment** to stop later reinterpretation. Requester and payer may differ **only with explicit independently authorized payer funding**. Never use AI `create()`'s unbounded legacy max-spend as the new CMP payer approval. |
| `matchId`, `offerId`, `providerId`, `resourceId`, accepted pricing policy/version and quote, SLA/profile, verifier selection, provider settlement beneficiary | ComputeMatch420 with offer/provider/resource registries | `matchId` starts unset and becomes write-once at `MATCHED`; bind accepted-match immutable commitment. Beneficiary is derived from accepted match and the authorized provider settlement profile at acceptance, **never supplied by a settlement caller**. |
| `manifestHash`, `outputSchemaHash`, runtime/profile, partition-plan reference, `replicationFactor` | Requester's signed/versioned execution manifest and accepted request/match | Commit nonzero execution manifest and output schema before match/paid acceptance; preserve immutable digest and accepted partition/replica limits. Exact manifest encoding/signature is CMP-0.4, work-unit encoding CMP-0.3; do not accept placeholder bytes as evidence that either has been verified. |
| `fundedAmount`, `reservedAmount`, `earnedAmount`, `refundableAmount`, `asset`, `vaultId`, `obligationRef` | Verified custody/authorization record and ComputeSettlement420 with registered 420Vault | Economic amounts are derived from **actual** funded/reserved Vault balance, not user-reported or AI-facade callbacks. Native `$420` uses asset `address(0)` as the inspected Vault implementation does. All debits and refunds are bounded by prior authorization and unique obligation IDs. |
| `resultCommitment`, `resultManifestHash`, `receiptRoot`/receipt reference, `verificationOutcomeRef`, `disputeRef`, `settlementId` | ComputeReceiptRegistry420, ComputeVerificationRouter420, ComputeDispute420, ComputeSettlement420 | Set only at the corresponding authorized transition; never infer correctness merely from a provider-signed receipt. Store minimal commitments, not raw private data, keys or URLs with secrets. |
| `status`, `createdAt`, `updatedAt`, `acceptedAt`, `completedAt` (where relevant), `revision` | ComputeJobRegistry420 | Deterministic state transition provenance and one-way lifecycle; timestamp fields are **observations**, not inputs to IDs, signatures or accepted price. |

Names above are **logical schema fields**, not assertions that proposed `contracts/src/compute/` Solidity modules, public mappings, ABIs or deployed instances already exist. Implementations may store immutable snapshots or validated references, but MUST NOT maintain two independently writable sources for the same economic or identity fact. Any referenced request/match/policy revision that can later change must be snapshotted or committed by immutable digest at binding.

## 2. Proposed canonical contract-facing shape

The following is a **reviewable schema target, not an existing Solidity ABI**. Use typed IDs (`bytes32`) for canonical identifiers; use `uint256` for payment accounting to avoid truncation; `uint64` for bounded deadlines/timestamps with checked conversions; `uint32` for version/revision; and a closed `Status` enum matching the frozen V1 lifecycle. If an implementation uses narrower amounts, prove the conversion is safe before accepting funds or metered receipts.

```solidity
// Normative logical layout; do not copy as a production ABI without CMP-0.2 review/tests.
struct ComputeJobCore {
    bytes32 jobId;
    bytes32 requestId;
    bytes32 requestCommitment;
    bytes32 manifestHash;
    bytes32 outputSchemaHash;
    bytes32 partitionPlanCommitment;
    uint32 schemaVersion;
    uint32 replicationFactor;
    uint64 createdAt;
    uint64 deadline;
}
struct ComputeJobBindings {
    bytes32 matchId;             // zero until MATCHED; then permanently bound
    bytes32 matchCommitment;     // zero until MATCHED; immutable thereafter
    bytes32 fundingRef;         // nonzero only after real custody verified
    bytes32 vaultId;
    bytes32 providerObligationRef;
    bytes32 refundObligationRef;
    bytes32 resultCommitment;
    bytes32 resultManifestHash;
    bytes32 receiptCommitment;
    bytes32 verificationOutcomeRef;
    bytes32 disputeRef;
    bytes32 settlementId;
}
struct ComputeJobAccounting {
    address asset;               // address(0) for native $420
    uint256 authorizedMaximum;   // request/payer approved upper bound
    uint256 fundedAmount;       // proved deposited/reserved, not a callback claim
    uint256 earnedAmount;
    uint256 refundableAmount;
}
```

Do not read unbound zero references as valid identities; the job implementation MUST expose a separately validated presence/status or tightly constrain when each reference can be read. If an actual request uses `bytes32(0)` as a deliberate *optional* privacy/policy selector, the policy must say so explicitly; required job ID, request ID, manifest hash, input commitment, resource requirements, workload class and version may not silently default. `replicationFactor >= 1` with a policy-defined upper bound and sufficient aggregate authorized spend; zero or unchecked multipliers are invalid.

## 3. Validation gates at creation, funding, match and execution

**Create (`CREATED`):** authorized requester; unique nonzero domain-bound `jobId`/`requestId`; supported nonzero schema/workload version; canonical request exists and is still eligible; nonzero immutable request/manifest/input/output/partition commitments; supported resource/verification profiles and privacy policy; nonexpired bounded deadline; positive explicit maximum; valid replication limit and partition bounds. Capture request revision/commitment and prevent a mutable external request from changing accepted semantics. Reject unknown manifests and inputs that only claim validity without verifiable signature/version policy once CMP-0.4 is implemented. A request creation is **not** a funding event.

**Fund (`FUNDED`):** independent payer authority for a concrete asset, Vault, job and upper bound; verify registered Vault address/code and actual native-asset deposit or exact token transfer, unique funding/obligation reference, sufficient unencumbered balance and per-job reservation, and atomic confirmation/replay rules. `0 < fundedAmount <= authorizedMaximum`; repeat funding cannot double-count, replace the payer or widen the maximum without a separately authorized bounded action. Frozen `AIJobEscrow` confirmation is not actual Vault custody. If the full funding/invariant proof is unavailable, remain unfunded and do not dispatch paid work.

**Match (`MATCHED`):** one authorized immutable match bound to this exact funded request, its pinned revision/manifest, active qualified provider/node/resource, currently effective compatible offer, eligible service capacity and expiry, committed beneficiary, accepted price/SLA/verification versions and quote `<= fundedAmount <= authorizedMaximum`; aggregate partition/replica worst-case spend is inside that quote. No scheduler can override participant constraints or substitute a later policy version. Reject a second match, mismatched provider/offer/resource, expired offer, revoked capability or post-acceptance beneficiary change. Unmatched jobs have no payable provider entitlement.

**Accept/start (`ACCEPTED`, `RUNNING`):** only a specifically authorized, still-eligible provider/node/resource principal can accept, with deadline, funding reservation, signed execution manifest, verifier compatibility, resource availability and accepted match still valid. The frozen transition matrix and suspension/emergency policy determine the safe effects of changes *after* acceptance; they cannot rewrite the immutable match or confiscate accrued funds. Worker execution is off-chain and never blocks `fourtwentyd` consensus or the `node420` EVM engine.

**Commit/verify/settle:** require authorized receipt/attempt and committed output bound to the exact job/match/manifest, nonreplayed monotonically metered units, and the preaccepted verification profile. Evidence of execution is not automatically correctness. Enforce one settlement entitlement per authorized unit/replica, terminality, and `earnedAmount + refundableAmount <= fundedAmount <= authorizedMaximum`; for a finalized economic closeout, account for the entire funded amount as actual earned payout, payer-bound refundable value, or still-secured amount with a documented resolution path. Released Vault obligations become claimable only to their recorded beneficiary; cancelling one merely restores Vault free balance and does **not** send a refund to the payer. A split payout/refund requires separately proven beneficiary-specific custody paths and reconciliation.

**Exceptional paths:** cancellation, expiry, failure and dispute must be actor/policy-scoped, preserve existing reserved balance and payer refund rights and never reopen a terminal job. `DISPUTED` requires its own bounded outcome path, not a free-form state setter. Exact transitions and post-dispute terminality belong to CMP-0.7; settlement claim/refund operation ordering to CMP-0.8; signed receipts and verifiers to CMP-0.9; objective slash/arbitration to CMP-0.10.

## 4. Deterministic commitments and compatibility handoff

Commit the immutable job core with an explicit **versioned domain** containing `block.chainid`, the verified ComputeJob registry instance and `schemaVersion`; encode fixed-width fields using a single published typed ABI encoding, **not** JSON, concatenated strings, mutable block timestamps or off-chain scheduler identifiers. The request and match commitments must themselves bind their exact typed field order and version. Domain migration or accepted-field changes require a new version and explicit compatibility rules; the later CMP-0.3 and CMP-0.4 phases will publish concrete type hashes, computed vectors and two independent implementation fixtures. No claim of finalized hash vectors is made here.

420AI's fixed AI job, provider, escrow and reputation IDs remain separate compatibility identities; an AI-to-CMP adapter must prove a one-to-one bounded mapping to canonical CMP request/job/provider and independently verify both state machines. Resource Protocol sessions/receipts are not aliases for CMP matches or signed compute receipts. Service discovery via ProtocolRegistry is separate from action authority via CapabilityRegistry; registering a Compute service does not confer Vault, settlement, governance, consensus or wallet permissions. CMP contracts get no new frozen Genesis system address; require verified deployment, runtime codehash and authorized registry publication.

## 5. Required executable contract tests before declaring CMP-0.2 implementation qualified

1. Creation accepts only valid versioned request/manifest/partition commitments and one `jobId` per request according to an explicitly tested cardinality policy; rejects zero/reused IDs, invalid version, missing/expired input, incompatible privacy/verification, zero/deadline overflow and unbounded budgets.
2. Request revisions and accepted match economic terms cannot drift after job binding. Later provider metadata, settlement address or pricing changes cannot redirect an accepted beneficiary or raise the accepted quote.
3. Unfunded jobs cannot match or execute; fake escrow callbacks, false Vault balances, cross-job reservation references, duplicate deposit/obligation IDs and unauthorized payer grants fail closed.
4. Mismatched request/offer/resource/provider, expired capability/offer, ineligible stake/security configuration, provider suspension at acceptance and unsafe replication/partition budget arithmetic revert.
5. Every allowed state edge and unauthorized/duplicate/invalid edge is tested, including cancellation, expiry, failure, disputed resolution, emergency stops, terminal replay and identical events/status provenance.
6. Provider payout, payer refund, partial earnings and zero earnings conserve actual Vault funds. A cancelled obligation is not incorrectly treated as transferred; no unrelated withdrawal can spend a payer's freed balance; frozen/winding-down custody preserves authorized claims.
7. Run cross-language type/ABI/hash vectors after CMP-0.3/0.4 freeze, Foundry and application integration tests after implementation, plus docs and full-repository checks on **the exact final PR head**. Green CI for this documentation-only increment is not proof of a deployed job registry or functioning paid compute.

## CMP-0.2 closeout boundary

This phase freezes **the logical field ownership, binding moments, validation rules, accounting limits and downstream test obligations**. Concrete ABI/typehash vectors, deterministic work-unit identity, signed execution manifests, deployed contracts, real adapters, live worker routes and end-to-end paid settlement remain separate implementation gates. No existing AI/Resource/Vault unit test is being represented as a new CMP integration test.

# CMP-1.1 — ComputeJobRegistry: implementation and qualification

Authority: original `CMP-1-IMPLEMENTATION-ROADMAP.md`. PR #370 remains CMP-1.1. Do not conflate green CI or the prior experimental foundation PR #369 with production acceptance.

## Registry-local implementation

`ComputeJobRegistry420.sol` creates one unique job per request, binds immutable manifest/workload/input/output commitments and owner, validates state/revision and calls externally configured evidence authorities for funding, accepted matching, worker assignment/results and verifier decisions. Its original `ComputeJobRegistry420.t.sol` tests use explicit TEST-ONLY permissive fixtures for later-stage evidence, not production proof.

## CMP-1.1.1 signed request/manifest authorization

`ComputeJobSignedRequestAuthority420.sol` is the signed production-candidate replacement for the earlier `ComputeJobRequestAuthority420.sol` on-chain-only legacy request authority. Configure the signed authority, **not the on-chain-only legacy authority**, as `ComputeJobRegistry420.requestEvidence` for signed-manifest jobs. The registry calls `validRequest` inside `createJob` before it allocates a job ID; the signature-authenticated authority matches the exact authenticated owner, request ID/digest, manifest hash, workload, input, output schema and deadline, and denies expired authorizations. The registry also rejects reuse of a request ID.

The signed EIP-712 authorization fixes the typed-data domain to `420 Compute Request` version `1`, `block.chainid` and the verifying authority contract address. It hashes the exact owner, payer, manifest, workload, input and output-schema commitments, job deadline, authorization expiry, positive max spend, and owner-scoped nonce. At registration both the owner **and the named payer** must authorize precisely that digest; the authenticated owner submits the registration. Canonical EOA ECDSA signatures (27/28 and low-s) and ERC-1271 smart-account signatures are supported. Owner-scoped nonces are consumed on valid registration, and no second signed request can use the same nonce. `fundingTerms(requestId)` exposes the immutable payer and maximum *authorized* spend for the future canonical escrow integration; these values are authorization constraints, **not a proof of deposit, reservation or actual spend**. The `manifestHash` is the signed hash commitment to the off-chain manifest bytes; the contract does not parse or certify those bytes or independently attest the workload.

`ComputeJobSignedRequestAuthority420.t.sol` covers successful signature admission and registry creation, altered manifest/workload/creation fields, changed payer or max spend, missing payer consent, non-owner submission, expired authorization/creation, duplicate signatures and job creation, and chain/contract domain replay. Qualification requires the Solidity Contracts, 420 Integrated Qualification and 420Docs runs on the same **final** head. No signed authority has been deployed or activated by this PR.

## Concrete funding progress — not admitted

`ComputeJobVaultReservationEvidence420.sol` is a read-only adapter for active escrow-type instances in `VaultRegistry420` and `VaultAccounting420`: owner, job, asset, beneficiary, obligation, minimum amount and reserved balance. Existing Vault deposits are pooled at vault level, so a Vault creator and reserved obligation do not prove which payer deposited money. This adapter MUST NOT be configured as the sole production funding evidence. `fundingRef` is an obligation ID, not payer authorization. No production escrow is deployed here.

## Remaining CMP-1.1 integration and release gates

1. **Payer-specific custody (CMP-1.2 dependency):** canonical $420 deposit authorization and a job-isolated reservation bound to the authenticated payer, exact job and accepted maximum spend, transfer provenance, refund recipient, available and reserved balances, replay and timeout/refund/dispute protections. Enforce `fundingTerms` against real custody records; the signed ceiling by itself does not enforce token movement. Do not allow paid execution without the qualified funding source.
2. **Worker and accepted match (CMP-1.3 dependency):** independently authorized accepted match and locked provider/node/resource/attempt, currently eligible operator, authenticated signed execution receipts and replay protection. The current worker gateway validates operator plus job-scoped capability, not hardware or accepted-match truth; test fixtures must not qualify a real match.
3. **Independent verifier (CMP-1.4 dependency):** approved profile and independent selection, job/attempt/result/profile/nonce/expiry-bound signed verdicts, decision provenance and conflict-of-interest protections. The current gateway checks distinct worker/verifier identities and capabilities but cannot prove computational correctness.
4. **Closeout:** real-source positive and hostile cross-job/cross-owner/replay tests, failure/expiry/dispute custody-safe transitions, final qualification on the reconciled PR head and an explicit production admission/deployment decision. No settlement authorization or published production job-registry endpoint until all dependencies are proven.

**Status:** signed-request source and tests are committed on PR #370; other integration and production admission gates remain open. The PR remains draft and unmerged. Preserve original CMP-1.1 through CMP-1.5 responsibilities; do not fabricate escrow, worker registries or verifier authorities to bypass these gates.

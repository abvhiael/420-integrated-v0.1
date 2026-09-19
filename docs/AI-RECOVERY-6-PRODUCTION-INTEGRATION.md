# AI-RECOVERY-6 — production integration and settlement qualification

Last reconciled: **2026-09-19**. Scope: PR #348, branch `ai-compute-recovery-v1`.

**Status: IN PROGRESS — partial 6.1–6.4 implementations have passed CI; neither phase 6 nor the complete AI recovery is production-qualified.** At commit `ab08c093f7d2f59d0728e03c00b6e6335ce35935`, all 12 PR-triggered GitHub Actions workflows passed, including AI Provider Runtime, Solidity, Integrated Qualification, AI Read API, AI Web, Docs, two Indexer runs, Developer Hub and three Wallet checks. These are build/unit/regression results for that commit, **not** evidence of funded testnet jobs, deployed model hosting, secure key management, real Vault transfers, dispute resolution or released websites. Any later commit requires its own CI check. PR #348 remains a draft, not merged to `main`.

## At-a-glance status and dependencies

| Workstream | What is implemented and CI-tested | What is still required to close it |
| --- | --- | --- |
| **6.1 Provider transactions and lifecycle** | `420-ai-provider/src/qualified-transactions.ts` enforces canonical preflight constraints via an injected external executor; runtime unit tests pass. | Independently qualified signer/authorization, receipt and finality verification, durable recovery of commit-to-receipt failures and testnet evidence. |
| **6.2 Canonical RPC state** | `420-ai-provider/src/canonical-rpc.ts` reads five AI/Compute contracts at a confirmation-pinned block and rejects chain/identity/state mismatches; its tests pass. | Trustworthy ProtocolRegistry/deployment resolution, contract bytecode identity, verified RPC/finality/reorg policy, and live executor integration. |
| **6.3 Private transport and serving** | `420-ai-provider/src/private-payload.ts` provides AES-256-GCM job/provider-bound opaque payload storage adapter, access/expiry/size and input-commitment checks; its tests pass. | Authenticated production object store and KMS, client-side input provisioning, authorized output retrieval, signed deployment/model manifest, immutable model-version/runtime checks, actual inference backend and private testnet E2E. |
| **6.4 Vault funding and settlement** | `420-ai-provider/src/vault-reconciliation.ts` provides a read-only funding/paid evidence gate with unit tests and passing provider CI. | Independently verified canonical Vault evidence reader, Wallet-approved deposits, governance-bound Vault/settlement adapters, real reservation/claim and separately authorized refunds, partial-payment rules, replay/reorg tests and funded testnet E2E. |
| **6.5 Trust and verification** | Underlying protocol contracts and earlier recovery foundations exist; no completed production verifier integration is evidenced here. | Independent policy-specific 420Trust/verifier route, commitment-bound evidence, challenge/dispute/appeal decisions and settlement holds; tests and testnet proofs. |
| **6.6 User and operator integration** | AI Web and AI Read API CI pass; this does not mean the public AI application or Wallet writes are deployed. | Wallet-confirmed AI request/funding writes; safe lifecycle UX; qualified provider operations, privacy-safe telemetry and runbooks; browser and testnet integration. |
| **R7 End-to-end launch qualification** | Not yet demonstrated. | Testnet full successful, invalid, disputed and refunded job paths, independent audit, deployment manifests, failure/reorg drills and release gates. |

**Current engineering priority:** finish **6.4's source-of-truth chain-backed Vault evidence and real settlement**, while completing 6.1–6.3 prerequisites in parallel. Do not jump to 6.5 or activate paid flows on the strength of green CI alone. The numbered phases identify work packages, not a claim that each preceding package is finished.

## 6.1 External provider transaction boundary — partially implemented; unit/CI qualified

`420-ai-provider/src/qualified-transactions.ts` supplies `QualifiedProviderTransactions420`, a `ProviderTransactionPort420` implementation. It delegates execution to an injected `QualifiedComputeExecutor420` and does not own signer secrets, send raw transactions, or take custody of user funds.

Before every state-changing operation it reads canonical AI/Compute work, validates active/staked AI provider state, provider/job/request bindings, expected Compute job state, chain ID, operator identity, and bound Compute contract addresses. Only the current Compute operator is allowed by this adapter; delegated provider execution remains disabled until its on-chain scope is independently qualified.

The executor is an **external security-critical dependency**, not merely an HTTP receipt source. A production executor must independently derive the `msg.sender` authority from canonical ComputeProviderRegistry/ComputeAuthorization state, simulate against the selected chain and verified deployment, obtain an approved signer authorization, submit the exact encoded target/method/arguments, wait for a successful canonical receipt under the configured finality policy, then return chain/target/hash evidence. A `confirmed: true` assertion from an untrusted service is insufficient. The adapter's injected interface is not itself a deployed signer or full cryptographic receipt verifier.

Receipt submission derives `canonicalReceiptId` using the actual on-chain ComputeReceiptRegistry, checks that `lastSequence`, `lastReceiptId`, cumulative units, and charge are all zero, and refuses second-final-receipt attempts until canonical reconciliation. Output manifest must already match the committed Compute job. Receipt charge may not exceed AI maximum or Compute funding. These checks do not replace on-chain authorization or accounting.

**Critical retry gate:** A RUNNING job that successfully committed output but failed receipt submission must never rerun inference blindly. Persist a privacy-safe pending receipt, reload canonical ComputeJobRegistry and receipt head and submit the *same* commitment-bound receipt idempotently. Existing `AIProviderRuntime420.process()` returns WAIT for jobs no longer RUNNING; a separately qualified recovery path is required before production.

## 6.2 Canonical RPC and qualified executor — read adapter implemented; broader gate open

`420-ai-provider/src/canonical-rpc.ts` implements read-only `CanonicalRPCState420` using ABI-specific reads of AIJobManager, AIProviderRegistry, ComputeJobRegistry420, ComputeRequestRegistry420 and ComputeProviderRegistry420. Reads use a shared confirmation-pinned block; the adapter rejects unexpected chain IDs, insufficient confirmation depth, wrong job/request/provider/operator bindings, unverified supplied Compute addresses and a changed block hash during hydration. Frozen AI predeploys remain `0x042f` and `0x0431`.

The caller must supply Compute addresses **already authenticated** by ProtocolRegistry or an approved signed deployment manifest. This adapter does not itself resolve the registry, independently authenticate deployed bytecode/proxies, prove chain-specific finality or implement the qualified signer. Implement and test those capabilities with adversarial RPC/reorg/chain-swap fixtures before enabling operator writes. A block-hash check is defense in depth, not standalone finality proof.

## 6.3 Storage/private-payload transport and model serving — encrypted adapter implemented; production path open

`420-ai-provider/src/private-payload.ts` supplies AES-256-GCM job/provider/purpose-bound envelopes with opaque object references, input commitment checks, authorization callback, expiry and bounds. Unit tests cover corruption, denial, expiry and commitment mismatch. Details and remaining controls: [AI-RECOVERY-6-3-PRIVATE-PAYLOAD.md](AI-RECOVERY-6-3-PRIVATE-PAYLOAD.md).

Deliver authenticated short-lived object access, independently enforced storage ACL/KMS key release, secure client input encryption, policy-bound output decryption, no secret/plaintext logging, signed provider/deployment manifests, and an actual model-serving backend that checks the immutable registered model version, artifact commitment and compatible runtime profile. Do not accept arbitrary HTTP input refs or redirects. Prove a private input→inference→authorized result testnet flow before closing 6.3.

## 6.4 Funding/Vault settlement — read-only reconciliation implemented; money movement open

`420-ai-provider/src/vault-reconciliation.ts` now checks funding escrow against a dedicated Vault obligation and checks a reported payment against claimed-obligation/withdrawal evidence. **This is an injected read-only evidence interface, not a chain-authenticated reader or a transaction executor.** Exact guarantees and limitations: [AI-RECOVERY-6-4-VAULT-RECONCILIATION.md](AI-RECOVERY-6-4-VAULT-RECONCILIATION.md).

`AIJobEscrow.fund()` always reverts; only the governance-bound Vault adapter may call `confirmVaultFunding` after a real user-approved deposit and dedicated reserved obligation. `AIJobEscrow.markClaimable`, `markRefundable`, `release` and `refund` modify entitlement/manager state but **do not transfer funds**. Real transfers must occur via authorized `AssetVault420`/`VaultAccounting420` obligation, claim or separate payer refund routes; reconcile exact asset, job, payer, provider ID, beneficiary, vaultRef, fundingRef, obligation/operation IDs, amount and settlementRef with canonical receipts and finality. Never report “paid” based only on an escrow `CLOSED` state.

**6.4 next executable sequence:** (1) Implement a chain-ID/deployment/code-verified, finalized-block Vault evidence reader that proves obligation plus successful event/receipt bindings and rejects mismatched emitters, cross-job references, reorgs and duplicate operations. (2) Add Wallet-approved deposit/authorization and a governance-bound, non-custodial adapter that reserves the exact job obligation before funding confirmation. (3) Implement authorized provider claim and separately accounted payer refund/cancellation, including partial charge/unused balance and idempotent escrow transitions. (4) Run successful, underfunded, duplicate, reverted, wrong-recipient, wrong-asset, cross-job, dispute-hold and reorg testnet flows. Keep paid AI requests disabled until all steps qualify.

## 6.5 420Trust and outcome verification — pending integration

Bind evidence to Compute job, model/version, verifier profile and receipt/result commitments. Provider signatures establish attribution, not factual truth. The authorized verifier route may call `ComputeJobRegistry420.markVerified` only after its profile-specific policy passes; a provider daemon or read API must never self-verify. Dispute, failed-verification and appeal paths must block premature settlement; document clear outcomes and authorized release/refund conditions.

## 6.6 Browser write integration and operator operations — pending integration

Wire Wallet-confirmed AI request creation, bounded Compute request/funding, canonical provider match and lifecycle inspection without storing signing secrets in `ai/web/` or enabling `features.writes` prematurely. A passing AI Web workflow does not prove the application is deployed or usable. Add provider supervision, readiness/health and privacy-safe metrics, retry/reorg/drain drills, funding and verification status UX and testnet operator runbooks.

## R7 — end-to-end release qualification (not started as an evidenced integrated test)

On a pinned, documented 420 testnet deployment, exercise user-approved deposit→Vault obligation→AI/Compute request and match→provider accept/run→private inference→commit→single canonical receipt→independent verification/challenge→actual claim or separately authorized refund. Verify contract addresses/code, signed manifests, finality, reconciliation and recipient balances throughout. Repeat across cancellation, expiry, dispute, failed model execution, signer failure, storage/KMS denial, duplicate submission and reorg. Perform security review and an operational rollback/drain drill before proposing public paid access, marking the PR ready for review or merging for launch.

## Definition of done / release gate

Mark each workstream complete only when implementation, adversarial unit/integration tests, approved deployments and independent testnet evidence are all linked in the roadmap. GitHub CI passing alone qualifies **the tested commit's code**, not external services, economic correctness or production readiness. Until the above gaps close, leave paid AI requests, settlement automation and privileged browser writes disabled.
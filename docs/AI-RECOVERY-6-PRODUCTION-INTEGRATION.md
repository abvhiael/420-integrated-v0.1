# AI-RECOVERY-6 — production integration and settlement qualification

Status: **IN PROGRESS — 6.1 qualified; 6.2 canonical RPC hydration implemented, CI pending; broader phase not qualified**

## 6.1 External provider transaction boundary (qualified)

`420-ai-provider/src/qualified-transactions.ts` supplies `QualifiedProviderTransactions420`, a `ProviderTransactionPort420` implementation. It delegates execution to an injected `QualifiedComputeExecutor420` and does not own signer secrets, send raw transactions, or take custody of user funds.

Before every state-changing operation it reads canonical AI/Compute work, validates active/staked AI provider state, provider/job/request bindings, expected Compute job state, chain ID, operator identity, and bound Compute contract addresses. Only the current Compute operator is allowed by this adapter; delegated provider execution remains disabled until its on-chain scope is independently qualified.

The executor is an **external security-critical dependency**, not merely an HTTP receipt source. A production executor must independently derive the `msg.sender` authority from canonical ComputeProviderRegistry/ComputeAuthorization state, simulate against the selected chain and verified deployment, obtain an approved signer authorization, submit the exact encoded target/method/arguments, wait for a successful canonical receipt under the configured finality policy, then return chain/target/hash evidence. A `confirmed: true` assertion from an untrusted service is insufficient. The adapter's injected interface is not itself a deployed signer or full cryptographic receipt verifier.

Receipt submission derives `canonicalReceiptId` using the actual on-chain ComputeReceiptRegistry, checks that `lastSequence`, `lastReceiptId`, cumulative units, and charge are all zero, and refuses second-final-receipt attempts until canonical reconciliation. Output manifest must already match the committed Compute job. Receipt charge may not exceed AI maximum or Compute funding. These checks do not replace on-chain authorization or accounting.

### Critical retry rule

A RUNNING job that has successfully committed its output but failed to submit its receipt must not be executed a second time just because a worker attempt returned an error. Resume by reading canonical ComputeJobRegistry state and receipt head, then submitting the *same* commitment-bound receipt, not a new output. Existing `AIProviderRuntime420.process()` currently returns WAIT for any job no longer RUNNING; a separate persisted, privacy-safe receipt-reconciliation path is required before production. Do not mark this adapter production-ready or enable paid requests until that path has qualified.

## 6.2 Canonical RPC and qualified executor (partially implemented; CI pending)

`420-ai-provider/src/canonical-rpc.ts` now provides `CanonicalRPCState420`, a read-only `CanonicalStatePort420` implementation with ABI-exact reads for AIJobManager, AIProviderRegistry, ComputeJobRegistry420, ComputeRequestRegistry420, and ComputeProviderRegistry420. All reads use the same confirmation-pinned block; it rejects an unexpected chain ID, insufficient confirmation depth, missing identities, mismatched job/request/provider/operator bindings, unverified Compute addresses, and a block-hash change during hydration. Frozen AI predeploy addresses remain 0x042f and 0x0431.

The caller must supply Compute addresses **already verified** using ProtocolRegistry or a signed deployment manifest. This adapter does not resolve or authenticate the registry itself, verify bytecode identity, prove finality under a consensus-specific policy, or run an external signer. Those are remaining 6.2 exit gates. A confirmation-depth block-hash check is defense in depth, not a standalone finality proof.

Implement network-bound deployment/ProtocolRegistry resolution and a qualified signer service with independently verified receipt/finality/reorg evidence before enabling operator transactions.

## 6.3 Storage/private-payload transport and model serving (pending)

Implement authenticated short-lived access to encrypted/private input/output objects, commitment checks before/after transport, policy-bound decryption, no private payload logging, signed provider/deployment manifests, and a concrete model-serving backend with immutable model-version/runtime-profile compatibility checks. Avoid accepting arbitrary HTTP URLs or arbitrary remote redirects as private payload references.

## 6.4 Funding/Vault settlement (pending)

Bind user-approved Wallet funding to canonical 420Vault receipts. Only the governance-bound Vault adapter may call `AIJobEscrow.confirmVaultFunding`; `AIJobEscrow.fund()` always reverts. Bind settlement to the authorized settlement adapter. `markClaimable` and `markRefundable` are not asset movement; the actual Vault disbursement/refund must be verifiably completed and idempotent before marking escrow CLOSED or reporting funds paid. Check payer, provider ID, beneficiary, vaultRef/fundingRef, amount, settlementRef, lifecycle and refund eligibility against canonical state; test double-execution and reorg behavior.

## 6.5 420Trust and outcome verification (pending)

Bind evidence to Compute job, model/version, verifier profile and receipt/result commitments. Provider signatures establish attribution, not factual truth. The authorized verifier route may call `ComputeJobRegistry420.markVerified` only after its profile-specific policy passes; a provider daemon or read API must never self-verify. Dispute, failed-verification and appeal paths must block premature settlement.

## 6.6 Browser write integration and operator operations (pending)

Wire Wallet-confirmed AI request creation, bounded Compute request/funding, binding and lifecycle inspection without storing signing secrets in `ai/web/` or enabling `features.writes` prematurely. Add provider supervision, health/readiness metrics without leaking private payloads, replay/reorg/drain drills, and testnet operator runbooks.

## Exit criteria

AI-RECOVERY-6 closes only when external signer, canonical RPC, encrypted payload transport, real backend, Vault settlement, trust/verifier, retry reconciliation and the Wallet write path each have executable tests and testnet integration evidence. A passing TypeScript interface/unit-test gate alone is not production qualification.

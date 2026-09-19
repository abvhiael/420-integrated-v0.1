# 420AI recovery roadmap

Status: **ACTIVE RECOVERY PROGRAM**

This roadmap tracks repository-level recovery from partially implemented 420AI architecture to a Genesis-qualified, testnet-operable application stack.

## AI-RECOVERY-1 — On-chain architecture recovery — COMPLETE

Restored mature AI authorization/policy/deployment/request/result/router modules, ComputeMarket contracts and AI/Compute bridge without duplicating model or version authority; added contract tests and maps.

## AI-RECOVERY-2 — Genesis address reconciliation — COMPLETE

Step 6.2 remains the physical predeploy authority. Conflicting newer fixed allocations were removed and routers/factories made registry-resolved; the address verifier and Wallet collision checks were updated.

## AI-RECOVERY-3 — Provider/runtime control plane — COMPLETE / CI QUALIFIED

`420-ai-provider/` supplies canonical reconciliation, provider eligibility, bounded metering, payload/result commitments, runtime/manifest checks and non-custodial external transaction ports. This is a control-plane foundation, not yet a deployed inference service.

## AI-RECOVERY-4 — Derived API, Indexer projection and service discovery — COMPLETE / CI QUALIFIED

`420-ai-api/`, Indexer AI/Compute views and Developer Hub service discovery provide typed, non-authoritative model/provider/job/history read surfaces. Indexed discovery is distinct from canonical current-state reads. Concrete hosted API and direct-RPC hydration deployments remain AI-RECOVERY-6/7 work.

## AI-RECOVERY-5 — ai.420integrated.org UI — COMPLETE / CI QUALIFIED (READ-ONLY GENESIS SHELL)

`ai/web/` supplies the responsive web shell, model/provider/job discovery, wallet identity/network checks, request draft review and observational operator surfaces. The dedicated AI Web and all eleven companion workflow runs passed at `3e789a2ea568781801d357a9814b44d314bd0c78`. There is no claim of deployed `ai.420integrated.org` or enabled payment/job submission. Canonical write actions remain fail-closed until phase 6 qualifies the necessary adapters.

## AI-RECOVERY-6 — Production adapters and verification/settlement integration — IN PROGRESS

See `docs/AI-RECOVERY-6-PRODUCTION-INTEGRATION.md` for implementation details and acceptance criteria.

- **6.1 External provider transaction adapter:** implementation committed; checks canonical provider/job/request state and spend before advancing Compute state and submitting one final receipt; dedicated unit tests added; fresh CI qualification pending. External qualified signer and receipt verification are still required.
- **6.2 Canonical RPC reader and qualified executor:** registry/deployment discovery, exact ABI hydration, confirmed receipts, finality/reorg/authorization — pending.
- **6.3 Storage/private payload and model serving:** encrypted, authenticated delivery, signed manifests, real backend and compatibility gates — pending.
- **6.4 Vault funding and settlement:** real asset movement, idempotent settlement/refund, beneficiary derivation — pending.
- **6.5 Trust evidence and verification:** profile-bound proofs, verifier authorization, dispute gates — pending.
- **6.6 Wallet write flow and operator reliability:** request/funding/binding UI, retry reconciliation, telemetry and supervision — pending.

Do not enable `features.writes`, claim paid job operability, or call phase 6 complete until all six integrations have passed E2E qualification.

## AI-RECOVERY-7 — Testnet deployment and end-to-end qualification — PLANNED

Deploy contract/service manifests, worker, API and UI; qualify Wallet -> AI request -> Compute -> provider -> verification -> settlement/refund; run failure/reorg/security drills, fuzz/invariant expansion and release qualification. No testnet/mainnet deployment is implied by passing repository CI.

## Completion definition

420AI recovery is complete only when canonical on-chain state, provider runtime, read API, user UI, private data transport, qualified signer, model backend, Vault/Trust adapters and deployed testnet agree on identities, permissions and lifecycle semantics, and the full user flow is validated end to end.

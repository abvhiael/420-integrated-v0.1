# 420AI audit remediation roadmap

Status: **ACTIVE**
Audit baseline: `main@b58b09a17e641a42b81d832bad913a83c7caada9`

This roadmap preserves the frozen 420AI V1 architecture. It does not redefine 420AI around the subset of files currently present.

## AI-AUDIT-1 — canonical definition and repository inventory
- Freeze the authoritative source set: frozen V1 architecture, Genesis app map, frozen/canonical addresses, AI Genesis config, application manuals, infrastructure docs, prior recovery evidence and current source/tests.
- Record exact `main` and audit-branch SHAs.
- Classify every canonical 420AI component as COMPLETE / PARTIAL / MISSING / STALE / BROKEN / BLOCKED / NOT APPLICABLE.
- **Repository-side status: COMPLETE by this audit branch.**

## AI-AUDIT-2 — frozen Genesis compatibility layer
- Requalify `AIProviderRegistry`, `AIModelRegistry`, `AIJobManager`, `AIJobEscrow`, and `AIReputationRegistry`.
- Verify the fixed discovery identities `0x042f` through `0x0433`, constructor/init assumptions, authority boundaries, lifecycle constraints, Vault-only escrow compatibility, and Trust-derived reputation behavior.
- Expand adversarial tests for authorization, replay, terminal states, arbitrary-recipient prevention, provider suspension and model/version immutability where current tests are insufficient.
- **Repository-side status: COMPLETE. Level 1 qualified at implementation SHA `a524c83a576fabafec466e469a51fc8522d23035` by 420AI Audit Qualification run `37085984181`. Durable evidence: `docs/audit/420AI-AUDIT-2-QUALIFICATION.md`.**

## AI-AUDIT-3 — canonical AI V1 modules
Implement the architecture-named modules that are still absent from current `main`, adapting them to **current** ComputeMarket and Vault interfaces rather than copying the stale 2026-09 recovery branch:
1. `AIAuthorization420.sol`
2. `AIPolicyRegistry420.sol`
3. `AIModelDeploymentRegistry420.sol`
4. `AIRequestRegistry420.sol`
5. `AIResultRegistry420.sol`
6. `AIComputeAdapter420.sol`
7. `AIRouter420.sol`
8. `IAI420.sol`

`AIModelRegistry` already owns canonical model/version state, so do **not** create a second independently writable `AIModelVersionRegistry420`; reconcile the Genesis dApp map and docs to the single-authority implementation only after that architectural decision is documented and tested.

- **Repository-side status: COMPLETE. Level 1 qualified at implementation SHA `b04ead697a90f325f952ba41ca50bdbda57d4258` by 420AI Audit Qualification run `37090313576`. Durable evidence: `docs/audit/420AI-AUDIT-3-QUALIFICATION.md`.**

## AI-AUDIT-4 — current ComputeMarket integration
- Bind AI requests to the current CMP request/job/worker/verifier/economic primitives.
- Prove adaptation can narrow but cannot broaden spend, deadline, provider/resource, privacy or verification constraints.
- Bind provider/deployment identity, accepted price, payer, beneficiary, verification profile and immutable result commitment.
- Add end-to-end AI -> CMP -> verified entitlement/refund tests.

- **Repository-side status: COMPLETE. Level 1 step qualification plus Level 2 app-integration milestone coverage passed at implementation SHA `3108fa8f17c1e9482c6506cc39ea64e56fd8727f` by 420AI Audit Qualification run `37093230900`. Durable evidence: `docs/audit/420AI-AUDIT-4-QUALIFICATION.md`.**

## AI-AUDIT-5 — custody, settlement and disputes
- Use the current 420Vault/CMP settlement path; no standalone AI custody.
- Prove payer-segregated funding, ceiling enforcement, provider-beneficiary derivation, one-time settlement, unused-funds recovery, cancellation/refund, dispute hold/resolution, objective slashing boundary and non-confiscatory emergency behavior.

- **Repository-side status: COMPLETE. Exact-head Level 1 qualification passed at implementation SHA `7b0aef02bd2064bfb97fec9e57d0b7c613bc5a05` in 420AI Audit Qualification run `37176098018`; `custody-settlement` job `111358922262` passed together with all retained AI qualification jobs. Durable evidence: `docs/audit/420AI-AUDIT-5-QUALIFICATION.md`.**

## AI-AUDIT-6 — provider runtime and private payload path
- Rebuild the off-chain `420ai` provider service against current RPC/Registry/CMP interfaces.
- Define signed execution manifests, private payload encryption/retention, receipt submission, retry/idempotency, restart recovery, observability and bounded failure behavior.
- Do not revive stale provider code without current-interface review.

- **Repository-side status: COMPLETE. Level 1 qualified at implementation SHA `0a70e753256e3d3c8cead2894ee9924c72d1b570` by 420AI Audit Qualification run `37099378185`. Durable evidence: `docs/audit/420AI-AUDIT-6-QUALIFICATION.md`.**

## AI-AUDIT-7 — read API / indexer
- Implement or reconcile AI read models from canonical Registry/CMP/AI events and state.
- Support reorg-safe indexing, recovery/rebuild, versioned schemas, pagination, network validation and no plaintext-private-payload leakage.

- **Repository-side status: COMPLETE. Exact-head Level 1 qualification passed at reconciled implementation SHA `12cd213186b107210470aa0fc3fef68d7a7798c4` in 420AI Audit Qualification run `37173980718`; `ai-read-api` job `111352636986` passed together with all retained AI qualification jobs. Durable evidence: `docs/audit/420AI-AUDIT-7-QUALIFICATION.md`.**

## AI-AUDIT-8 — user-facing AI client
- Implement the actual 420AI user-facing client; current `main` has manuals but no production AI web application.
- Real wallet connection, network validation, model/version/deployment discovery, request/funding state, transaction/error/recovery states, accessibility/responsiveness and production configuration.
- No privileged browser secrets or provider credentials.

- **Repository-side status: COMPLETE. Original client implementation SHA `b49543dc5c5227ed5d9eff3d0d4383af3f1ec1ad` was reconciled onto current-main qualification head `12cd213186b107210470aa0fc3fef68d7a7798c4`. Level 1 plus retained Level 2 app-integration qualification passed in 420AI Audit Qualification run `37173980718`; `ai-client` job `111352637063`, `ai-read-api` job `111352636986`, and all retained AI jobs succeeded. Durable evidence: `docs/audit/420AI-AUDIT-8-QUALIFICATION.md`.**

## AI-AUDIT-9 — deployment and Genesis materialization
- Materialize/verify frozen predeploy runtime where required.
- Deploy Registry-resolved AI V1 modules with receipts and runtime code hashes.
- Publish canonical component IDs through ProtocolRegistry.
- Define deployer/admin transfer, smoke tests, rollback/recovery, monitoring and DNS/API dependencies.

- **Repository-side status: COMPLETE. Level 1 exact-head qualification passed at implementation SHA `ed7ab3af91d54b36d3ca6595eaf1363e07f09a55` in 420AI Audit Qualification run `37228805812`; all 10 required jobs passed, including `deployment-materialization` job `111513926105`. Durable evidence: `docs/audit/420AI-AUDIT-9-QUALIFICATION.md`. Live chain addresses, transaction hashes, Registry publication transactions, DNS/API materialization and production-equivalent runtime evidence remain explicitly deferred to AI-AUDIT-11.**

## AI-AUDIT-10 — exact-head pre-testnet qualification
- Clean build from documented instructions.
- Focused AI Foundry suite plus required CMP/Vault/Registry/Identity integration suites.
- Static/security analysis, docs verifier, application build, provider/API build and no-uncommitted-change check.
- Commit exact-head qualification evidence.

- **Repository-side status: COMPLETE. Level 1 exact-head qualification plus the retained pre-testnet app-integration milestone passed at implementation SHA `bfbbca7fa847e46217b4d4b4d23bd70cf72424e8` in 420AI Audit Qualification run `37236254656`. All 12 required jobs passed, including `pretestnet-qualification` job `111535889439` and `pretestnet-security` job `111535889308`. Durable evidence: `docs/audit/420AI-AUDIT-10-QUALIFICATION.md`. AI-AUDIT-11 remains BLOCKED until the production-equivalent testnet and provider infrastructure are live.**

## AI-AUDIT-11 — production-equivalent testnet qualification
**BLOCKED until the production-equivalent 420Integrated testnet and required provider infrastructure are live.**
- Deploy exact release candidate.
- Exercise real wallet -> AI request -> CMP match -> provider execution -> receipt -> verification -> settlement/refund paths.
- Record tx hashes, deployed addresses, code hashes, Registry publication evidence, provider/runtime logs and recovery drills.

## AI-AUDIT-12 — Genesis / production release gate
- Governance/operations acceptance where required.
- Production secrets, monitoring, incident response, backups and operator runbooks.
- Final exact-head evidence proving no unresolved HIGH/CRITICAL issue and no undocumented dependency.

Do not renumber completed steps. If a new prerequisite is found, add a decimal substep under the owning step.

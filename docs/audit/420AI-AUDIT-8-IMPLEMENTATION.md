# AI-AUDIT-8 — user-facing AI client implementation record

Status: **IMPLEMENTED — FORMAL QUALIFICATION BLOCKED**  
Application: **420AI**  
Roadmap step: **AI-AUDIT-8 — user-facing AI client**  
Implementation SHA: `b49543dc5c5227ed5d9eff3d0d4383af3f1ec1ad`  
Audit branch: `audit/420ai-complete-20261002`  
Primary PR: **#491**  
Current main at implementation closeout: `d37d751dfa232b20c8158d55c20c13cc1d7a10ef`

## Implemented client

The production browser client source now exists under `ai/web`.

It provides:

- injected EIP-1193 wallet connection;
- target-network validation and wallet authority invalidation;
- model, model-version, deployment, policy and request/job discovery through the versioned AI read API;
- requester-side `AIJobManager.createRequest`, `cancel` and `openDispute` transaction preparation;
- local private-input commitment generation without putting plaintext into calldata or public read models;
- explicit reviewed transaction state followed by gas estimation and wallet approval;
- transaction confirmation, revert, reorg, drop and timeout/error handling;
- indexed funding/Vault/provider/ComputeMarket/result lifecycle display;
- responsive and keyboard-accessible browser UI;
- restrictive browser security headers;
- production-origin/runtime configuration with fail-closed unresolved deployment values; and
- explicit exclusion of browser provider credentials, private keys and privileged API secrets.

## Funding boundary

The browser does not implement direct escrow funding. Repository authority is explicit: `AIJobEscrow.fund` is disabled. AI funding is bound through the canonical Vault/settlement adapter path and the browser displays the resulting funding state.

## Targeted local qualification

The client was exercised using Node 22 with the app-specific build path:

`npm run build`

Results:

- structural check — PASS;
- final `app.js` syntax check — PASS;
- unit/boundary suite — **16 passed, 0 failed, 0 skipped**.

Coverage includes:

- Ethereum Keccak/ABI encoding;
- request calldata excludes private plaintext;
- runtime secret/credential rejection;
- fail-closed unresolved production config;
- wrong-network refusal;
- wallet authority invalidation;
- chain-scoped AI read API access;
- read-schema mismatch rejection;
- requester mutation boundaries;
- canonical transaction confirmation;
- reverted transaction handling;
- reorg detection; and
- dropped transaction handling.

## CI blocker

Formal AI-AUDIT-8 qualification is **not complete**.

The required `420AI Audit Qualification` workflow now contains an exact-head `ai-client` job and the accumulated `ai-read-api` job. However, GitHub has not emitted a `pull_request` Actions run for the connector-generated implementation heads.

A temporary draft qualification PR (#501) was created from the same exact implementation SHA to attempt an `opened` event without code divergence. It also produced no Actions run.

Under the audit qualification policy, missing/untriggered required CI is not green. Therefore this record intentionally does **not** mark AI-AUDIT-8 COMPLETE.

## Completion gate

AI-AUDIT-8 may be marked COMPLETE only after an exact-head 420AI Audit Qualification run validates, at minimum:

- `ai-client`;
- `ai-read-api`;
- retained provider/runtime and AI contract/integration jobs required by the app milestone.

No executable implementation change should be made after `b49543dc5c5227ed5d9eff3d0d4383af3f1ec1ad` unless the new head is requalified.

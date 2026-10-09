# HZ-GCA-15 — Moderation, abuse, privacy and adversarial hardening

Status: **PARTIAL — local Level 1 PASS (99/99), canonical threat closure remains incomplete**.

Source: `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`, HZ-GCA-15.
PR #565, implementation SHA `6f0aa739faeaa42c2953fe738f0dcde4db2e7e4f`; observed main/base `ffc6a4028676907c266714b5c1ae8ba3af9a7137`.

Added `hz/generate/src/security-gate.js`, `hz/generate/test/security-gate.test.js`, retained export/package script, and targeted `.github/workflows/420hz-gca-15.yml`.

Threat review (a standalone gate does not secure routes until bound to the actual callers):
- Prompt-injection/tool boundary: provider output is non-authoritative; suspicious instruction payload rejected in a local fixture. Real provider/tool prompt-boundary enforcement remains to be shown.
- Malicious media/metadata and unsafe HTML/URL: basic URL and HTML metadata validation, negative fixtures; full MIME/content inspection, DNS rebinding, redirects, media decoding and CSP/browser tests not qualified.
- Unauthorized reference audio, unconsented voice/persona, derivative rights: canonical proof callback required by gate; real Creative/consent verification and expiry/revocation must be exercised through actual publish and generate pipelines.
- Spam/resource exhaustion: bounded per-account in-memory request rate fixture; production distributed rate/quota, cross-wallet/Sybil controls and concurrent enforcement not qualified.
- Wallet/session replay: scoped nonce and expiry checks locally; real signed Wallet session, audience/chain binding and durable nonce persistence require integration.
- Vote stuffing/Sybil and collusive nominations: earlier Awards fixture controls exist, but no full identity uniqueness, collusion graph, or concurrent/persistent abuse defense has been qualified.
- Chart manipulation: qualified play/source rules retained from HZ-GCA-9; independent bot/collusive manipulation suite not yet complete.
- Report/block/mute bypass: earlier Community tests retained; cross-account and cross-service enforcement must be integrated and adversarially verified.
- Provider result spoofing: canonical proof callback and output fingerprint local tests; live 420AI/Compute provider authority must reject spoofed status and forged result manifests.
- Storage hash mismatch: SHA-256 hex commitment equality check tested; real storage receipts and malicious replacements need service test.
- Stale/reorged derived state: fail-closed source-readiness and reorg gate local test; durable reindex/backfill/rollback remains testnet-gated.
- Private draft/prompt and secrets/provider-token leakage: basic secret metadata-key guard and no-public-projection gate; verify logs, traces, notifications, storage, telemetry and responses across live service boundaries.
- Unsafe HTML/URL/media metadata: check known hazardous URL schemes and loopback/private host patterns; qualified resolver/redirect-safe fetch policy required.

The local gate is not a substitute for trusted canonical Wallet/Creative/Identity and provider source verifiers. It must not be wired to a public write path relying on caller-controlled `authorize` or `verifyCanonical` callbacks.

Level 1 PASSED: exact-SHA `hz/generate npm run qualify` in run https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37871466964, job `113630306132`: 99 tests PASS, 0 failures/skips/cancellations; SHA check PASS. Evidence HEAD run https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37871498068 also SUCCESS.
Canonical exit *documented threat-model closure with negative/adversarial tests* is **not yet satisfied comprehensively**. Do not mark HZ-GCA-15 COMPLETE from five new local gate tests alone.

Level 2: app-focused integration milestone at HZ-GCA-14–16.
Level 3: comprehensive merge-candidate closeout deferred.
Next canonical: **HZ-GCA-16 — Website and product navigation integration**.

## Security follow-up (2026-10-08; NOT a complete HZ-GCA-15 closeout)

Repository-side changes made after the original 99-test baseline:
- Hardened `HzSecurityGate420` URL filtering for IPv6 literals and additional private/reserved host classes; reject non-object metadata and require explicitly injected replay/rate stores in production mode. **Injection alone does not prove persistence, atomicity, distributed rate enforcement or DNS/redirect safety.**
- Added `GenerationJobManager420({requireCanonicalResult:true,verifyProviderResult})` for positive canonical verification of the actual output manifest at the real polling boundary, failing a job on negative verification. Existing mock-compatible/default paths do **not** automatically activate canonical verification; production composition must enforce this mode and use a source-authentic verifier, not a caller-provided boolean.
- Added adversarial tests for forged results, trusted-result acceptance, unsafe URL classes, malformed metadata and missing external stores. Updated HZ-GCA-15 workflow paths to cover job manager changes.

Remaining blocking repository-side work: wire verified Wallet/Creative/Identity/420AI sources to every real Generate/Publish/Community/Vote/Chart entry point; enforce report/block/mute across cross-service projections; verify anti-collusion and source-unique Chart/Awards events; isolate secret and private data in logs/notifications; robust media validation and authenticated storage receipts; verify signed provider status/commitment binding. **This note does not assert those items are fixed.**

Deferred HZ-GCA-18 testnet requirements: externally persistent atomic nonce/replay and rate stores across restarts/replicas, cross-wallet abuse resistance, verified network-bound wallet sessions, concurrent Sybil/vote/collusion protection, canonical consent expiry/revocation, redirect/DNS-rebinding safe fetch, real media decoding/CSP, 420AI provider finality, reorg rollback, service-level privacy/secrets and actual cross-service abuse traces.

Qualification: new implementation HEAD and exact-SHA CI results must be verified independently; old 99/99 PASS may not be cited as qualification of these changes. HZ-GCA-15 remains **PARTIAL**, and HZ-GCA-16 / HZ-GCA-17 must not be declared complete from this follow-up alone.

## Repository-side integration hardening follow-up — 2026-10-08

Implementation includes `hz/generate/src/production-security.js` with a fail-closed composition interface requiring canonical Wallet session, Creative rights, 420AI/provider result, Identity eligibility, atomic replay-consumption and quota adapters. These injected functions are contracts for external trusted infrastructure, not implementations of those services. Generation jobs require positive canonical result validation in secure mode. Production Register/Publish checks Creative authorization on each publish invocation, including idempotent replay, so revoked/expired authorization can block later attempts; the underlying Creative service must provide fresh authoritative verdicts. Awards now supports a production-required abuse verifier for nominations and votes. Charts support trusted checkpoint verification and reject self-owned qualified play assertions. Cross-service private notification projection requires positive recipient authorization and never publicly projects private events.

Targeted adversarial fixtures cover missing authorities, denial outcomes, duplicate replay, private notification isolation, stale chart checkpoints and unavailable production verifiers. Tests use deterministic mock authorities; they do not demonstrate cryptographic signing, actual network auth, shared DB persistence, nonce atomicity under concurrency, Sybil/collusion graph algorithms or real revocation. Those require authoritative provider implementations and HZ-GCA-18 production-equivalent tests.

Follow-up qualification: the first run on `7b9e9c0b1a71bfb48d234599513a6b380f4ee013` exposed three failures (IPv6 localhost bypass, legacy private-notification test lacking auth injection and rights-fixture setup); corrections have been applied. **Final status remains PARTIAL until exact-SHA passing results and source-backed integration evidence are verified.** Do not merge or mark production ready on interface-only evidence.

## M4 security closure update — additional repository-side fail-closed boundaries

- Production `CommunityStore420` now refuses construction without `verifySession` and verifies each write at the point of use with actor, exact community-write scope, audience and current time. The permissive pre-verified assertion remains solely for deterministic non-production fixtures.
- Production `HzCrossService420` now requires `allowCommunityEvent` and fails closed for disallowed FOLLOW_ACTIVITY and COMMUNITY_ACTIVITY in both notifications and public aggregates. The gate must be backed by canonical privacy/moderation state and implemented on every production replica; its injection does not prove cross-service deployment.
- Adversarial tests in `hz/generate/test/production-security.test.js` cover both missing production verifier dependencies, negative authority answers, safe local positive authority, and blocked social projection suppression.
- Both changes affect executable integration surfaces and require fresh exact-SHA Level 1 / M4 app-integration qualification. Earlier green runs do not apply automatically.

**Still unresolved before claiming full repository-side M4 closure:** prove the production adapters are actually instantiated and used by every deployed write/read path; signed provider output and source binding through the real adapter; authoritative Identity/Creative verification and revocation at voting/publication; trusted source-qualified chart events; robust media/storage receipt validation and security privacy handling; moderation/appeal lifecycle where supported. Deployment, shared transactional stores, cryptographic authority, real provider network finality, cross-wallet collusion resistance, DNS/redirect-safe fetch, reorg recovery, cross-service endpoint checks and deployed observability belong to HZ-GCA-18. No code-only check is a substitute for their live evidence.

HZ-GCA-14 same-object live-service obligations remain unchanged in `docs/audit/420HZ-TESTNET-DEFERRED-INTEGRATION-ROADMAP.md`. **HZ-GCA-17 is not authorized by this update.**

## M4 explicit production composition follow-up

Repository implementation: `hz/generate/src/production-surfaces.js` composes existing Community, Charts, Awards, Cross-service and Generation managers using explicit injected authority adapters, instead of silently invoking independent fixture-friendly constructors for deployment. It requires separate Wallet session/community-session, Creative, provider-result, Identity, atomic replay/rate, source-qualified playback, finalized checkpoint, cross-service source/private-read, moderator social suppression and Awards abuse/authorization interfaces. Production Charts additionally fail closed without qualified-play and checkpoint callbacks. `hz/generate/test/production-surfaces.test.js` provides missing-adapter, negative-verdict and social suppression assertions.

**Scope qualification:** the integration contract and tests are repository-side controls, not proof that external providers implement genuine signatures, transactional persistence, consent revocation, content scanning or distributed abuse defenses. No production deployment is represented in this PR. HZ-GCA-14 live same-object integrations and HZ-GCA-18 service qualification remain explicitly open. HZ-GCA-17 must not commence from interface-only success. New exact-HEAD workflows must complete before treating this update as tested.

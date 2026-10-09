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

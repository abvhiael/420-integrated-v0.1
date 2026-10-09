# CMP S-02 — Read-only science ingestion implementation and qualification

**Status: IMPLEMENTATION LEVEL-1 PASS; CANONICAL S-02 EXIT BLOCKED ON AUTHORIZED LIVE PROVIDER RESPONSES.** Do not mark S-02 COMPLETE without real provider-approved responses and final source schema confirmation.

- Implementation SHA: `ec0eb70b5a44f5195b530b2e31166bf18bdefb76`.
- Audit branch: `cmp-s02-readonly-ingestion-20261008`.
- Stacked PR: #575, based on S-01 PR #574. Base S-01 evidence SHA: `08bca1873d5b58db5c51f3398dc8d3c71e20c24a`; main baseline `ff61fc1171d422c081f4a5abb9e5828e88949c0f`.
- Required Level 1 CI: [CMP S-02 External Ingestion run 37842252391](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37842252391) — **SUCCESS** on exact implementation SHA.
- Qualified job: ingestion `113534271582` — **SUCCESS**; exact-head checkout, Node 22 syntax validation, targeted security/contract tests.
- Code files: `compute/ingestion/package.json`, `compute/ingestion/src/{client,parsers,providers}.mjs`, `compute/ingestion/test/client.test.mjs`, `.github/workflows/cmp-s02-ingestion.yml`.
- Corrective commit: parser and fixture escaping fixed before successful exact-SHA run. Failed superseded run `37842203894` is **not** used as passing evidence.
- Protection: both production source profiles disabled; explicit per-source consent/permission/approval gate; HTTPS exact origin/path; IP DNS callback refuses private/reserved ranges; no HTTP redirect; no automatic credential propagation; timeout and response-size caps; bounded per-source rate limiting/backoff; schema-specific parsers; source SHA-256 digest; non-authoritative non-rewardable observation only; cursor consistency check; no donor username in emitted records.
- Negative tests: disabled sources, absent DNS verifier, unsafe URL/IP, malformed flat-file/XML, XML entity declaration, observed record privacy and rate limiting.
- Still missing: **provider-authorized actual Folding@home and a named BOINC project endpoint responses**; production verified MIME/schema, dynamic hostname DNS pinning, project-specific credential and access policy, upstream revocation/correction and pagination semantics; no work-unit acceptance evidence or wallet-linked participant identity. The current source profiles are intentionally non-executable placeholders, not production endpoint declarations.
- S-01 monetized source access remained disabled and neither source was queried in CI. Real endpoint tests cannot be substituted with fixtures.
- Level 2: deferred to S-06 (actual ingestion/Indexer/app convergence); Level 3: deferred to accumulated phase closeout. No global Foundry, Genesis, Geth or Docs reruns required for this slice.
- Next canonical step after S-02 fully qualifies: S-03 — Source-of-truth and trusted evidence verification.

Before enabling fetch on a real network, implement a networking layer that **pins transport to validated public DNS answers** (callback-only DNS validation is insufficient against DNS rebinding) and verify it through live-approved endpoint tests. Do not activate current clients in a production runtime.

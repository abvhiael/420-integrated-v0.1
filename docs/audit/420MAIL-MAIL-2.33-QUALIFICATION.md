# 420Mail MAIL-2.33 Qualification

## Step
**MAIL-2.33 — Encryption & Leakage Controls**

## Completion
- Status: **COMPLETE**
- Level 1: **PASS — app-scoped step qualification**
- Level 2: **PASS — retained app integration revalidation for shared private-blob path**
- Product/security milestone: **IN PROGRESS; not closed**
- Qualified feature SHA: `bb1927548066595d05e190c77c975e20f0086ff1`
- Exact tested PR merge-candidate SHA: `d667344167ddbfdbfe0360c4bdaa4fafaa2e5c87`
- Tested/current `main` parent: `764a2da3380d211efb83ef0f22c9909ca33e7345`
- Audit branch: `mail-2-11-email-wallet-onboarding-20261006`
- PR: #537

## Canonical gap resolved
Repository docs already required private encrypted blob storage, but durable service composition did not enforce the provider's encryption/key-custody posture. Private storage locators/digests and delivery fingerprints were also serializable through HTTP-facing structs. Blob digests were stored but not consistently verified on every read/write path.

## Implementation
- Added `PrivateBlobSecurityProfile` / `PrivateBlobSecurityProvider`.
- `NewDurableService` now fails closed unless the configured blob provider attests:
  - encryption at rest;
  - external/qualified key custody;
  - owner-scoped access.
- Added `putPrivateVerified` and `getPrivateVerified`.
- Provider-returned SHA-256 evidence is verified on writes.
- Retrieved private plaintext is re-hashed and checked against the durable digest before use.
- Hardened all shared body paths:
  - send;
  - draft create/save/recovery;
  - private search;
  - Outbox staging/process;
  - message read.
- HTTP responses now recursively redact:
  - `body_ref`;
  - `body_digest`;
  - `staging_body_ref`;
  - `staging_body_digest`;
  - `request_fingerprint`;
  - `idempotency_key`.
- Durable internal metadata remains intact for restart recovery, integrity, and idempotency.
- No Mail-owned encryption keys or second encryption layer were introduced.

## Negative/adversarial coverage
Tests verify:
- durable service rejects a blob store with no security profile;
- durable service rejects incomplete/insecure security posture;
- secure profile is accepted;
- mismatched provider digest is rejected on write;
- tampered blob plaintext is rejected on read;
- HTTP message/list responses do not expose private storage evidence.

## Qualification history
### Run #411 — formatting defect
- Run: **37532796384**
- Job: **112506124026**
- Exact head — PASS
- Go format — FAIL
- later gates — correctly SKIPPED
- Cause: gofmt-only drift in new MAIL-2.33 Go code/tests.

### Run #412 — stale verifier defect
- Run: **37532904525**
- Job: **112506488497**
- Exact head — PASS
- Go format — PASS
- Go test — PASS
- Go race — PASS
- Go vet — PASS
- Static verifier — FAIL
- Cause: verifier referenced `http` before initialization, then retained the obsolete direct `Blobs.PutPrivate` token after the code intentionally moved to `putPrivateVerified`.
- No implementation semantics or assertions were weakened.

### Final exact-head qualification
Workflow: **420Mail Audit Qualification**
- Run: **37533237581** (#414)
- Job: **112507609725**
- Exact checkout:
  `HEAD is now at d667344 Merge bb1927548066595d05e190c77c975e20f0086ff1 into 764a2da3380d211efb83ef0f22c9909ca33e7345`

Results:
- Exact head — PASS
- Go format — PASS
- `go test ./mail/...` — PASS
- `go test -race ./mail/...` — PASS
- `go vet ./mail/...` — PASS
- `python3 scripts/verify-420mail-audit.py` — PASS
- verifier output: `MAIL-2.33 encryption and leakage controls: qualified by app-scoped checks`

## Level 2 shared-dependency revalidation
MAIL-2.33 changes the private-blob path shared by message send/read, draft lifecycle, private search, and Outbox delivery. Run #414 already executes the complete retained Mail package, race suite, vet, and cumulative verifier on the exact merge candidate, so it also provides the required app-level shared-dependency integration revalidation.

A duplicate identical run was not created. This does **not** close the Product/security milestone, which remains defined through MAIL-2.35.

## Security conclusions
- production-equivalent durable composition requires declared encryption at rest;
- encryption-key custody remains outside Mail;
- blob access must remain owner-scoped;
- blob integrity is checked on write and read;
- private storage references/digests are not emitted over Mail HTTP;
- private body plaintext is not added to durable metadata, public search, or on-chain state;
- prior Mail behavior remains green under the retained full app suite.

## Level 3
**NOT RUN / NOT DUE.**

Repository-wide Solidity, Genesis/address-authority, 420 Integrated/global, Docs/global, Geth/global, and complete app-phase closeout qualification remain deferred.

## Blockers
No repository-side blocker remains for MAIL-2.33.

Live provider encryption implementation, external KMS/HSM configuration, deployed key rotation, production backup/restore encryption, provider compromise response, and public-testnet/operations evidence remain later release/security gates.

## Evidence inheritance
This evidence file and roadmap/PR bookkeeping are documentation-only and inherit qualification from exact tested merge-candidate SHA `d667344167ddbfdbfe0360c4bdaa4fafaa2e5c87` without recursive requalification.

## Next canonical step
**MAIL-2.34 — Phishing & Impersonation Protection**

# ARB-PRE-05 — Private Arbitration Evidence, Integrity and Retention

## Authority and privacy boundary

420Arbitration contracts store **only a 32-byte evidence commitment** and emit its case ID, round, and submitting account in a canonical `EvidenceCommitted` event. They do **not** store documents, recovery keys, encrypted capsules or private access credentials. A commitment does not establish that evidence was factually correct, grant access, or change a ruling.

The Wallet-integrated Arbitration application provides a local file-selection, encryption and verification workflow. A file is never read automatically on screen mount. No browser telemetry, console calls, public catalogue, Indexer or chain calldata receives the file's bytes, file name, private recovery key or authenticated storage session.

### Public versus private

| Public on-chain | Private, user-controlled off-chain |
| --- | --- |
| Case ID, round, submitter and salted commitment | Original file bytes, SHA-256 digest, random 32-byte commitment nonce |
| Immutable policy snapshot and evidence/ruling event history | AES-GCM encrypted capsule, 12-byte IV and 256-bit recovery key |
| Claim and remedy commitments | Access-control grants, 420Storage object identity/retention policy |

The app derives `evidenceCommitment = keccak256(abi.encode(domain, chainId, caseRegistry, caseId, round, submitter, SHA256(file), nonce))` with domain `keccak256("420/arbitration/evidence/private-envelope/v1")`. The nonce is **32 random bytes**, kept inside the confidential capsule and never broadcast with the on-chain commitment. Equal plaintexts therefore produce unrelated public commitments. The same exact context, plaintext digest and nonce deterministically produce the same commitment.

The plaintext is encrypted locally with **AES-256-GCM**, using a random 12-byte IV and authenticated additional data binding chain, Case registry, case ID, round and original submitter. The returned capsule includes ciphertext, IV, digest and nonce, **not the 256-bit recovery key**. The recovery key must be saved separately by the user/authorized recipient. These are client-side protections; a compromised device, user-disclosed key or badly administered evidence host can still leak private content.

## Wallet interaction and lifecycle

1. Verify the connected Wallet and select a real on-chain case. Only a claimant/respondent in an open evidence round may prepare a new case evidence commitment.
2. Explicitly select a nonempty private file up to **8 MiB**, then click **Encrypt file and generate commitment**. The browser creates the randomized, case/round-bound commitment and populates only the public 32-byte hash in the existing Evidence form.
3. Click **Download encrypted evidence capsule** and separately **Reveal private recovery key** to retain the decryption material securely. The file and key must not be published, sent to an open public endpoint, placed in a URL, or entered into public case metadata. A missing capsule/key **cannot be reconstructed from the commitment**.
4. Submit the commitment using the existing Wallet simulation, fee review, explicit authorization, device signing and canonical receipt flow. Storage upload success is **not** evidence submission. The app never creates an on-chain success state from a storage response.
5. For private inspection, select the exact on-chain case, enter the original round, submitter and commitment, select the encrypted capsule locally, and supply the private recovery key. The app first checks the **canonical case event history** to match all four identities. It then decrypts and verifies AEAD, exact original file size and SHA-256 digest. The chain event is checked again afterward to reject a reorganization during inspection.
6. Private plaintext is **not rendered automatically**. A separate **Download verified private evidence** user action offers the verified bytes as an attachment. The application's temporary decrypted buffer is cleared after download; a page refresh or Wallet identity change also discards temporary evidence state.

### Storage availability and failure

The concrete, read-only `createPrivate420StorageRetrieval420` client implements the documented **GET /v1/resources/retrieve** private interface: six-part object reference, required `X-420-Access-Mode: private`, `X-420-Subject`, `X-420-Session-ID` and `X-420-Capability: read` headers, no credentials in query strings, no cookies/referrers, redirect rejection and HTTPS (loopback HTTP for local testing only). Retrieval requires a no-store/private response, verifies content length while streaming against the declared size to prevent oversized payload allocation, and validates the SHA-256 shard root before parsing an encrypted evidence capsule. The `X-420-Session-ID` and subject are supplied by the independently authorized session verifier at request time and are **never** committed to source config, case history or telemetry. This client does not issue sessions or implement a competing storage backend.


The `createPrivateEvidenceStore420` adapter accepts **only an explicitly configured approved 420Storage v1 transport** and a trusted authenticated session verifier supplied by the application. This is **not** an alternate storage contract or signing system. The adapter has no public anonymous fallback, no generic URL-derived upload and no raw-evidence log path. The adapter expects the Storage v1 two-stage `prepare` → `ingest` transport with complete six-field object identity, plus `retrieve` with `mode:"private"`. Server-side authorization (subject/session/capability), object privacy, no-store caching, authenticated encryption/retention and allowed-host/TLS enforcement remain mandatory responsibilities of the qualified 420Storage deployment. **Browser-supplied roles, public object URLs and Wallet addresses alone are not access tokens.**

The Wallet now imports `createArbitration420StorageBridge420` as its evidence-workspace integration point. It is **offline by default**, with `online: false` and no approved session issuer or public upload path. When an independently trusted operator supplies the authorized 420Storage v1 endpoint, backend-verified session issuer and existing Storage prepare/ingest port, the bridge composes these adapters rather than creating a separate backend. Each grant must be server-issued for **one** Wallet account, chain, case, evidence round, `read` or `write` action and exact Storage object identity; it must carry a short-lived 420Storage private session. Browser-generated session data, 420ID app login alone and a caller's claim to be a resolver never authorize access. Upload additionally requires real `agreement_id`, `capacity_reservation_id`, `commitment_id` and idempotency key from existing 420Storage authority. Storage envelope payloads may be approximately twice the plaintext 8 MiB maximum because ciphertext uses hex encoding; bounded retrieval and upload checks account for this expansion.

Where no approved private storage and session authority are connected, remote upload and retrieval **fail closed**; the local encrypted capsule export and local verified inspection continue to work. No production storage endpoint/session has been invented or placed in Wallet runtime config. Avoid using a public 420Storage retrieval route for any Arbitration evidence, even if its ciphertext appears unreadable.

- **Unauthorized or expired:** an approved private session must identify the actual viewer, case, chain, Case registry, round and a non-expired access grant. The backend must independently authenticate the session and deny revoked or unknown grants.
- **Missing / inaccessible / revoked:** storage read fails, but canonical case/evidence history and commitments remain unchanged. Do not silently substitute another provider, object or document.
- **Corrupted / tampered / wrong case:** fail before exposing plaintext; the authenticated AAD, commitment, original size, digest and case history must all match.
- **Upload integrity:** before invoking approved Storage prepare/ingest, the client requires the recovery key to authenticate-decrypt the capsule against its exact case/round commitment, wipes the temporary plaintext, and verifies the encrypted capsule's exact serialized byte size and SHA-256 shard root against the Storage object reference. A mismatched key, tampered ciphertext, wrong object length or false root fails before a provider call.
- **Interrupted upload:** no final receipt is returned. Staging/cleanup remains the Storage provider's responsibility. The Wallet does not resubmit a commitment or roll back canonical chain state.
- **Duplicate commitment:** the underlying Case registry rejects identical evidence hashes within the same case/round. The UI must not bypass or weaken this rule.
- **RPC reorganization:** a log no longer canonical to the selected case/round is not permission to decrypt the evidence.

## Access restrictions and retention

Default private access is **deny**, including to observers, all unselected resolvers, unrelated Wallet accounts, Indexers, analytics and public API callers. The minimum permitted audience consists of the claimant, respondent and the **snapshotted resolver for the relevant round**, with an additional **authenticated, case/round-scoped, expiry-bound storage session** and the separately distributed recovery key. No browser UI can grant someone these rights by itself. Storage must implement server-side revocation, and access must be reverified on every retrieval; a recipient holding an already-exported plaintext copy cannot be remotely revoked.

Private storage retention requests must be **positive and at most 90 days**. The provider must enforce the requested expiry/deletion policy and any applicable law/appeal preservation requirements. The client does not claim that deleting hosted ciphertext erases the permanent public on-chain commitment or copies already shared with authorized recipients. Users should choose a shorter retention period when appropriate, use secure key distribution, and delete temporary decrypted/downloaded copies according to their applicable obligations. No automatic permanent retention is promised. Retention is a bounded configurable operational agreement rather than a new on-chain protocol constant.

**Sensitive data controls:** do not log/track file bytes, file names, private hashes/nonces, ciphertext, keys, session IDs, tokens, private Storage object refs or retrieval URLs; do not include them in error messages, support traces, screen captures, analytics or public API responses. Failures use redacted categories instead of propagating provider credentials or payload text. Application code uses text nodes for public commitments and does not render private file bytes as HTML.

## Test evidence and boundaries

Focused tests under `wallet/web/test/arbitration-evidence*.test.js` cover deterministic and randomized commitments, cross-case/round/chain/submitter substitutions, AES-GCM tamper rejection, missing/corrupt storage, wrong six-part Storage object identity, upload interruption, missing/revoked/expired access, forbidden plaintext leakage and canonical history rechecks.

The `420Arbitration ARB-PRE-04 browser and local EVM` job additionally selects a real private file, encrypts/downloads the capsule, submits the exact hash through Wallet, verifies the on-chain event, retrieves the capsule locally and recovers/downloads the original bytes **only after exact canonical case/round match**. This local-EVM evidence does not prove a deployed private storage host, production credentials or public testnet availability.

For the precise live-only activation requirements and test evidence, see **ARBITRATION-AUDIT-5** in [the canonical Arbitration remediation roadmap](../../audit/420ARBITRATION-AUDIT-REMEDIATION-ROADMAP.md). These are deliberately deferred until the testnet is operational; no active online connection is claimed.

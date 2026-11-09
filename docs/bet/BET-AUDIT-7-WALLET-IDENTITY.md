# BET-AUDIT-7 — Wallet/Identity integration contract

**Scope:** Read-only authentication boundary for 420Bet, not a funded game session or a capability grant. Implementation remains WIP until an independently qualified signature verifier, subject binding, eligibility provider and deployment are available. No canonical address or policy is fabricated.

## Existing canonical authorities

- `clients/420bet-lobby/src/wallet.js` is EIP-1193 discovery only, and remains unchanged. Wallet presence, chain and account metadata are **not authentication**.
- `Identity420` is the canonical identity/credential authority, with frozen `IIdentityCredential420.hasValidCredential(bytes32 subjectId, bytes32 credentialType)`. It is a subject-based credential system, **not** a direct wallet-address eligibility lookup. One or more credentials may be valid, and current issuer/profile state, revocation and expiry are dynamic. A TrustClass does not automatically establish legal status (see `docs/audit/ID-AUDIT-1-AUTHORITATIVE-IDENTITY-API-DECISION.md`).
- `wallet/web/core/session-management.js` owns actual SmartAccount420 session-key and capability flows. The new 420Bet session is a separate **read-only website bearer**, never a smart-account session key, chain capability or permission to place bets.

## New source boundaries

- `server/wallet-identity-sessions.mjs` creates random 256-bit, expiring, nonce-bound sign-in challenges with an exact origin, normalized EIP-1193 account, chain ID and explicit read-only intent. Challenges are consumed **before** awaiting the qualified external signature verifier, preventing concurrent replay. The verifier receives the entire message, signature, account and chain; acceptance requires strict boolean `true`. Signed-in sessions are random bearer tokens, chain/account-bound and short-lived. Every use invokes fresh Identity eligibility checks and enforces unchanged authorization version and revocation/expiry. Explicit revoke and revoke-all are available; a restarted in-memory service invalidates sessions. No positive policy cache.
- `server/canonical-identity-eligibility.mjs` checks `eth_chainId`, non-empty `eth_getCode` at a configured Identity420 address and real `eth_call` of the frozen `hasValidCredential` ABI for *every configured required credential type*. A trusted subject binding must independently map the authenticated account to an actual `bytes32 subjectId`; an independently supplied policy must also attest eligibility. Missing, wrong-chain, unrecognized, expired or revoked requirements fail closed. The adapter does not invent credential types, legal age, geofence or jurisdiction policy.
- `server/wallet-session-http.mjs` exposes only POST `/api/420bet/session/{challenge,authenticate,status,revoke}`, with strict Origin, JSON, bounded request bodies, no cookie authentication, no cache, and bearer account/chain checks. A hosting service must inject `createBetWalletSessions` with **qualified** verifier and Identity dependencies; endpoints are not exposed by the default `serve.mjs` unless the operator explicitly wires them with those providers.
- `src/wallet-session.js` is an opt-in EIP-1193 browser transport which calls `eth_requestAccounts` and `personal_sign` **only after** a user explicitly chooses to sign in. It invalidates in-memory tokens on account/chain/disconnect events and never calls `eth_sendTransaction`, `wallet_sendCalls`, approvals or capability creation. It is not yet mounted in the default lobby UI.

## Before full local qualification

1. Use an independently reviewed Ethereum EIP-191/contract-wallet (EIP-1271 where applicable) signature verifier that binds exact challenge message, account, chain and origin. Do not substitute client-reported signature validity or stubbed `true` outside tests.
2. Bind an approved 420Identity deployment and a verifiable, revocable wallet-to-Identity-subject resolver. Pin runtime code hash/chain deployment manifest. Keep the RPC read-only.
3. Supply a real legally approved, current policy engine for applicable age/region/jurisdiction, responsible-play restrictions, self-exclusion, operator authorization and policy version. Do not infer compliance from the credential TrustClass.
4. Wire the session handler into a production-equivalent same-origin backend with TLS, authorization and rate limits, durable/revocable session store as needed, service restart behavior, security logging without tokens or personal data, CSRF and Origin review, and appropriate monitoring. In-memory session state is explicitly not a horizontally scaled production store.
5. Wire the opt-in browser sign-in to the approved UI without changing canonical game authorization. Test account/chain changes and actual wallet sign/rejection, session revocation, EIP-1271/EOA verification, malicious origin, delayed verification and policy expiry, including official testnet identity reads.
6. Complete scoped and cross-service integration Level 2 and freeze exact implementation SHA, tests, source and deployment digests. No funded play activation.

## Current scoped tests

`tests/wallet-identity-integration.test.mjs` covers nonce replay, signed challenge scope, identity revocation, policy version changes, expiry, canonical Identity ABI and wrong-network/negative cases. `tests/wallet-session-http.test.mjs` exercises the optional HTTP handler, spoofed origins, bearer account binding, revoked session and the EIP-1193 client flow.

Tests use **explicit mock** signature and identity-policy callbacks; they establish source boundary behavior only, not an approved signer, real ID deployment, official-testnet access or live 420Bet session activation.

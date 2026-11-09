# BET-AUDIT-7 — Wallet/Identity integration contract

**Scope:** Read-only authentication boundary for 420Bet, not a funded game session or a capability grant. Implementation remains WIP until an independently qualified signature verifier, subject binding, eligibility provider and deployment are available. No canonical address or policy is fabricated.

## Existing canonical authorities

- `clients/420bet-lobby/src/wallet.js` is EIP-1193 discovery only, and remains unchanged. Wallet presence, chain and account metadata are **not authentication**.
- `Identity420` is the canonical identity/credential authority, with frozen `IIdentityCredential420.hasValidCredential(bytes32 subjectId, bytes32 credentialType)`. It is a subject-based credential system, **not** a direct wallet-address eligibility lookup. One or more credentials may be valid, and current issuer/profile state, revocation and expiry are dynamic. A TrustClass does not automatically establish legal status (see `docs/audit/ID-AUDIT-1-AUTHORITATIVE-IDENTITY-API-DECISION.md`).
- `wallet/web/core/session-management.js` owns actual SmartAccount420 session-key and capability flows. The new 420Bet session is a separate **read-only website bearer**, never a smart-account session key, chain capability or permission to place bets.

## New source boundaries

- `server/wallet-identity-sessions.mjs` creates random 256-bit, expiring, nonce-bound sign-in challenges with an exact origin, normalized EIP-1193 account, chain ID and explicit read-only intent. Challenges are consumed **before** awaiting the qualified external signature verifier, preventing concurrent replay. The verifier receives the entire message, signature, account and chain; acceptance requires strict boolean `true`. Signed-in sessions are random bearer tokens, chain/account-bound and short-lived. Every use invokes fresh Identity eligibility checks and enforces unchanged authorization version and revocation/expiry. Explicit revoke and revoke-all are available; a restarted in-memory service invalidates sessions. No positive policy cache.
- `server/wallet-signature-verifier.mjs` supplies the actual call boundary for a **qualified viem PublicClient** `getChainId` and `verifyMessage` (EOA or approved EIP-1271 support), checking the verified account/message/chain and denying on errors. The operator must provision and qualify the genuine RPC/client and signature support; a mock positive callback is never acceptable in a deployed service.
- `server/canonical-identity-eligibility.mjs` checks `eth_chainId`, non-empty `eth_getCode` at a configured Identity420 address and real `eth_call` of the frozen `hasValidCredential` ABI for *every configured required credential type*. A trusted subject binding must independently map the authenticated account to an actual `bytes32 subjectId`; an independently supplied policy must also attest eligibility. Missing, wrong-chain, unrecognized, expired or revoked requirements fail closed. The adapter does not invent credential types, legal age, geofence or jurisdiction policy.
- `server/wallet-session-http.mjs` exposes only POST `/api/420bet/session/{challenge,authenticate,status,revoke}`, with strict Origin, JSON, bounded request bodies, no cookie authentication, no cache, and bearer account/chain checks. A hosting service must inject `createBetWalletSessions` with **qualified** verifier and Identity dependencies; endpoints are not exposed by the default `serve.mjs` unless the operator explicitly wires them with those providers.
- `src/wallet-session.js` is an opt-in EIP-1193 browser transport which calls `eth_requestAccounts` and `personal_sign` **only after** a user explicitly chooses to sign in. It invalidates in-memory tokens on account/chain/disconnect events; explicit sign-out reports server revocation failure rather than falsely claiming remote revocation. It never calls `eth_sendTransaction`, `wallet_sendCalls`, approvals or capability creation. It is not yet mounted in the default lobby UI.

## Before full local qualification

1. Provision an independently reviewed, chain-bound viem PublicClient (with EIP-191 and supported EIP-1271 contract-wallet verification), wire `createWalletSignatureVerifier` into the session manager and verify against real wallet signatures. The adapter is implemented, but the deployed verifier/RPC and real signature evidence remain open. Do not substitute client-reported signature validity or stubbed `true` outside tests.
2. Bind an approved 420Identity deployment and a verifiable, revocable wallet-to-Identity-subject resolver. Pin runtime code hash/chain deployment manifest. Keep the RPC read-only.
3. Supply a real legally approved, current policy engine for applicable age/region/jurisdiction, responsible-play restrictions, self-exclusion, operator authorization and policy version. Do not infer compliance from the credential TrustClass.
4. Wire the session handler into a production-equivalent same-origin backend with TLS, authorization and rate limits, durable/revocable session store as needed, service restart behavior, security logging without tokens or personal data, CSRF and Origin review, and appropriate monitoring. In-memory session state is explicitly not a horizontally scaled production store.
5. Wire the opt-in browser sign-in to the approved UI without changing canonical game authorization. Test account/chain changes and actual wallet sign/rejection, session revocation, EIP-1271/EOA verification, malicious origin, delayed verification and policy expiry, including official testnet identity reads.
6. Complete scoped and cross-service integration Level 2 and freeze exact implementation SHA, tests, source and deployment digests. No funded play activation.

## Current scoped tests

`tests/wallet-identity-integration.test.mjs` covers nonce replay, signed challenge scope, identity revocation, policy version changes, expiry, canonical Identity ABI and wrong-network/negative cases. `tests/wallet-session-http.test.mjs` exercises the optional HTTP handler, spoofed origins, bearer account binding, revoked session and the EIP-1193 client flow.

Tests use **explicit mock** signature and identity-policy callbacks; they establish source boundary behavior only, not an approved signer, real ID deployment, official-testnet access or live 420Bet session activation.


## Production-equivalent runbook and explicit provisioning boundary

**Repository status:** Implementation is composed in `server/identity-runtime.mjs`, launchable with `npm run serve:identity` **only after real operator configuration**. It imports actual viem public-client verification (EIP-191 / approved EIP-1271), live Identity420 `eth_call`, a trusted external subject-binding and independent policy service. A matched, nonzero approved-policy digest and exact deployed bytecode hash are mandatory; there is no guest identity fallback, invented credential, test key or positive eligibility stub in the runtime.

### Required server-side configuration

| Setting | Meaning |
| --- | --- |
| `BET_SESSION_ORIGIN` | Exact website origin, e.g. the **actually approved** 420Bet domain; controls challenge origin and HTTP Origin checks |
| `BET_SESSION_CHAIN_ID` | Verified official decimal chain ID |
| `BET_IDENTITY_RPC_URL` | Qualified official HTTPS RPC source |
| `BET_IDENTITY_CONTRACT_ADDRESS` | Independently verified deployed Identity420 contract |
| `BET_IDENTITY_RUNTIME_CODE_HASH` | Exact verified Keccak-256 hash of deployed Identity420 bytecode |
| `BET_IDENTITY_CREDENTIAL_TYPES` | JSON array of externally approved `bytes32` credential identifiers; no made-up claims |
| `BET_IDENTITY_AUTHORITY_URL` | Independent HTTPS eligibility/subject service **root origin** |
| `BET_IDENTITY_AUTHORITY_TOKEN` | Secret used only for server-to-server subject and policy introspection |
| `BET_IDENTITY_POLICY_VERSION` | Independent approved policy version (not a local assumption) |
| `BET_IDENTITY_POLICY_APPROVAL_DIGEST` | Exact nonzero `bytes32` digest approved and attested by the independent policy authority |
| `BET_SESSION_BACKEND_TOKEN` | Shared backend-only bearer known to the Cloudflare Worker proxy and Node service; at least 32 characters |
| `BET_SESSION_PORT`, `BET_SESSION_HOST` | Optional service port and bind host; defaults 8788 and loopback |

The subject authority must serve two authenticated, privacy-limited POST endpoints:

- `/v1/wallet-subject` receives `{account,chainId}` and returns the matching `{account,chainId,subjectId,revoked:false}`, where `subjectId` is the **canonical existing Identity420 subject** and is not derived from the address.
- `/v1/420bet/eligibility` receives `{account,subjectId,chainId,requiredCredentialTypes,mode:"read-only",expectedPolicyVersion,expectedPolicyApprovalDigest}`. A valid positive response matches the same scopes, `policyVersion`, `policyApprovalDigest`, `authorized:true`, `revoked:false`, a changing `authorizationVersion`, and a bounded future `expiresAt` Unix epoch **milliseconds**. The service must re-evaluate negative and revoked policies on every call. No positive caching.

The backend's Node HTTP service rejects requests that do not carry the independently configured `X-Bet-Edge-Secret` from the trusted Worker proxy. It rejects cross-origin requests and cookies, requires explicit bearer sessions for status/revocation, and never emits an account capability or wallet transaction.

### Cloudflare Worker activation (requires genuine deployment)

`clients/420bet-lobby/wrangler.jsonc` now reserves `/api/420bet/session/*` for the Worker rather than serving SPA HTML. Until configured, `GET /api/420bet/session/capabilities` reports `readOnlyIdentityAvailable:false`, and the POST API fails closed.

Provision `BET_IDENTITY_ENABLED=true`, a verified external HTTPS `BET_SESSION_BACKEND_URL`, and the **secret** `BET_SESSION_BACKEND_TOKEN` at the Cloudflare Worker production environment **only after** the back-end service, legal policy and testnet release gates are approved. The Worker forwards only a bounded JSON request and selected bearer/account/chain headers to that service, never browser cookies or the authority token. Sign-in is opt-in from the lobby, discovered through the same-origin capabilities endpoint. It is not enabled by a frontend-only flag or mere wallet presence.

**Unfinished external dependencies:** The actual approved provider, credential policy/subject binding and RPC deployment must be provisioned by their appropriate authorities. The production signature verifier is not deployed just because the source invokes viem; passing mock integration tests does not constitute actual production/official-testnet acceptance. See `TN-BET-7-IDENTITY` in the canonical testnet work roadmap for each required receipt, security/control review and go/no-go.

### How to inspect the local implementation

From `clients/420bet-lobby`:

```sh
npm install
npm test
npm run build
# Only with authorized secret and official-network configuration:
npm run serve:identity
```

The isolated `tests/identity-runtime.test.mjs` deliberately signs a **test fixture** EIP-191 wallet message using viem and traverses canonical-style Identity420 RPC and policy service responses. It does not contain a live funded wallet or authoritative Identity deployment. The Cloudflare Worker and browser transport tests verify disabled-by-default routing and explicit read-only login. Production deployment and independent acceptance remain on the testnet roadmap rather than being falsely completed.

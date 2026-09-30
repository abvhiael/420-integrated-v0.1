# 420Exchange PRE-05 — quote authenticity, provenance and replay protection qualification

**Canonical roadmap:** `docs/420EXCHANGE-PRE-TESTNET-COMPLETION-ROADMAP.md`  
**Step:** PRE-05 — quote authenticity, provenance and replay protection  
**Completion state:** COMPLETE  
**Qualification level:** Level 1 step-specific + Level 2 Exchange authority-integration milestone  
**Audit branch / PR:** `audit/exchange-pretestnet-phase-20260930` / PR #430  
**Audit base SHA:** `4d0ede3692efe55f04a50c7bf5b749afe579eccb`  
**Qualified implementation SHA:** `a447e84951bc618961272ba94d78dfff96154ee2`  
**Current repository `main` observed at closeout:** `6715d9fd3747953f298e79527fb9e86588db8d35`

## Canonical requirements and disposition

| Requirement | Disposition |
| --- | --- |
| Canonical signed/authenticated quote envelope | SATISFIED — `420-exchange-quote-auth-v1` authenticates the canonical `420-exchange-signed-quote-payload-v1` using Ed25519. The signed payload contains the complete executable quote except the signature envelope itself. |
| Pin producer identity/key/version and allowed key rotation | SATISFIED — browser runtime policy pins service, exact endpoint URL, deployment/router/spender, producer ID, key version, raw Ed25519 public key, validity window, revocation epoch and bounded overlap. |
| Bind authentication to every execution-critical field | SATISFIED — signature covers deployment/manifest, chain, account, recipient, assets/metadata, route/path, raw amounts, fees/economics, builder execution input, timestamps, quote ID, replay domain and transaction fingerprint. Structural intake rejects missing/unknown top-level and nested execution semantics. |
| Domain-separate chain, Exchange service, deployment/router, account, quote ID and expiry | SATISFIED — replay domain is derived over `420/service/exchange-quote/v1`, canonical chain ID, deployment ID, manifest hash, router, account, quote ID and expiry; browser recomputes it independently. |
| Reject unsigned/forged/replayed/cross-chain/cross-router/cross-account/endpoint-substituted quotes | SATISFIED — dedicated threat tests reject each case. Exact endpoint URL, not merely origin, is pinned by policy. |
| Bind browser-reviewed transaction fingerprint to authenticated quote | SATISFIED — backend builds the canonical transaction with the same Exchange execution primitives, signs its fingerprint, and browser independently reconstructs and compares the fingerprint before trust promotion. |
| Fail closed on extra/omitted critical fields | SATISFIED — exact object-key sets are enforced for quote envelope, deployment, producer/authentication, economics, builder, tokens, fees, reviewed intent, execution and route hops before authentication promotion. |
| Quote revocation/expiry and operator key rollover | SATISFIED — quote freshness/expiry is checked at receipt and review; key policy enforces explicit revocation, revocation epoch, not-before/not-after windows, and bounded active-key overlap. |
| Deterministic signing/verification test vectors | SATISFIED — RFC 8032 Ed25519 test vector 1 is committed under test-only fixtures; same quote/key/source/clock produces an identical authenticated envelope. |

## Trust model implemented

The trust path is now:

`DISPLAY_SNAPSHOT`  
→ `REVIEW_CANDIDATE_ONLY` — schema/session/freshness only  
→ **Ed25519 verification against pinned policy**  
→ `TRUSTED_EXECUTION_QUOTE`  
→ `AUTHENTICATED_EXECUTION` canonical preparation  
→ later PRE-06 reviewed/preflight orchestration.

Transport HTTPS, API source labels, token `verified` flags, configured endpoints and unit tests do not upgrade trust.

### Non-forgeable verifier evidence

PRE-05 does not replace `sourceAuthenticated:true` with another caller-controlled boolean/object.

`verifyQuoteAuthentication()` creates a frozen evidence object and privately brands it in `quote-authentication.js` using a module-local `WeakSet`. `canonical-execution-inputs.js` and `reviewed-execution-bridge.js` accept authenticated execution provenance only when `isVerifiedQuoteEvidence()` confirms that exact verifier-issued object.

Cloning or hand-constructing `{verified:true}` evidence loses the private brand and fails closed.

## Signed domain and execution binding

The signed quote binds:

- service domain: `420/service/exchange-quote/v1`
- chain ID
- deployment ID
- manifest hash
- router
- spender
- account
- recipient
- quote ID
- observation and expiry
- replay domain
- input/output token metadata
- route market IDs
- route IDs
- route data
- raw input amount
- raw/minimum output
- fee components/rate/total
- gross/net quote economics
- canonical builder input
- **canonical transaction fingerprint**

The browser independently:

1. reconstructs the candidate transaction;
2. validates exact quote structure;
3. selects the pinned producer/key;
4. checks key status/window/revocation epoch;
5. checks public-key fingerprint;
6. hashes the canonical signed payload;
7. verifies Ed25519 signature;
8. checks exact endpoint/deployment/router domain;
9. recomputes replay domain;
10. recomputes transaction fingerprint;
11. admits the quote through a replay guard;
12. only then rebuilds it with `AUTHENTICATED_EXECUTION` provenance.

## Key management and rotation

Production private keys are **not** committed.

The service accepts an injected Ed25519 signer. Browser/runtime policy contains only public trust material.

Checked-in policy artifacts:

- `exchange/quote-service/config/auth-policy-template-v1.json`
- `exchange/quote-service/config/signer-rotation-v1.json`

Rotation semantics:

- producer ID and key version are explicit;
- public key is pinned;
- key validity window is explicit;
- revocation is explicit;
- revocation epoch must match;
- simultaneous active-key overlap is bounded;
- retired/revoked/out-of-window keys fail closed;
- signature validity alone cannot override policy.

## Principal implementation files

Quote service:

- `exchange/quote-service/src/auth.js`
- `exchange/quote-service/src/quote-engine.js`
- `exchange/quote-service/config/auth-policy-template-v1.json`
- `exchange/quote-service/config/signer-rotation-v1.json`
- `exchange/quote-service/schemas/signed-quote-payload-v1.json`
- `exchange/quote-service/schemas/quote-auth-policy-v1.json`
- `exchange/quote-service/schemas/executable-swap-quote-response-v1.json`

Browser:

- `exchange/web/core/quote-authentication.js`
- `exchange/web/core/executable-quote-intake.js`
- `exchange/web/core/canonical-execution-inputs.js`
- `exchange/web/core/reviewed-execution-bridge.js`
- `exchange/web/core/bound-swap-review.js`
- `exchange/web/core/quote-review-session.js`
- `exchange/web/read-only-swap-review-ui.js`
- `exchange/web/runtime-config.json`

Qualification:

- `exchange/quote-service/test/authentication.test.js`
- `exchange/quote-service/test/browser-intake-compat.test.js`
- `exchange/quote-service/test/test-auth.js`
- `exchange/quote-service/test/fixtures/pre05-ed25519-rfc8032-v1.json`
- `exchange/web/test/authenticated-quote-fixture.js`
- `exchange/web/test/executable-quote-intake.test.js`
- `exchange/web/test/bound-swap-review.test.js`
- `exchange/web/test/reviewed-execution-bridge.test.js`
- `exchange/web/scripts/pre03-chromium-acceptance.mjs`
- `exchange/quote-service/scripts/check-pre05.mjs`

## Level 1 qualification

Exact implementation SHA: `a447e84951bc618961272ba94d78dfff96154ee2`

Required app-specific workflow:

- **420Exchange Web Verification** — run `36788581522` / run number 602 — **SUCCESS**

PRE-05 / backend-specific qualification on that exact head:

- PRE-04 retained static checks — SUCCESS
- PRE-04/PRE-05 quote backend unit + HTTP + authentication/adversarial tests — SUCCESS
- quote-service secret scan — SUCCESS
- PRE-05 static authenticity/provenance/replay gate — included in `npm run check` — SUCCESS

Retained affected Exchange qualification on the same exact head:

- Static Exchange checks — SUCCESS
- Exchange web unit tests — SUCCESS
- PRE-02 deployable artifact verification — SUCCESS
- PRE-02 simulated EIP-1193 Chromium acceptance — SUCCESS
- **PRE-03 Chromium acceptance using a real PRE-05-signed quote and browser Ed25519 verification — SUCCESS**
- frontend secret scan — SUCCESS

Earlier implementation runs failed during development due to:
- retained PRE-04 static text pinning the old `DEFERRED_TO_PRE05` marker;
- Ed25519 KeyObject normalization defects;
- a Base64URL test mutation that did not reliably change decoded trailing bits.

Those root causes were corrected without weakening product trust requirements. They are not qualification evidence.

## Level 2 milestone qualification

**COMPLETE — PRE-05 authority-integration milestone.**

PRE-05 introduces the decisive cross-component authority boundary between the repository-owned quote backend and the browser execution-review path. The exact-head Exchange workflow qualified:

- signed backend production;
- signature/key/replay adversarial tests;
- browser independent verification;
- authenticated intake compatibility;
- canonical fingerprint binding;
- retained PRE-02 session authority;
- retained PRE-03 human review/browser acceptance;
- no wallet signing/submission path.

This is a meaningful Level 2 milestone under the active phase model.

## Exit criterion

> browser/client can independently verify quote origin and exact intent offline; no caller-provided `sourceAuthenticated`/equivalent flag can upgrade trust.

**SATISFIED.**

The executable core no longer accepts `sourceAuthenticated` or legacy `QUALIFIED_EXECUTION` trust shortcuts. PRE-05 static qualification explicitly rejects their reintroduction.

## Security/adversarial coverage

Qualified cases include:

- unsigned quote;
- forged signature;
- wrong public-key fingerprint;
- unknown producer/key version;
- revoked key;
- mismatched revocation epoch;
- key outside validity window;
- excessive key rollover overlap;
- repeated quote/replay;
- cross-account substitution;
- cross-chain substitution;
- router/deployment substitution;
- endpoint substitution;
- transaction-fingerprint substitution;
- quote ID/expiry/replay-domain tampering;
- route/amount/recipient/fee/economics tampering;
- extra unknown critical fields;
- omitted critical fields;
- caller-crafted `verified:true` evidence;
- stale/expired quote;
- changed wallet/session through retained PRE-02 controls.

## Current-main divergence review

At closeout, current `main` was `6715d9fd3747953f298e79527fb9e86588db8d35`.

Changes since the audit base remain confined to Compute Market contracts/config/docs/scripts and shared non-Exchange qualification workflows. They do not modify:

- `exchange/web/**`
- `exchange/quote-service/**`
- `.github/workflows/exchange-web.yml`

Therefore the exact-head PRE-05 app-specific qualification remains valid. Full reconciliation with current `main` remains intentionally deferred to PRE-12 before monolithic merge.

## Level 3 app-phase status

**Deferred to PRE-12.**

Repository-wide Solidity/Genesis, Geth, Docs/global reconciliation, global fault/soak and final monolithic 420 Integrated qualification are not PRE-05 completion gates.

## Limitations / deliberately deferred work

- PRE-05 qualification uses deterministic offline/static chain and route adapters; PRE-10 owns production Exchange read/Indexer/startup composition.
- Production signer custody/HSM/KMS/operator procedures are operational PRE-11/live deployment concerns; no production private key is committed.
- Real deployed Exchange addresses/code hashes/live route state remain public-testnet gates.
- PRE-05 authenticates a quote but does not itself authorize wallet submission.
- PRE-06 must compose the authenticated quote into explicit review → confirmation → fresh preflight → default-OFF guarded-send orchestration.

## Next canonical roadmap step

**PRE-06 — guarded swap orchestration.**

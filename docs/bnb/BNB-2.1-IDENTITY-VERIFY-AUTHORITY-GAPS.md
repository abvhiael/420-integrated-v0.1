# BNB-2.1 — Independent authority gap reconciliation

**Status: BLOCKED, not accepted.** Reviewed current 420Identity and 420Verify specifications alongside the BnB runtime.

## Actual protocol boundaries

- `docs/apps/identity/permissions.md`: 420Identity controls profiles and issuer credentials. Possession of identity credentials does **not** authorize unrelated dApp permissions. BnB may consume properly authenticated Identity session proofs, but must independently enforce BnB scope, account state and property grants.
- `docs/apps/verify/verify-8-public-api-integrations.md`: 420Verify public `GET /v1/verify/{chainID}/{address}/{runtimeCodeHash}` provides **non-canonical software deployment evidence**. It is **not** a host/property title, controller or lodging license oracle. The service explicitly marks `canonical:false` and `registryAuthority:false`; the document forbids interpreting verification as an authorization grant.
- No independently specified 420Verify property/host claim API or authorized issuer was established in these inspected canonical files. BnB MUST NOT treat software verification as property control evidence.

## Mandatory acceptance gates

1. **420Identity session verification:** verify issuer/audience/chain and signed key provenance from a separately authenticated provider, key rotation, JWT identifier and replay, revocation on every mutation, clock skew, deactivation and session binding. An issuer-pinned JWT public-key configuration alone does not prove the production provider is live.
2. **Independent host/property claims:** specify an authorized property-claim issuer and verifiable controller/real-property ID and licensing rules. Require expiry/revocation, subject and property scope and deny fake/unavailable/ambiguous claims. 420Verify contract evidence alone is insufficient. Until the separate property authority is approved, publication is disabled.
3. **Secure account recovery:** recovery must be initiated and verified by approved Identity authority with an independently fresh and purpose-bound assertion; rotate credentials and invalidate *all* old sessions at recovery time, without security-question/local password bypass. Test stolen, old, replayed and cross-account proof.
4. **Every API mutation:** enforce authenticated, non-revoked Identity session; correct BnB app audience; host/guest or property-scoped capability; cross-tenant row constraints; no role/authority from caller headers, 420Verify software evidence or unverified tokens; recovery must immediately revoke mutations.
5. **Adversarial runtime acceptance:** execute actual PostgreSQL and multi-instance tests for expired/rotated/revoked tokens, IDOR, unauthorized publication, manager grant expiry, recovery replay, concurrent logout vs write, forged property claims and lost authority-provider availability.
6. **Testnet acceptance:** independently prove real Identity and approved property authority integration; until then no claims of live verification or enabled transactional booking.

**Qualification policy:** BNB-2.1 Level 1 remains BLOCKED until every above step is implemented/tested against one exact candidate SHA. Retain BNB runtime CI results as partial coverage, not comprehensive authorization evidence. No Level 2/3 or merge assertion.

## Testnet handoff — 2026-10-10

The actual network/Identity420 deployment, live issuer revocation/key lifecycle, independent property issuer governance/approval, and multi-instance provider-backed HTTP/PostgreSQL acceptance are now explicitly enumerated in [BNB-TESTNET-WORK-ROADMAP.md](BNB-TESTNET-WORK-ROADMAP.md) under T-BNB-IDENTITY-1, T-BNB-IDENTITY-2, T-BNB-PROPERTY-1 and T-BNB-INTEGRATION-1. This change relocates execution dependencies; it does **not** satisfy them or close BNB-2.1. Local API authorization, fail-closed recovery, replay, property scope, hostile adapters, and exact-SHA BnB CI remain non-testnet work. Do not promote the synthetic test signer or pending property claims into a live authority. Official ID-AUDIT-9 continues to control upstream network qualification.

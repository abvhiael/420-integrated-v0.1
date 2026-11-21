# AUTH-12 — Security, Privacy and Adversarial Qualification

## Scope and preserved authority

This phase qualifies the 420ID identity/authentication bridge, BongGoggles
wallet-free social and off-chain XP, optional wallet association, confidential
SSO introspection and monetization participation consent. AUTH-1 through
AUTH-11 remain canonical: 420ID has app-scoped subjects; the user may post,
message, play account-local games and accumulate off-chain XP without a wallet.
Neither XP, consent nor a wallet association creates a token entitlement,
claim, invoice, paid membership, transaction approval or canonical reward.

Previous evidence: AUTH-11 PR #1274 was merged at
`1ea18bd4ecda363cc0032b7866e1360dc9459075` after successful
AUTH-11-focused 420ID, social and browser workflows. Other unrelated
intervening main changes are not part of this security scope.

## Threat model and enforced invariants

| Boundary | Attack | Fail-closed defense / retained qualification |
|---|---|---|
| HTTP and JSON | Duplicate keys, case-folded Go struct aliases, Unicode keys, escaped duplicates, unknown fields and oversized bodies | 420ID `uniqueObject` and social `strictJSON` reject non-ASCII property names, folded duplicates, malformed/trailing JSON; existing HTTP body limit, origin, media type and CSRF checks remain |
| PostgreSQL runtime | Multi-privilege `has_table_privilege(...,'SELECT,INSERT')` previously returned true for **any one** grant | Each SQL privilege is independently required in social, social extras, 420ID SSO and optional wallet readiness; tests revoke one required grant at a time under real PostgreSQL `SET ROLE` |
| Separation of duties | Runtime compromise reads abuse reports, fabricates moderation or rewrites other users' opt-in | `social.ReadyRuntime` rejects reports read/write, moderation writes, hidden-post updates, full-comment UPDATE and forbidden deletes; `MonetizationManager.ReadyRuntime` rejects DELETE, TRUNCATE, full-table UPDATE and owner/app ID updates. Operator/migration checks remain distinct |
| Session revocation | Confidential SSO child considered active while its parent is revoked or user's monetization consent/wallet link is updated | SSO `Introspect` locks the parent, child and owning account in one PostgreSQL transaction and reads the private readiness projection in the same transaction. Concurrent revocation/consent updates serialize and immediately affect subsequent reads |
| Browser private data | Late status/consent response arrives after logout, visibility loss or another session, repopulating a prior user's participation details | 420ID browser uses a request-generation invalidation barrier and clears all member checkboxes and private status on sign-out or hidden tab; inconsistent payment/claim flags are rejected; no local cache authority |
| Wallet, XP and funds | Opt-in or linked wallet mistaken for a claim, XP converted into spendable tokens, hidden content farmed for XP | AUTH-10/11 boundary remains unchanged; existing wallet-verified canonical contracts exclusively authorize real rewards; new tests assert all programme status has no claim/paid/payment authority |
| External integration and rollout | Untrusted public edge or stale/unavailable 420ID confidential service | Existing exact-host, HTTPS ingress config, app-bound SSO, certificate verification and static secret boundaries remain; activation stays explicit and disabled by default; live ingress, migration/grants and deployed SSO client must be independently confirmed |

## Implementation files

Security defenses: `services/420id/acceptance.go`, `sso.go`,
`wallet_link.go`, `monetization.go`,
`services/bong-goggles-account-social/http.go`, `store.go`,
`cmd/420id/main.go`, `cmd/bong-goggles-social/main.go` and
`services/420id/monetization-ui.mjs`.

Adversarial regression cases:
`services/420id/security_test.go`,
`security_integration_test.go`, `monetization-ui.test.mjs`,
`services/bong-goggles-account-social/security_test.go` and
`security_integration_test.go`. The existing AUTH-1–11 tests continue
to run as part of the affected race-enabled PostgreSQL workflows.

## Operator and deployable readiness (distinct from unit qualification)

Only the separately approved operator applies migrations and grants.
The serving `account420_runtime` credential must have *only*
`SELECT,INSERT` and column-scoped `UPDATE(reward_opt_in,creator_opt_in,revision,updated_at)`
on `account420.monetization_consents`; it cannot DELETE, TRUNCATE,
update `account_id` or `app_id`, or hold unrestricted table UPDATE.
The social runtime cannot read `reports`, alter `posts.hidden_at`,
write `moderation_events` or mutate comments (only SELECT/INSERT).
Changes to the roles fail new startup checks before public HTTP is served.

The restriction does not abolish existing operator-only moderation or
wallet-signature workflows. For a real deployment, verify actual
PostgreSQL role grants using a separate least-privileged credential,
pin the approved SSO client and TLS edge, verify 420ID/Render/Neon
schemas, prove browser cookie and rollback behavior, and exercise
revocation plus privacy-negative probes on that same deployed release.
Until then all new AUTH-9/10/11 opt-ins remain gated. No on-chain rewards
are activated by AUTH-12.

## Qualification record

Affected exact-head GitHub workflow links, commit SHA and test outcomes
are recorded in the AUTH-12 pull request after CI completes. No earlier
run, simulated provider, or successful local PostgreSQL test may be
represented as a deployed service, audited on-chain payout or live
testnet acceptance. Do not merge this branch without an explicit request.

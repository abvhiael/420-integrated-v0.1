# Reefer Review security and trust model

## Protected assets
Article integrity, author/publisher attribution, visibility, rights/provenance evidence, moderation history, and confidentiality of non-public content.

## Trust boundaries
- Wallet/Identity authentication remains outside this replaceable application.
- Rights assertions are authoritative only when returned by a qualified 420 Rights integration.
- Article bodies are off-chain and must be stored by a qualified 420 Storage deployment.
- Search is a rebuildable projection and may never widen visibility.
- Notifications and 420Mail are delivery layers and cannot publish, modify rights, or authorize wallet actions.
- Moderators may alter application visibility only; they cannot transfer assets or rewrite rights evidence.

## Threats and repository mitigations
- SPAM/SYBIL: repository code validates identity activity; production rate limits and abuse controls remain a deployment gate.
- CONTENT_RIGHTS_ABUSE: publication requires a rights assertion over the article digest; live chain provenance is still required.
- MODERATION_ABUSE: HIDE/RESTORE requires a scoped authorizer; production capability audit remains required.
- INDEX_POISONING: only PUBLIC + PUBLISHED records are projected; Search failures do not mutate canonical publication state.
- WEBHOOK_REPLAY: this baseline exposes no webhook receiver. Future webhooks must be signed, expiring, replay-protected and idempotent.
- MESSAGING_ABUSE: 420Mail hook is outbound application delivery only; live source authentication and recipient controls remain required.
- private visibility leakage: public list and public item reads expose only PUBLIC/PUBLISHED content. Non-public author/editor reads are intentionally absent until viewer-aware Identity/session authorization is implemented.

## Accepted repository limitation
The development executable still uses development-only non-live dependency adapters and intentionally refuses staging/production startup. RR-4 removed the unsigned `X-420-Actor` authentication path from the HTTP/browser/client boundary; protected routes now fail closed without the deployment-supplied verified-session composition. Live Wallet/Identity verifier deployment remains a later live/deployment gate.


## RR-3 editorial lifecycle boundaries

RR-3 adds repository-stage revision, restricted-read, tombstone and moderation-history behavior without changing the production trust conclusion.

- State-changing editorial methods require an active actor through the injected Identity interface before authorization.
- Published edits require a fresh Rights assertion over the new body digest; prior revisions and their rights claims remain retained.
- Public article reads fail closed for PRIVATE/restricted/DRAFT/HIDDEN/TOMBSTONED records.
- The development `DevAuthorizer` includes explicit visibility rules solely to exercise viewer-aware flows. These rules are not production capability semantics.
- Tombstoning removes Search projection best-effort and blocks article reads and later edits, but RR-3 does not claim cryptographic deletion or storage erasure.
- Moderation HIDE, RESTORE and TOMBSTONE actions persist actor, action, reason, from/to status and timestamp.
- The browser continues to render external and editorial data through DOM text nodes rather than feed-provided HTML.
- RR-4 now supplies the repository-qualified verified-session, expiry/revocation and scoped-capability boundary. Live issuer/verifier deployment remains a later live/deployment gate.


## RR-4 Wallet / 420Identity session boundary

RR-4 removes unsigned actor-header authority from the public HTTP surface.

Protected editorial and moderation requests require a bearer credential verified by a deployment-supplied Wallet/420Identity session verifier. ReeferReview independently checks exact service audience, expected chain/network, session/wallet/subject shape, expiry, revocation and required capability before deriving the actor placed in request context.

Capability scopes are deliberately separated:
- `reefer.author` is ownership-bound;
- `reefer.publisher` may exercise publisher/editorial authority;
- `reefer.moderator` may moderate but cannot manufacture author ownership.

Restricted viewer eligibility is not inferred from mere authentication. FOLLOWERS, COMMUNITY_ONLY and ORGANIZATION_MEMBERS reads require verifier-derived visibility grants unless publisher authority applies.

The browser keeps bearer material memory-only and does not write session credentials to localStorage or sessionStorage. `X-420-Actor` is not sent or trusted.

Live Wallet/Identity gateway deployment, session issuer configuration and production ingress remain later live/deployment qualification and are not claimed by RR-4.

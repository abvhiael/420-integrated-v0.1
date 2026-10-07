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
- private visibility leakage: public list and anonymous reads remain bounded to published PUBLIC/UNLISTED policy; restricted reads require the RR-4 verified session/visibility boundary. RR-5 authorizes metadata before fetching an owner-scoped private body.

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


## RR-5 durable Storage / Rights boundary

RR-5 separates durable application metadata from authoritative body storage and Rights provenance.

- Publication, revision, moderation and idempotency metadata use the schema-versioned `DurableStore`; state writes use an exclusive file lock, temporary file, fsync, atomic rename, 0600 permissions and directory sync.
- Corrupt JSON, inconsistent publication/revision linkage and unsupported future store schemas fail closed.
- Article plaintext is not persisted in the metadata store.
- The qualified RR-5 composition requires a 420 Storage provider security profile asserting encryption at rest, external key custody, owner-scoped access and SHA-256 integrity.
- ReeferReview independently checks requested SHA-256 before upload and verifies canonical ObjectRef size/root on write and read.
- Unauthorized restricted reads are rejected from publication metadata before any private blob retrieval.
- Publishing and published revisions require structured 420 Rights provenance. Body-digest substitution, wrong holder wallet, wrong chain or wrong network fail closed when corresponding session evidence exists.
- ReeferReview does not mint Rights claims, grant licenses, choose canonical Registry addresses or treat its local metadata as Rights authority.

Live Storage provider encryption/key-custody proof, live Rights deployment/Registry resolution and production recovery remain later live/testnet/deployment gates.


## RR-6 Search / Notifications / Mail integration boundary

RR-6 treats all three shared services as non-canonical side effects of an already-authorized publication.

- Search admission is exactly PUBLIC + PUBLISHED and requires retained 420Rights provenance matching the article digest.
- Search results use the canonical 420Search result schema and a ReeferReview-owned source-key namespace; reconciliation may delete only ReeferReview article projections.
- Search failure cannot roll back publication, moderation or Rights state.
- Notifications requests target canonical `420/service/notifications/v1`, are idempotent and exclude article body bytes, Storage locators, sessions, bearer tokens and wallet secrets.
- Notification consent suppression is accepted without fabricating delivery evidence; contradictory or incomplete receipts fail closed.
- Internal 420Mail delivery uses canonical `420/service/mail/v1` source semantics rather than spoofing `420/service/reefer-review/v1` as Mail authority.
- Mail recipients come from a deployment-supplied opt-in audience boundary; external SMTP and paid external newsletters remain disabled.
- The durable integration outbox is non-authoritative recovery state. It is schema-versioned, locked, owner-only, atomically replaced and fsynced.
- Search/Notifications/Mail outage leaves replayable pending work and may surface warnings, but cannot undo or widen the canonical ReeferReview publication.
- A moderation-time Search delete failure is retained for later reconciliation even though canonical moderation intentionally does not fail on derived Search outage.

Live endpoint authentication, provider credentials, public-testnet outage/recovery and production monitoring remain later deployment gates.

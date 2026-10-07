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
The development executable uses explicit development adapters and the `X-420-Actor` harness header. It intentionally refuses staging/production startup. This is not production authentication and must never be placed behind public ingress unchanged.


## RR-3 editorial lifecycle boundaries

RR-3 adds repository-stage revision, restricted-read, tombstone and moderation-history behavior without changing the production trust conclusion.

- State-changing editorial methods require an active actor through the injected Identity interface before authorization.
- Published edits require a fresh Rights assertion over the new body digest; prior revisions and their rights claims remain retained.
- Public article reads fail closed for PRIVATE/restricted/DRAFT/HIDDEN/TOMBSTONED records.
- The development `DevAuthorizer` includes explicit visibility rules solely to exercise viewer-aware flows. These rules are not production capability semantics.
- Tombstoning removes Search projection best-effort and blocks article reads and later edits, but RR-3 does not claim cryptographic deletion or storage erasure.
- Moderation HIDE, RESTORE and TOMBSTONE actions persist actor, action, reason, from/to status and timestamp.
- The browser continues to render external and editorial data through DOM text nodes rather than feed-provided HTML.
- Production authentication, revocation, capability issuance and session expiry remain RR-4.

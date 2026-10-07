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
- private visibility leakage: public List filters to PUBLIC/PUBLISHED. Production reads must add viewer-aware checks before non-public body retrieval.

## Accepted repository limitation
The development executable uses explicit development adapters and the `X-420-Actor` harness header. It intentionally refuses staging/production startup. This is not production authentication and must never be placed behind public ingress unchanged.

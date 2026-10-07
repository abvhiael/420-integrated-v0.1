# ReeferReview web app

The ReeferReview web directory is the browser surface for the repository-stage application.

## RR-2 routes

Client-side hash navigation:

- `#latest` — combined external cannabis news and ReeferReview Originals.
- `#news` — persistent external cannabis-news feed with source/topic filters and keyset pagination.
- `#originals` — public ReeferReview publications.
- `#topics` — topics supplied by the RR-1 news API.
- `#search` — searches the external news API and filters public originals.

The browser uses same-origin API paths. Static hosting alone is not a complete application deployment; `/v1/news...` and `/v1/publications...` must route to the ReeferReview backend.

External stories remain clearly labeled and use their canonical publisher URL with a **Read original** handoff. The UI does not copy full third-party article bodies.

## Accessibility baseline

RR-2 includes:
- skip link;
- semantic header/nav/main/sections/footer;
- programmatic form labels;
- visible keyboard focus;
- live status regions;
- current-page navigation state;
- responsive layouts;
- reduced-motion handling;
- non-color-only external/original labels.

Browser E2E and formal accessibility qualification remain RR-9 work.


## RR-3 / RR-4 editorial and identity routes

Additional hash routes:
- `#article/{publicationID}` — article reader.
- `#editorial` — authenticated write/edit/publish workspace.
- `#moderation` — authenticated moderation workspace.

RR-4 replaces the earlier development actor-entry control. Protected browser requests now use a deployment-provided `window.ReeferReviewWalletSession` gateway and `Authorization: Bearer` credentials. The token remains memory-only and is not written to localStorage or sessionStorage. If a qualified Wallet gateway is unavailable, protected actions fail closed.

The browser does not mint sessions or infer author/moderator authority. The backend validates audience, network/chain, expiry, revocation, active Identity state and scoped capability.

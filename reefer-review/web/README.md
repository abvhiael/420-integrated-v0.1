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

# RR-11 — Cloudflare Pages read-only RSS preview proxy

This is **preview integration only**. Render's free service has an **ephemeral filesystem**: news items, source changes and poll checkpoints may be lost after a restart, redeploy or idle shutdown. This does not satisfy RR-11 persistent-storage, rights, operational or production gates.

## Pages setup

- Confirm the **ReeferReview Pages project** is Git-connected to this repository.
- For the provided `functions/` tree to be detected, configure **Root directory: repository root** (leave blank in the Cloudflare Pages dashboard).
- Use **Build output directory: `reefer-review/web`**. Preserve existing build configuration if a site-specific build step is required. **Do not** put `functions/` inside the static web output directory. Do not configure the entire monorepo's other Pages sites to use this proxy.
- Do not deploy until confirming the currently deployed ReeferReview Pages project can retain its existing static assets and all other API behavior. Changing its root may affect build behavior; capture the current settings first.
- Deploy this branch to a Pages preview first. Validate before merging to `main`.

## Routing

Cloudflare Pages Functions:
- `GET/HEAD /v1/news`
- `GET/HEAD /v1/news/*` (article, sources and topics paths only as supported by upstream)

They forward only public JSON queries to `https://reeferreview-rss-preview.onrender.com`, preserving query strings, without forwarding client credentials/cookies. Other methods return 405. Admin endpoints (`/v1/admin/news/sources`), editorial, Wallet and chain APIs are **not** proxied. Root assets are unchanged. API responses are marked `no-store`, and redirects are not followed.

## Acceptance checklist

1. Check Render `/readyz` and `/v1/news?limit=5` directly; verify actual HTTP response, real source attribution and canonical publisher URLs.
2. Visit the **Cloudflare Pages preview** of ReeferReview: test `/v1/news?limit=5`, `/v1/news/sources`, `/v1/news/topics`, news filters and home/latest, and verify no cross-origin fetch/CORS problem.
3. Ensure `POST /v1/news` is 405 and `/v1/admin/news/sources` is **not routed through this proxy**.
4. Confirm existing static pages and ReeferReview Originals remain intact. The news-only backend does **not** supply `/v1/publications`; latest/originals may still show unavailable unless separately backed.
5. Review Pages Function logs and Render polling logs. Free Render may sleep on inactivity and its temporary files may be cleared. Do not call RSS storage durable or label production ready.
6. For a production launch, provide durable shared storage or a safe transactional DB adapter, backups, rights review, operational controls, tested same-origin ingress, and retained app qualification.

## Rollback

Remove the new `functions/v1/news.js`, `functions/v1/news/[[path]].js` and the helper on this branch or roll back the Pages deployment. No Render storage configuration is changed.

# RR-11 — Cloudflare Worker RSS preview proxy

**Preview only:** the Render free instance still uses an ephemeral filesystem, not durable article or checkpoint storage. This change does not satisfy production, source rights or persistence gates.

## Confirmed Cloudflare deployment settings (operator screenshot, 2026-10-08)

- Cloudflare Workers & Pages > `reeferreview` > Production > Settings
- Git repository: `abvhiael/420-integrated-v0.1`
- Production branch: `main`
- Root directory: `reefer-review/web`
- Build command: none
- Deploy command: `npx wrangler deploy`

**Do not migrate this deployment to Pages** or change its root directory. The previous `functions/` approach was inappropriate for the existing Worker deployment and has been removed from this PR.

## Implementation

- `reefer-review/web/wrangler.jsonc`: configures named Worker `reeferreview`, script entrypoint and an existing-directory static asset binding. The worker runs before only `/v1/news` and `/v1/news/*`. Other requests continue via `env.ASSETS.fetch(request)`.
- `reefer-review/web/worker.js`: proxy only GET/HEAD public news routes to `https://reeferreview-rss-preview.onrender.com`. Preserves path, query and conditional request headers. Rejects redirects, strips incoming cookies and authorization, and does not expose admin routes.
- `reefer-review/web/.assetsignore`: prevents the Worker implementation and config files from being served as public site assets.
- No Render storage changes, no paid resources, no chain/testnet changes.

## Preview procedure (manual Cloudflare action required)

1. Check out branch `reeferreview/cloudflare-rss-proxy` and run `cd reefer-review/web`. Do **not** use the existing production command `npx wrangler deploy` on this branch to test a preview. The separate checked-in `wrangler.preview.jsonc` explicitly names the preview Worker `reeferreview-rss-preview-worker`.
2. Validate with `npx wrangler deploy --config wrangler.preview.jsonc --dry-run`.
3. From that same directory, deploy with `npx wrangler deploy --config wrangler.preview.jsonc`. The expected preview address is the `workers.dev` URL printed by Wrangler (the account-specific subdomain must be read from actual output). Check the printed Worker name is `reeferreview-rss-preview-worker` before accepting. Do not merge to `main` or trigger the production Git build until acceptance.
4. Check preview `/v1/news?limit=5`, `/v1/news/sources`, `/v1/news/topics`, static index/assets, and reject POST `/v1/news`.
5. Verify publisher attribution and real articles via the live JSON response. An HTTP 200 alone is insufficient.
6. Verify the existing site's latest view separately; the RSS-only Render backend does not serve `/v1/publications`, so original/editorial requests still require their own backing service.
7. Observe Cloudflare preview request logs and Render poller logs. No persistent news durability is implied.

### Live HTTP checks

Use the **actual URL printed by Wrangler** as `PREVIEW_URL` (no trailing slash), then run:

```sh
curl -i "$PREVIEW_URL/"
curl -i "$PREVIEW_URL/styles.css"
curl -i "$PREVIEW_URL/v1/news?limit=5"
curl -i "$PREVIEW_URL/v1/news/sources"
curl -i "$PREVIEW_URL/v1/news/topics"
curl -i -X POST "$PREVIEW_URL/v1/news"
curl -i "https://reeferreview-rss-preview.onrender.com/v1/news?limit=5"
```

Passing requires HTTP 200 plus real publisher stories for article retrieval, static HTML and CSS served correctly, and HTTP 405 for POST. Missing articles or unavailable upstream **do not** count as a pass. Keep evidence tied to the exact commit SHA and deployed Worker version.

## Rollback

Rollback the isolated preview Worker or remove `worker.js`, `wrangler.jsonc` and `.assetsignore` before merging; production is unchanged while the PR is unmerged.

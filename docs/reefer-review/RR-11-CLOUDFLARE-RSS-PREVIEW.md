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

1. Confirm that Cloudflare preview builds can be selected for `reeferreview/cloudflare-rss-proxy`. If a preview deploy will still target production `reeferreview` by name, **do not run** the ordinary deploy command. Use a separate preview Worker name/config and domain; do not overwrite the production Worker.
2. Validate the Worker bundle with `npx wrangler deploy --dry-run` from `reefer-review/web` using the Cloudflare project token and expected Wrangler version.
3. Deploy into an isolated preview Worker; do not merge to `main` or trigger the production Git build until acceptance.
4. Check preview `/v1/news?limit=5`, `/v1/news/sources`, `/v1/news/topics`, static index/assets, and reject POST `/v1/news`.
5. Verify publisher attribution and real articles via the live JSON response. An HTTP 200 alone is insufficient.
6. Verify the existing site's latest view separately; the RSS-only Render backend does not serve `/v1/publications`, so original/editorial requests still require their own backing service.
7. Observe Cloudflare preview request logs and Render poller logs. No persistent news durability is implied.

## Rollback

Rollback the isolated preview Worker or remove `worker.js`, `wrangler.jsonc` and `.assetsignore` before merging; production is unchanged while the PR is unmerged.

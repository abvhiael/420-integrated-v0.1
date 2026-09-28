# 420Explorer Cloudflare deployment

This directory publishes the branded 420Explorer frontend at **https://explorer.420integrated.org** using Cloudflare Workers + Static Assets.

## Architecture

```text
explorer.420integrated.org
        |
        +-- static UI -> explorer/web/static
        |
        +-- /v1/* -> Cloudflare Worker -> EXPLORER_ORIGIN -> 420Explorer Go service -> 420Indexer
```

The browser remains a same-origin consumer of the qualified `/v1/*` Explorer API. The Worker does not talk directly to node420 or the consensus service and does not become canonical authority.

## Required Cloudflare/GitHub configuration

The Cloudflare account must manage the `420integrated.org` zone.

Configure these GitHub Actions secrets before the first production deployment:

- `CLOUDFLARE_API_TOKEN` — token permitted to deploy Workers and manage the custom-domain route.
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID.
- `EXPLORER_ORIGIN` — the **HTTPS** production-equivalent 420Explorer Go-service origin.

`EXPLORER_ORIGIN` must not be a loopback address. The Worker deliberately returns `503 ORIGIN_NOT_CONFIGURED` if it is absent and refuses non-HTTPS/loopback origins.

The public browser never receives this origin value.

## Custom domain

`wrangler.jsonc` declares:

```json
{
  "pattern": "explorer.420integrated.org",
  "custom_domain": true
}
```

On the first authorized production deployment, Cloudflare creates/manages the Worker custom-domain DNS binding and certificate for `explorer.420integrated.org`.

Do not create a competing DNS record for the same hostname.

## Qualification

From `explorer/cloudflare`:

```sh
node --check src/worker.mjs
node --test test/*.test.mjs
```

Repository Explorer tests must also pass:

```sh
go test ./explorer/...
go vet ./explorer/...
```

## Deployment

Production deployment is intentionally **manual-only** through the GitHub Actions workflow **420Explorer Cloudflare**.

1. Merge/choose the exact qualified commit intended for deployment.
2. Ensure the three GitHub secrets above are configured.
3. Run **Actions → 420Explorer Cloudflare → Run workflow**.
4. Set `deploy_production=true`.
5. The workflow tests the UI/Worker, stores `EXPLORER_ORIGIN` as a Worker secret, then deploys the Worker/static assets.
6. Verify:
   - `https://explorer.420integrated.org/`
   - `https://explorer.420integrated.org/v1/health`
   - `https://explorer.420integrated.org/v1/ready`
   - `https://explorer.420integrated.org/v1/status`

For EXP-NEXT.4, the public URL should be used as `EXPLORER_LIVE_URL=https://explorer.420integrated.org` only after the backend/indexer/canonical sources are production-equivalent and the live evidence requirements are available.

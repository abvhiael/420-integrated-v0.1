# 420Status Cloudflare deployment

This directory publishes the branded 420Status frontend at **https://status.420integrated.org** using Cloudflare Workers + Static Assets.

## Architecture

```text
status.420integrated.org
        |
        +-- static UI -> status/web/static
        |
        +-- /v1/*, /healthz, /readyz
              -> Cloudflare Worker
              -> STATUS_ORIGIN
              -> status420 Go service
              -> 420Indexer / public evidence sources
```

The browser remains a same-origin consumer of the qualified read-only 420Status API. The Worker is presentation infrastructure only and never becomes canonical protocol authority.

## Required GitHub / Cloudflare configuration

The Cloudflare account must manage the `420integrated.org` zone.

Configure these GitHub Actions secrets:

- `CLOUDFLARE_API_TOKEN` — token permitted to deploy Workers/custom domains.
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID.
- `STATUS_ORIGIN` — optional until the backend is live; later set to the HTTPS production-equivalent `status420` service origin.

If `STATUS_ORIGIN` is absent, the website still deploys and `/v1/*` fails closed with `503 ORIGIN_NOT_CONFIGURED`. The public browser never receives the origin value.

## Custom domain

`wrangler.jsonc` declares `status.420integrated.org` as a Worker custom domain. Let Cloudflare create/manage its DNS binding and TLS certificate; do not create a competing DNS record manually.

## Qualification

From `status/cloudflare`:

```sh
npm install --no-audit --no-fund
npm test
npm run check
npx wrangler deploy --dry-run
```

Repository Status checks also remain required:

```sh
go test ./status/...
go test -race ./status/...
go vet ./status/...
go build ./status/cmd/status420
```

## Deployment

Production deployment is manual-only through **Actions → 420Status Cloudflare**.

1. Merge the exact qualified commit to `main`.
2. Configure `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.
3. Run **420Status Cloudflare** with `deploy_production=true`.
4. The workflow deploys the branded static site even when `STATUS_ORIGIN` is not configured.
5. When the production-equivalent `status420` backend exists, add `STATUS_ORIGIN` and rerun the workflow.
6. Verify:
   - `https://status.420integrated.org/`
   - `https://status.420integrated.org/healthz`
   - `https://status.420integrated.org/readyz`
   - `https://status.420integrated.org/v1/status`

A public shell deployment does **not** by itself make 420Status testnet-, Genesis-, or production-ready. Those claims still require live backend evidence and the remaining STATUS-AUDIT roadmap work.

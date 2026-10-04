# 420Analytics Cloudflare deployment

This directory publishes the public 420Analytics dashboard at **https://analytics.420integrated.org** using Cloudflare Workers + Static Assets.

## Architecture

```text
analytics.420integrated.org
        |
        +-- static dashboard -> analytics/cloudflare/public
        |
        +-- /v1/*, /health, /ready
              -> Cloudflare Worker
              -> ANALYTICS_ORIGIN
              -> analytics420 Go service
              -> qualified 420Indexer
```

The public shell can deploy before the backend exists. Until `ANALYTICS_ORIGIN` is configured, API routes fail closed with `503 ORIGIN_NOT_CONFIGURED`; that state is **not** ANALYTICS-9 live qualification evidence.

## Cloudflare build settings

Use:

- Project name: `analytics`
- Build command: `npm install --no-audit --no-fund && npm test && npm run check`
- Deploy command: `npx wrangler deploy`
- Preview command: `npx wrangler dev`
- Root directory: `/analytics/cloudflare`

The Cloudflare account must manage the `420integrated.org` zone.

## Backend origin

When the production-equivalent Analytics backend exists, configure the Worker secret:

```sh
npx wrangler secret put ANALYTICS_ORIGIN
```

The value must be an HTTPS, non-loopback origin for the deployed `analytics420` service. The browser never receives this value.

## Custom domain

`wrangler.jsonc` declares `analytics.420integrated.org` as a Worker custom domain. Let Cloudflare manage the DNS binding and TLS certificate; do not create a competing DNS record manually.

## Qualification

From `analytics/cloudflare`:

```sh
npm install --no-audit --no-fund
npm test
npm run check
npx wrangler deploy --dry-run
```

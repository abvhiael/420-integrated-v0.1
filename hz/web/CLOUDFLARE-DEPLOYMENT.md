# 420Hz Cloudflare Pages deployment

## Intended public origin

`https://hz.420integrated.org`

The repository site is safe to publish before the public testnet because every state-changing or chain-dependent user action is disabled by default. Publishing the static site does **not** complete HZ-AUDIT-7 and does not establish any live chain deployment.

## Cloudflare Pages values

- Framework preset: **None**
- Production branch: choose the branch intentionally being deployed
- Root directory: repository root
- Build command: **leave empty**
- Build output directory: **hz/web**

Do not set `hz/web` as both the root directory and the output directory.

## Custom domain

After the Pages preview is verified, bind:

`hz.420integrated.org`

through the correct Cloudflare account/zone.

## Live runtime gate

`runtime-config.js` intentionally ships with:

- `liveEnabled: false`
- `chainId: null`
- `indexerBaseUrl: null`

HZ-AUDIT-7 must supply and qualify the real public-testnet chain identity, deployed addresses, ProtocolRegistry bindings and live indexer/RPC configuration before those gates are changed. The website must not infer or invent these values.

## Verification

Run:

`python3 scripts/verify-420hz-web.py`

The verifier checks the production origin, static assets, fail-closed runtime configuration, CSP/security headers and required user-facing sections.

# 420Hz user-facing web application

## Status

Repository implementation: **IMPLEMENTED — pre-testnet static client**.

Public origin reserved by this implementation:

`https://hz.420integrated.org`

This website is the user-facing presentation layer for 420Hz. It does not replace chain, Registry, rights, settlement or indexer authority.

## Official brand

The approved 420Hz logo is committed as:

`hz/web/420hz-logo.svg`

That asset embeds the approved logo image and is the canonical website brand image. The site uses it for:

- the browser favicon;
- the sticky header brand image;
- the primary hero/main website image;
- the footer brand image.

The surrounding visual system follows the approved artwork: lustrous gold, rich forest green, cannabis green and electric blue accents on a deep green-black field.

## User experience

The initial client provides:

- 420Hz public brand/home experience;
- music/creator product positioning;
- discover capability search;
- artist/catalog empty states that do not fabricate live data;
- rights/credits explanation;
- playback/streaming economics presentation;
- creator-studio entry point;
- explicit network/testnet status;
- fail-closed Wallet/publishing controls before live deployment.

## Trust boundaries

Before HZ-AUDIT-7:

- Wallet connection is disabled;
- publishing is disabled;
- Creator Studio state-changing actions are disabled;
- no live artist/release data is represented;
- no chain ID is invented;
- no Indexer URL is invented;
- no deployed HZ address is invented.

After HZ-AUDIT-7, the web client may be bound to the verified testnet deployment only through qualified runtime configuration.

## Files

- `hz/web/index.html`
- `hz/web/styles.css`
- `hz/web/app.js`
- `hz/web/runtime-config.js`
- `hz/web/420hz-logo.svg`
- `hz/web/favicon.svg` (legacy asset retained but no longer canonical)
- `hz/web/_headers`
- `hz/web/CLOUDFLARE-DEPLOYMENT.md`
- `scripts/verify-420hz-web.py`
- `.github/workflows/420hz-web.yml`

## Deployment

See `hz/web/CLOUDFLARE-DEPLOYMENT.md`.

Repository implementation does not itself claim that the Cloudflare Pages project, custom domain, DNS record or public endpoint is already deployed.

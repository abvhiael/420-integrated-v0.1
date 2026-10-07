# 420Hz user-facing web application

## Status

Repository implementation: **IMPLEMENTED — pre-testnet static client**.

Public origin reserved by this implementation:

`https://hz.420integrated.org`

This website is the user-facing presentation layer for 420Hz. It does not replace chain, Registry, rights, settlement or indexer authority.

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
- `hz/web/favicon.svg`
- `hz/web/_headers`
- `hz/web/CLOUDFLARE-DEPLOYMENT.md`
- `scripts/verify-420hz-web.py`
- `.github/workflows/420hz-web.yml`

## Deployment

See `hz/web/CLOUDFLARE-DEPLOYMENT.md`.

Repository implementation does not itself claim that the Cloudflare Pages project, custom domain, DNS record or public endpoint is already deployed.

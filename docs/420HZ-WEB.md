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

## Planned Generate / Community / Awards expansion

The current static web client reflects the already implemented publishing/rights/streaming foundation. The next dedicated 420Hz application phase is defined in `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`.

That phase adds:

- a prominent **Generate your own song** entry point;
- AI-generated / AI-assisted song creation through 420AI + Compute Market;
- project/version/stem/provenance workflows;
- Generate → register Work/Recording → publish integration;
- community follows/favorites/playlists and chart/discovery projections;
- award seasons/categories, nominations, voting, results and permanent badges;
- anti-Sybil, moderation, privacy and adversarial hardening;
- production-equivalent testnet qualification before live claims.

Generate Studio is now repository-implemented under HZ-GCA-6 using qualified deterministic mock/dev execution. It remains explicitly pre-testnet and must not imply that live generation, registration/publication, community voting or awards are already deployed.


## Generate Studio

HZ-GCA-6 adds a prominent **Generate your own song** home-page CTA and a fully navigable pre-testnet Generate Studio.

The repository-qualified UX includes:

- prompt and optional lyrics composer;
- advanced genre/style/mood/instrumentation controls;
- development cost/capacity preview;
- accessible generation progress;
- deterministic A/B take comparison;
- audio/stem preview surfaces without fabricated public media URLs;
- provenance/disclosure presentation;
- save/regenerate/remix controls;
- explicit Register & Publish handoff owned by HZ-GCA-7;
- failure/retry/refund state;
- responsive/mobile layout and reduced-motion/accessibility support.

The Generate Studio uses deterministic mock/dev state only. It does not enable Wallet signing, submit publication transactions, invent a production chain/provider/storage endpoint, or represent generation success as registration/publication success.

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

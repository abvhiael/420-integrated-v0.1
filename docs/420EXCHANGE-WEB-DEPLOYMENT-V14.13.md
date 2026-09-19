# 420Exchange V14.13 Production Deployment

The production target is `https://exchange.420integrated.org`. V14.13 packages the qualified Exchange web client as a static artifact without introducing protocol authority.

## Artifact

Run `npm run build` from `exchange/web`. Production mode requires the deployment environment to provide:

- `EXCHANGE_CHAIN_ID`
- `EXCHANGE_RPC_URL`
- `EXCHANGE_EXPLORER_URL`
- `EXCHANGE_API_BASE_URL`
- `EXCHANGE_STREAM_URL`
- optional comma-separated `EXCHANGE_MARKET_SUBJECTS`

The build fails closed if required production values are missing. It generates `dist/` with the application, runtime configuration, `CNAME`, SPA `404.html`, provider-compatible `_headers`, `build-meta.json`, and `deployment-manifest.json`.

## DNS and TLS

The artifact pins `exchange.420integrated.org` as the custom domain. DNS and hosting-provider setup are operational configuration outside repository source. The production provider must terminate HTTPS, redirect HTTP to HTTPS, and apply the generated security-header policy. Do not mark V14.13 production-live until the public hostname serves the qualified artifact over HTTPS and the header policy is observed at the edge.

## Runtime endpoints

The repository intentionally does not hard-code production RPC/API/stream endpoints. Deployment variables inject those values into `runtime-config.json`. Endpoint values must remain HTTPS/WSS and may not contain embedded credentials.

## Cache policy

HTML and build metadata should revalidate. `runtime-config.json` should be `no-store`. Static source assets may be cached only according to the hosting provider's release/version strategy. Because this app currently uses unhashed filenames, do not configure effectively permanent caching for `app.js` or `styles.css` until fingerprinted assets are introduced.

## Rollback

1. Identify the last exact-head V14 artifact that passed Exchange Web, Integrated, and Docs qualification.
2. Redeploy that artifact without modifying chain state, contracts, orders, bridge records, or indexer data.
3. Verify `build-meta.json` reports the expected source SHA.
4. Verify `runtime-config.json` still targets the approved production network/API endpoints.
5. Verify HTTPS, custom domain, CSP, frame denial, and API connectivity.
6. Record the rollback artifact SHA in the deployment record.

A rollback is a presentation-layer operation only; it must never mutate protocol state.

## V14.13 release gate

Repository qualification proves artifact construction and deployment workflow behavior. Public production qualification additionally requires live DNS/TLS/provider configuration and real production network/API variables. Those operational values are not yet present in repository runtime configuration and therefore remain a V14.13/V14.14 release gate.

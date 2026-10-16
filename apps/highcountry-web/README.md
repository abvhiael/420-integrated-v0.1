# High Country R06.1 browser shell

Node 22+; no installation or third-party dependencies required for the R06.1 application shell.

From repository root: `node apps/highcountry-web/scripts/build.mjs`, then
`HIGHCOUNTRY_RUNTIME_CONFIG=apps/highcountry-web/config/offline.example.json node apps/highcountry-web/server.mjs`.
Open http://127.0.0.1:4174/.

**Offline configuration is explicit.** This is only the R06.1 shell, **not yet a playable game**. R06.2 implements the guest local-save gameplay loop.

A connected configuration uses `schema:"highcountry-web-runtime-v1"`, `mode:"connected"`, a positive numeric `chainId`, an authoritative nonzero 32-byte `gameId`, HTTPS `rpcUrl` and `apiUrl`, and nonzero deployed addresses for `contracts.gameRegistry`, `contracts.gameIdentity`, `contracts.gameEntitlements`, and `contracts.gameClaims`. Never insert example/fake contracts into production configuration. The existing `deployments/gaming/testnet.runtime.json` is unresolved; it must **not** silently enable connected production mode. No player wallet is required for shell access.

Run `node --test apps/highcountry-web/test/*.test.mjs`, `npm --prefix apps/highcountry-web run check`. The build copies static entrypoints with deterministic source bytes, while the server supplies explicit validated configuration. Routes: /, /play, /account, /settings, /about. Network reachability is checked with `eth_chainId`; an unreachable or wrong-chain RPC is exposed honestly. The application makes no wallet transaction and stores no credential.

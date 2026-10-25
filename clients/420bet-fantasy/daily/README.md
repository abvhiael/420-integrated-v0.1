# Daily hockey application and confidential custodian

This application uses the canonical FantasyContestEngine420, its admission/ranking modules, FantasySlateBook420, FantasyDisputeController420 and actual ERC20 $420. Production contract sources are unchanged. A local browser integration runner deploys those contracts to isolated Anvil and exercises real WebCrypto, signed receipts, wallet transactions, two-operator oracle reports, stat proofs, challenge bonds and canonical settlement. Sports statistics in this runner are explicitly synthetic. Live NHL/testnet qualification remains in the testnet roadmap.

## Install and qualify locally

Use Python 3.12, Node 22 or newer, pnpm 11.25.0, Foundry 1.8.6 and solc 0.8.30.

```sh
python -m pip install -r clients/420bet-fantasy/daily/requirements.txt
pnpm --dir clients/420bet-fantasy/daily install --frozen-lockfile --ignore-scripts
pnpm --dir clients/420bet-fantasy/daily exec playwright install chromium
node clients/420bet-fantasy/daily/build.mjs
python scripts/fantasy/qualify-daily-application.py --output work/daily-qualification
```

Use `--forge`, `--anvil` and `--solc` for explicit binary paths. A clean scoped Git commit is required for an exact-SHA qualification certificate. `--allow-dirty` is diagnostic only and cannot produce a passing certificate. Compilation is not counted as a contract test: the browser runner performs the real integration transactions and asserts outcomes and token conservation. The injected EIP-1193 wallet uses public local Anvil accounts and genuine signatures; it does not qualify external wallet-extension approval screens.

The runner creates and tears down its own isolated services. Public evidence comprises qualification.json, source-checksums.json, deployment.json, browser-result.json, conservation.json, compile/browser logs and desktop/mobile screenshots. NEVER upload the output `private/` directory, SQLite files, database backups or keys. Actual private custody files are generated independently for each run; the restart test reuses the same directory within its run.

## Operator configuration

```sh
python clients/420bet-fantasy/daily/init-custodian.py --directory /private/new-custodian
python clients/420bet-fantasy/daily/server.py --config /private/application.json --private-directory /private/new-custodian --port 8420
```

The initializer refuses an existing directory and prints only public identities. Restrict the private directory to the service identity using native OS ACLs (especially on Windows); POSIX mode bits alone do not establish Windows access control. Encrypt disks and backups. Back up SQLite consistently with its WAL using SQLite backup tooling, together with the separately protected storage/encryption keys. Restore and test before admitting funded entries. The validator key issues receipts; a separate, minimally funded publisher signs only permissionless lock/publication/recovery transactions. Neither key can authorize user funding. Fund the publisher with network gas and monitor `/api/health` for publication failures before the one-hour publication deadline. Run one active publisher per custodian database.

`application.json` is deployment-specific: chainID, HTTPS (or loopback) rpc, deploymentBlock, engine, asset, codeHashes mapping every module address to its keccak runtime hash, profiles (name, subject, credential, account; optional resolverCredential), slates keyed by frozen slate ID (name, lockAt, athletes with id/name/positions), plannedPools, candidateFeeds keyed by reserved pool ID and candidateFeed fallback. A generated public deployment.json from local qualification illustrates this schema. `localQualification:true` is accepted only on isolated loopback chain 31337. Do not use public Anvil keys outside that environment.

Before sealing a slate, publish the generated encryption key hash and actual validator identity, grant its slate-scoped VALIDATE_LINEUP capability, register the canonical independent custodian identity and establish verified user/resolver credentials. Reserve pool IDs with the engine's dispute-controller registration capability and configure their candidate feeds. Slate metadata and profiles are public display/discovery records; authority and eligibility are always checked against contracts. The client supports public and invitation-only pools, optional entrant caps, launcher-funded free prizes, paid entries, pre-lock edits, entry pagination, standings, challenges, resolver review, payouts and refunds. Two entrants use winner-take-all; three or more use the frozen configurable rank percentages (60/30/10 by default). One lineup per canonical person is enforced on-chain.

The server binds only loopback and enforces its exact same-origin Host/Origin. Remote hosting, TLS termination, public ingress/rate limits, secret-manager integration and operational redundancy require separate deployment qualification. It is ready for local application use; this certificate does not claim public hosting or live sports settlement. Run the existing Sportradar verified-statistics/oracle workflow for sports-data ingestion; the test harness control endpoint is isolated, randomly authenticated and never part of the application service.

## Custody and disputes

Browser X25519/HKDF-SHA256/AES-GCM envelopes bind pool, subject and nonce. The server requires wallet consent bound to chain, engine, credential, actor and exact receipt digest, verifies current seat-independent fantasy identity/capabilities, decrypts, validates all seven unique position slots and commitment, synchronously commits AES-GCM sealed storage, then rechecks authority before signing. No plaintext lineup/salt is submitted over HTTP. At most eight distinct pending receipts per subject/pool/nonce bound storage growth; submitting an existing receipt remains idempotent. This does not cap accepted edits: each accepted edit advances the nonce.

Only the receipt matching the actual accepted on-chain nonce and commitment is published. A newer issued but unaccepted receipt cannot replace it. Production publication waits for a finalized post-lock snapshot and wall clock. Underfilled pools cancel separately from publication. Missing publication invokes canonical recovery/refunds. Retain keys and accepted receipts through settlement and the operational retention policy; avoid logging request bodies.

Challenges retain public evidence text whose hash must match an actual confirmed claim. A verified independent resolver with claim-scoped capability can decide only after review closes and before its deadline. Upheld bonds return to the payer; denied bonds credit the community fund. Corrected candidates undergo another review under the original bounded deadline. No application endpoint manufactures statistics, bypasses authority or signs user transactions. Backend transaction plans allowlist canonical destinations, require exact token approvals and zero native payment; wallets recheck account/network and estimate each transaction before signing.

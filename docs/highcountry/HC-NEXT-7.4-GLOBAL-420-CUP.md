# HC-NEXT-7.4 — Global 420 Cup integration ledger

**Status: PRE-TESTNET LEVEL 2 QUALIFIED on implementation SHA `d179dda303af1e1cd0f79f7843716fc18326ef46` (2026-10-29); operational/testnet acceptance and complete milestone closeout remain OPEN.** Canonical owner: HC-NEXT-7.4; existing R04.13 `Global420Cup` remains the on-chain Cup result and scoped issuance authority, with R04.12 `CompetitionEngine` retaining canonical harvest scoring and result finality. Do not create a conflicting local champion or fabricate chain grants.

## Canonical boundaries

- Four-player, two-semifinal, one-final bracket, registered immutable season/organizer/rules and prize-policy commitments. Advance only the two independently finalized semifinal winners; the final must consist of precisely those two finalists.
- Exact final results and current provenance, with a read-only deterministic ordered round/score projection; prize-rules commitments **do not** constitute funded payouts.
- Championship display trophy is nontransferable/nonfinancial, anchored to the canonical Cup result commitment. Cross-game prestige requires separately current, exact-scope canonical issuance. Neither grants superior gameplay/harvest statistics or funds.
- Account-only ordinary exhibitions remain wallet-free. They are not silently converted to the address-owned R04.13 tournament. Any account-to-address association requires independently qualified issuer/wallet-link binding and finality.
- Reorg/revocation invalidates current qualification and must fail closed rather than serve cached or client-submitted results.

## Implemented initial slice

`services/420-gaming-player-profile/src/highcountry-global-cup.js` is an optional read-only projection consuming a separately configured canonical finalized Cup source. It validates exact chain/code hash, block hash, current result status, round/event identities, winners and finalist consistency and suppresses unissued/revoked prestige. It performs no issuance, transfer, prize payout, or authoritative local result mutation.

`test/highcountry-global-cup.test.js` exercises the projection using an injected fixture. This is **unit evidence**, not proof of actual EVM verification. The scoped workflow is `.github/workflows/highcountry-global-cup-next-7-4.yml`.

## Additional implementation committed after initial slice

- `highcountry-cup-rpc.js` performs real JSON-RPC chain-ID, independently pinned deployed bytecode, finalized/canonical-block witness, and EIP-1898 state reads for the exact Cup/CompetitionEngine. Required selectors and expected runtime bytecode are deployment inputs; no unverified deployed address is invented. It rechecks block canonicality after reads and rejects mismatched authority.
- `highcountry-cloud-http.js` exposes optional authenticated POST `/highcountry/cup/standings` with the exact `cupId` field, issuer verification, game scope and final session recheck. No client-submitted champion, address or entitlement is accepted.
- `highcountry-cup-achievements.js` provides serializable PostgreSQL upsert and append-only historical observations. Persisted snapshots are never independently trusted: `current` rechecks finalized chain state and returns `current:false` if the durable view is stale. `migrations/011_highcountry_cup_achievements.up.sql` and migrator-role-only `highcountry-cup-migrations.js` define an additive, least-privilege schema and drift checks. Migration/worker deployment is explicitly operator-owned; HTTP cannot execute DDL.
- `highcountry-cup-integration.test.js` adds RPC adversarial and transaction/reverification scenarios. These injected RPC and pool tests are not live EVM or real PostgreSQL acceptance; do not claim production qualification from fixture results.

## Missing pre-testnet implementation — cannot defer

1. Wire a real independently validated finalized-block Cup/CompetitionEngine adapter: verify official contract bytecode, deployed code hashes, ABI, RPC block hash and canonical chain finality; reject RPC disagreement/reorgs. Build adversarial EVM-backed integration.
2. Bind verified qualifying results and advancement to the live application service, authentication boundary, client/API, account-wallet identity where applicable and canonical competition event IDs. No caller-supplied result authority.
3. Integrate finalized standings, trophies, achievement history, replay-safe idempotent projection/record storage and crash/recovery behavior. Verify no duplicate awards or stale achievements across chain rollback.
4. Qualify read paths with live PostgreSQL and the actual service composition, revocations, wrong scopes, revoked or altered results, fraudulent finalists, race/restart/reorg and failure conditions. Supply source verification, interface/config validators and meaningful CI.
5. Reconcile all step requirements, affected workflows and documentation against current main and run the appropriate complete Level 1/Level 2 gate on the frozen exact implementation SHA.

**External testnet gate retained:** deployed addresses and code hashes, real issuer and authorization keys, finalized chain evidence, live revocation/reorg/recovery, independent security and operational signoff. Follow `docs/highcountry/HIGHCOUNTRY-TESTNET-WORK-ROADMAP.md`. Do not treat a mocked source as acceptance.

## Integration hardening and acceptance evidence — October 28, 2026

- The finalized-block reader now validates exact selectors against the retained Solidity public ABI, independently computes Keccak-256 of the pinned Cup runtime bytes, verifies deployed Cup/engine bytecode at one EIP-1898 canonical finalized block, checks a common nonzero season for all three matches, and independently recomputes the exact R04.13 `abi.encode` commitment from chain ID, Cup address, registered events, scopes, winners and scores. An RPC-returned commitment alone is not sufficient.
- Scoped tests include malformed selectors, mismatched bytecode, incorrect commitment, mixed seasons, issuer/origin/request spoofing, result revocation, durable database replay and idempotency, bounded serializable transaction retries and a composed RPC→projection→database test.
- The dedicated Cup workflow now also includes the retained real Foundry R04.13 contract tests. This qualifies the **on-chain contract in an isolated EVM test** and the separate service adapter tests. It does **not** assert that a live deployed JSON-RPC node was integrated with Foundry's EVM state.
- Earlier exact SHA `df116d4596c029d4243b3908059625b08a68304b` passed Cup Level 1 run `40799204211` and Gaming Player Profile run `40799204007`. These remain historical passing evidence, **not qualification for later commits**.
- Full closeout is blocked until the latest exact-SHA scoped tests pass, a single combined real-EVM-node→adapter→authenticated service→real PostgreSQL integration is verified, the issuer-owned account↔wallet binding is independently validated where claimed, and current main plus docs/testnet deferrals are reconciled. No testnet deployment address, code hash, signer or live-chain evidence is manufactured.

**Closeout request disposition: NOT READY.** Keep PR #899 draft/unmerged until those mandatory local integration gates have exact-SHA PASS evidence. Do not silently defer pre-testnet EVM/service acceptance to testnet.

## Pre-testnet Level 2 qualification — 2026-10-29

- **Qualified executable SHA:** `d179dda303af1e1cd0f79f7843716fc18326ef46` (the subsequent ledger update is documentation-only).
- **Real Anvil EVM → canonical finalized RPC → Cup projection → authenticated HTTP → PostgreSQL and revocation:** PASS, [run 40945265767](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/40945265767), job `123698854244`. The isolated harness deploys real Cup/CompetitionEngine contracts, verifies the fixture deployment receipt, compares deployed code at latest/finalized, verifies transaction identity/success, and rejects revoked final evidence. Local `evm_mine` and bounded receipt polling are deterministic local-chain synchronization, **not proof of independent validator consensus**.
- **Cup projection Level 1 and scoped Foundry contract boundary:** PASS, [run 40945266297](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/40945266297), jobs `123698855666` and `123698856196`.
- **Gaming Player Profile Service:** PASS, [run 40945266303](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/40945266303), job `123698855700`.
- **Disposition:** The previously blocking *local real-EVM/PostgreSQL Level 2 integration qualification* is complete on the recorded SHA. Do not claim independently audited deployment bytecode, externally controlled issuer/wallet-link authority, deployed multi-instance recovery or live-network finality from isolated Anvil. Remaining separate pre-testnet milestone requirements in this ledger, if not evidenced elsewhere, remain OPEN. No Level 3/merge claim is implied by Level 2 PASS.
- **Testnet-specific acceptance remains OPEN:** deploy to the actual 420 Integrated testnet with approved immutable chain ID/address/code-hash/selector manifests and authorization keys; verify independent validator consensus, authentic finalized receipts and reorg/recovery, external RPC agreement, operational issuer/wallet-link lifecycle and multi-instance deployment/security signoff. Record results under `HIGHCOUNTRY-TESTNET-WORK-ROADMAP.md` rather than rerunning local Anvil tests as substitutes.

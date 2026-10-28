# HC-NEXT-7.4 — Global 420 Cup integration ledger

**Status: IN PROGRESS — NOT QUALIFIED.** Canonical owner: HC-NEXT-7.4; existing R04.13 `Global420Cup` remains the on-chain Cup result and scoped issuance authority, with R04.12 `CompetitionEngine` retaining canonical harvest scoring and result finality. Do not create a conflicting local champion or fabricate chain grants.

## Canonical boundaries

- Four-player, two-semifinal, one-final bracket, registered immutable season/organizer/rules and prize-policy commitments. Advance only the two independently finalized semifinal winners; the final must consist of precisely those two finalists.
- Exact final results and current provenance, with a read-only deterministic ordered round/score projection; prize-rules commitments **do not** constitute funded payouts.
- Championship display trophy is nontransferable/nonfinancial, anchored to the canonical Cup result commitment. Cross-game prestige requires separately current, exact-scope canonical issuance. Neither grants superior gameplay/harvest statistics or funds.
- Account-only ordinary exhibitions remain wallet-free. They are not silently converted to the address-owned R04.13 tournament. Any account-to-address association requires independently qualified issuer/wallet-link binding and finality.
- Reorg/revocation invalidates current qualification and must fail closed rather than serve cached or client-submitted results.

## Implemented initial slice

`services/420-gaming-player-profile/src/highcountry-global-cup.js` is an optional read-only projection consuming a separately configured canonical finalized Cup source. It validates exact chain/code hash, block hash, current result status, round/event identities, winners and finalist consistency and suppresses unissued/revoked prestige. It performs no issuance, transfer, prize payout, or authoritative local result mutation.

`test/highcountry-global-cup.test.js` exercises the projection using an injected fixture. This is **unit evidence**, not proof of actual EVM verification. The scoped workflow is `.github/workflows/highcountry-global-cup-next-7-4.yml`.

## Missing pre-testnet implementation — cannot defer

1. Wire a real independently validated finalized-block Cup/CompetitionEngine adapter: verify official contract bytecode, deployed code hashes, ABI, RPC block hash and canonical chain finality; reject RPC disagreement/reorgs. Build adversarial EVM-backed integration.
2. Bind verified qualifying results and advancement to the live application service, authentication boundary, client/API, account-wallet identity where applicable and canonical competition event IDs. No caller-supplied result authority.
3. Integrate finalized standings, trophies, achievement history, replay-safe idempotent projection/record storage and crash/recovery behavior. Verify no duplicate awards or stale achievements across chain rollback.
4. Qualify read paths with live PostgreSQL and the actual service composition, revocations, wrong scopes, revoked or altered results, fraudulent finalists, race/restart/reorg and failure conditions. Supply source verification, interface/config validators and meaningful CI.
5. Reconcile all step requirements, affected workflows and documentation against current main and run the appropriate complete Level 1/Level 2 gate on the frozen exact implementation SHA.

**External testnet gate retained:** deployed addresses and code hashes, real issuer and authorization keys, finalized chain evidence, live revocation/reorg/recovery, independent security and operational signoff. Follow `docs/highcountry/HIGHCOUNTRY-TESTNET-WORK-ROADMAP.md`. Do not treat a mocked source as acceptance.

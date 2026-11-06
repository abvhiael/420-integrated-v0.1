# 420Bet poker projection service — deployability and approval gate

**Status:** server source and Level 1 test implementation. **Not deployed** and **not authorized** to issue funded poker actions. The HTTP service deliberately refuses to start without explicitly configured `POKER_ENABLE_API=true`, an authenticated cookie issuer, manifest-pinned deployed contracts, independent provider proof verification, and finality-capable HTTPS RPC.

## Executable implementation

`clients/420bet-poker/projection/` contains:
- `service.mjs`: HMAC-verified, same-origin cookie authenticated, GET-only endpoint handler. It does not mint login sessions or carry account passwords.
- `chain-reader.mjs`: `viem` finalized-block `eth_call` reads against the existing `PokerTableRegistry420.getTable`, `PokerSeatLedger420.seatOf/activeHand/seatingEpoch`, `PokerNLHEBetting420.gameOf/playerOf`, `PokerConfidentialDeal420.getHand`, `PokerPrivateShuffleGate420.recordOf` and `PokerLiveCardReveals420.slotOf`. Every contract is bound to an explicitly pinned runtime code hash at the exact finalized block. No fabricated cards, players or balances.
- `serve.mjs`: disabled-by-default HTTP start. HTTPS termination, cookies and external session issuance must be secured at the trusted reverse proxy, not public client code.
- `tests/`: failure behavior, same-origin/session validation, privacy, snapshot bindings, no-write and chain configuration.

The browser already consumes `/api/420bet/poker/v1/session`, `/tables`, and `/tables/:id/snapshot` from the same origin. No unrelated game or contract gets write capabilities from this service. `Fold`, `Check`, `Call`, `Raise`, buy-in and settlement stay disabled.

## Required environment bindings (never commit actual secrets)

- `POKER_ENABLE_API=true` only **after** independent approval
- `POKER_CHAIN_ID`: exact official chain ID
- `POKER_RPC_URL`: HTTPS finality-capable RPC, no credential in its URL
- `POKER_CONTRACTS_JSON`: map of `registry,ledger,engine,deals,shuffle,reveals` to the **deployed, qualified** contract addresses, plus corresponding `codeHashes` (runtime keccak256 at the pinned block)
- `POKER_TABLES_JSON`: `{chainId,tables:[{tableId,configHash,name,smallBlind,bigBlind,tableVersion}]}`, all values independently matched to registry
- `POKER_SESSION_HMAC_KEY`: random 32+ bytes in **hex**, only shared securely with a separately approved login/session issuer
- `POKER_ALLOWED_ORIGIN=https://420bet.420integrated.org`
- `PORT` and `POKER_HOST`, bound behind a same-origin, TLS-enabled reverse proxy

Player authentication is supported by one-time wallet-signed read-only challenges: `POST /api/420bet/poker/v1/auth/challenge` and `POST /api/420bet/poker/v1/auth/verify` (strict same-origin JSON, challenge expiry, replay rejection, short-lived `__Host-poker_session` HttpOnly/Secure/SameSite=Strict cookie). These endpoints never grant wager signatures, only read projection access. A statically-hosted Cloudflare Pages site alone does not run this Node service. Until a reverse proxy routes the exact `/api/420bet/poker/v1` prefix to the separately hosted service, the browser correctly shows **OFFLINE/UNVERIFIED**.

## Critical incomplete dependencies and safety

1. **Session issuance:** The service now implements one-time EIP-191 wallet challenges, signed nonce verification and a read-only `__Host-poker_session` cookie; production must still ensure nonce-store single-instance behavior (or install a shared atomic store), rate limiting at the edge, legal eligibility and configured expected-origin TLS proxy. The address alone never authenticates an account. The authentication issuer is not a qualification for wagers or funded play.
2. **Private hole cards:** Public blockchain state cannot deliver private plaintext hole cards. The reader intentionally returns no `privateCards`. Integrate a separately reviewed recipient-only proof path tied to each actual authenticated recipient, hand nonce, seat epoch, `PokerDeliveryProofBook420`, provider keys and ciphertext delivery receipts before returning them. Never send a plaintext deck, other players' cards, ephemeral decryption secrets or private proving witnesses.
3. **Committed public reveals:** For active hands the reader requires an on-chain committed dual-provider deal and verified shuffle record, checks the precise engine/ledger/deal/reveal address bindings and reads only `opened` public `PokerLiveCardReveals420` slots, which were accepted through their actual share and unmask verifiers. No revealed slot means no card display. Preserve exact Solidity native phases `PREFLOP`, `AWAIT_FLOP`, `FLOP`, `AWAIT_TURN`, `TURN`, `AWAIT_RIVER`, `RIVER`, `SHOWDOWN`, and `UNCONTESTED`; the final phase is **not** equivalent to settled funds. A proof receipt is not inferred from the local game client.
4. **Independent approval:** Verify provider independence, exact trusted setup/verifiers, signer policy, post-deployment contract code, settlement/rake caps, operator status, legal/jurisdictional acceptance and `TN-POKER-01..04` / 5A.11 proof requirements before public service or any funded wagering.
5. **Operator/deployment boundaries:** This tool cannot infer a production RPC, manifest, secret or chosen Render workspace. Never fabricate these values or deploy a public, empty or mock service to masquerade as an authoritative one.

## Service endpoints

- `GET /api/420bet/poker/v1/session` authenticated read-session identity
- `GET /api/420bet/poker/v1/tables` finalized qualified table discovery
- `GET /api/420bet/poker/v1/tables/:bytes32id/snapshot` player-redacted, hash- and nonce-bound canonical state

The backend returns HTTP 401 for invalid sessions, 503 for unverifiable canonical reads, never caches private information, blocks CORS and refuses every write HTTP method. Attested public state and authenticated player private state must remain separate.

## Qualification

Run only `npm test` from `clients/420bet-poker/projection` and the focused workflow. Passing tests qualifies the server's fail-closed boundary, **not** successful official testnet deployment, privately revealed holes, independent security certification or live multiplayer acceptance.

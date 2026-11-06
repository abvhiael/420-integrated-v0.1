# 420Bet Poker — canonical read-only browser projection contract

**Status:** Frontend adapter implementation; NOT a deployed poker API and NOT release authorization. This source repository contains canonical NLHE contracts and crypto test owners; the deployed, authenticated browser projection service was **not identified** during this implementation. The 420Bet UI must display **OFFLINE / UNVERIFIED** until such a service exists and supplies the required canonical responses.

## Required deployment boundary

The frontend defaults to the same-origin base path `/api/420bet/poker/v1`, overrideable using a trusted deployment setting `BET_LOBBY_CONFIG.pokerApiBase`. The path must be same-origin, absolute and must not include query, fragment, backslash or newline. Do not point it at arbitrary third-party API origins.

No browser code signs poker actions, computes canonical chip balances, generates private shuffles, settles hands, authorizes seats or initiates buy-ins. All four action buttons remain disabled. Never interpret this client work as a new PokerHandEngine or as deployable multiplayer custody.

A dedicated server under the same origin must implement these **GET-only** routes with authenticated HttpOnly, Secure, SameSite cookies and HTTPS:
- `GET /session` — returns `{authenticated:true,scope:"poker:read",viewerId,subject,chainId,expiresAt}`. The server must use an authenticated signed session, bind the account to a qualifying poker seat and enforce an explicit network scope. A wallet address alone is not authentication.
- `GET /tables` — returns canonical accessible table discovery.
- `GET /tables/:id/snapshot` — returns a *redacted viewer-specific* projection and public state derived from existing finalized PokerTableRegistry420, PokerSeatLedger420, PokerNLHE modules and confidential deal/reveal commitments.

The server is required to check all role/capability gates, finality, table/version, seat epoch, player identity, hand/action nonces, committed source hashes, encrypted-deal proofs and key-release policy. The browser cannot certify on-chain authority from an asserted JSON field. Do **not** expose a service until authenticated server and independent security review establish these obligations.

## Server response contract

Every tables/snapshot response:
```json
{
 "source": "canonical-poker-projection-v1",
 "authority": "verified",
 "viewerId": "opaque-viewer-id",
 "chainId": 1,
 "stateHash": "0x<64 hex>",
 "blockNumber": 120,
 "sequence": 2,
 "observedAt": 1794000000000
}
```

Tables response also includes up to 100 `tables`:
```json
{
 "id": "garden", "name": "Garden Table", "seatCount": 6,
 "occupied": 2, "smallBlind": 5, "bigBlind": 10,
 "phase": "FLOP", "tableVersion": 1
}
```

A table snapshot includes `table` with `id,tableVersion,seatCount,dealerSeat,phase,handNonce,actionNonce,ledgerVersion,pot,deadline,turnSeat,community,seats,viewer`. `community` is an array of publicly revealed rank/suit cards. Each `seats` entry contains only `index,status,playerId,displayName,stack,committed`. `viewer` contains `seatPlusOne` (0 for spectator) and `holeCards` (0 or 2 cards, for the authenticated seat **only**). Never include a complete deck, other-player private cards, shuffle secrets or unrevealed cards.

`observedAt` and `deadline` are Unix **milliseconds**. `sequence` is the monotonic canonical projection version. Identical unchanged snapshots may repeat the same sequence and hash. Changed content must increment sequence. A block regression, table-version change during a subscription, action/ledger/hand nonce rollback, session expiry, missing authority field or malformed/private-leaking response causes a fail-closed disconnect and clears private cards and table information.

## Runtime and test requirements

The browser authenticates, discovers and polls selected tables at 2.5-second intervals, using same-origin cookie requests and `cache: no-store`. It does **not** use websocket events as canonical authority and never enables gameplay buttons. On route exit, it disposes the polling client and removes player-specific cards. If server credentials fail or the source projection cannot be verified, no live seat or pot is fabricated.

Before live connectivity can be claimed: identify and deploy the trusted server and endpoint; qualify proof/finality/seat-redaction semantics in server tests, authenticate two independent accounts and assert cross-viewer secrecy, verify disconnect, replay, reorg, withheld provider and rollback cases, and complete the existing poker 5A.11 official testnet/legal gates. Until then the UI is a usable, fail-closed integration boundary rather than a live multiplayer product.

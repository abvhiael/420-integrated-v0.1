
# Step 4.2 — node420 / fourtwentyd Engine API Integration

Status: **IMPLEMENTED SCAFFOLD + TESTED MOCK PAYLOAD FLOW**

## Execution integration model

`node420` is the public 420 execution-client launcher/distribution boundary around an exact pinned
go-ethereum release. Step 4.2 pins `v1.17.5`.

We do not vendor or casually fork the full Geth tree into the 420 monorepo. The helper
`scripts/build-node420-upstream.sh` checks out the exact release tag, records its resolved commit,
builds Geth, and places the binary under `bin/upstream`.

`node420` launches that pinned execution binary with:
- local/private authenticated Engine API;
- JWT secret;
- default Engine API port 8551;
- public Ethereum JSON-RPC kept separate.

## fourtwentyd Engine client

`consensus/engine` implements:
- HS256 JWT creation with `iat`, `id`, and `clv` claims;
- `engine_exchangeCapabilities`;
- `engine_forkchoiceUpdatedV3`;
- `engine_getPayloadV3`;
- `engine_newPayloadV3`.

The code deliberately uses Engine API JSON structures rather than Geth internal packages, preserving
the consensus/execution boundary.

## Payload flow

The integration test exercises:

1. fourtwentyd negotiates capabilities;
2. fork-choice state + payload attributes are sent;
3. execution returns a payload ID;
4. fourtwentyd fetches the execution payload;
5. fourtwentyd submits the payload for validation;
6. execution returns `VALID`.

The current automated flow uses a deterministic mock Engine server. The next live-devnet task is to
run exactly the same client against the pinned real Geth process initialized with a 420 execution
genesis.

## Security

Engine API must remain local/private. JWT protects the Engine RPC endpoint from unauthenticated
callers but is not transport encryption. Production deployments should bind to loopback or a
protected network namespace/socket.

## Next

Step 4.3:
- define canonical consensus block/attestation/QC SSZ types;
- add BLS signing;
- wrap real node420 execution payload hashes in ConsensusBlock;
- implement 15-seat QC aggregation and chained finality.

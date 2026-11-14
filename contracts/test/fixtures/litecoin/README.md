# BRIDGE-AUDIT-3.V.4 — Litecoin

## Production path

`LitecoinScrypt420` computes exact Scrypt PoW for an 80-byte header.
`LitecoinHeaderChain420` verifies the completed result, Litecoin header rules,
ancestry and greatest cumulative work. `LitecoinFinalityVerifier420` authenticates
a deposit transaction/output, destination commitment and twelve-confirmation
best-chain witness. `LitecoinBridgeAdapter420` binds the actual router/route and
preserves message/outpoint replay protection. The existing router, risk,
accounting, route and transfer registries retain their authorization boundaries.
No route activation, deployed custody or live fund movement is claimed.

The implementation reuses the qualified Bitcoin `BridgeCrypto420` SHA256d and
`BridgeWire420` canonical wire/CompactSize primitives. Header chain, transaction
and deposit logic derive from the qualified Bitcoin implementation with explicit
Litecoin consensus, monetary, Scrypt, confirmation and MWEB changes. Bitcoin
source files, historical fixtures and passing evidence are unchanged.

## Exact Scrypt without an oracle

Litecoin uses Scrypt(N=1024, r=1, p=1, dkLen=32), password=header, salt=header.
The worker performs PBKDF2-HMAC-SHA256, all 1,024 ROMix fill rounds, all 1,024
random-access mixing rounds and final PBKDF2. Salsa20/8 uses wrapping 32-bit
arithmetic. Stored scratch consists of 1,024 128-byte blocks per job. The block
identifier/parent link remains SHA256d; the *separate little-endian Scrypt digest*
is compared to the target. SHA256d does not establish Litecoin PoW.

A full hash is too expensive for a normal single EVM transaction. The worker's
permissionless deterministic computation is split into bounded calls; relayers
supply **no intermediate state or claimed hash**:

1. `chain.scrypt().begin(rawHeader)` initializes and returns SHA256d(rawHeader).
2. Call `advance(headerId, steps)` with 1–32 rounds until `cursor(headerId)==2048`.
3. Read `result(headerId)` or submit the header to the chain.

Duplicate `begin` cannot reset work. Unknown, unfinished and wrong-header jobs
cannot authenticate a header. Only the immutable worker constructed by the
chain supplies a completed hash. Concurrent callers advance the same verified
state; no caller, signature, challenge window, precompile upgrade, external
prover or optimistic assertion supplies authority.

The standalone genesis test consumed 275,981,508 gas including deployment and
64 progress calls. The observed maximum progress-call gas in the historical
trace was 5,458,532; the positive test enforces a bound below 30 million. Normal
separate transactions additionally pay cold storage/calldata costs, with ample
margin to that bound. The persistent 128 KiB scratch per header and substantial
aggregate gas are material operational costs. This implementation is exact,
bounded computation; it does not claim inexpensive verification or a new ZK
proof system. Historical syncing from genesis must perform this work for each
admitted header. No cost/freshness assumption is hidden behind an oracle flag.

## Litecoin consensus profile

The chain is anchored at the canonical mainnet genesis
`12a765e31ffd4059bada1e25190f6e98c99d9714d334efa41a195a7e7e04bfe2`.
Raw digest bytes in contract header keys use the reverse/display convention
already used by the Bitcoin implementation. Targets enforce Core compact signed,
zero, overflow and mainnet pow-limit rules (`00000fff…fff`). Initial bits are
`0x1e0ffff0`; genesis work uses that actual target, not the looser pow limit.

Mainnet spacing is 150 seconds; retarget interval is 2,016 blocks / 302,400
seconds. Timespan clamps to 75,600–1,209,600 seconds. The first boundary uses
height 0 through 2,015; later boundaries use the full period, including the
preceding boundary's parent (e.g. heights 2,015 through 4,031 at height 4,032).
The chain stores this exact per-branch retarget anchor. Core's one-bit shift
before multiplication for high targets, division rounding, compact encoding and
pow-limit cap are reproduced. Testnet minimum-difficulty exceptions do not apply.

Header timestamps must exceed median time past of up to eleven preceding
headers and be no more than two hours ahead of the destination clock. Buried
minimum versions follow mainnet BIP34/66/65 heights 710000/811879/918684.
Each authenticated header adds floor(2^256/(target+1)) work. A strictly heavier
branch replaces the tip; ties retain the incumbent, and losing branches remain
available. Confirmations verify every stored parent hop from the best-known tip.
Reorganizations immediately invalidate old/orphaned confirmation witnesses.

This is header-only SPV, not full block/script/MWEB consensus re-execution or
proof that the globally heaviest/current chain has been relayed. It assumes the
usual honest-work source consensus and a correctly maintained destination clock.
Previously settled deep-reorg compensation remains operational recovery; replay
maps deliberately do not reopen already consumed source outputs.

## Deposit wire format and MWEB restrictions

Deploy `LitecoinHeaderChain420`, sync headers, then deploy
`LitecoinFinalityVerifier420(chain, gatewayScript, routeId,
minimumDepositHeight, destinationRouter)`. The router must exist and the minimum
height must be nonzero. Configure existing governance-controlled LTC asset/route,
verifier, custody script and risk limits. The adapter rejects a verifier whose
router, route or gateway script hash does not match its required context.

A deposit pays a positive raw-litoshi amount to the exact configured standard
P2PKH/P2SH/P2WPKH/P2WSH/P2TR locking script, plus exactly one zero-value
`OP_RETURN PUSH32` commitment. The commitment is produced by
`commitmentScript(uint32 paymentIndex, address recipient, uint64 amount)`:

```
domain = keccak256(abi.encode("420/LTC/DEPOSIT/V1", destinationChainId,
                            destinationRouter, routeId, keccak256(gatewayScript)))
commitment = keccak256(abi.encode(domain, paymentIndex, recipient, amount))
```

`LitecoinFinalityVerifier420.Proof` canonically ABI-encodes block hash, transaction
bytes, payment/commitment indices, recipient, transaction Merkle index, ordered
SHA256d sibling digests and best-tip-to-deposit ancestry. No supplied amount,
transaction ID, script hash, transaction count or Merkle root is trusted.
The parsed transaction sums outputs against **84,000,000 LTC** in litoshis;
legacy and SegWit txids normalize to the same stripped bytes. Coinbase deposits,
stripped 64-byte ambiguity, noncanonical counts, malformed witness, ambiguous
commitments, unspendable gateway scripts and substitution of destination,
payment index, script, amount, route or router fail closed.

MWEB flags 0x08/0x09, MWEB-only transactions and HogEx serialization are rejected.
Every output is also checked for witness-v8 HogAddr and witness-v9 peg-in programs,
so stripping extension flags cannot conceal those programs in a deposit.
Unsupported MWEB outbound script types are rejected without advancing the nonce.
Ordinary transparent transactions after MWEB activation remain supported; the
bridge does not invent a taint policy for subsequent transparent spending.
Witness execution and MWEB extension validity are not supplied by this SPV proof.

Twelve confirmations are mandatory. Proofs are bounded to 1,100,000 bytes,
transactions to 1,000,000 bytes and Merkle paths to 32 siblings. Very old deposits
need an ancestry witness that fits this proof cap; minimum deposit height is a
governance deployment policy. Consumed outpoints remain consumed across witness
re-encoding, verifier rotation, message-ID changes and reorgs. Downstream router
failure atomically rolls back replay state and risk usage.

## Genuine evidence and reproducibility

`sources.json` records exact API URLs, mainnet identities and pinned Litecoin
Core revision `9fe73a4bd1433f9b90ee0ea5fc6e985b6702d343`. Relevant unmodified Core
source files and their MIT license are retained in `core/` for rule reconciliation.
`SHA256SUMS.json` covers every durable fixture, oracle, source reference and log.
`qualification/source-sha256.json` records the actual qualified Solidity closure.

- `blocks.json`, `headers.bin`, `expected.jsonl`, `oracle.bin`: **4,033 consecutive
  genuine headers**, heights 0–4,032. Python/OpenSSL independently verifies every
  Scrypt digest, SHA256d identifier, parent, target, retarget, cumulative work and
  MTP. Both 2,016 and 4,032 boundaries change difficulty; the latter is a 4× rise.
- Production Solidity performs complete real Scrypt and genesis-linked admission
  for the first twelve headers and an additional sixteen-header stateful cache.
  Both historical retarget boundary headers run real Scrypt and production
  admission using explicitly seeded, independently verified historical parent
  context. The tests do not claim to execute all 4,033 Scrypt jobs on the EVM.
- Height 448 preserves a genuine legacy payment and Merkle path. Mainnet height
  **2,300,000**, hash
  `b13ad2996ea82902fda1b53e9b59046f25ef1a5f24b53a4fdd84471741f98b5b`,
  preserves a genuine SegWit payment and a genuine HogEx transaction, their full
  transaction-ID list, header and Merkle paths. Stripped HogEx identity is
  independently reconstructed, while the bridge rejects that transaction type.
  The modern header's Scrypt is also computed by the real Solidity worker.
- Controlled gateway/fork tests seed clearly labeled local header context to
  isolate claims, replay, branch selection and registry rollback. They are not
  represented as historical 420Bridge deposits or as mined synthetic blocks.

From the repository root, with Python (OpenSSL Scrypt), Forge 1.9.0 and solc 0.8.24:

```
python3 contracts/test/fixtures/litecoin/verify.py
python3 scripts/qualify-litecoin.py
python3 scripts/verify-litecoin-bytecode.py --solc /path/to/solc-0.8.24
```

The isolated runner compiles unmodified selected import closures with Cancun,
optimizer 200 and via-IR. It rejects zero-test runs, uses 2,500 fuzz inputs per
fuzz case and 128 invariant runs of depth 64. It does not compile or rerun
unrelated Bitcoin, Ethereum or application suites. See `qualification/RESULTS.md`
for original logs, corrections, test counts and publication evidence.

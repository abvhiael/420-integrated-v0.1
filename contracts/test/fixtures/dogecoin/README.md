# BRIDGE-AUDIT-3.V.5 — Dogecoin

## Concrete verifier and security boundary

`DogecoinHeaderChain420` is a genesis-anchored, permissionless header SPV client.
It checks Dogecoin target/difficulty/timestamp/version rules, actual Scrypt work,
AuxPoW relationships when flagged, ancestry and greatest cumulative work.
`DogecoinFinalityVerifier420` authenticates a transaction, exact custody output,
destination commitment and configured best-chain confirmations. The existing
`DogecoinBridgeAdapter420` additionally binds verifier route/router, its approved
gateway script, configured DOGE asset, message replay and outpoint replay. The
shared router/route/risk/transfer/accounting contracts retain their existing
controls. No deployment, custody signing, fund movement or route activation is
performed by this local qualification.

The Scrypt worker is copied **unchanged** from qualified Litecoin commit
`5741522429732437b92b3a9e0d0f659d6b781b1f`; its Git blob is pinned in sources.json.
The Bitcoin SHA256d and canonical wire/CompactSize infrastructure is reused
without changes. Existing passing Bitcoin/Litecoin/Ethereum evidence remains
unchanged; these preceding branches are not silently merged by this work.

The worker computes exact Scrypt(N=1024,r=1,p=1,dkLen=32), password=salt=80-byte
header, using PBKDF2-HMAC-SHA256, Salsa20/8 and all ROMix rounds. A full computation
is expensive (~276M aggregate qualification gas and 128 KiB persistent scratch
per header), so `begin(header)` plus `advance(SHA256d(header), steps)` executes
1–32 rounds per bounded call until cursor 2048. Sixty-four calls at 32 rounds
finish a job. Every intermediate state is computed by the contract, not supplied
by a relayer. The chain constructs its own immutable worker. There is no trusted
hash oracle, relayer signature, optimistic challenge or destination consensus
upgrade. Historical sync from genesis must pay these substantial gas/storage
costs; no inexpensive verification or instant mainnet bootstrap is claimed.

Dogecoin block IDs, transaction IDs and Merkle nodes use SHA256d. **PoW uses the
separate little-endian Scrypt digest**, compared to the child Dogecoin target.
For unflagged blocks that digest is computed over the child header. For AuxPoW
it is computed over the authenticated parent mining-candidate header. Parent
nBits, parent chain membership and parent hashBlock metadata supply no Dogecoin
work authority. Core does not require that the parent candidate be accepted by
Litecoin or satisfy Litecoin's own target/transaction rules. The implementation
preserves that distinction, including parent candidates with zero outputs.

This is header-only SPV and assumes source honest work. It does not re-execute
Dogecoin transactions, prove the globally heaviest/current tip has been relayed,
or validate a full parent chain. Destination clock correctness and maintained
header relaying remain operational assumptions. Previously settled deep-reorg
compensation is operational recovery; consumed outpoints deliberately remain
consumed.

## AuxPoW, chain identity and activation

`DogecoinAuxPow420.Proof` is canonical ABI encoding of:

```
(bytes coinbase, bytes32[] parentBranch, uint32 parentIndex,
 bytes32[] chainBranch, uint32 chainIndex, bytes parentHeader)
```

Header admission is `submit(bytes childHeader, bytes encodedAux)`. Unflagged
headers require empty AuxPoW bytes; flagged headers require the canonical proof.
`powHeader(childHeader, encodedAux, height)` is a pure convenience for relayers;
it grants no admission authority. The state-changing path always derives height
from the authenticated stored parent and revalidates everything. Relayers compute
work on the returned header, then submit child/proof to the chain.

Checks reproduce pinned Dogecoin Core:

- AuxPoW is version bit 8; nonlegacy child chain ID is **98**. Full versions 1
  and 2 are legacy, including the historical version-2/chain-ID-zero exception.
- AuxPoW is rejected before height **371337**; legacy headers are rejected at
  and after that height. Correct-chain-ID **unflagged** headers remain allowed
  afterward. Historical height 371340 demonstrates that exact rule; activation
  does not mean every later block is merged-mined.
- Base version is signed nVersion % 256. Buried minimum versions 3/4 apply at
  heights **1034383/3464751**. Full packed version is not used for that comparison.
- Parent index must be zero; the parent candidate chain ID cannot be 98. The
  exact parent transaction ID and parent Merkle branch must produce its header's
  Merkle root. Parent witness framing, when present, is stripped for its txid.
- The child hash/chain branch produces a root whose **reversed bytes** must occur
  in the first parent's input script. Chain branch depth is at most 30.
- If `fabe6d6d` exists, it is unique and immediately precedes that root. Without
  the marker, backward compatibility allows the root to start within the first
  20 script bytes. Following uint32-LE tree size must equal 2^depth; nonce must
  put chain 98 at the claimed slot under Core's wrapping uint32 LCG recurrence.
- The serialized historical CMerkleTx hashBlock field is not a consensus
  commitment and is omitted from the proof ABI. Transaction inclusion in the
  parent is independently established by the Merkle branch and parent header.

Parent proofs are bounded to 32 parent siblings, 30 chain siblings, an 80-byte
parent header and the existing bounded transaction/envelope sizes. These are
explicit bridge resource limits, not full parent-chain validation. Other
malformed, mismatched or trailing proof bytes fail closed.

## Difficulty, work, canonical ancestry and timestamps

Mainnet genesis is
`1a91e3dace36e2be3bf030a65679fe821aa1d6ef92e7c9902eb318182c355691`;
message start is `c0c0c0c0`. Stored header/Merkle keys use raw digest bytes,
reversed from explorer display order. Compact target sign/zero/overflow and the
mainnet `00000fff…fff` pow limit are enforced. Genesis bits are `0x1e0ffff0`.

Before **145000**, retargets occur every 240 blocks with a 14,400-second target
span. The first uses genesis through height 239; later periods use the full
interval, e.g. heights 239 through 479 at height 480. Timespan lower bounds are
1/16 through height 5000, 1/8 through 10000, and 1/4 afterward; upper bound is 4×.
At **145000** DigiShield applies on every block: previous minus grandparent
block time is amplitude-filtered as `60 + (elapsed - 60) / 8`, with **signed
truncation toward zero**, then clamped to **45–90 seconds**. Target arithmetic,
compact rounding and pow-limit cap follow Core. Mainnet has no testnet minimum-
difficulty exceptions. Subsidy randomness is transaction consensus, not header
work, and is not substituted for proof validation.

Each header adds floor(2^256/(target+1)) child work. Strictly greater cumulative
work wins; ties retain the incumbent and losing branches remain available.
Confirmations verify every stored parent hop from best known tip to the deposit;
reorgs invalidate orphaned witnesses immediately. MTP uses up to eleven preceding
headers, and future timestamps are limited to two hours versus destination time.

## Deposits and configuration

Deploy the chain and synchronize headers. Deploy
`DogecoinFinalityVerifier420(chain, gatewayScript, routeId, minimumDepositHeight,
destinationRouter, minimumConfirmations)` with an existing router, a positive
height floor and an explicit nonzero confirmation policy. The canonical
Dogecoin route did not prescribe a numeric threshold; qualification exercises
**12**, without inventing a mainnet consensus confirmation rule. Configure the
existing adapter's verifier, DOGE asset/route binding and gateway-script allowlist
through existing governance. Risk/custody/activation requirements remain intact.

Only standard configured P2PKH or P2SH custody scripts are supported. A source
transaction must include a positive payment to that exact script and exactly one
zero-valued `OP_RETURN PUSH32` commitment. Amounts are raw koinu. The commitment
binds:

```
domain = keccak256(abi.encode("420/DOGE/DEPOSIT/V1", destinationChainId,
                            destinationRouter, routeId, keccak256(gatewayScript)))
commitment = keccak256(abi.encode(domain, uint32(paymentIndex), recipient,
                                uint64(amount)))
```

Use the verifier's `commitmentScript` to build it. `Proof` canonically ABI-encodes
block hash, complete transaction, payment and commitment indices, recipient,
transaction Merkle index, ordered SHA256d siblings and best-tip ancestry. Caller
amounts, txids, output scripts and Merkle roots are not trusted.

The child parser enforces Core's **10,000,000,000 DOGE per-transaction MAX_MONEY**,
canonical counts, output sums and full byte consumption. Dogecoin's disabled
SegWit path is rejected for child deposits; parent AuxPoW witness serialization
is handled separately. Coinbase deposits, 64-byte stripped leaf/node ambiguity,
wrong indices, malformed transactions, ambiguous commitments, wrong scripts,
amounts, recipients, route or router fail closed. Transactions are bounded to
1,000,000 bytes, deposit envelopes to 1,100,000 bytes and transaction paths to 32
siblings. A very old deposit's exact ancestry must fit the envelope bound.

Message and outpoint replay state persists across verifier rotation and reorgs.
The adapter records authenticated source context. Downstream route, risk or
transfer rejection rolls back replay flags and risk accounting atomically.
Ordinary historical payments do not become 420Bridge gateway deposits.

## Genuine fixtures and independent reproduction

`sources.json` records acquisition, representation and pinned Dogecoin Core
revision. Core AuxPoW/difficulty/header validation source and MIT license are
retained unmodified in `core/`. `source-blocks.zip` retains the original `raw/` files and their companion RPC JSON. It contains source full serialized blocks
where available; when the provider returns only decoded RPC data, an explicitly
labeled 80-byte header and its companion JSON preserve the full genuine AuxPoW
fields. Such files are not described as full raw blocks. Derived ABI AuxPoW bytes
are independently serialized from these authenticated fields.

The independent stdlib/OpenSSL oracle recomputes every selected Scrypt PoW,
SHA256d identity, target, applicable difficulty, parent links, segment work,
MTP and full-body transaction Merkle roots where body bytes are present. Ranges
cover genesis/early retargets, DigiShield activation and AuxPoW activation. It
pins the first merged block to Core's actual checkpoint
`60323982f9c5ff1b5a954eac9dc1269352835f47c2c5222691d80f0d50dcf053`.

Solidity tests execute actual Scrypt on genesis-linked headers, actual transition
headers, parent work throughout a historical merged/standalone block sequence,
and sixteen genuine precomputed job results used by the stateful invariant.
Historical high-height parent context is explicitly seeded; this does not claim
that the EVM synchronized all 371337 predecessors. Controlled gateway/fork tests
are explicitly local fixtures, not claimed mined blocks or historical 420Bridge
deposits. Genuine payment bytes, amounts, txid and Merkle path are retained.

```
python3 contracts/test/fixtures/dogecoin/verify.py
python3 scripts/qualify-dogecoin.py
python3 scripts/verify-dogecoin-bytecode.py --solc /path/to/solc-0.8.24
```

Python needs OpenSSL Scrypt, not a third-party package or RPC for verification.
The test runner uses Forge 1.9.0, solc 0.8.24, Cancun, optimizer 200 and via-IR,
2,500 fuzz inputs per case and 128 invariant runs at depth 64. It copies only the
unmodified selected import closure and rejects zero-test runs. Original logs,
qualified source checksums and detailed results are in `qualification/RESULTS.md`.

# BRIDGE-AUDIT-3.V.12 — Dobbscoin (BOB)

Baseline: `main` at `97413f2eea862d5f2ec3117313cd3beb15a634f4`.
Scope: the original seven BOB consensus, inclusion and historical-evidence requirements.
Date: 2026-11-14 (America/Regina).

## Implementation and trust boundary

`DobbscoinFinalityVerifier420` integrates the authoritative native consensus
implementation through `AuthenticatedCheckpoint420`. It is **an authenticated
native-replay verifier, not a permissionless scrypt light client**. Governance
chooses the checkpoint authority and initial root. That authority authenticates a
fresh, unmodified, pinned native replay with `-assumevalid=0`, complete native
script validation (see below), the native selected
chain and the independent qualification record. A compromised authority can forge
state records; the EVM does not recompute scrypt, Kimoto Gravity Well or the full
UTXO/script state. These are explicit dependencies, not facts inferred from RPC
confirmation counts. The checkpoint producer rejects RPC-only status envelopes.

The EVM independently authenticates the state Merkle path and current authority
epoch; pins genesis, source revision and EVM chain; binds the exact child and work
header bytes; checks compact targets, attested scrypt work against the **child**
target, relative chain work, expected difficulty/emergency predicate, MTP and
future timestamps; enforces activation and chain IDs; verifies AuxPoW commitments;
and verifies deposit transaction inclusion, outputs and destination commitments.
Native full validation supplies script execution, UTXO validity, difficulty
context, ancestry and native chain selection. A header or JSON object claiming
`finalized=true` is insufficient.

Checkpoints are monotonic, predecessor-bound and signed for the exact EVM chain,
registry, network and authority epoch. Rotation makes the previous root unusable
until a fresh signed advance. Historical checkpoint entries remain immutable.
Neither the native replay nor this checkpoint establishes global tip freshness.
Deployment operators must continue following the native selected mainnet chain;
this is the existing source-chain dependency, not a new finality guarantee.

## Authoritative consensus audit

Primary source: <https://git.subgenius.finance/SubGeniusFinance/dobbscoin-source>.
GitHub mirror: <https://github.com/dobbscoin/dobbscoin-source>.
Both advertised HEADs were verified as
`1a300eb0f469e5a3cb0d8337f20adbab83a512e3` (v0.14.1).
The native sources were built without modifications.

| Rule | Pinned implementation and integration |
| --- | --- |
| Identity | Mainnet SHA256d genesis `6d2d7d525900712451b9697d0b5b2304ebae6efb349540da445bf575c0159969`; magic `a0fb1783`; port 19985; address versions 0/5. Header identifiers use SHA256d; work uses scrypt N=1024, r=1, p=1. |
| Genesis exception | `CheckProofOfWork` explicitly exempts work hash `b83bb8028229439a4e645a56d48ee31b884efdb0e395c8538a10a462166563f3`. Genesis does **not** satisfy its ordinary compact target. The historical checker verifies this exact anchor; the bridge rejects height-zero deposits. |
| Compact/work | Reject zero, negative, overflowing and above-limit targets. Limit `(2^256-1)>>20`; compact `1e0fffff`. Work is `floor(2^256/(target+1))`, accumulated by the native node and independently checked. Equality with the target is allowed. |
| Original retarget | Before 13,579: 2,016-block / 14-day algorithm, 600-second spacing, 1/4–4 timespan clamp, native uint256 arithmetic. |
| KGW | Heights 13,579–31,596: 9–252-block window, signed integer averaging with division toward zero, running maximum timestamp, native floating-point event-horizon calculation. The Python reference independently reproduces it; the EVM authenticates its expected result. |
| DigiShield | 31,597–68,424: 600 seconds. From 68,425: 120 seconds. Per-block amplitude filter, signed truncation toward zero, 3/4–3/2 timespan bounds and native uint256 arithmetic. |
| LWMA-3 | From 1,888,808; 60-block bootstrap, then N=60, T=120, k=219600; solvetimes clamp ±720; weighted-time floor k/3; **divide-before-add** target calculation. |
| Emergency difficulty | From 1,888,888: a gap **strictly greater than 21,600 seconds**, with candidate bits exactly `1e0fffff`, permits the emergency target. Normal expected bits remain valid after a stall; the emergency target is not mandatory. |
| Chain selection | Native highest cumulative work; equal-work preference follows native reception sequence and pointer tie-break, not an invented lexicographic hash rule. After the old active tip reaches the LWMA gate, native activation rejects disconnecting more than 100 buried blocks; exactly 100 remains allowed. |
| AuxPoW gate | Mainnet 2,000,000; testnet/regtest 10. Before activation, AuxPoW flag and chain ID must be zero. At/after activation, chain ID 176 is mandatory; **standalone scrypt work remains valid**. |
| AuxPoW commitment | Parent index zero; parent chain ID differs from 176; child chain branch ≤30; SHA256d positional branches; reversed child-chain root in the parent input script; single `fabe6d6d` immediately before the root, or legacy root at offset ≤20. Tree size and uint32-wrapping LCG-derived slot must match. Parent scrypt is compared to the **child's** target, not the parent's bits. |
| Native AuxPoW wire | Parent transaction, legacy unused `hashBlock`, parent branch/index, child-chain branch/index and pure 80-byte parent header. Native `initAuxPow` uses a parent transaction with **zero outputs**. Parent branches have no invented 32-level cap. Parent-chain canonicality or a valid parent `nBits` is not a Dobbscoin AuxPoW requirement. |
| Execution | Native consensus validates scripts/UTXOs and historical version rules. CLTV activates at mainnet 2,000,000 (testnet 150), separately from the test AuxPoW gate. |

Pinned references: `src/chainparams.cpp`, `src/chainparams.h`, `src/pow.cpp`,
`src/main.cpp`, `src/primitives/pureheader.*`, `src/auxpow.*`,
`src/primitives/transaction.h` and `src/amount.h`.

## Deposit, gateway and replay bindings

Only native BOB legacy version-1 deposits are supported. This is a supported bridge
profile, not a claim that every other serialization is invalid native consensus.
There is no Bitcoin SegWit reinterpretation. Amounts use 100,000,000 base units per
BOB and the native 10-billion-BOB `MAX_MONEY` sanity limit, not Bitcoin's 21-million
limit. The constant is not a claim about BOB's eventual issuance cap.

Governance configures a P2PKH or P2SH gateway locking script and its route. A payment
must be nonzero, non-coinbase, included at its actual transaction position and
locked to that exact script. A distinct zero-valued output must contain exactly
`OP_RETURN PUSH32 keccak256(abi.encode(domain,paymentIndex,recipient,amount))`.
`domain=keccak256(abi.encode("420/BOB/DEPOSIT/V1",destinationChainId,
destinationRouter,routeId,gatewayScriptHash))`.

The verifier enforces the original 288-confirmation minimum and the configured
minimum deposit height. The adapter independently checks confirmations, network,
gateway, route, asset and destination chain/router. `auxPowValidated` means the
activation-appropriate work/chain-ID path was validated; it does not require an
AuxPoW flag where native consensus permits standalone mining.

Source output identity is fixed by network genesis, transaction ID and payment
index. The adapter consumes both message ID and source output. A different memo,
route configuration or verifier rotation cannot make an already-consumed outpoint
spendable again. Failed admission consumes nothing.

## Native historical script shortcut

Auditing `ConnectBlock` identified a separate checkpoint optimization:
`fScriptChecks = height >= Checkpoints::GetTotalBlocksEstimate()`. The pinned
mainnet estimate is 1,848,000. **Assumevalid=0 alone does not verify signatures
below this checkpoint.** The first native consensus replay is retained; its
missing historical signature checks are qualified with the unmodified native
`libdobbscoinconsensus` ABI against the authenticated raw chain and exact spent
output scripts. This targeted pass applies the actual P2SH/BIP66 version-window
flags, verifies every affected input and rejects a tampered historical signature.
The affected-only pass verified **1,911,823 historical inputs**, including
1,765,871 under the BIP66 DER flag, and rejected a tampered signature. It does
not repeat the passing scrypt/difficulty scan. Native replay validates
scripts from 1,848,000 onward. Together these establish full script coverage.

The producer now disables the shortcut directly for fresh replays with
`-checkpoints=0`. Its required known mainnet genesis/tip and independent canonical
history still bind network identity. The bundle builder rejects a replay with
checkpoint-skipped scripts unless the matching native-script complement is
present. The receipt is provenance for the trusted authority, not a cryptographic
proof that an arbitrary JSON sender ran a process.

## Genuine historical evidence and controlled evidence

Official snapshot:
<https://www.dobbscoin.info/bootstrap/dobbscoin-chain-1914745-20260928.zip>.
Published checksum manifest:
<https://www.dobbscoin.info/bootstrap/SHA256SUMS>.
SHA-256: `30874468c97d7911d1486828a2e8410f11f5af7921786f9073d295bf57ed278a`.

Only raw `blocks/blk*.dat` files were extracted. Snapshot chainstate, indexes,
wallets and undo data were not imported. The selected snapshot tip was independently
cross-checked with the official explorer API:
`c6d2be979323fee26cac4dd88c0e180992d8c62a8901cf6a2faf621f347d2cb8`
at height 1,914,745. Compact committed fixtures include genuine headers,
transactions, scrypt hashes, expected bits, MTP and cumulative work. The full raw
corpus is reproducibly acquired rather than committed as an 820-MiB binary.

The independent scan passed **1,914,746 blocks and 2,140,134 transactions**, all
five difficulty eras and four emergency blocks (1,888,904; 1,891,905; 1,896,462;
1,899,995). Canonical header-stream SHA-256:
`805b01aef94d298dc4aa42142e7dac7e53bb05b672ea0f1560bfa9c772591594`.
Cumulative work: `0x7b83dcd4a57899`.

Twenty-eight settled historical records pass the actual EVM block verifier. An
ordinary historical transaction at height 68,493 has authenticated inclusion and
output parsing, and is correctly rejected as a bridge deposit without the required
420 destination memo. It is not presented as a historical gateway transaction.

At acquisition, the public explorer reported height 1,948,531, below mainnet
AuxPoW activation. The actual native regtest therefore supplies the **controlled**
AuxPoW activation proof: premature template rejection, an independently mined
parent accepted at regtest height 10, and later native standalone blocks with
chain ID 176. A separate native fork test rejects depth 101 and accepts depth 100.
Neither these controlled blocks nor programmable checkpoint consumer fixtures are
relabeled genuine historical mainnet AuxPoW or deployed gateway evidence.

## Qualification and deployment status

**Local implementation and qualification complete.** The full native replay
reached the exact expected tip and cumulative work, then the SDK's authenticated
28-record Merkle bundle passed the EVM verifier. Aggregate retained evidence is
**79 unique Solidity tests (5,000 fuzz cases), 29 Python tests, 21 targeted native
consensus tests**, native AuxPoW/standalone and 100/101-depth fork integrations,
the complete independent mainnet scan and 1,911,823 complementary native script
checks. No GitHub Actions qualification was launched.

Exact commands, passing evidence, checksums, native replay receipt, source/runtime
identity and qualification lineage are retained in [dobbscoin](dobbscoin/).
The original 21 native consensus tests passed. Targeted Solidity, Python, native
regtest and historical passes are retained individually; passing owners are not
rerun merely to obtain a single larger test total. The one AuxPoW parent-branch
implementation correction was requalified only against its affected tests.

The route remains inactive. The existing activation prerequisites still require a
governance-configured checkpoint authority/root, deployed code identity, custody
and gateway script, Registry/risk bindings and live inbound/outbound deployment
qualification. This change does not deploy or activate those dependencies.
No new roadmap phases, branch rules or approval process are introduced.

The next family in the authoritative verifier inventory is **Pirate Chain (ARRR)**.
Current `main` contains no numbered `BRIDGE-AUDIT-3.V.13` roadmap entry; this change
does not invent one or begin its work. Existing Solana/testnet deferrals and open
Tron, XRP, POT and CURE PRs are preserved.

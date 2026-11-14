# BRIDGE-AUDIT-3.V.3 — Ethereum local implementation

The production path is `EthereumConsensusLightClient420` →
`EthereumFinalityVerifier420` / `EthereumGatewayMessageVerifier420` →
`EthereumBridgeAdapter420` → the existing gateway router, route, transfer, risk
and accounting registries. ETH, AAVE, AUDIO, EURC, LINK, QCAD, UNI and USDT keep
their existing canonical asset/route identifiers. No route is activated here.

## Consensus and trust boundary

The light client deploys its own immutable, real SP1 v6.1.0 Groth16 verifier.
It verifies proofs of the pinned SP1/Helios guest, including BLS12-381 aggregate
sync-committee signatures, supermajority finality, committee transitions and SSZ
branches. It uses Cancun's existing BN254 precompiles; EIP-2537 or a destination
consensus upgrade is not required. Security depends on Ethereum sync-committee
honesty, BLS/hash security, SP1/Groth16 soundness and its trusted setup. This is a
consensus light client, not execution revalidation or full-node consensus.

Bootstrap requires an independently obtained trusted Ethereum-mainnet Beacon
checkpoint, its complete header, current committee SSZ root and state branch.
The constructor verifies both root bindings. Bootstrap and updates enforce a
14-day maximum checkpoint age and reject future finalized slots. Relayers
cannot choose a new checkpoint or change the immutable guest/verifier.
An expired instance needs a fresh trusted bootstrap and governance-controlled
verifier rotation under the existing adapter controls; replay state stays in
the adapter. A fixture's historical checkpoint must not be used as a live
checkpoint after it expires.

The guest ELF, source snapshot, full Cargo.lock, and exact Helios dependency
revision are retained in `consensus-program`. `sources.json` pins repositories,
revisions, ELF/tool SHA-256s and independently derived program verification key.
`qualification/program-vkey.log` records the actual native SP1 v6.8.1 derivation:

```
cargo-prove prove vkey --elf consensus-program/helios.elf
# 0x009677367b726fbff9493b3cb72e5d6d218cf4e453f92b7ca1bfce64fe005f1b
```

The guest clears prover-supplied `next_sync_committee` before verifying updates.
The contract authenticates the journal's previous header, previous slot and
starting committee against its stored state, verifies the actual Groth16 proof,
then commits the advanced finalized header and committee roots. The execution
state root in the journal is **not** used alone to authorize receipts. Instead,
`authenticateExecution` checks the full proven Beacon header and a direct SSZ
branch for the execution **block hash**, verifies slot/timestamp binding, and
hashes the canonical RLP execution header. That hash commits both transaction
and receipt roots. `authenticateAncestor` extends authentication backward by
exact parent hashes, contiguous execution numbers and strictly older timestamps.
Finalized execution hashes cannot be replaced.

Current mainnet Fulu uses the Electra state-tree indices and Deneb execution
payload layout. Bellatrix/Capella and Deneb execution-hash indices are 412 and
812; committee state indices are 54 and 86. Gloas is not implemented or claimed.
A future incompatible fork requires a reviewed new client/guest and normal
governance rotation. No fork upgrade is silently inferred from an RPC response.

## Proof wire format and gateway binding

The finality envelope is canonical ABI:
`(uint64 blockNumber, bytes32 blockHash, bytes32 receiptsRoot, bytes messageProof)`.
`messageProof` canonically encodes `EthereumGatewayMessageVerifier420.Proof`:

```
(bytes executionHeader, uint64 transactionIndex, bytes transaction,
 bytes[] transactionProof, bytes receipt, bytes[] receiptProof, uint32 logIndex)
```

Trie proofs contain the RLP root node followed by hashed descendants; embedded
children are decoded in place. The key is canonical RLP(transactionIndex), not
its hash. Both tries must prove the same index against the same authenticated
execution header. Transaction identity is keccak256 of the proven raw signed
transaction, never an unverified receipt RPC field. Legacy and EIP-2718 receipt
types 1–4 are supported. Only a successful receipt with the exact gateway event
can create a transfer. RLP lengths, nesting, integer encoding, trie compact
paths, child representation, node bounds and trailing proof nodes are checked.

`EthereumDepositGateway420`, deployed on Ethereum chain 1, emits:

```
BridgeDeposit420(bytes32 indexed messageId, address indexed token,
 address indexed sender, uint256 destinationChainId, address destinationRouter,
 bytes32 routeId, address recipient, uint256 amount, uint256 nonce)
```

The source gateway escrows exact native value or an explicitly allowed ERC-20's
exact balance increase, supporting no-return tokens and rejecting failed,
false-return, fee-on-transfer and reentrant deposits. Amounts are raw asset units.
The message ID is:

```
keccak256(abi.encode("420/ETH/DEPOSIT/V1", uint256(1), gateway, sender,
 token, destinationChainId, destinationRouter, routeId, recipient, amount, nonce))
```

The message verifier checks all fields and its configured token→route binding.
The finality verifier returns authenticated destination chain/router/route
fields in the extended interfaces. The adapter checks them against its actual
router and route mapping, checks the governance-allowlisted source gateway and
asset, and consumes the message ID once. Replay state persists across verifier
rotation. A rejected downstream router/registry operation atomically rolls back
consumption and risk accounting. A generic ETH payment or ERC-20 Transfer event
cannot be converted to a gateway deposit.

## Deployment configuration

1. Obtain a fresh, independently trusted mainnet finalized Beacon checkpoint
   and current committee state proof. Deploy the consensus client with these
   values; compare its `PROGRAM_VKEY`, deployed verifier and initialization logs.
2. Deploy the message verifier with governance and the existing destination
   `GatewayRouter420`. Configure the existing ETH and seven canonical ERC-20
   route IDs using `setRoute(token, routeId)`; native ETH uses address(0).
3. Deploy `EthereumFinalityVerifier420` with these concrete client and message
   verifier addresses. Configure the existing adapter through governance;
   allowlist the reviewed Ethereum source gateway, preserve canonical asset
   mappings and route bindings, and retain existing risk/emergency controls.
4. Relayers submit pinned-guest proofs, authenticate finalized execution headers
   with SSZ branches, optionally authenticate ancestors, and submit both trie
   proofs plus the selected deposit log. They have no signature authority.

Use mainnet chain configuration and complete light-client state when generating
SP1 proofs. Obtain the upstream guest workspace at the exact `program_commit`
in `sources.json`, including `cli` and `zk-api` (the local source snapshot is
for audit, not a complete Cargo workspace). Its Cargo.lock pins Helios 0.9.4 and
SP1 6.8.1. Use the pinned SP1 build toolchain and upstream build commands when
rebuilding the guest. Independently derive the rebuilt ELF's key before using
it. This qualification derived the key from the checked-in upstream ELF and
verified real proofs; it does **not** claim a fresh Rust guest rebuild or new
proof generation. A prover is not needed to verify existing proofs.

This source escrow implements ingress only. Deployment, custody withdrawal
configuration, operational proving and live cross-chain activation remain
existing activation dependencies; no production addresses, fund movements or
live end-to-end deposits are claimed by this local qualification.

## Historical evidence and independent reproduction

`sources.json` records acquisition endpoints; `SHA256SUMS.json` authenticates all
fixture and qualification artifacts. Two actual Across SP1-Helios update
transactions provide genuine Ethereum finality proof/journal pairs. Avalanche
is only their transport/source of archived bytes, never a finality oracle.
Both proofs verify locally against the pinned guest key. The second crosses
sync-committee period 1909→1910. Four real Beacon bootstrap responses bind
initial/final headers, committees and execution payloads.

Execution block **26411202** has hash
`0xd04129e4d7b1e1fdee6e87f5ad2b36454791e8a2c1f1b971afd28fc9d4260c51`.
The Python oracle independently reconstructs all **221** signed transactions,
all receipts, both tries and the execution RLP hash. Its genuine parent header
also authenticates through the production ancestry path. Native ETH and
AAVE/LINK/USDT historical transaction/receipt vectors exercise Solidity MPT
verification. State-trie account proofs authenticate **all seven** canonical
token addresses and runtime code hashes against the finalized block state root.
A separate genuine 512/512-participant Fulu sync update is independently checked
with py_ecc BLS verification, actual mainnet signing domain and SSZ proofs;
modified signing roots, invalid signatures and empty participation are rejected.

Source gateway integration uses actual local EVM deposits and recorded logs,
signed local transactions, correctly serialized receipts and controlled trie
roots. Test-only root injection and token mocks are explicit. These are not
represented as historical mainnet gateway deposits. Historical account/code
proofs and historical transaction membership are independently genuine.

From the repository root:

```
python3 -m venv /tmp/ethereum-verify
/tmp/ethereum-verify/bin/pip install -r contracts/test/fixtures/ethereum/requirements.lock
/tmp/ethereum-verify/bin/python contracts/test/fixtures/ethereum/verify_manifest.py
/tmp/ethereum-verify/bin/python contracts/test/fixtures/ethereum/verify.py
/tmp/ethereum-verify/bin/python contracts/test/fixtures/ethereum/verify_bls.py
python3 scripts/qualify-ethereum.py --routes --hardening
python3 scripts/verify-ethereum-bytecode.py --solc /path/to/solc-0.8.24
```

The tests use solc 0.8.24, Cancun, optimizer 200, via-IR, 2,500 fuzz runs and
128 invariant runs of depth 64. The runner copies unmodified selected import
closures and fails if no tests execute. It excludes unaffected Solana-only
hardening cases. Compilation/test code-size limits do not establish production
deployability; `qualification/bytecode-sizes.json` separately records production
creation/runtime sizes against EIP-3860/EIP-170 limits.

See `qualification/RESULTS.md` and original logs for exact local evidence.

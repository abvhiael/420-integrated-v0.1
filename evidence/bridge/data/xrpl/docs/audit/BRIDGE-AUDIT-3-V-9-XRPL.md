# BRIDGE-AUDIT-3.V.9 — XRP Ledger (XRP)

**Status: repository implementation and genuine native validated-ledger qualification COMPLETE under the explicit trusted-UNL snapshot model. No live deployment or route activation claimed.** Baseline main `97413f2eea862d5f2ec3117313cd3beb15a634f4`. Existing XRP activation requirements remain in force; routes remain inactive.

| Original requirement | Implemented and actually qualified |
| --- | --- |
| Authenticated validated-ledger verification | `XrplFinalityVerifier420` authenticates canonical full native validation messages against the ledger's native hash and sequence, then accepts only the configured trusted-master quorum. RPC `validated:true` cannot create a certificate. Conflicting accepted hashes at one ledger index cannot replace each other. |
| Trusted validator-list and quorum model | Governance-authenticated, immutable mainnet UNL snapshots pin unique master identities, current manifest signing-key hashes/addresses, ledger interval and Ripple-time interval. Minimum quorum is ceil(80% of trusted masters); no automatic negative-UNL reduction. Duplicate masters/keys/addresses, unknown, disabled, wrong-network and out-of-window profiles reject. Both genuine signed publisher lists and all manifest bindings are independently authenticated offline. |
| Ledger hashes and transaction roots | The exact 118-byte native header is hashed with `LWR\0`; sequence, root and time are parsed from those same committed bytes. Native validation signatures bind that exact ledger hash/sequence. Genuine full-ledger root reconstruction checks all 74 transaction+metadata leaves. |
| SHA-512Half and applicable SHAMap proofs | Native SHA-512 truncated to its first 256 bits; correct `LWR`, `VAL`, `TXN`, `SND` and `MIN` domains. Native transaction+metadata SHAMap v1 has 16 child hashes per inner node, selected by transaction-ID nibbles; bounds, depth, child consistency and root are verified. 21 independent SHA-512 padding/boundary vectors pass. |
| Inclusion and successful execution | The leaf commits both full serialized transaction and metadata with native VL framing plus transaction key. `tesSUCCESS` is required from authenticated metadata; partial payments, issued assets, SendMax/DeliverMin/Paths and contradictory delivered amounts reject. Multi-signature transaction authorization is inherited from source-ledger validity, not inferred from the packet alone. |
| Gateway, amount and destination tags | Approved AccountID, positive native drops (up to native supply bounds), source account, no self payment, explicit tag presence/value, destination chain/router/route and signed recipient memo are bound. Tag absent and tag zero are distinct. The concrete adapter independently enforces destination bindings and retains message/transaction replay protection. |
| Genuine historical validated-ledger evidence | Ledger 108335815 has 34 unique trusted native full validations under a verified 35-master roster (28 required). Its ledger hash, full 74-transaction SHAMap root and a successful 24,809,848-drop Payment with tag 282161781 are independently reproduced and verified in Solidity. Ordinary historical payments cannot be relabelled as bridge deposits. |

## Trust and native consensus model

XRPL validation depends on a chosen trusted validator list and adequate honest-validator/list overlap assumptions; this implementation does not invent global stake finality or a 420 validator committee. Governance authenticates the mainnet publisher/list provenance and master-to-current-manifest signing bindings before installing an immutable profile. A falsely approved list can grant false authority. The profile contains the full unique trusted-master population and an explicit quorum at least ceil(80%). It never reduces that threshold based on untrusted server observations or an unauthenticated NegativeUNL. Operators using a different effective UNL policy require an independently authenticated snapshot; no policy is inferred from signatures or public JSON labels.

Profiles bind network, snapshot hash, allowed ledger-index interval and Ripple-epoch time interval. The native full validation must match the exact ledger hash and sequence, be signed within that profile interval, and have signing time within 300 seconds of ledger close. Disabling a profile invalidates its certificates. Reinstalling the same disabled profile fails; new snapshots require explicit governance approval. Historical proofs remain eligible only under a snapshot appropriate to that historical interval. This is not autonomous publisher-list polling, manifest-rotation discovery or amendment/UNL-state replay.

The genuine corpus pins the two publisher master keys from the upstream mainnet `validators-example.txt`, verifies each publisher manifest, verifies each publisher's raw-list signature and each validator's master/ephemeral manifest signatures, then independently recovers/verifies all contributing native validation signatures. Both lists agree on 35 masters. Native messages from unlisted signers and repeated broadcast copies do not count. The accepted historical ledger has 34 unique trusted full signatures, exceeding 28 required. No private validator key or source signing service is needed or claimed.

## Native serialization, SHAMap and execution

SHA-512Half is the first 32 bytes of SHA-512, not the distinct SHA-512/256 algorithm. Ledger hash is `half(LWR\0 || nativeHeader118)`. A validation's signing preimage is `VAL\0 || canonicalSigningFields`, excluding its `Signature` field. All serialized fields are parsed with canonical extended field headers, ordering, lengths and bounded nested-object/array handling. Only native secp256k1 validation keys are supported, matching the pinned rippled validation format. DER signatures require canonical integer encoding and valid scalar ranges, with low-s enforcement when the fully-canonical flag is set. Full validations are required; partial validations cannot count.

Transaction key is `half(TXN\0 || fullTransaction)`. A transaction+metadata leaf is `half(SND\0 || VL(transaction) || VL(metadata) || transactionKey)`. An inner node is `half(MIN\0 || sixteenChildHashes)`. Full nodes are supplied root-to-leaf, with the child at each depth selected by the corresponding transaction-key nibble. Paths have 1–64 inner nodes; missing/extra depth, wrong branch, mismatched metadata/transaction bytes and wrong roots fail closed. This is native transaction SHAMap v1, not Ethereum MPT, a binary Merkle tree, an account-state proof or a caller-supplied transaction-root assertion.

Only direct native XRP `Payment` is interpreted. Success is the actual metadata `TransactionResult` byte zero (`tesSUCCESS`) inside the authenticated leaf. An issued-currency encoding is not drops; the native sign/currency bits, positive value and supply bounds are checked. `tfPartialPayment` is rejected so a requested amount cannot over-credit a smaller delivered value. SendMax, DeliverMin and Paths are unsupported; a present native `DeliveredAmount` must equal the amount. The independent genuine-evidence check also confirms the destination AccountRoot balance delta. No RPC-only delivered amount or provisional result is authoritative.

Bridge memo is the exact 112-byte `MemoData`:

`420XRPV1 || destinationChainId:u256BE || destinationRouter:20 || routeId:32 || recipient:20`.

The memo is committed in the signed native transaction; the authenticated ledger commits its execution. Governance approves each `(gateway AccountID, tag-present flag, destination tag) -> route` binding; absent/zero tag are intentionally different keys, and zero route revokes the binding. The adapter independently verifies certified destination chain/router/route, approved gateway, configured XRP asset/route and shared replay identities. The interface now returns these destination bindings; deploy a matched new verifier/adapter ABI pair. Existing outbound custody and release/activation requirements are not reclassified by this inbound audit.

`Proof` ABI is `(bytes32 profile,bytes header,bytes transaction,bytes metadata,bytes32[16][] nodes)`. Submit genuine full validations individually with `submitValidation(profile, header, validation, memberIndex)` until the trusted quorum is reached; then submit the canonical ABI proof through the existing router/adapter. Individual validation submissions need no signing authority. `verifyPayment` exposes authenticated historical Payment evidence without assigning bridge authority; the bridge entry point additionally requires the memo and gateway/tag route.

## Actual local qualification and preserved evidence

**49 unique Solidity tests passed**, including **5,000 fuzz cases** (2,500 native-drops values and 2,500 invalid currency/sign encodings). `xrpl-qualification/solidity.log` retains the initial 43 passes: ten adapter owners, 32 proof/adversarial owners including both fuzz tests, and the genuine historical integration. `xrpl-qualification/additional.log` retains only six new checks: three adapter destination substitution cases, the 21-vector SHA-512Half test, native DER/canonical-flag checks and malformed VL/native-amount boundaries. No passing qualification was rerun. There were no test failures. Compiler shadowing/mutability suggestions are non-failing warnings; production sources were not churned to silence them.

`history.log` records two authenticated publisher lists, verified master/ephemeral manifests, 34 native trusted full signatures, exact ledger hash, full 74-leaf transaction SHAMap reconstruction, and the genuine tagged Payment/committed balance credit. `controlled.log` and `controlled-vectors.log` identify deterministic PUBLIC TEST-ONLY fixtures; adding the independent hash/DER vectors regenerated identical existing controlled bundles and introduced no historical-data substitution.

`history-publisher-pins.log` adds an explicit offline check that both pinned publisher keys occur in the preserved upstream mainnet configuration. Only this changed offline verifier was rerun; generated proof bytes and all passing Solidity evidence remained unchanged. `toolchains.json` records the actual installed versions, including cryptography 50.0.0, matching the reproduction pins.

Production deployment bounds: verifier runtime **19,130 bytes**, init **23,695**; SHA-512Half runtime **4,146**, init **4,173**; adapter runtime **3,792**, init **4,201**. All satisfy EIP-170/EIP-3860. Each tested validation submission and deposit call asserts gas below 30 million. The historical harness's aggregate **63,706,514 gas** spans 34 separate native validation calls, snapshot setup and proof checks; it is not a single production transaction recommendation. Exact artifact lengths are in `xrpl-qualification/bytecode.json`.

Toolchain: Foundry v1.9.0 (`6056c5845d34205a83cf7108042adb137325c9df`), solc 0.8.24 (`e11b9ed9`), Cancun, viaIR, optimizer 200. The targeted runner copies the unchanged import closure; elevated test aggregate gas/code-size settings permit the historical harness and are not production deployment exemptions. Source fingerprints, fixture and qualification manifests are retained. No GitHub Actions run was launched; CI run IDs are empty. Publication uses `[skip ci]`; future qualification is scoped to XRPL owners and the shared hash dependency. Existing docs filters exclude this audit/evidence directory.

The pinned SHA-512 source previously referenced by the Solana code and its source fingerprint was absent from current main. This change restores `solana/vendor/Sha512.sol` and its Apache-2.0 license from `mel-project/ed25519-sol@3b36ec8c361c8fe29e6eff10019521454f888ff5`. Its SHA-256 is exactly the already-recorded `96a74497a31f38c57bbf989e66575ae72338bbce950cbbf9bc202cb52cd91eb8`. XRPL reuses this exact dependency and independently qualifies SHA-512Half; no Solana source behavior or prior evidence is replaced.

Reproduction:

```sh
python -m pip install -r scripts/xrpl/requirements.txt
python scripts/xrpl/verify_history.py
python scripts/xrpl/make_controlled.py
sha256sum -c contracts/test/fixtures/xrpl/SHA256SUMS
python scripts/qualify-xrpl.py
XRPL_SOLC=/path/to/solc-0.8.24 python scripts/verify-xrpl-bytecode.py
```

## Provenance, integration and next step

Native protocol reference: [`XRPLF/rippled@3c72fb540d239463d2a4e071d6f71200c3abb5f4`](https://github.com/XRPLF/rippled/tree/3c72fb540d239463d2a4e071d6f71200c3abb5f4), especially `STValidation.h/.cpp`, `Manifest.cpp`, `LedgerHeader.cpp`, `HashPrefix.h`, `SHAMapTxPlusMetaLeafNode.h`, `SHAMapInnerNode.cpp`, and `cfg/validators-example.txt`. Genuine capture endpoints, exact ledger/payment identities, root model and offline regeneration are documented in [the corpus README](../../contracts/test/fixtures/xrpl/README.md).

All seven supplied requirements are repository/historical-qualified under the stated UNL snapshot model. No local implementation blocker remains. No production verifier deployment, operating current UNL snapshot, gateway/custody account or route activation is claimed. Existing production/testnet activation gates remain separate and unsatisfied by local tests. The next numbered step is **BRIDGE-AUDIT-3.V.10**; its canonical title was not found in current repository sources, so no title is invented and no downstream work has begun.

# BRIDGE-AUDIT-3.V.13 — Pirate Chain (ARRR)

Date: 2026-11-15. Baseline: `97413f2eea862d5f2ec3117313cd3beb15a634f4` (`main`).

**Full-step acceptance remains OPEN. Routes remain INACTIVE.** This change implements and locally qualifies the Equihash/PoW, authenticated-checkpoint admission, native shielded-crypto integration, ownership/witness/nullifier, memo, replay and proof-composition boundaries. It does not establish an operationally qualified native Pirate/KMD/anchor proof service or approved gateway custody. No RPC confirmation, checkpoint signature, or controlled regtest fixture is represented as permissionless native dPoW proof.

## Original requirements and evidence

| Original requirement | Implemented and locally verified | Remaining qualification |
|---|---|---|
| Equihash consensus | EVM personalized BLAKE2b Equihash (200,9), distinct/ordered 512 indices, nine collision rounds, SHA-256d target and exact native block-work increment; 449 historical mainnet headers | Full canonical native difficulty/ancestry context through the chosen tip belongs to the authenticated native-state provider |
| Applicable notarization and dPoW | Authenticated native-state record requires actual notary-set, notarization transaction, covered block and cross-chain anchor evidence digests; strict coverage and confirmations; no unsigned/RPC-only admission | Real native notary/anchor evidence and qualified provider authority have not been supplied or deployed; this is **not** a completed native dPoW implementation on EVM |
| Canonical ancestry and confirmations | Checkpoint membership, monotonic shared checkpoint authority epochs, source/network identity, increasing and exact per-block work, minimum three confirmations, October restart anchor | Canonical selection/difficulty history is delegated to native full validation and must be qualified before activation |
| Authenticated shielded transactions | Pinned upstream Sapling Groth16 and Ironwood PostNu6_3 proof, spend/binding signature and version-specific transaction digest integration; historical V4 and native V6 fixtures | Native global anchor, spent-nullifier, inclusion and execution state must also be authenticated by the provider |
| Note commitments, nullifiers, memo | Real FVK decryption, reconstructed commitments, depth-32 witnesses against native roots, received-note nullifiers, strict bridge-domain memo/amount/recipient binding | Mainnet gateway bindings/custody remain unavailable |
| Viewing-key security and deposit ownership | Isolated Linux worker, private owner-only regular FVK files, no final-component symlinks, no key arguments/output, generic failures and contained upstream key-parsing panics, disabled core dumps/process dumping; both pools qualified with disposable native wallets | Production secret-manager/custody provisioning and operating credentials are not configured |
| Note reuse and credential disclosure | Persistent adapter message/nullifier/commitment replay checks across verifier rotation; source/destination/route/key bindings; worker error-output and private-file adversarial checks | Production end-to-end gateway operation remains unqualified |
| Genuine historical shielded evidence wherever available | A genuine historical mainnet Sapling transaction's proof/signatures and transaction Merkle inclusion; 449 genuine historical headers | No historical mainnet owned-gateway viewing/witness evidence was available; no claim to reveal historical private payments; no genuine historical Ironwood deposit qualification |

## Authoritative source audit

Audited release source: [PirateNetwork/pirate](https://github.com/PirateNetwork/pirate/tree/b14db80bfc1a819b958e36d1e0127e94c395d445), commit `b14db80bfc1a819b958e36d1e0127e94c395d445`, release `v6.0.14-b14db80`. `pirate-qualification/upstream-source.json` records hashes of the relevant consensus, notarization, network, address and cryptography files.

* `chainparams.cpp` and `komodo_utils.cpp`: canonical asset name `PIRATE`, private-chain parameters and genesis `027e3758c3a65b12aa1046462b486d0a63bfa1beae327897f56c5cfb7daaae71`. Asset-chain genesis alone is not a unique network identity; the verifier also binds the Pirate network domain, source revision and destination. Mainnet Equihash is (200,9), not regtest (48,5).
* `pow.cpp`, `main.cpp`: native target limits, contextual difficulty, ancestry, chainwork, timestamps and chain selection remain native rules. KMD-only notary easy-mining branches must not be transplanted to Pirate. Native block work is `(~target / (target+1))+1`. The EVM validates the current block's target and work independently. `KOMODO_LOADINGBLOCKS` permits a PoW shortcut while loading, and checkpoint-based expensive-check shortcuts exist; merely importing a bootstrap is not qualification of full historical execution. The controlled node uses `-checkpoints=0`; the Rust worker independently rechecks shielded authorizations.
* `komodo_notary.cpp`, `komodo_hardfork.cpp`, `komodo.cpp`, `cc/eval.cpp`, `crosschain.cpp`, `notarisationdb.cpp`: notary seasons use KMD height or asset-chain timestamps as appropriate. Native notarization admission must authenticate spent notary prevouts, actual transaction signatures, unique applicable notary identities and the correct historical quorum path. Pirate's quorum changes at **4,141,650**, to **six** signatures. Legacy `komodo.cpp` includes its historical 7/11/relative-count disjuncts; `Eval::CheckNotaryInputs` uses its own 11/six path. Do not replace these distinct rules with a timeless majority or arbitrary signatures on an EVM certificate.
* `komodo_dpowconfs`: raw confirmations are returned when no notarization has ever been seen. Once notarization exists, only transaction heights **strictly below** the last notarized height receive raw confirmation counts; equal heights return one. The bridge rejects the pre-notarization fallback and requires strict coverage plus at least three confirmations. This does not mean three extra blocks after notarization.
* `komodo_bitcoind.cpp::komodo_verifynotarization`: missing KMD or destination-chain RPC credentials can return zero without authenticating the external transaction. Therefore a native zero return or `getinfo.notarized` flag is insufficient. An approved provider must authenticate the actual canonical KMD anchor transaction and applicable onward dPoW anchor (the native `BTC` alias also covers LTC), with native input/signature/notary validation, not just copy an RPC flag.
* Mainnet Ironwood activates at **4,161,185**, uses branch ID **`37a5165b`**, transaction **V6**, and Pirate's **PostNu6_3** circuit. It is not legacy Zcash Orchard V5. The October recovery checkpoint at **4,176,945** is `00000007cf016224dc6e7b7101dc3d7e4cd792f7dbbce18003ff577e399acca1`; accepted post-restart records must carry that canonical recovery anchor. Abandoned fork evidence must not be credited.
* `key_io.cpp`: both Sapling `zs` and Ironwood `pirate` use original **Bech32**, checksum constant one, with a 43-byte payload. The adapter checks exact length, alphabet, checksum and canonical padding; native address-point validation remains the custody/execution dependency.
* Native Rust dependencies are locked to the same upstream Pirate forks/revisions. Sapling spend/output parameters are checked against upstream published SHA-256 values before use; arbitrary verification parameters are rejected.

The official Linux archive was acquired and its published SHA-256 verified:
`d3e674042144e5d4e7e0370c3f7a4cd52ed110a398ec8496ef32c5e4d29473d3`.
Its `pirated` executable SHA-256 is `82a14e5ab1f544d360b43459b4fa99440e056e3dd9fe320dcf9eafd8d4ac93fa`.
The binary prints the stale describe string `v6.0.14-ga86845f3dc`; qualification identifies the actual official release archive and bytes, not an invented reproducible-build provenance claim.

## Trust and execution boundaries

`PirateChainFinalityVerifier420` integrates `AuthenticatedCheckpoint420`. Governance selects the native proof-service authority and gateway FVK identities. An authority-authenticated SHA-256 Merkle leaf binds the full native record: canonical source/block/transaction, roots, cumulative/parent work, actual native execution digest, notary-set and cross-chain notarization evidence, gateway key/pool, decrypted note, authenticated note position and memo. Its validation mask is part of this signed commitment. **The mask and nonzero digests alone are not native proofs.** A dishonest approved authority can certify false native state; qualification of that authority and its native verification dependencies remains mandatory. No production authority is created or presumed here.

The EVM independently checks canonical encoding, checkpoint membership/epoch, mainnet/restart identity, exact raw evidence SHA-256, current-block Equihash/PoW/work, strict notarization coverage, confirmations, gateway/pool, native note-root binding, and memo domain. The adapter additionally checks the actual destination chain/router/route and approved key before permanently consuming message, note and nullifier identifiers. Rotation does not clear replay state.

The Rust worker validates actual Sapling and Ironwood authorizations using the pinned native algorithms. Its supported ordinary deposit profile has no transparent inputs, Sprout or legacy Orchard bundles. It does not establish global unspent-nullifier state, canonical ledger inclusion, historical native execution or dPoW by itself. Those cannot be replaced with the worker's `true` fields.

The unsigned composer binds the worker receipt to an already authenticated native checkpoint record and emits the exact EVM ABI. It has no authority signer and no RPC-finality fallback. Its supplied checkpoint root is checked against the actual governance-approved root on EVM; caller-provided JSON does not bootstrap trust. Controlled composer/EVM tests deliberately use mock authority contexts and are not genuine mainnet owned-deposit proofs.

## Shielded ownership, privacy and byte order

Incoming viewing keys can decrypt but cannot establish the received note's spend nullifier. Require a full viewing key: Sapling derives the nullifier from its authenticated position and `nk`; Ironwood derives it using its FVK. A public transaction input nullifier belongs to a spent input and must never be substituted for a newly received note's nullifier. Both received-note nullifiers were checked against subsequent real native spends in the disposable wallet.

The worker accepts a 96-byte binary FVK through a private file, never through command arguments or environment variables. Native extended viewing keys are decoded only within the disposable harness; production custody must provide the isolated binary FVK securely. Secret input buffers are zeroized, failures do not print library errors or key material, and process/core dumping is disabled. This is process isolation and disclosure prevention, not a claim that every third-party curve object has a verified memory-erasure implementation. Keep private wallet files, RPC credentials and daemon logs outside the repository.

Memo layout: eight bytes `420ARRR1`, 32-byte domain, 20-byte destination recipient, little-endian u64 amount, then 444 zero bytes. Domain is `keccak256(abi.encode("420/ARRR/DEPOSIT/V1", network, destinationChainId, router, route, keyId, pool))`. Amount must equal the decrypted note value. Output indices are bound by the authenticated note/transaction record and stable message ID; they are not required in the plaintext memo, because native wallet output ordering can change while constructing a shielded transaction.

Successful output is restricted to authorized bridge-format notes and public bridge evidence. It does not expose FVKs or unrelated memos. Amount and destination become public when bridging by design. A registered FVK identity authorizes the gateway wallet's received notes; it is not proof that production withdrawal custody exists.

Rust receipt transaction IDs and shielded fields use native raw digest bytes. EVM source transaction/block identifiers use conventional display-order hashes; the composer explicitly reverses transaction IDs. Native RPC Sapling roots/nullifiers use uint256 display order and must be reversed for raw crypto bytes; native Ironwood roots/nullifiers already use raw byte order. The native witness qualification checks those different encodings explicitly.

## Qualification and reproducibility

See [retained results](pirate-qualification/RESULTS.md), logs and fixture checksums. All tests ran locally; no GitHub Actions run is claimed. Passing evidence from earlier bridge families and PRs is unchanged. The new narrow owner workflow and existing path exclusions prevent unrelated contract/docs/sports qualification for Pirate code paths. The single publication commit skips CI to preserve this local evidence without launching redundant workflows.

Reproduce public qualification:

```sh
python -m pip install -r scripts/pirate/requirements.txt
python scripts/qualify-pirate.py
python scripts/pirate/verify_history.py
python -m unittest discover -s scripts/pirate -p 'test_*.py' -v
cargo build --release --locked --manifest-path scripts/pirate/shielded/Cargo.toml
python scripts/pirate/fetch_params.py /private-work/pirate-params
python scripts/pirate/qualify_shielded.py --binary scripts/pirate/shielded/target/release/pirate-shielded420 --params /private-work/pirate-params
sha256sum -c contracts/test/fixtures/pirate/SHA256SUMS
```

For optional reproduction of native ownership evidence, use the exact verified release binary and upstream parameters (including Sprout, which the native daemon requires) in its normal parameter directory. Do not replace existing production wallet data. `make_controlled.py --node /verified/pirated --workdir /private-work/disposable` rejects a nonempty output directory, creates a private wallet, disables peers/checkpoint shortcuts, uses regtest upgrades at 1/1/5, mines funding, generates both pool deposits and a later Ironwood spend, and exports only private disposable viewing files. Then run `qualify_native.py` and `qualify_owned_negative.py` with that workdir, the built crypto binary and parameter directory. RPC credentials and viewing keys never enter Git. The native harness may forcibly terminate its disposable daemon after its bounded shutdown wait; no restart/persistence qualification is claimed.

Historical raw blocks were acquired from the official bootstrap stream's complete `blocks/blk00141.dat` entry. The full 30,163,619,055-byte compressed archive was not downloaded and its whole-archive published checksum is **not** claimed verified. The entry checksum, actual extracted header/transaction checksums and provenance are recorded in `historical-inclusion.json`. Independent validation finds 449 distinct valid Equihash/PoW headers and 245 parent edges among them; the file contains height gaps/order differences, not a consecutive canonical-chain proof. A genuine Sapling transaction is authenticated to its genuine block's Merkle root and cryptographic authorizations. This proves those cryptographic properties, not canonical tip, dPoW or historical ownership.

## Genuine external blockers and next canonical work

No approved native Pirate/KMD/onward-anchor verification service, authenticated live native-state authority, registered production gateway FVK or withdrawal custody was present in authoritative `main`. Those dependencies must supply and qualify real canonical ancestry/difficulty/execution, season-specific notarization and anchor evidence before this route can activate. Historical mainnet owned-note evidence requires authorized private viewing and witness data; public explorer responses cannot manufacture it. Never request publication of production viewing credentials.

Acquisition attempts: official explorer API returned HTTP 403; the alternate explorer's `/api/status` and `/api/blocks` returned HTTP 404; TLS-verified public lightwalletd access returned upstream HTTP/2 502. Official bootstrap streaming did provide the genuine public historical data above. These limitations are recorded as acquisition evidence, not asserted as proof that no other operator has the missing service or private evidence.

The original V.13 acceptance remains open on these dependencies. Nothing is silently moved to a new roadmap phase or called complete. Current `main`'s verifier inventory ends with Pirate Chain and does not define a numbered successor to V.13; no V.14 or other successor is invented or begun.

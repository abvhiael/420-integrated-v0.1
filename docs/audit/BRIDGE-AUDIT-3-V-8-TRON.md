# BRIDGE-AUDIT-3.V.8 — Tron (TRX)

**Status: repository implementation and genuine historical native-TRX qualification COMPLETE for the documented checkpoint/SR-snapshot trust model. Production deployment and route activation are not claimed.** Baseline main: `97413f2eea862d5f2ec3117313cd3beb15a634f4`. All configured TRX routes remain inactive.

| Original requirement | Implementation and actual qualification |
| --- | --- |
| Implement or integrate solidified-block verification | `TronFinalityVerifier420.solidify` checks a consecutive native signed header branch from an authenticated checkpoint or previously solidified anchor. Nineteen distinct active SRs must produce at the target height or above. The accepted prefix is persisted; conflicting solid blocks cannot replace it. |
| Authenticate SR identities and relevant signatures | Explicit ordered 27-SR snapshots bind witness accounts to their current witness-permission signing keys. SHA-256 of native raw header bytes is verified by secp256k1 recovery. Tests cover delegated keys, wrong keys, repeated producers and native high-s encoding. Historical verification recovers every producer against the independently sourced genesis roster. |
| Validate applicable consensus and finality rules | Mainnet genesis, snapshot/checkpoint identity, exact block-number ancestry, increasing absolute slots, scheduled SR `(timestamp / 3000) % 27`, active-set size, bounded no-transition validity window and the 19-of-27 solidification rule are enforced. Disabled/unknown profiles fail closed; conflicting solidification rejects. Invalid pending branches store no state and cannot pin a head. |
| Authenticate transaction inclusion and execution results | Native transaction protobuf is hashed in full, including signatures and any result, against the signed transaction root. java-tron's odd Merkle node is promoted unchanged. Only atomic native `TransferContract` is supported. Committed FAILED, REVERT and other failed results reject; native pre-TVM transfers with no result are justified by native actuator semantics and qualified with genuine evidence. TVM calls and TRC token transfers are not interpreted as native deposits. |
| Validate gateway accounts and native amounts | Source owner, `0x41` native addresses, non-self transfer, positive signed-int64 sun amount, approved gateway, exact bridge memo, destination chain/router/route and recipient are checked. The adapter independently checks the certified destination bindings and retains canonical transaction/message replay maps across verifier changes. |
| Test genuine historical solidified-block evidence | 1,099 consecutive genuine mainnet headers anchored back to genesis; native producer signatures, ordered genesis SR membership/scheduling, two native transaction signatures and complete transaction leaves checked independently. Solidity solidifies linked historical chunks through height 1045 and authenticates its 580,000,000,000-sun native payment. Historical ordinary payments cannot be relabelled as bridge deposits. |

## Trust boundary and supported consensus profile

This is a native DPoS signature/header light verifier with **governance-authenticated checkpoint and SR permission snapshots**, not a 420 validator committee or bridge-domain signature oracle. It accepts genuine native block producer signatures. Governance must authenticate the checkpoint's canonical mainnet provenance, the exact ordered active SR set, witness permission keys and the historical validity interval from independently verified source-chain state. A false checkpoint or roster can grant false authority. The contract does not replay elections, permission updates or the SVM/TVM, and a genesis label cannot make an arbitrary checkpoint trustworthy.

Each immutable profile has a snapshot hash, checkpoint number/hash/time, final supported height and expiration time. The time span is at most six hours. Its approved window must end before any maintenance, witness/permission or consensus-parameter change; the contract rejects imports outside that bounded window. Later periods require their own authenticated snapshots. No snapshot is installed automatically, unknown profiles cannot verify deposits, and disabling a profile invalidates its proofs. A snapshot must not be inferred solely from public RPC `listwitnesses`, recovered signature addresses or an RPC solidity label. The native assumptions are the source chain's honest-SR/finality guarantees plus the explicitly trusted checkpoint and profile authenticity; this is not a claim of autonomous genesis-to-current election replay.

The historical profile is particularly reproducible: the upstream genesis config supplies all 27 identities and their initial ordering, all captured transactions are native payments, no captured transaction changes membership or permissions, and the captured window ends before the next maintenance boundary. The offline verifier handles bootstrap block 2's maintenance skip and proves the block-2 checkpoint from genesis; Solidity starts ordinary scheduling at block 3. That bootstrap witness roster is not reused as a current production roster.

## Native wire and bridge binding

Header identity is SHA-256 of protobuf `BlockHeader.raw`, with its first eight bytes replaced by the big-endian block number. The native signature signs the **unmodified raw-header SHA-256**, not that block ID. The transaction ID is SHA-256 of `Transaction.raw_data`. The transaction Merkle leaf is SHA-256 of the **entire serialized Transaction**, including signatures and `ret`; a transaction-ID-only branch cannot authenticate an execution result. Canonical protobuf field order, supported field types, lengths, duplicate singular fields, overflow and bounded sizes are checked. Native signature recovery accepts the java-tron high-s representation; replay identity remains the raw transaction ID.

Native `TransferActuator` rejects self transfers and non-positive amounts, debits the owner and credits the recipient atomically, marks success, and throws on failed validation/execution. Unlike a TVM call, a native transfer cannot remain in a valid committed block with a failed transfer effect. When a result is present, this implementation verifies its success from the committed leaf; when the pre-TVM result is absent, success follows from authenticated inclusion of that validated native operation. External `TransactionInfo`, JSON `SUCCESS` and `solidified=true` do not supply proof authority. Multi-signature account authorization is inherited from source-block validity; this verifier does not reconstruct live account permission state from the packet's signatures.

Inbound memo is exactly 112 bytes:

`420TRXV1 || destinationChainId:u256BE || destinationRouter:20 || routeId:32 || recipient:20`.

It is inside the signed raw transaction. `setGateway(account, route)` is governance-only; setting a zero route revokes that destination. The concrete adapter separately checks the approved source account, bound TRX asset/route, certified destination chain/router/route, caller and replay state. No external native payment is silently assigned a recipient. Native units are sun; 1 TRX = 1,000,000 sun. Outbound custody/release is not implemented or reclassified by this inbound audit step; existing activation requirements remain in force.

`DepositProof` ABI is `(bytes32 profile,uint64 number,bytes transaction,uint32 index,uint32 count,bytes32[] siblings)`. Supply the canonical ABI encoding to the adapter/router after `solidify` has committed the source block. Inclusion branches use full-transaction leaves and promote an unmatched odd node without a sibling. Extra branches, wrong indexes, transaction/result mutations and non-canonical bridge proof envelopes reject. `verifyNativeTransfer` exposes authenticated native evidence without granting bridge authority; `verifyFinalizedTransfer` additionally requires the memo and approved gateway route.

## Retained targeted qualification

48 unique Solidity tests passed, including **5,000 fuzz cases** (2,500 native amount cases and 2,500 unsupported-wire cases). Preserve these logs without a broad suite rerun:

- `tron-qualification/solidity.log`: initial 38 passes (12 adapter, 25 proof/adversarial including both fuzz owners, one genuine historical integration).
- `tron-qualification/solidity-additional.log`: seven additional passes and one test-helper failure. The failing helper assumed a fixed protobuf payload length when locating an enum; the implementation did not fail.
- `tron-qualification/solidity-affected.log`: only that affected test rerun, passing after using parsed protobuf boundaries. Existing assertions were retained.
- `tron-qualification/permissions-and-native-failure.log`: two new delegated-permission and native failure/int64 boundary tests, both passing.
- `tron-qualification/history.log`: offline verification of genuine ancestry, signatures, scheduling and complete transaction roots. Adding explicit genesis serialization and no-membership-change checks required only this offline verification to run again; Solidity/production sources were unchanged.
- `tron-qualification/history-exact-upstream.log` and `historical-exact-upstream.log`: final fixture provenance correction removes one extra trailing blank line introduced while saving the upstream config. The config is now byte-identical to the pinned upstream content. Only the snapshot hash/profile fixture changed; native headers, signatures, transaction bytes, roster values and production code did not. Regenerated offline evidence and reran only the historical integration owner for the final fixture identity. The 48-test count is unique tests, not duplicate attempts.

Compiler/runtime: Foundry v1.9.0 (`6056c5845d34205a83cf7108042adb137325c9df`), solc 0.8.24 (`e11b9ed9`), Cancun, viaIR, optimizer 200. The isolated runner copies the unchanged test import closure. Elevated aggregate test gas/code-size settings permit a test to perform eleven historical solidification calls in one test invocation; they are not production deployment exemptions. Individual tested 128-header solidification and deposit calls each assert gas below 30 million. The historical harness's aggregate 126,949,727 gas is multiple independent production calls, not a single recommended transaction.

Independent production compiler bounds: verifier runtime 13,451 bytes / init 13,757; adapter runtime 3,723 / init 4,132. Both satisfy EIP-170 and EIP-3860; actual artifact lengths are in `tron-qualification/bytecode.json`. Publication preserves all existing Solana/Bitcoin and unrelated audit evidence. No GitHub Actions run is launched or claimed; run IDs are empty. Only new TRON owners are wired to `bridge-tron-proof.yml`; existing docs workflow filters exclude these audit/evidence files. The publication commit uses `[skip ci]` to preserve passing local evidence.

Reproduction:

```sh
python -m pip install -r scripts/tron/requirements.txt
python scripts/tron/verify_history.py
sha256sum -c contracts/test/fixtures/tron/SHA256SUMS
python scripts/qualify-tron.py
TRON_SOLC=/path/to/solc-0.8.24 python scripts/verify-tron-bytecode.py
```

## Source provenance and integration status

Protocol implementation reference: [`tronprotocol/java-tron@b33eed89a6a424c498d4fb1b03ca2c86eddf4840`](https://github.com/tronprotocol/java-tron/tree/b33eed89a6a424c498d4fb1b03ca2c86eddf4840), specifically `DposService.java`, `DposSlot.java`, `BlockCapsule.java`, `TransactionCapsule.java`, `capsule/utils/MerkleTree.java`, `TransferActuator.java`, `Tron.proto`, `Parameter.java` and the genesis `config.conf`. Fixture sources, checksums and independent expected values are documented in [the corpus README](https://github.com/abvhiael/420-integrated-v0.1/blob/43c7fa2363574cd21491ad6252371fa537ea1010/contracts/test/fixtures/tron/README.md). Source fingerprints and result classification are adjacent in `tron-qualification`.

No testnet, production verifier, current SR permission snapshot, custody gateway account or activation transaction is claimed by repository qualification. The existing TRX deployment/activation gates remain unchanged; unavailable live deployments do not invalidate the genuine historical and local proof qualification completed here. The interface now returns certified destination chain/router/route fields, so a deployed adapter/verifier pair must use this matched ABI; do not mix the earlier mock-only ABI with the new verifier.

Next numbered step: **BRIDGE-AUDIT-3.V.9**. Its canonical title was not found in the repository; no title or downstream work is invented and it has not begun.

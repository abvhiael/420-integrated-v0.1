# GOV-PRE-08 Step 3: unsigned V4 materialization and local integration evidence

## Authority boundary

Step 2 merged as PR #1337, merge 511680b2a096c59783e77604add7b9dbcd74d185. Historical FROZEN_V3 remains the authoritative frozen history. The source-bound V4 proposal is unsigned and may NOT trigger application migrations or production activation. No local synthetic founder or impersonated Timelock transaction proves genuine governance consent.

## Exact-source reproducible commands

The workflow invokes:

~~~sh
bash scripts/gov-pre-08/qualify-step3.sh
~~~

An exact checked-out PR SHA, Foundry, Python 3 and local Anvil are required. EXPECTED_HEAD must match the actual Git HEAD and RUNNER_TEMP must be an empty disposable directory.

Build output contains fourteen genuine compiled founder, retirement, Treasury, sponsorship and developer-compensation module artifacts. Each includes full ABI, creation bytecode, deployed runtime template, storageLayout, immutable-reference offsets and Git blob provenance, with independent SHA-256 digest verification. Two independent compiler artifact exports must be byte-identical. Outputs explicitly leave network addresses and live runtime verification NULL/FALSE, because constructor-dependent templates are not the live EVM.

## Two-node local qualification

Each chain starts from identical local-only 42m native allocations, with chain ID 31337 and no funded dev account. On each independent process the Step 2 operator executes real constructors, ProtocolReserve code materialization (Anvil-only), Vault registration and native reserve-to-Vault transfers. The Step 3 verifier independently fetches canonical mined receipts, deployed code, read-back custody and all six native transfer/deposit/accounting events, checking uniqueness, canonical block hashes and unchanged source HEAD. Replay of the same six logs cannot change the read-only projection.

The reorg probe snapshots the disposable chain, makes a local transfer, rolls back and demands orphaned receipt disappearance and exact balance restoration. The harness dumps the funded node state, shuts down the actual process, starts a new process with the saved state, and re-verifies actual runtime codehashes, VaultRegistry addresses, accounting balances, ProtocolReserve immutable, all original native allocations and 42m conservation. A simulated rollback is not proof of production consensus reorg/finality.

## Cross-protocol coverage vs remaining work

| Consumer | Actual scope added | Remaining Step 3 exit |
|---|---|---|
| Registry | Actual local VaultRegistry resolution and Vault pointers | Approve V4 component IDs and complete service and founder/Treasury graph discovery |
| Treasury | Step 2 actual native funded Vault receipts and local settlement | Running complete Treasury policy and payout route coverage |
| Indexer | Independent canonical receipt/log projection and idempotent replay | Actual 420Indexer ingestion with restart/reorg checkpoint reconstruction |
| Explorer | Existing Indexer-only authority config checked | Running Explorer consuming recovered Indexer state |
| Wallet | Existing Registry-discovery non-authority source checks | Actual wallet account/chain/discovery/sign/claim/vote operations and negatives |
| Stake | Step 2 sponsored credit/collateral/reward local tests | Actual Stake consensus/native issuance and downstream operations |
| Governance | Step 1 real Foundry founding graph and local Timelock-scope tests | Unified local Civic/Timelock lifecycle and authorized V4 migration |

A passing workflow only qualifies its demonstrated local source, receipt, replay, simulated reorg and process recovery assertions. It does NOT mean seven production applications all ran end-to-end. The missing genuine approvals do not excuse engineering tests; they also must never be fabricated.

## Cold-start / recovery rule

From the exact qualified source SHA, first generate and verify V4 unsigned compiler outputs, then generate a local synthetic Genesis and launch loopback-only Anvil. Materialize and fund the real disposable Vaults, archive the receipt witness, independently reconstruct canonical logs, probe reorg rollback, persist state and restart into a new local Anvil process. Confirm canonical Registry, runtime code hashes and native custody after the restart. A failed check is a NO-GO, not permission to regenerate output and rewrite history.

Never copy synthetic founder identities, impersonation calls, local-only component IDs, or this chain-31337 output to testnet or production. Release still requires external authentic founder owner proofs and an independently approved V4; local Step 3 also needs full runtime Wallet/Indexer/Stake/Treasury/Explorer/Governance integration before its complete exit can be claimed.

## Step 3 incremental persistent-Anvil graph and real 420Indexer adapter

The runnable `materialize-local-v4-contract-graph.py` now extends the **same funded Step 2 Anvil process**. The 14 production modules are genuinely deployed through their constructors, not merely compiled to ABI templates. Three frozen system anchors (GovernanceTimelock, ProtocolRegistry, ValidatorRegistry, CommunityValidatorReserve) are materialized *locally only* using fresh production constructor runtime and explicit initial Timelock storage. The canonical unsigned V4 identity is never approved; chain-31337 Anvil impersonation, local-only component registration IDs, and fixture founders are not signed authority or transferable production state.

On that real graph, actual on-chain local transactions install and verify three synthetic founder claims, fourteen ProtocolRegistry component revisions and code hashes, three canonical services (Treasury, Vault, Development Compensation), founder Treasury native policy and budget initialization, one-shot binding, actual Stake/Community Reserve sponsorship pointers and the Compensation Vault binding. Source/custody proofs require two independently cold-started Anvil processes produce identical graph digests; full code hashes, Registry IDs, service discovery and balances are read again after actual process replacement and local Anvil state import.

The `qualify-step3-indexer.mjs` test additionally executes the repository's **real** `420Indexer` `EvmJsonRpcSource420`, `ProtocolDecoderRegistry420` and `ProtocolProjection420` modules against that chain's mined transaction logs. Genuine compiler ABI events bind to actual component addresses, with canonical block/receipt correlation, duplicate replay suppression, wrong-emitter rejection, derived read-model rollback and full reconstruction. The SQL transaction adapter is explicitly **in-memory** and only simulates a PostgreSQL transaction boundary: it neither deploys nor tests a live PostgreSQL, checkpoint worker or Explorer application. It must never count as full Indexer/Explorer runtime qualification. All evidence is scoped to chain 31337.

**Still not qualified:** a signed, independently approved V4; production V3-to-V4 migration; a live wallet performing native/identity/governance operations through the new real Registry; real PostgreSQL-backed 420Indexer checkpoint/reorg/recovery and running 420Explorer; consensus-to-Stake-native issuance; and real end-to-end Civic Governance Timelock decisions, cross-network rejection and consumer failover across applications. These are mandatory before complete GOV-PRE-08 Step 3 closeout. The Step 3 branch remains DRAFT/IN PROGRESS.

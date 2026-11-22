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


## Running-application local integration added after initial Step 3 source qualification

The expanded local-only qualification at scripts/gov-pre-08/qualify-step3.sh now assembles actual independent application components rather than substituting document/config lookups:

* **Wallet web clients:** scripts/gov-pre-08/qualify-step3-wallet.mjs imports the actual wallet/web/core/treasury-client.js and governance-management.js and reads real Anvil deployed contracts. The local Registry publishes canonical existing Treasury Router + five Civic component IDs and the actual Treasury ABI/runtime dependencyRoot. Tests verify the real canonical Treasury service, all five Civic identities/code hashes/bindings, read-only governed action preparation, wrong-chain detection, disappearing Registry runtime, disconnected-account rejection, and no broadcast. This is not a browser UI nor an authorized vote.
* **Persistent 420Indexer:** scripts/gov-pre-08/qualify-step3-postgres.mjs uses a real PostgreSQL 16 service and the production TypeScript PostgresSql420, EvmJsonRpcSource420, ProtocolDecoderRegistry420, CoreProjectionConsumer420, IndexerIngestor420, SqlCanonicalHistoryStore420 and checkpoint machinery. An isolated schema is rebuilt per local chain. An actual IndexerPublicApiAdapter420 and HTTP server handle read-only requests. Assertions cover canonical receipts, persisted checkpoints, idempotent resume, a real disposable Anvil reorg with orphaned receipt deletion and canonical replacement, reconnect after Anvil and process restart, and wrong-chain HTTP denial. Local Anvil finality is HEAD-ONLY; no consensus finality is fabricated.
* **Explorer Go application:** scripts/gov-pre-08/postgres-explorer-compat.mjs translates live read-only committed PostgreSQL indexes into the Go Indexer API used by the *actual* explorer/cmd/explorer420 binary; scripts/gov-pre-08/qualify-step3-explorer.sh starts that Go process on loopback and tests /v1/ready, status, block listings and details, HTML serving, original chain transaction and receipt, Registry service version, process restart, and chain-420/31337 refusal. Unsupported consensus, Stake activity, or finalized views fail closed. The transport adapter is TEST ONLY and cannot be presented as production Go/TypeScript API deployment parity.
* **Actual 15-validator devnet processes:** scripts/gov-pre-08/qualify-step3-consensus.sh executes 15 independent fourtwentyd binaries over the repository devnet-bus TCP broker, maintains 11/15 quorum source, checkpoints and restores persisted consensus head/safe/finalized states, and exercises a second process lifetime. This tests actual accelerated devnet services only; it is not a signed production BLS quorum, a native node420 Engine API path, 420Stake reward minting, or combined 420/31337 execution/finality proof.

The workflow has a real disposable PostgreSQL service and Node 22 / Go 1.23 / Foundry toolchains, retains source-head manifests, raw Postgres/restart/Explorer/consensus evidence, and cancels superseded PR runs. The **new expanded test sub-scopes must NOT be called qualified until the exact latest source SHA has a successful retained CI artifact**.

### Remaining mandatory full Step 3 gates

* Running, persistent and truly connected node420 + 15-validator fourtwentyd with authenticated Engine API, EVM 420 consensus-origin system calls, issuance/accounting and Stake reward routing; local TCP devnet and Anvil differ in chain ID and do not settle on the same native 420 execution ledger.
* Real identity-backed Wallet account/authorization and browser transaction/vote UX with all attack/reorg/recovery cases; the read-only local Wallet is a genuine client integration but not real authenticated user action.
* Production-standard PostgreSQL workers and Go Explorer with all routes (including consensus, Stake and Treasury), chain 420 state, full checkpoint/finality and reorg guarantees and deployment rollback; the strict compatibility bridge proves a local interface slice only.
* End-to-end Civic proposal/voting/timelocked execution and retirement across all actual services, not an Anvil-impersonated Civic activation snapshot.
* Three genuine off-system founder ownership proofs and independently reviewed chain-specific V4 approval before ANY migration. A user request to implement or test DOES NOT replace these independent cryptographic approvals.

Do not merge this draft PR as full GOV-PRE-08 Step 3 completion or promote the source candidate. Preserve historical V3 without in-place mutation; all new graph IDs, timing and authority remain isolated to chain 31337.

# GOV-PRE-08 Step 3: unsigned V4 materialization and local integration evidence

## Latest qualification status

**GOV-PRE-08 Step 3 local engineering qualified.**
[PR #1338](https://github.com/abvhiael/420-integrated-v0.1/pull/1338)
passed all three jobs in [run 45108109535](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45108109535)
at executable source `a8f133d7869f6784e40671b1c5a3c8f3ff672051`.
The [unified evidence](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45108109535/artifacts/14788074524)
and [source and recovery evidence](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45108109535/artifacts/14788577328)
record the same-chain results. The PR records the final rerun and its artifacts.

| Case | Retained result |
|---|---|
| Genesis and protected committee handoff | Two source materializations produced identical funded Genesis bytes with 42,000,000 $420. Fifteen protected validators per active roster certified the original roster, the disjoint replacement roster at slot 17,640, and the returning original roster at slot 35,280. Each replacement used the exact prior parent QC. |
| Civic and Treasury | Real Chromium and 420ID signed the proposal and ballot. The G1 operation denied execution before the frozen seven-day delay and executed at height 14. At height 15 a signed EIP-1559 transaction released 1 $420 from the Operations Vault using two narrowly scoped grants, rejected replay, and left 4,199,999 $420 in the Vault. Both Indexers and Go Explorer reconstructed the same payout and commitment. |
| Stake and PostgreSQL recovery | Civic funded 42,000 $420 in sponsored collateral. The two native sponsored allocations each paid 535714285714020000 wei to the operator and 59523809523780000 wei to the community reserve. Both Indexers and Go Explorer agreed before and after the certified reward-tip replacement. A corrupt Go snapshot and a corrupt TypeScript finalized checkpoint were rejected. Reconstruction and bounded tip replay preserved the finalized payout, balances, and canonical projections. |

Two independent native cold starts also reproduced identical Genesis,
consensus history, checkpoint, public trust, and financial result files.
The release workflow pins its staging toolchain and copies fork-system
accounts only from the target Genesis configuration. The 31337 staging block,
beacon, and request history stays on the staging network.

Use [the exact-head workflow](https://github.com/abvhiael/420-integrated-v0.1/blob/main/.github/workflows/governance-pre-08-step-3.yml)
for cold start and evidence collection. The unified job captures signed proposals
and quorum receipts, execution receipts and archives, PostgreSQL recovery logs
and consumer projections in `govpre08-unified-local-<source SHA>`. To enable
native archive ingestion against a previously indexed ledger, rebuild the
TypeScript projection from the canonical Genesis using authenticated Engine RPC
and the retained ABI before serving it. Restart the worker against that rebuilt
durable checkpoint and compare the canonical receipts and Stake evidence.

The committee schedule authorizes only the isolated local chain in the rehearsal.
Independent founder ownership and exact V4 approval remain pre-Genesis ceremony
prerequisites. Live claims, finalized network receipts, reward observations and
governance retirement remain in [GOV-AUDIT-9](420GOVERNANCE-TESTNET-WORK-ROADMAP.md#network-only-gov-audit-9-evidence-not-local-step-3-acceptance).

## QUALIFIED — one real local chain-420 execution state (2026-11-22)

**Exactly qualified executable source:** `d7399faffe11899b9e0b53f9e5ff474838c25034`. [GOV-PRE-08 Step 3 #45077808181](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45077808181) **SUCCESS**, all three jobs: actual Step 2 funded source graph materialization, patched Geth/native reward/real execution crash and protected BLS settlement, and **one jointly observed chain-420 native/application run**. Separate [node420 Release Gate #45077808158](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45077808158) also **SUCCESS** at the same executable SHA. Retained combined local witness `govpre08-unified-local-d7399faffe11899b9e0b53f9e5ff474838c25034`, artifact ID **14776046654**; native and source manifests are in the same successful workflow.

The actual funded Anvil 31337 account trie (14 production founder/Treasury/Stake/etc. constructor modules, registered Civic/Registry services, registered and funded Vaults) is exported into **one new disposable patched-Geth chain-420 Genesis**. This is a post-state Genesis import: earlier Anvil receipts do not magically exist on new Geth blocks. The *real* `fourtwentyd --certified-settlement` process verifies its **11-of-15 signed deterministic local BLS fixture quorum**, submits authenticated Engine batches and settles two real blocks through the canonical `ConsensusSystemCall420` gateway and `ValidatorRegistry` / `RewardController`; native rewards fund the public insecure test-only EOA, which then signs and sends a genuine EIP-1559 transfer included in the second certified block. The actual production Wallet Treasury and Governance clients verify Registry service/module discovery and wallet session against this same Geth RPC, without broadcasting an unauthorized governed Treasury or Civic action.

Two production Indexer paths read **that exact same Geth execution history**: the Go Indexer archives BLS-certified native system-call logs with real producer provenance and persists canonical state in PostgreSQL 16, while the TypeScript `420-indexer` persists its EVM blocks and real ordinary EOA transaction/receipt to isolated PostgreSQL projections. The real running Go Explorer consumes the Go Indexer **directly**, not the earlier test-only PostgreSQL compatibility bridge, and serves its certified block and the signed Wallet transaction. Recovered Indexer and Explorer processes retain the same certified block hash and native-log count. The retained canonical block-2 hash is `0xc3169f1f6dadd351525bddf4dbb73f549a27f360c4233c9231dc73e0d5caf7e8`, signed Wallet tx `0x1da68a2617ca37eff6578046f3f8bd14eaad4792fac3adb90ec56d45a922c9bd`, with **4 real system calls and 14 archived native logs**.

The strengthened exact-head test now **reconciles actual shared-Geth custody twice**: after importing the source Genesis and after both certified system-call batches, signed Wallet settlement, and recovered Indexer/Explorer services. It requires unchanged source-bound contract runtime and `0x0424 ProtocolReserve = 3,560,000 $420`, `Operations AssetVault420 = 4,200,000`, `Contingency AssetVault420 = 840,000`, `Community AssetVault420 = 0`, `0x0425 CommunityValidatorReserve = 6,300,000`, and `0x0426 CommunityRewardReserve = 2,100,000`. These exact amounts are read from Geth RPC and compared to the real Step 2 mined-funding manifest. **No synthetic balance or fabricated Geth transaction receipt is substituted.** The qualification also corrected an intermittent actual-Geth SIGKILL/restart race: the test now awaits child-process exit and datadir lock release; full crash/reconstruction still passes.

**Remaining, different engineering acceptance:** this is a real jointly connected **application/consensus settlement chain**, but its BLS quorum was generated by a deliberately insecure deterministic local fixture, **not by 15 simultaneously running, independently protected validator signer processes**; the separate 15-process devnet has not been represented as the producer of this Geth chain. Actual browser Wallet UI/identity and Civic proposal/vote/Timelock execution journeys, multiprocess network production/recovery, and broader application failure/finality/permissions remain separate pre-testnet scope. Overall GOV-PRE-08 is not completed by this sub-scope.

**Network-only deferred evidence** (not Step 3 coding requirements): actual live Genesis and deployment attestations, human founder on-chain claim transactions, live Treasury funding/retirement and live Indexer/Explorer canonical outcomes belong to [the existing GOV-AUDIT-9 testnet work roadmap](420GOVERNANCE-TESTNET-WORK-ROADMAP.md). Independently supplied public founder addresses and approved, signed exact V4 Genesis authorization must precede launching an immutable production-equivalent testnet; synthetic founder keys and `FROZEN_V3` are never changed.


## Exact-head pre-testnet engineering status — 2026-11-22

**CONFIRMED PASS, pre-testnet evidence only:** commit `48aa642e0aede9750136ac2ad23f022087851dfd` qualified under [Step 3 CI #45072161557](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45072161557) in **both** jobs, including the real patched `node420` native 90/10 reward/JWT Engine/protected-signing/recovery gate and two independent Anvil + PostgreSQL + running Explorer/Wallet/Registry local applications. The standalone [node420 Release Gate #45072161582](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/45072161582) also passed at the same source head. Earlier statements below about the PostgreSQL app and node420 native suite being unrun/untested describe previous interim revisions, not this current passing scope.

**Not yet done, but fully feasible before testnet** (software exit criteria, in priority order):

1. **One actual connected local network:** start patched `node420` and certified `fourtwentyd` on the *same chain ID/Genesis*, execute canonical authenticated Engine system calls in that shared state, and attach real Stake/Registry/Treasury/Indexer/Explorer/Wallet consumers. The two successful CI jobs use different local fixtures; separate PASS does not establish a common 420-chain execution history.
2. **Complete app actions and Civic lifecycle:** run real Wallet account creation/import/connection, native transactions, guarded Treasury operation, founder-claim fixture, Civic proposal/vote/finalize/schedule/execute with simulated local actors; verify unauthorized signature, disconnection, wrong-chain, stale-Registry and duplicate-operation denials, including the on-chain read model and UI confirmation.
3. **Production Indexer/Explorer transport parity:** remove the *test-only* PostgreSQL-to-Go Explorer compatibility adapter from the launch path. Connect the actual production 420Indexer API and Go Explorer, with authenticated consensus producer/finality provenance, full Stake/Treasury/Governance routes, durable PostgreSQL projections and rollback/rebuild.
4. **Hostile-network and recovery qualification:** deliberately restart/crash the paired consensus/execution nodes, indexer, Explorer, wallet session and Postgres; test finality, reorg, checkpoint restoration, split-network isolation, stale source, malformed signatures and mismatched runtimes. Capture reproducible exact-head test results.
5. **Reproducible V4-shaped release package:** generate exact compiled ABI, bytecode, immutable storage, frozen component/service IDs, 42m $420 supply and Vault funding, expected deployment order, preflight scripts, operational manifests and rollback procedures. Use only clearly synthetic local founders until the launch ceremony, never fabricate owner proof.

**Separate from software, do not chase as pre-testnet implementation:** real founders' independently controlled public addresses and optional EIP-191 proof, independent approval of the exact V4 Genesis commitment, and launch authorization are external *pre-Genesis ceremony* inputs. They cannot be manufactured by CI. The genuine public founder beneficiaries must be known **before** an immutable Genesis containing their liquid allocations and constructor bindings is launched; ordinary EOA address creation and personal signing do **not** require an existing chain. The final on-chain `claimFounderWallet`, code-bound EIP-1271 proof against the real network, live receipts, finalized native reward and actual government/retirement evidence are **post-launch** verification. Defer those live checks without redefining them as code blockers.

**Status:** current *proved local subscopes PASS*; remaining shared-network/full-app software requirements OPEN; real V4 launch/ceremony NOT AUTHORIZED. Do not conflate these three milestones.

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

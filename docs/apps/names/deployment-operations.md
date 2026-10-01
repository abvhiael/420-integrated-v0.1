---
title: 420 Names deployment and operator runbook
audience:
  - operator
  - developer
category: operations
status: pre-genesis
version: current
---

# 420 Names deployment and operator runbook

This runbook is the Names-specific operational authority for **NAMES-AUDIT-8**. It covers deployment order, configuration, verification, recovery, monitoring, the threat model, and known limitations for the canonical `Names420` predeploy.

It does **not** claim a live testnet or production deployment. Production-equivalent chain verification belongs to NAMES-AUDIT-9.

## Canonical deployment identity

| Item | Frozen value |
| --- | --- |
| Contract | `Names420` |
| Protocol | `420Names` |
| Protocol version | `3` |
| Canonical address | `0x0000000000000000000000000000000000000435` |
| Governance timelock immutable | `0x0000000000000000000000000000000000000429` |
| Solidity | `0.8.24` |
| Optimizer | enabled, 200 runs |
| EVM target | Cancun |
| Runtime bytes | `4336` |
| Runtime code hash | `0xa974fffd3a40e7f28db41e4ae30656b33789d2483b18b47c809ce2385de709b7` |
| Genesis storage root | `0x56e81f171bcc55a6ff8345e692c0f86e5b48e01b996cadc001622fb5e363b421` |
| Source blob SHA-1 | `4cb9b06b4a3febb3bf024c087f3ade1eebdcf31d` |
| Artifact payload SHA-256 | `c40970d3a04503309f9467eaca00c915f5ce3dd1e993c2df3318aa6cd149ab2c` |
| Indexer descriptor SHA-256 | `74602adfdde367c82fcefcd35a89a5b0e415e92721289cca9e827be32299b3be` |

The historical `0x0000000000000000000000000000000000000445` Names proposal is retired and must never be used as an active deployment address.

Canonical repository inputs:

- `contracts/artifacts/Names420.json`
- `contracts/config/predeploy/Names420-predeploy-state.json`
- `contracts/config/predeploy/predeploy-plan.json`
- `contracts/config/deployment-manifest.json`
- `420-indexer/descriptors/names420-v3.json`

## Deployment order

Names420 is a Genesis predeploy. Do not deploy it as an unrelated post-launch contract and then point clients at it.

1. **Freeze the chain candidate.** Establish the intended chain ID/genesis identity and exact repository release SHA. Do not generate client configuration from a reservation or local fixture.
2. **Materialize GovernanceTimelock first.** Address `0x0429` is the constructor-bound immutable authority identity inherited through `SystemAccess`. The Names runtime must embed that exact address.
3. **Regenerate and verify the Names compiler artifact.** Run the NAMES-AUDIT-5 generator/checks from the candidate release tree. Compiler settings, source identity, ABI, storage layout, and immutable references must match the frozen artifact.
4. **Regenerate and verify deterministic Names Genesis state.** Run the NAMES-AUDIT-6 generator/checks. Genesis alloc code must be the materialized deployed runtime, not creation bytecode.
5. **Install Names420 at `0x0435`.** Use the exact runtime and empty constructor-derived storage from `Names420-predeploy-state.json`.
6. **Verify the chain before enabling consumers.** Confirm chain identity, code, contract identity/version, immutable governance binding, and Genesis state as described below.
7. **Enable 420Indexer only with the frozen Names descriptor.** `names420-v3.json` must reproduce from the frozen artifact and remain subordinate to chain state.
8. **Enable Search after Indexer readiness/catch-up.** Search is a derived consumer and must remain degraded while Indexer is stale, rebuilding, or on an unverifiable branch.
9. **Publish Wallet configuration last.** Only a chain-specific deployment manifest that has passed live verification may set `deployment.namesAddress` for production-equivalent Wallet use.

`ProtocolRegistry` is **not** a direct Names420 runtime dependency. A `serviceId` stored in a Names record is only a reference; consumers that care about service legitimacy must independently validate Registry state.

## Configuration

### Contract and Genesis configuration

Required:

- canonical address `0x0435`;
- immutable governance timelock `0x0429`;
- exact materialized runtime hash listed above;
- no mutable constructor storage entries;
- mapping roots `records=0`, `commitments=1`, `primaryNameByAddress=2`;
- canonical empty storage-trie root at Genesis.

Never:

- substitute creation bytecode for deployed runtime;
- patch the governance immutable at an unreported byte offset;
- seed name records, commitments, or reverse records unless a separately accepted Genesis specification explicitly changes the frozen state;
- change `0x0435` to the retired `0x0445` address;
- infer a Names address from UI configuration or an Indexer/Search response.

### Client configuration

Wallet/SDK consumers must verify, at minimum:

- expected chain ID before and after relevant RPC reads;
- deployed code exists at the configured Names address;
- `systemName() == "Names420"`;
- `protocolVersion() == 3`;
- resolver response shape is the canonical seven-field record;
- record expiry is evaluated against trusted chain time.

A Wallet or application must fail closed if its deployment binding is absent or unqualified.

### Indexer/Search configuration

420Indexer must use the frozen descriptor at `420-indexer/descriptors/names420-v3.json`, containing exactly seven canonical events. Descriptor address/source/artifact/runtime/digest drift is a release blocker.

Names event history used for public-state reconstruction must be replayed in ascending `block_number, tx_index, log_index` order. Search rejects unordered or incomplete bounded history rather than fabricating a state.

## Deployment verification

A candidate is not Names-qualified merely because source code compiles or because `0x0435` is reserved.

### Offline release-tree verification

Before producing a chain image:

1. run `python scripts/generate-names-audit-5-artifact.py --check`;
2. run `python scripts/test-names-audit-5-artifact.py`;
3. run `python scripts/generate-names-audit-6-genesis-state.py --check`;
4. run `python scripts/test-names-audit-6-genesis-state.py`;
5. from `420-indexer/`, run `node scripts/generate-names420-descriptor.mjs --check`;
6. run the retained Names contract, Wallet, Indexer/Search and static qualification required by the current audit phase.

Any regenerated artifact/descriptor diff is a failure until understood and explicitly reconciled.

### Live-chain verification

NAMES-AUDIT-9 must independently verify the production-equivalent testnet. At minimum:

1. verify the expected chain ID and Genesis/network identity using qualified RPC endpoints;
2. read code at `0x0435` and require the frozen runtime code hash;
3. call `systemName()` and require `Names420`;
4. call `protocolVersion()` and require `3`;
5. verify the inherited `governanceTimelock()` reads `0x0429`;
6. verify the expected initial storage/predeploy state before user traffic;
7. prove the Wallet resolves through the verified chain-specific deployment;
8. prove Indexer events/state are derived from the verified `0x0435` deployment and exact frozen descriptor;
9. prove Search reconstruction agrees with canonical events/state;
10. exercise commit/register, renew, resolution, reverse resolution, transfer nomination/acceptance and expiry behavior.

Use more than one trusted observation path when release policy requires independent chain verification. Do not mark Wallet/Indexer/Search configuration production-qualified from offline manifests alone.

## Monitoring

Names420 has no token custody, operator-controlled balance, oracle, bridge, or background worker. Monitoring is therefore focused on deployment identity, lifecycle correctness, transaction failure patterns, and derived-service consistency.

### Canonical contract monitors

Alert on:

- no code at `0x0435`;
- runtime hash different from the frozen hash;
- `systemName()` or `protocolVersion()` mismatch;
- governance timelock binding different from `0x0429`;
- RPC providers disagreeing about chain ID, canonical block/hash, code, or Names reads;
- unexpected inability to read active records through the canonical ABI.

### Lifecycle/event monitors

Observe the seven frozen event families and flag anomalous operational patterns, including:

- sustained commitment activity without corresponding registrations after the valid reveal window;
- unusual spikes in rejected/failed registration, renewal, transfer, or resolution transactions;
- transfer acceptance followed by a derived view retaining the old profile/service association;
- reverse-name presentation that disagrees with current forward resolution;
- apparent active names whose canonical lease has expired.

These are operational signals, not authority to mutate user records.

### Derived-service monitors

Track:

- Indexer health/readiness and ingestion/finality lag;
- descriptor/version mismatch;
- reorg rollback/replay status;
- Indexer disagreement with canonical finalized Names state;
- Search errors caused by incomplete or unordered history;
- Wallet deployment-binding/version failures.

If Indexer/Search disagree with canonical chain state, mark derived services degraded and repair/rebuild them. Never alter canonical Names state merely to make a projection match.

## Recovery

### Wrong code, address, immutable, or Genesis state before launch

**Stop the candidate release.** Do not patch around an invalid Names predeploy in Wallet, Indexer, Search, or documentation.

Regenerate from the frozen source/compiler inputs, rebuild the Genesis candidate, re-run qualification, and issue a new chain candidate. A candidate with the wrong runtime, wrong `0x0435` address, wrong `0x0429` immutable, or wrong initial state is not the accepted Names Genesis.

### Canonical chain disagreement after launch

First establish chain truth and finality. If RPC providers disagree, do not use Indexer/Search as a tie-breaker. Quarantine untrusted endpoints and keep state-changing UX degraded until the canonical chain is established.

Names420 itself exposes no operator/admin name-mutation, pause, migration, arbitrary-call, or upgrade function. Operators cannot legitimately rewrite ownership, resolution, expiry, commitments, or transfers as a recovery shortcut.

A consensus/canonical-contract failure is a chain incident and must follow the chain/governance recovery process; it is not repairable by editing a Names projection.

### Indexer reorg or corruption

1. keep Indexer/Search-derived Names reads degraded;
2. identify the trusted canonical rollback point and finality horizon;
3. retract/roll back non-canonical projections;
4. replay canonical Names events using the frozen descriptor;
5. confirm ascending event order and rebuilt state;
6. compare representative rebuilt objects with canonical Names reads;
7. restore Search only after Indexer readiness/catch-up succeeds.

Do not repeat user writes merely because an Indexer/Explorer/Search record disappeared during recovery.

### Search corruption or stale state

Rebuild Search from qualified Indexer protocol history. Search must reject incomplete or unordered history. If Search and Indexer disagree, compare both against canonical chain state and repair the derived layer.

### Wallet configuration error

Remove the bad environment/deployment binding from service immediately. Do not redirect `.420` resolution to a guessed address. Re-enable only after chain ID, `0x0435`, code hash, identity/version and deployment manifest are verified.

### User-level transaction incidents

Operators do not have a privileged reversal mechanism.

- expired commitment: user creates a fresh commitment;
- active lease conflict: wait for expiry or use another name;
- failed preflight: correct owner/pending-owner/resolution/duration/network state before retrying;
- submitted transaction with unknown status: determine canonical receipt before any retry;
- mistaken transfer: only the canonical owner/pending-owner flow can change ownership; operators cannot seize or rewrite it.

## Threat model

### Canonical authority

Names420 is authoritative only for:

- name ownership;
- pending transfer ownership;
- lease expiry;
- forward resolution;
- reverse-name selection while forward resolution still agrees;
- optional Identity profile and Registry service references.

It is **not** authority for legal identity, universal reputation, service legitimacy, Wallet/custody permission, or ownership of the address stored as a resolution target.

### Primary threats and controls

| Threat | Control / operational expectation |
| --- | --- |
| Copied commitment/front-running | commitment includes committer and is one-use |
| Early/late reveal | 60-second minimum and 24-hour maximum commitment age |
| Active-name overwrite | active lease blocks registration |
| Unauthorized renewal/resolution/transfer | owner checks; acceptance requires pending owner |
| Stale transfer associations | acceptance resets resolution to new owner and clears profile/service |
| Stale reverse presentation | reverse read revalidates lease and forward-target agreement |
| Resolver ABI confusion | canonical seven-field record; consumers use `resolvedAddress`, never assume `owner` is destination |
| Wrong-chain/wrong-contract client | chain/code/system-name/version checks fail closed |
| Forged/stale Indexer descriptor | frozen artifact-derived seven-event descriptor and pinned digest |
| Reorg-derived stale Search state | canonical rollback/replay; ascending history; incomplete/unordered history rejected |
| Unicode/lookalike presentation | canonical Wallet management accepts lowercase ASCII presentation labels; contract stores hash+length |
| Registry/Identity over-trust | references are optional; consumers independently validate bilateral/Registry claims |
| Operator overreach | no admin name-mutation/pause/upgrade path exists in Names420 |

### Incident rule

When canonical chain state and a derived surface disagree, canonical chain state wins. When canonical chain identity itself cannot be established, fail closed rather than choosing the most convenient RPC, cache, Wallet view, Indexer result, or Search result.

## Known limitations

1. **No live deployment evidence yet.** The frozen artifact, predeploy state and descriptor are offline deterministic evidence. NAMES-AUDIT-9 owns production-equivalent live verification.
2. **No operator repair key.** Names420 intentionally provides no privileged method to edit user ownership/resolution/expiry after deployment.
3. **Lease expiry is protocol state.** Expired names stop resolving authoritatively and may later be registered again.
4. **Commitments are time-bounded, not permanent reservations.** Reveal must occur inside the 60-second to 24-hour window.
5. **Names are presentation identifiers, not identity proof.** Identity and Registry references need independent validation.
6. **Derived services can lag or rebuild.** Indexer/Search availability does not change canonical Names state.
7. **Plaintext labels are not recoverable from on-chain event history by Search.** Search operates on canonical label hashes; presentation labels belong at appropriate client/application boundaries.
8. **On-chain label storage is hash plus length.** Lowercase-ASCII presentation canonicalization is enforced by qualified clients, not by storing plaintext in Names420.
9. **Reverse records can become stale in storage but not authoritative in reads.** `reverseResolve` returns zero unless the lease remains active and forward resolution still agrees.
10. **Optional `profileId`/`serviceId` fields are references only.** Their presence does not establish trust, legitimacy, credential validity, or execution permission.

## Operator release checklist

Before enabling Names to users, record evidence for every item:

- [ ] exact release SHA identified;
- [ ] chain/genesis identity approved;
- [ ] GovernanceTimelock at `0x0429` qualified;
- [ ] Names compiler artifact reproduces;
- [ ] deterministic Names predeploy state reproduces;
- [ ] `0x0435` contains the expected runtime;
- [ ] runtime hash matches the frozen hash;
- [ ] `systemName()`, `protocolVersion()`, and governance binding match;
- [ ] initial state matches the approved predeploy;
- [ ] seven-event Indexer descriptor reproduces with the pinned digest;
- [ ] Indexer is ready/caught up and reorg behavior is qualified;
- [ ] Search reconstruction agrees with canonical history;
- [ ] Wallet uses the verified chain-specific deployment binding;
- [ ] full production-equivalent user workflow smoke passes;
- [ ] monitoring/alerts are active;
- [ ] rollback/escalation owner and incident channel are assigned;
- [ ] no live-readiness claim is made from offline evidence alone.

## Related material

- [420 Names architecture](architecture.md)
- [420 Names security](security.md)
- [420 Names troubleshooting](troubleshooting.md)
- [420 Names developer integration](developer/index.md)
- [Genesis architecture](../../architecture/genesis-architecture.md)
- [Registry / Names / Identity architecture](../../architecture/protocols/registry-names-identity-420is.md)
- [Indexer/Search troubleshooting](../../troubleshooting/indexer-explorer-search-analytics-status.md)
- `docs/audit/420NAMES-AUDIT-6-GENESIS-STATE-QUALIFICATION.md`
- `docs/audit/420NAMES-AUDIT-7-INDEXER-SEARCH-QUALIFICATION.md`

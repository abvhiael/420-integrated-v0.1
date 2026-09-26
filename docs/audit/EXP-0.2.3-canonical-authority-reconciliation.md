# EXP-0.2.3 — canonical data and authority requirements

**Status:** authority matrix committed; exact-head CI qualification required before closeout.  
**Predecessors:** EXP-0.2.1 capability scope and EXP-0.2.2 user-workflow acceptance matrix.  
**Machine-readable register:** `docs/audit/EXP-0.2.3-canonical-authority-matrix.json`.

## Objective

Freeze the source-of-truth and conflict-resolution rules that every later Explorer milestone must obey.

EXP-0.2.3 does **not** create new protocol authority. It records which component is authoritative for each domain and what Explorer/420Indexer are allowed to do with that data.

The governing rule is simple: **Explorer and 420Indexer are derived read infrastructure. They may project, decode, cache, aggregate and present authoritative data, but they cannot outrank the canonical chain, consensus, frozen Genesis address authority, or the owning protocol contract.**

## Authority domains

The matrix defines thirteen domains:

1. chain inclusion and execution truth;
2. head/safe/finalized status;
3. fixed Genesis system addresses;
4. Registry-resolved application implementations;
5. Indexer database and checkpoints;
6. contract runtime identity and decoding;
7. Names and Identity labels;
8. transaction settlement and payment meaning;
9. staking, validator and reward authority;
10. governance authority;
11. wallet, custody and execution authority;
12. privacy-sensitive off-chain data;
13. service health and wrong-network/staleness detection.

Each entry identifies:
- the canonical authority;
- Explorer's allowed role;
- Indexer's allowed role;
- concrete requirements;
- conflict-resolution behaviour;
- repository evidence.

## Frozen authority order

### Canonical chain and consensus

Canonical execution/consensus state determines transaction inclusion, block identity, receipt status, log provenance and finality.

Explorer must preserve chain ID and block hash provenance. It must not infer success from a transaction hash alone. Receipt status and canonical block membership are required.

Head, safe and finalized are separate states. The Explorer service already fails closed when finality ordering is inconsistent.

### Fixed Genesis system addresses

`config/system-addresses.json` and `contracts/config/system-addresses.json` are the frozen authority for fixed Genesis predeploy assignments. Explorer has no reserved address of its own.

Candidate addresses or Registry-published application addresses must never replace fixed system-predeploy identity.

### Registry-resolved applications

For Registry-resolved application implementations, canonical `ProtocolRegistry` state is authoritative. Explorer and Indexer may expose the service/version history, but cached data, documentation and candidate addresses do not become active merely by being displayed.

### Indexer storage

420Indexer storage, checkpoints and derived models are non-canonical and rebuildable. Explorer remains a consumer. It may not add a parallel RPC ingestion loop, checkpoint store, reorg engine or decoder registry.

### Runtime bytecode, ABI and verification metadata

Deployed runtime bytecode and canonical deployment provenance define execution truth. Registry commitments add version/protocol provenance.

Verified-source metadata, labels, decoded event/function names and UI descriptions remain presentation metadata. They cannot override runtime code or canonical provenance.

### Names and Identity

420 Names and 420 Identity are optional display enrichments. Their labels may make an address easier to recognize but cannot replace the address, transaction provenance or owning protocol's canonical record.

### Payments and settlement

Explorer may confirm generic on-chain facts such as sender, recipient, value, token transfer, receipt status and finality. It must not infer that those facts satisfy an invoice, escrow, marketplace, payroll or application settlement rule unless the owning protocol's canonical state establishes that meaning.

### Validators, staking and rewards

Explorer gains no validator or staking authority. Consensus and the owning Stake420/validator protocol remain authoritative. The absence of a staking/reward Explorer view remains a documented workflow gap rather than a reason to infer reward state from generic transfers.

### Governance

Explorer gains no governance execution authority. Governance420/timelock state is authoritative. The separate EXP-0.2.1 question about whether a governance **view** is Genesis-required remains unresolved; this milestone freezes authority regardless of how that display-scope decision is resolved.

### Wallet/custody/execution

Explorer cannot sign, hold custody, grant permissions or execute protocol actions. Explorer failure must not block direct wallet, RPC, contract or protocol interaction.

### Privacy-sensitive data

A public chain hash, commitment or transaction reference does not turn an off-chain private payload into canonical public Explorer content. Explorer may show the public commitment without claiming possession or verification of hidden data.

### Health and wrong-network handling

The Explorer profile requires chain ID 420. Wrong-chain, stale, degraded or internally inconsistent Indexer state must not be presented as qualified canonical truth. The correct response is fail-closed/not-ready presentation with visible chain/finality/freshness information.

## Automated qualification gate

`scripts/verify-exp-0-2-3-canonical-authority.py` must fail closed unless:

1. all thirteen authority domains are present exactly once;
2. every entry has canonical authority, Explorer role, Indexer role, requirements, conflict resolution and repository evidence;
3. every evidence path exists;
4. the Explorer Genesis profile still says `canonicalStateAuthority: false`;
5. the profile still disables independent ingestion, checkpoint, reorg and decoder ownership;
6. the two frozen system-address maps are byte-equivalent JSON structures and contain no Explorer address assignment;
7. ProtocolRegistry remains fixed at `0x0000000000000000000000000000000000000434`;
8. required chain ID remains 420;
9. database non-canonical/rebuildable rules remain enabled;
10. every source invariant EXP-INV-001 through EXP-INV-013 remains represented by the authority matrix/global rules;
11. Names/Identity remain display-only;
12. verified-source metadata cannot override runtime bytecode;
13. payment, governance, staking, wallet and privacy domains do not grant Explorer authority.

The verifier writes `exp-0-2-3-evidence/summary.json` and `authorities.tsv`, which CI uploads.

## Completion condition

EXP-0.2.3 is qualified when its fail-closed verifier and the existing Explorer/Indexer/repository qualification suites pass on the same exact PR head, with the evidence artifact uploaded.

Qualification means the authority model and conflict-resolution rules are frozen and reproducible. It does not prove the later live/runtime data paths are correct.

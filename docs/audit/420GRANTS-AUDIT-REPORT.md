# 420Grants audit report

## Scope and classification

420Grants is a **Genesis implementation protocol**, not a separately frozen standalone public application.

Canonical responsibility:

- governed Program/Application/Award/Milestone workflow state.

Explicit non-authority:

- no Treasury custody;
- no direct asset transfer;
- no Civic/governance bypass;
- no standalone signing authority;
- no authoritative Indexer/UI state.

Canonical upstream authorities:

- Civic / GovernanceTimelock;
- 420Treasury;
- 420Vault;
- CapabilityRegistry420;
- ProtocolRegistry for service discovery.

## Repository audit status

| Step | Status | Repository result |
| --- | --- | --- |
| GRANTS-AUDIT-1 | COMPLETE | canonical definition/inventory/authority graph qualified |
| GRANTS-AUDIT-2 | COMPLETE | lifecycle/accounting remediation qualified |
| GRANTS-AUDIT-3 | COMPLETE | adversarial/replay/invariant qualification passed |
| GRANTS-AUDIT-4 | COMPLETE | Civic/Treasury/Vault/capability boundary reconciled |
| GRANTS-AUDIT-5 | COMPLETE | Registry/address/deployment materialization qualified |
| GRANTS-AUDIT-6 | COMPLETE | client/indexer/Wallet integration qualified |
| GRANTS-AUDIT-7 | COMPLETE | documentation/threat model/operator closeout qualified on exact head |
| GRANTS-AUDIT-8 | IN PROGRESS | Level 3 accumulated merge-candidate reconciliation/qualification |
| GRANTS-AUDIT-9 | BLOCKED | production-equivalent testnet required |
| GRANTS-AUDIT-10 | BLOCKED | depends on AUDIT-9 and whole-system Genesis gates |

## Canonical implementation inventory

- `GrantIds420.sol`
- `GrantAuthorization420.sol`
- `GrantProgramRegistry420.sol`
- `GrantApplicationRegistry420.sol`
- `GrantAwardRegistry420.sol`
- `GrantMilestoneRegistry420.sol`
- `GrantRouter420.sol`

Six deployable contracts plus the IDs library form the canonical seven-file Grants suite.

## Key remediations

Repository-side remediation has established:

- ProgramRegistry as single aggregate Program-award accounting authority;
- exactly one bound AwardRegistry as cap reservation controller;
- inactive Program Award rejection;
- immutable Application identity and nonce replay resistance;
- cumulative Application award limits;
- Award/Milestone cap and ordinal safety;
- ACTIVE parent Award requirement for milestone approval;
- one-to-one Treasury disbursement/Milestone binding;
- exact Treasury budget/recipient/amount/Civic/purpose matching;
- no detachment from still-executable or executed Treasury payment;
- PAID only after Treasury EXECUTED + nonzero Vault release commitment;
- default-deny, object/action-scoped delegated submission;
- no Grants custody/transfer path;
- registry-resolved no-fixed-address deployment model;
- artifact/runtime/release materialization;
- non-authoritative Grants Indexer views;
- SmartAccount420-preserving Wallet transaction handoff.

## Address/deployment state

Grants Router remains:

`REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS`

Frozen shared identities used by the release model:

- GovernanceTimelock `0x0000000000000000000000000000000000000429`;
- ProtocolRegistry `0x0000000000000000000000000000000000000434`.

CapabilityRegistry420 candidate reservation:

`0x0000000000000000000000000000000000000447`

Status:

`CANDIDATE_NOT_DEPLOYED_NOT_FROZEN`

No CREATE2 production-address policy has been adopted for Grants.

## Client/indexer state

Wallet catalogue identity:

`420/service/grants/v1`

Qualified non-authoritative Indexer object views:

- Program;
- Application;
- Award;
- Milestone.

Wallet transaction preparation preserves SmartAccount420 authority. No standalone Grants signer or custody path exists.

## Threat model summary

Primary threat classes:

- governance bypass;
- capability overreach;
- replay/substitution;
- cap/accounting bypass;
- parent-state bypass;
- Treasury substitution or duplicate funding;
- detachment from executable/executed payments;
- false PAID evidence;
- custody expansion;
- Registry substitution;
- derived-state authority confusion;
- reorg/RPC inconsistency.

Canonical threat model:

`docs/apps/grants/threat-model.md`

Operator runbook:

`docs/apps/grants/operator-guide.md`

## Known trust limitation

Treasury V1 release evidence is commitment-only. Grants requires `EXECUTED + nonzero vaultReleaseHash` but does not independently prove that the commitment corresponds to an actual Vault transfer.

Production-equivalent qualification must correlate that commitment with canonical Vault transaction/event/receipt evidence.

## Qualification ownership

Ordinary steps use targeted Grants Level 1 qualification.

GRANTS-AUDIT-6 also completed the focused Level 2 Grants/Indexer/Wallet integration milestone.

GRANTS-AUDIT-8 owns the single Level 3 accumulated merge-candidate closeout:

- reconcile with then-current `main`;
- exact merge-candidate SHA;
- canonical full Solidity inventory once;
- separate Genesis/address-authority qualification;
- retained Grants and affected client/service qualification;
- Docs/global reconciliation;
- security/static/deployment/config qualification;
- roadmap/evidence reconciliation.

## Explicit live/testnet blockers

GRANTS-AUDIT-9 requires official production-equivalent testnet evidence for:

- chain/genesis identity;
- deployed Grants addresses/runtime hashes;
- constructor/immutable bindings;
- one-time Award Registry controller binding;
- live ProtocolRegistry publication/discovery;
- live CapabilityRegistry delegation;
- complete program-to-PAID Treasury/Vault flow;
- duplicate Treasury-disbursement rejection in deployed state;
- client/indexer reconstruction from live history;
- restart/reorg/RPC-disagreement behavior.

Local Anvil, mocks and repository CI cannot close those requirements.

## Production readiness boundary

No repository qualification state is represented as TESTNET, GENESIS or PRODUCTION readiness.

GRANTS-AUDIT-10 must separately report:

- CODE;
- BUILD;
- CONTRACT;
- TEST;
- DOCUMENTATION;
- INTEGRATION;
- SECURITY;
- TESTNET;
- GENESIS;
- PRODUCTION.

No readiness state is inferred from another.

## Canonical evidence

Qualification evidence is retained in:

- `docs/audit/420GRANTS-AUDIT-1-QUALIFICATION.md`;
- `docs/audit/420GRANTS-AUDIT-2-QUALIFICATION.md`;
- `docs/audit/420GRANTS-AUDIT-3-QUALIFICATION.md`;
- `docs/audit/420GRANTS-AUDIT-4-QUALIFICATION.md`;
- `docs/audit/420GRANTS-AUDIT-5-QUALIFICATION.md`;
- `docs/audit/420GRANTS-AUDIT-6-QUALIFICATION.md`;
- `docs/audit/420GRANTS-AUDIT-7-QUALIFICATION.md`;
- `docs/audit/420GRANTS-AUDIT-REMEDIATION-ROADMAP.md`.

GRANTS-AUDIT-7 exact-head implementation qualification: `14c6732aa1d30bed5e5e5459ee930bafc9c54426`, 420Grants Audit Qualification run `37086042799` / #68 SUCCESS, affected Solidity Contracts run `37086042862` / #4399 SUCCESS. GRANTS-AUDIT-8 remains the accumulated Level 3 merge-candidate closeout.

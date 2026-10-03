---
title: 420Grants Operator Guide
audience:
  - operator
  - developer
  - security
category: how-to
status: current
version: current
---

# 420Grants operator guide

420Grants is the governed grant workflow layer for programs, applications, awards and milestones. It does **not** custody or transfer Treasury assets. Governance authority remains with Civic/GovernanceTimelock, budget/disbursement authority remains with 420Treasury, custody/release remains with 420Vault, and delegated submit/claim authority is bounded through CapabilityRegistry420.

This runbook covers repository-qualified deployment, configuration, roles, monitoring, incident response, recovery boundaries, client/indexer behavior, known limitations and exact qualification commands. It does not claim production-equivalent testnet deployment; live evidence is owned by GRANTS-AUDIT-9.

## Canonical components

- `GrantAuthorization420` — resolves program/award-scoped capability authority.
- `GrantProgramRegistry420` — governed program definition and aggregate awarded accounting.
- `GrantApplicationRegistry420` — immutable program applications and nonce consumption.
- `GrantAwardRegistry420` — governed awards, application-level award totals and program-cap reservation.
- `GrantMilestoneRegistry420` — milestone lifecycle and exact Treasury disbursement binding.
- `GrantRouter420` — read-only convenience surface.
- `420Treasury` — canonical budget/disbursement authority.
- `420Vault` — canonical custody/release authority.
- `ProtocolRegistry` — Grants service/component discovery.

`GrantRouter420` remains `REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS`. No standalone Grants website is required by the canonical Genesis classification.

## Deployment and configuration authority

Canonical deployment materialization is defined by:

- `contracts/config/420grants-genesis.json`;
- `contracts/config/grants/grants-audit-5-release-materialization.json`;
- `contracts/config/genesis-address-namespace.json`.

Frozen shared identities:

- GovernanceTimelock: `0x0000000000000000000000000000000000000429`;
- ProtocolRegistry: `0x0000000000000000000000000000000000000434`.

CapabilityRegistry420 currently has candidate reservation `0x0000000000000000000000000000000000000447` with status `CANDIDATE_NOT_DEPLOYED_NOT_FROZEN`. Operators must not describe that reservation as a live deployed/frozen identity until its owning deployment step produces evidence.

### Required deployment sequence

1. deploy `GrantAuthorization420(CapabilityRegistry420)`;
2. deploy `GrantProgramRegistry420(GovernanceTimelock)`;
3. deploy `GrantApplicationRegistry420(GrantAuthorization420, GrantProgramRegistry420)`;
4. deploy `GrantAwardRegistry420(GovernanceTimelock, GrantProgramRegistry420, GrantApplicationRegistry420)`;
5. call `GrantProgramRegistry420.bindAwardRegistry(GrantAwardRegistry420)` exactly once;
6. deploy `GrantMilestoneRegistry420(GovernanceTimelock, GrantAuthorization420, GrantProgramRegistry420, GrantAwardRegistry420, TreasuryDisbursementRegistry420)`;
7. deploy `GrantRouter420(GrantProgramRegistry420, GrantAwardRegistry420, GrantMilestoneRegistry420)`;
8. publish `420/service/grants/v1` through `ProtocolRegistry.publishRegisteredService` with the exact Router implementation and nonzero manifest/interface/dependency commitments.

There is no adopted CREATE2 policy for the Grants family. Do not invent salts or production implementation addresses.

## Roles and permissions

| Authority | May do | Must not be treated as |
| --- | --- | --- |
| GovernanceTimelock / Civic-governed execution | create/activate programs; create/cancel/complete awards; create/approve/cancel milestones; perform one-time Award Registry binding | asset custodian; capability bypass; arbitrary payment executor |
| GrantAwardRegistry420 | reserve program award cap through the one-time ProgramRegistry controller binding | general governance authority |
| Applicant | submit its own application | award approver; Treasury executor |
| Award recipient | submit its own milestone claim | milestone approver; Treasury/Vault authority |
| Scoped CapabilityRegistry principal | submit application or milestone only for the exact Grants component/action/object scope | general Grants administrator |
| TreasuryDisbursementRegistry420 | own budget/disbursement state consumed by milestone approval/finalization | Grants workflow authority |
| 420Vault | custody/release governed assets | grant-selection or program authority |
| ProtocolRegistry governance | publish/discover the qualified Grants service/component graph | Grants lifecycle or payment authority |
| Indexer/Wallet/Explorer clients | reconstruct/display derived state and prepare transactions | canonical Grants state or signing authority |

Delegated access remains default-deny. A valid capability never bypasses program windows/caps, application identity, award state, milestone state, Treasury state/matching, or GovernanceTimelock-only mutations.

## Normal operating procedure

### Pre-operation identity checks

Before any governed Grants operation verify:

1. chain/network identity is the intended network;
2. GovernanceTimelock and ProtocolRegistry match canonical network manifests;
3. Registry resolves `420/service/grants/v1` to the expected `GrantRouter420`;
4. runtime code hashes match the qualified release candidate;
5. Router dependencies match the intended Program/Award/Milestone registries;
6. ProgramRegistry `awardRegistry` equals exactly the intended GrantAwardRegistry420;
7. MilestoneRegistry Treasury dependency equals the canonical TreasuryDisbursementRegistry420;
8. CapabilityRegistry identity/status matches the active network manifest.

Do not proceed when any dependency, runtime identity or Registry binding is ambiguous.

### Program creation

Before `createProgram` verify:

- nonzero program ID/type/Treasury budget/Civic action/metadata commitments;
- valid application window;
- nonzero total cap and max award;
- max award does not exceed total cap;
- Treasury budget and Civic commitment are the intended governed funding authority;
- program ID is unused.

### Application submission

Before `submit` verify:

- application ID equals the canonical ID for program/applicant/nonce/content;
- program is active;
- current time is within the application window;
- requested amount is nonzero and does not exceed max award;
- nonce has not been consumed for that program/applicant;
- caller is applicant or has exact scoped application-submit capability.

Applications are immutable after submission.

### Award creation

Before `createAward` verify:

- parent application exists;
- recipient exactly equals the application applicant;
- amount is nonzero and within application requested amount;
- cumulative awards for the application remain within requested amount;
- parent program is still active;
- amount satisfies per-award and remaining program cap;
- the one-time Award Registry controller binding is correct.

### Milestone creation and claim

Before `createMilestone` verify:

- parent Award is ACTIVE;
- ordinal has never been used for that award;
- amount and purpose are nonzero;
- aggregate non-cancelled milestone face value will remain within award amount.

Before `submitClaim` verify:

- milestone is PENDING;
- claim hash is nonzero;
- parent Award remains ACTIVE;
- caller is recipient or has exact award-scoped milestone-submit capability.

### Milestone approval

Before `approve` verify:

- milestone is CLAIMED;
- parent Award remains ACTIVE;
- Treasury disbursement exists and is SCHEDULED;
- Treasury budget equals Program Treasury budget;
- recipient equals Award recipient;
- amount equals Milestone amount;
- Civic action hash equals Program commitment;
- purpose hash equals Milestone purpose;
- Treasury disbursement is not already bound to another milestone.

A capability grant cannot replace GovernanceTimelock approval.

### Finalize paid

Before `finalizePaid` verify:

- milestone is APPROVED;
- bound Treasury disbursement is EXECUTED;
- `vaultReleaseHash` is nonzero;
- operators have correlated that commitment to actual canonical Vault release evidence under the production release process.

`EXECUTED + nonzero vaultReleaseHash` is the Grants completion gate. It is not independent cryptographic proof that Vault transferred assets.

### Cancellation

Program deactivation stops new awards but does not rewrite historical awards.

Award cancellation is governance-only and does not claw back already paid assets.

Milestone cancellation:

- is governance-only;
- is prohibited after PAID;
- if APPROVED, requires the bound Treasury disbursement to be canonically CANCELLED first;
- must never detach Grants from a still-executable or already-executed Treasury payment.

## Monitoring and reconciliation

Monitor at minimum:

- `ProgramCreated`;
- `ProgramActiveChanged`;
- `ProgramAwardedChanged`;
- `AwardRegistryBound`;
- `ApplicationSubmitted`;
- `AwardCreated`;
- `AwardStateChanged`;
- `MilestoneCreated`;
- `MilestoneClaimed`;
- `MilestoneApproved`;
- `MilestonePaid`;
- `MilestoneCancelled`;
- relevant Treasury disbursement lifecycle events;
- relevant CapabilityRegistry grant/revocation events;
- ProtocolRegistry Grants publication/lifecycle events;
- corresponding Vault release evidence for paid milestones.

Operational invariants to reconcile:

- aggregate Program awarded <= total cap;
- every Award amount <= Program max award;
- cumulative awards per Application <= requested amount;
- aggregate non-cancelled Milestones per Award <= Award amount;
- one ordinal is used at most once per Award;
- one Treasury disbursement is bound to at most one Milestone;
- PAID implies bound Treasury state EXECUTED and nonzero `vaultReleaseHash`;
- cancelled approved milestone implies Treasury was CANCELLED before the Grants binding was released.

Indexer routes are useful monitoring surfaces but return non-authoritative derived state.

## Incident response

### Registry/runtime/dependency mismatch

Symptoms:

- Registry resolves an unexpected Grants Router;
- Router/runtime hash differs from qualified release evidence;
- Router dependencies differ from the approved deployment graph;
- Program Award Registry binding or Milestone Treasury binding is unexpected.

Action:

1. stop new Grants governance/operational actions;
2. preserve chain, Registry, runtime and dependency evidence;
3. determine whether the mismatch is chain-selection, deployment, configuration or publication error;
4. do not rewrite canonical state merely to make clients green;
5. use governed corrective deployment/publication procedures;
6. requalify affected deployment/configuration before resuming.

### Suspected capability compromise

Action:

1. identify the principal, Grants action and exact program/award scope;
2. revoke only the affected capability grants;
3. inspect submitted Applications/Claims attributable to the exposed scope;
4. do not broaden emergency replacement capabilities;
5. remember that governance/Treasury/cap/window/state checks still apply and must not be bypassed.

### Program or award accounting discrepancy

If derived totals disagree with canonical contract state:

1. stop using the derived projection for decisions;
2. inspect ProgramRegistry, ApplicationRegistry and AwardRegistry canonical reads/events;
3. verify the one-time Award Registry controller binding;
4. rebuild Indexer projections from canonical history;
5. do not mutate canonical contracts to match an Indexer/UI total.

### Suspicious milestone payment evidence

If a PAID milestone's Treasury evidence cannot be correlated to real Vault release evidence:

1. preserve Grants, Treasury, CapabilityRegistry and Vault records;
2. treat the downstream payment evidence as suspect;
3. do not claim Grants independently proved the asset transfer;
4. investigate the authorized Treasury executor/release pipeline;
5. suspend/revoke affected execution capability where appropriate;
6. do not cancel the paid milestone to hide the historical execution;
7. any recovery of released assets requires separately authorized Treasury/Civic action.

### Incorrect Treasury binding

If a claimed milestone cannot be matched to a valid scheduled Treasury disbursement, do not approve it. Correct the Treasury schedule through the owning Treasury/governance process; never weaken Grants matching rules.

### Indexer/Wallet disagreement

Derived clients are replaceable and non-authoritative.

1. compare client output to canonical Grants/Treasury reads and events;
2. verify chain/finality/provenance;
3. rebuild or refresh the affected client projection;
4. preserve SmartAccount420 as transaction authority;
5. do not mutate Grants state solely to match a client.

## Incident evidence preservation checklist

Retain before corrective action:

- chain ID, network/genesis identity and evidence block hash;
- all Grants contract addresses and runtime code hashes;
- GovernanceTimelock, ProtocolRegistry, CapabilityRegistry and Treasury dependency identities;
- ProtocolRegistry service/component records and publication transactions;
- Program/Application/Award/Milestone canonical records;
- relevant Grants event logs;
- relevant Civic/governance action IDs/receipts;
- CapabilityRegistry grant IDs/scopes/actions/revocations;
- Treasury disbursement record and lifecycle events;
- actual Vault transaction/event/receipt evidence where payment is involved;
- Indexer provenance and client observations;
- operator containment/recovery actions.

Do not discard evidence because a corrected deployment or projection is later produced.

## Recovery boundaries

There is no operator-only:

- Program cap rewrite;
- Application rewrite;
- consumed nonce reset;
- Award recipient/amount rewrite;
- used milestone ordinal reset;
- paid Milestone rollback;
- Treasury disbursement rebinding after canonical payment;
- Award Registry controller replacement after initialization;
- custody override;
- direct asset clawback.

If a deployment is wrong, deploy/qualify a corrected registry-resolved release and publish it through governed Registry procedures. If canonical chain state is correct, rebuild derived clients to it.

## Known limitations

### Treasury/Vault release evidence

420Grants consumes Treasury's V1 commitment-only release model. A milestone becomes PAID when the bound Treasury disbursement is EXECUTED and carries a nonzero `vaultReleaseHash`.

Grants does **not** cryptographically prove that the hash corresponds to a real Vault release. Production-equivalent qualification must correlate the commitment with actual Vault transaction/event/receipt evidence.

### Registry-resolved addresses

The Grants implementation family has no adopted CREATE2 production-address policy. Router and other live implementation addresses must come from actual deployment evidence and ProtocolRegistry publication.

### CapabilityRegistry live identity

Candidate reservation `0x0000000000000000000000000000000000000447` is not itself proof of deployed/frozen CapabilityRegistry identity.

### Derived clients

Indexer, Wallet and other clients are non-authoritative. The Indexer Grants routes reconstruct history; they do not define canonical grant state.

### Live deployment status

Repository/local-EVM qualification does not prove public-testnet deployment. Chain/genesis identity, deployed addresses/runtime hashes, constructor bindings, Registry publication, live capability behavior, full program-to-PAID flow and reorg/RPC behavior remain GRANTS-AUDIT-9 evidence.

## Read/API reference

Qualified non-authoritative Indexer routes:

- `GET /v1/grants/programs/:programId?chainId=<id>`
- `GET /v1/grants/applications/:applicationId?chainId=<id>`
- `GET /v1/grants/awards/:awardId?chainId=<id>`
- `GET /v1/grants/milestones/:milestoneId?chainId=<id>`

Canonical contract reads include:

- `GrantProgramRegistry420.program(programId)`;
- `GrantApplicationRegistry420.application(applicationId)`;
- `GrantAwardRegistry420.award(awardId)`;
- `GrantMilestoneRegistry420.milestone(milestoneId)`;
- `GrantRouter420.program(programId)`;
- `GrantRouter420.award(awardId)`;
- `GrantRouter420.milestone(milestoneId)`.

## Exact repository qualification commands

From repository root unless a working directory is shown:

```bash
python3 scripts/verify-grants-audit.py
python3 scripts/verify-grants-audit-5-release.py
python3 scripts/verify-grants-audit-6-client-indexer.py
python3 scripts/verify-grants-audit-7-docs.py

cd contracts
forge build src/grants
forge test --match-path test/GrantsDeploymentBinding420.t.sol -vvvv
forge test --match-path test/GrantsGenesis420.t.sol -vvv
cd ..

cd 420-indexer
npm install --no-audit --no-fund --no-package-lock
npm run build
node --test dist/test/grants420-integration.test.js
cd ..

cd wallet/web
node --test test/genesis-app-catalog.test.js test/apps.test.js test/grants-handoff.test.js
```

Static/security qualification remains owned by `.github/workflows/grants-audit.yml`, including the Grants forbidden-primitive scan and targeted Slither gate.

## Qualification evidence

Retained audit evidence:

- `docs/audit/420GRANTS-AUDIT-1-QUALIFICATION.md`;
- `docs/audit/420GRANTS-AUDIT-2-QUALIFICATION.md`;
- `docs/audit/420GRANTS-AUDIT-3-QUALIFICATION.md`;
- `docs/audit/420GRANTS-AUDIT-4-QUALIFICATION.md`;
- `docs/audit/420GRANTS-AUDIT-5-QUALIFICATION.md`;
- `docs/audit/420GRANTS-AUDIT-6-QUALIFICATION.md`.

Canonical audit report and roadmap:

- `docs/audit/420GRANTS-AUDIT-REPORT.md`;
- `docs/audit/420GRANTS-AUDIT-REMEDIATION-ROADMAP.md`.

GRANTS-AUDIT-8 is exact-head Level 3 repository/app-phase closeout. GRANTS-AUDIT-9 is production-equivalent testnet qualification. GRANTS-AUDIT-10 is Genesis candidate / production closeout.

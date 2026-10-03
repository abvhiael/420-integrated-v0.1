---
title: 420Treasury Operator Guide
audience:
  - operator
  - developer
  - security
category: how-to
status: current
version: current
---

# 420Treasury operator guide

420Treasury is the governed budget/disbursement control plane for public Treasury spending. It does **not** custody Treasury assets. Canonical custody/release remains in `420Vault VAULT_TREASURY`.

This runbook covers repository-qualified deployment/configuration, roles and permissions, operational checks, incident handling, recovery boundaries, known limitations, and exact qualification commands. It does not claim live public-testnet deployment; live chain evidence is owned by TREASURY-AUDIT-8.

## Canonical components

- `TreasuryAuthorization420` — reads scoped execution authority from `CapabilityRegistry420`.
- `TreasuryPolicyRegistry420` — governance-controlled asset allow/cap/epoch policy.
- `TreasuryBudgetRegistry420` — governance-created budget records and reserve/settle/release accounting.
- `TreasuryDisbursementRegistry420` — governance scheduling/cancellation and capability-scoped execution.
- `TreasuryRouter420` — read-only convenience surface for remaining budget and executability.
- `420Vault VAULT_TREASURY` — separate canonical custody/release authority.

TreasuryRouter420 remains `REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS`. A standalone Treasury website is not required by the canonical application classification.

## Deployment and configuration authority

Canonical deployment materialization is defined by:

- `contracts/config/treasury/treasury-audit-6-release-materialization.json`;
- `contracts/config/genesis-address-namespace.json`;
- `contracts/config/420treasury-genesis.json`.

Frozen shared identities:

- GovernanceTimelock: `0x0000000000000000000000000000000000000429`;
- ProtocolRegistry: `0x0000000000000000000000000000000000000434`.

CapabilityRegistry420 currently has candidate reservation `0x0000000000000000000000000000000000000447` with status `CANDIDATE_NOT_DEPLOYED_NOT_FROZEN`. Operators must not represent that candidate as a deployed/frozen live identity until the owning deployment step provides evidence.

### Required deployment sequence

1. deploy `TreasuryAuthorization420(CapabilityRegistry420)`;
2. deploy `TreasuryPolicyRegistry420(GovernanceTimelock)`;
3. deploy `TreasuryBudgetRegistry420(GovernanceTimelock, TreasuryPolicyRegistry420)`;
4. deploy `TreasuryDisbursementRegistry420(GovernanceTimelock, TreasuryAuthorization420, TreasuryPolicyRegistry420, TreasuryBudgetRegistry420)`;
5. call `TreasuryBudgetRegistry420.setController(TreasuryDisbursementRegistry420)` exactly once;
6. deploy `TreasuryRouter420(TreasuryBudgetRegistry420, TreasuryDisbursementRegistry420)`;
7. publish `420/service/treasury/v1` through `ProtocolRegistry.publishRegisteredService` with the exact TreasuryRouter implementation and nonzero manifest/interface/dependency commitments.

There is no adopted CREATE2 policy for this registry-resolved Treasury family. Do not invent production addresses or salts.

## Roles and permissions

| Role/authority | May do | Must not be treated as |
| --- | --- | --- |
| GovernanceTimelock / Civic-governed execution | set asset policy; create budgets; schedule/cancel disbursements; perform one-time controller initialization during deployment | asset custodian; arbitrary executor bypassing Treasury/Vault safety |
| TreasuryDisbursementRegistry420 | reserve/settle/release budget accounting through the one-time Budget controller binding | governance authority or asset custodian |
| Scoped CapabilityRegistry principal | execute only the exact authorized disbursement/action/scope/amount while all policy/time/budget checks pass | general Treasury administrator |
| CapabilityRegistry component authority | create/revoke bounded Treasury execution grants for the Treasury component | authority to bypass Civic/budget/policy/Vault rules |
| ProtocolRegistry governance | publish/discover the qualified TreasuryRouter identity | Treasury execution/custody authority |
| 420Indexer / Explorer / Analytics | reconstruct and display derived Treasury state | canonical Treasury state authority |
| 420Vault | custody/release governed Treasury assets | budget/governance authority |

Execution must remain default-deny. A valid capability does not bypass expiry, policy revocation, budget effectiveness, single-disbursement caps, or epoch caps.

## Normal operating procedure

### Before policy or budget operations

Verify:

1. connected chain/network identity is the intended network;
2. GovernanceTimelock and ProtocolRegistry identities match canonical network manifests;
3. Registry resolves the expected TreasuryRouter and runtime code hash;
4. Router dependencies resolve to the intended Budget and Disbursement registries;
5. Budget controller equals exactly the intended Disbursement registry;
6. Indexer/Explorer/Analytics are treated as derived read surfaces only.

Do not proceed when any identity or binding is ambiguous.

### Asset policy changes

Before `setAssetPolicy`:

- verify the asset address;
- verify `maxSingleDisbursement > 0`;
- verify `maxEpochDisbursement >= maxSingleDisbursement`;
- verify the already-initialized `epochSeconds` is not being changed.

`epochSeconds` is immutable after initial policy creation. A policy revision can change allow status and caps but cannot remap the accounting epoch geometry.

### Budget creation

Before `createBudget` verify:

- nonzero budget ID, vault ID, category, asset and Civic action hash;
- valid bounded `validFrom < validUntil`;
- nonzero ceiling;
- asset policy currently allows the asset;
- budget ID has not been used;
- the Civic action commitment is the intended governing action.

Treat `metadataHash` as auditable metadata commitment, not authorization.

### Disbursement scheduling

Before `schedule` verify:

- ID equals the contract's canonical ID for the exact fields;
- parent budget exists and is effective;
- exact Civic action hash matches the parent budget;
- `notBefore >= budget.validFrom`;
- `expiresAt <= budget.validUntil`;
- current policy allows the asset/amount;
- sufficient uncommitted budget remains.

Scheduling reserves budget commitment.

### Execution

Before execution verify:

- state is `SCHEDULED`;
- current time is inside `notBefore..expiresAt`;
- parent budget remains effective;
- current asset policy still allows the amount;
- epoch cap has sufficient remaining allowance;
- executor has the exact scoped capability;
- actual canonical Vault release evidence has been produced or is being produced according to the adopted release process;
- the submitted `vaultReleaseHash` is derived from that actual evidence and is nonzero.

Execution settles Treasury budget accounting and stores the release commitment.

### Cancellation

Only governance may cancel a still-scheduled disbursement. Cancellation releases unexecuted budget commitment and moves the disbursement to terminal `CANCELLED`. Do not attempt to revive a cancelled or executed ID.

## Monitoring and reconciliation

Monitor at minimum:

- `AssetPolicySet`;
- `ControllerSet`;
- `BudgetCreated`;
- `BudgetCommitmentChanged`;
- `DisbursementScheduled`;
- `DisbursementExecuted`;
- `DisbursementCancelled`;
- ProtocolRegistry Treasury service/component publication/lifecycle events;
- CapabilityRegistry Treasury grant/revocation events;
- corresponding canonical 420Vault release evidence.

For every budget, enforce operational reconciliation:

`executed <= committed <= ceiling`

For every executed disbursement, retain correlation among:

- disbursement ID;
- recipient/asset/amount;
- Civic action hash;
- purpose hash;
- executor;
- `vaultReleaseHash`;
- actual Vault transaction/event/receipt identity;
- block number/hash and chain ID.

The derived Indexer budget/disbursement routes are useful for monitoring but return `authoritative: false`.

## Incident response

### Identity or deployment mismatch

Symptoms:

- ProtocolRegistry resolves an unexpected TreasuryRouter;
- runtime code hash differs from the qualified release candidate;
- Router dependencies differ from the approved deployment graph;
- Budget controller is not the expected Disbursement registry.

Action:

1. stop new Treasury operations;
2. preserve chain/Registry/contract evidence;
3. do not overwrite Registry state merely to make monitoring green;
4. determine whether the mismatch is configuration, deployment, Registry publication, or chain-selection error;
5. require governed corrective action or redeployment according to the owning release process;
6. requalify affected deployment/configuration before resuming.

### Suspected capability compromise

Action:

1. stop scheduling new disbursements for the affected operational path where governance policy permits;
2. revoke the exact affected grants at CapabilityRegistry;
3. identify every scheduled disbursement whose executor scope may be exposed;
4. cancel still-scheduled disbursements through governance if appropriate;
5. reconcile `epochSpent`, budget committed/executed state and Vault evidence;
6. never broaden replacement grants as an emergency shortcut.

### Incorrect or suspicious Vault release commitment

If a stored `vaultReleaseHash` cannot be correlated to actual Vault release evidence:

1. treat the execution evidence as suspect;
2. preserve Treasury, CapabilityRegistry and Vault logs/receipts;
3. do not claim that Treasury cryptographically proved the transfer;
4. investigate the authorized executor and release pipeline;
5. suspend/revoke the affected execution capability where appropriate;
6. reconcile downstream consumers such as Grants before relying on the execution record.

There is no generic Treasury method to rewrite an executed disbursement or replace its release hash.

### Policy incident

For a compromised/unsafe asset policy:

- governance may revise `allowed`, max-single or max-epoch policy values;
- existing scheduled execution re-checks current policy and therefore fails closed when policy is revoked/reduced below the amount;
- do not attempt to change `epochSeconds`; the contract rejects that after initialization.

### Indexer/Explorer/Analytics inconsistency

Derived services are rebuildable and non-authoritative.

Action:

1. compare against canonical contract/event state;
2. stop relying on the stale derived projection;
3. rebuild/replay the affected Indexer projection from canonical chain history;
4. confirm chain/finality/provenance and state invariants;
5. restore Explorer/Analytics only after agreement is re-established.

Do not mutate canonical Treasury state to match a derived service.

## Incident evidence preservation checklist

For any Treasury incident, retain before making corrective changes:

- chain ID and network/genesis identity;
- evidence block number and block hash;
- TreasuryRouter, Budget, Disbursement, Policy and Authorization addresses;
- runtime code hashes for all affected Treasury contracts;
- ProtocolRegistry service/component records and publication transactions;
- relevant Civic/governance action IDs and transaction receipts;
- CapabilityRegistry grant IDs, scopes, limits, revisions and revocation transactions;
- budget/disbursement records and all corresponding Treasury event logs;
- actual 420Vault release transaction/event/receipt evidence when execution is involved;
- Indexer/Explorer/Analytics provenance showing what derived services observed;
- operator actions taken during containment and recovery.

Do not overwrite or discard evidence merely because a corrected deployment or projection is later produced.

## Recovery boundaries

Treasury recovery is governance/deployment reconciliation, not state rewriting.

There is no operator-only:

- budget rewrite;
- executed-disbursement rollback;
- release-hash replacement;
- controller replacement after initialization;
- epoch-duration reset;
- custody override.

If a deployment is wrong, deploy/qualify a corrected registry-resolved release and publish it through governed ProtocolRegistry procedures. If chain history is canonical, derived services must be rebuilt to it rather than the reverse.

## Known limitations

### Vault release evidence model

The adopted model is `420/TREASURY/VAULT_RELEASE_COMMITMENT/V1` in `AUTHORIZED_EXECUTOR_COMMITMENT_ONLY` mode.

Treasury verifies that:

- the executor is authorized for the exact disbursement/action/scope/amount;
- the submitted release commitment is nonzero.

Treasury does **not** cryptographically prove that the supplied nonzero hash corresponds to an actual 420Vault release. An authorized executor can submit an arbitrary nonzero value unless operational controls derive and verify the commitment from real Vault evidence.

Therefore:

- `EXECUTED + nonzero vaultReleaseHash` is Treasury completion evidence;
- it is not independent proof of asset transfer;
- production-equivalent qualification must correlate the commitment to actual Vault transaction/event/receipt evidence;
- this limitation must remain visible in operator/security documentation and downstream consumer semantics.

### Live deployment status

Repository/local-EVM qualification does not prove public-testnet deployment. Live chain ID, genesis identity, deployed addresses, runtime code hashes, transactions, Registry publication and Vault-release correlations remain TREASURY-AUDIT-8 evidence.

### No standalone Treasury website requirement

Treasury is a covered protocol/control plane. Current canonical classification does not require a standalone public-facing Treasury website.

## Read/API reference

Qualified non-authoritative Indexer routes:

- `GET /v1/treasury/budgets/:budgetId?chainId=<id>`
- `GET /v1/treasury/disbursements/:disbursementId?chainId=<id>`

Both return derived state with `authoritative: false`.

Canonical contract reads include:

- `TreasuryPolicyRegistry420.assetPolicy(asset)`;
- `TreasuryBudgetRegistry420.budget(budgetId)`;
- `TreasuryBudgetRegistry420.isEffective(budgetId)`;
- `TreasuryDisbursementRegistry420.disbursement(id)`;
- `TreasuryDisbursementRegistry420.epochSpent(asset, epoch)`;
- `TreasuryRouter420.remainingBudget(budgetId)`;
- `TreasuryRouter420.isExecutable(id)`.

For the complete event/error field reference, see `docs/apps/treasury/reference.md`.

## Exact repository qualification commands

From repository root unless a working directory is shown:

```bash
cd contracts
forge build src/treasury src/grants/GrantMilestoneRegistry420.sol test/TreasuryGenesis420.t.sol test/TreasurySecurityProperties420.t.sol test/GrantsGenesis420.t.sol
forge test --match-path test/TreasuryDeploymentBinding420.t.sol -vvvv
forge test --match-path test/TreasuryGenesis420.t.sol -vvv
forge test --match-path test/TreasurySecurityProperties420.t.sol -vvv
forge test --match-path test/GrantsGenesis420.t.sol -vvv
cd ..

python3 scripts/verify-treasury-audit-5-descriptor.py
python3 scripts/verify-treasury-audit-6-release.py
python3 scripts/verify-treasury-audit-7-docs.py

cd 420-indexer
npm install --no-audit --no-fund --no-package-lock
npm run build
node --test --test-concurrency=1 dist/test/treasury420-integration.test.js dist/test/http-transport.test.js dist/test/api-surface.test.js
cd ..

go test ./analytics/indexerclient ./analytics/metrics
```

Static/security qualification is owned by `.github/workflows/treasury-audit.yml`, including targeted Slither and the Treasury forbidden-primitive scan.

## Qualification evidence

Retained audit evidence:

- `docs/audit/420TREASURY-AUDIT-2-QUALIFICATION.md`;
- `docs/audit/420TREASURY-AUDIT-3-QUALIFICATION.md`;
- `docs/audit/420TREASURY-AUDIT-4-QUALIFICATION.md`;
- `docs/audit/420TREASURY-AUDIT-5-QUALIFICATION.md`;
- `docs/audit/420TREASURY-AUDIT-6-QUALIFICATION.md`.

Canonical roadmap:

- `docs/audit/420TREASURY-AUDIT-REMEDIATION-ROADMAP.md`.

TREASURY-AUDIT-8 is the production-equivalent testnet gate. TREASURY-AUDIT-9 is external security review and final Genesis/production closeout.

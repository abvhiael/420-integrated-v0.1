---
title: 420Treasury Events, Errors and API Reference
audience:
  - developer
  - operator
category: reference
status: current
version: current
---

# 420Treasury events, errors and API reference

This reference describes the repository-qualified 420Treasury V1 contract/read surface.

## Contracts

### TreasuryAuthorization420

Constructor:
- `TreasuryAuthorization420(address capabilityRegistry)`

Custom errors:
- `ZeroAddress()`

Reads:
- `capabilityRegistry()`
- `scopeForDisbursement(bytes32 disbursementId)`
- `isDisbursementAuthorized(address principal, bytes32 disbursementId, bytes32 actionId, uint256 amount)`

### TreasuryPolicyRegistry420

Constructor:
- `TreasuryPolicyRegistry420(address governanceTimelock)`

Custom errors:
- `EpochDurationImmutable()`

Inherited/SystemAccess authorization may also revert on unauthorized governance access.

Events:
- `AssetPolicySet(address indexed asset, bool allowed, uint128 maxSingleDisbursement, uint128 maxEpochDisbursement, uint64 epochSeconds, uint32 revision)`

Writes:
- `setAssetPolicy(address asset, bool allowed, uint128 maxSingle, uint128 maxEpoch, uint64 epochSeconds)`

Reads:
- `assetPolicy(address asset)`
- `isAllowed(address asset, uint256 amount)`

Operational rules:
- `maxSingle > 0`;
- `maxEpoch >= maxSingle`;
- `epochSeconds > 0`;
- once initialized, `epochSeconds` cannot change.

### TreasuryBudgetRegistry420

Constructor:
- `TreasuryBudgetRegistry420(address governanceTimelock, address policy)`

Custom errors:
- `UnauthorizedCaller()`
- `InvalidBudget()`
- `BudgetExists()`
- `BudgetNotFound()`
- `BudgetExceeded()`
- `ControllerAlreadySet()`

Events:
- `ControllerSet(address indexed controller)`
- `BudgetCreated(bytes32 indexed budgetId, bytes32 indexed vaultId, bytes32 indexed category, address asset, uint128 ceiling, uint64 validFrom, uint64 validUntil, bytes32 civicActionHash, bytes32 metadataHash)`
- `BudgetCommitmentChanged(bytes32 indexed budgetId, uint128 committed, uint128 executed)`

Governance writes:
- `setController(address controller)` — one-time only.
- `createBudget(bytes32 budgetId, bytes32 vaultId, bytes32 category, address asset, uint128 ceiling, uint64 validFrom, uint64 validUntil, bytes32 civicActionHash, bytes32 metadataHash)`

Controller-only writes:
- `reserve(bytes32 budgetId, uint128 amount)`
- `settle(bytes32 budgetId, uint128 amount)`
- `release(bytes32 budgetId, uint128 amount)`

Reads:
- `budget(bytes32 budgetId)`
- `isEffective(bytes32 budgetId)`
- `controller()`
- `policy()`

Invariant:
- `executed <= committed <= ceiling`.

### TreasuryDisbursementRegistry420

Constructor:
- `TreasuryDisbursementRegistry420(address governanceTimelock, address authorization, address policy, address budgets)`

States:
- `NONE`
- `SCHEDULED`
- `EXECUTED`
- `CANCELLED`

Custom errors:
- `InvalidDisbursement()`
- `DisbursementExists()`
- `DisbursementNotFound()`
- `ExecutionUnauthorized()`
- `InvalidState()`
- `NotExecutable()`
- `EpochLimit()`

Events:
- `DisbursementScheduled(bytes32 indexed disbursementId, bytes32 indexed budgetId, address indexed recipient, address asset, uint128 amount, uint64 notBefore, uint64 expiresAt, bytes32 civicActionHash, bytes32 purposeHash)`
- `DisbursementExecuted(bytes32 indexed disbursementId, bytes32 vaultReleaseHash, address indexed executor)`
- `DisbursementCancelled(bytes32 indexed disbursementId)`

Governance writes:
- `schedule(bytes32 id, bytes32 budgetId, address recipient, uint128 amount, uint64 notBefore, uint64 expiresAt, bytes32 civicActionHash, bytes32 purposeHash)`
- `cancel(bytes32 id)`

Capability-scoped write:
- `markExecuted(bytes32 id, bytes32 vaultReleaseHash)`

Reads:
- `canonicalId(bytes32 budgetId, address recipient, uint128 amount, uint64 notBefore, uint64 expiresAt, bytes32 civicActionHash, bytes32 purposeHash)`
- `disbursement(bytes32 id)`
- `epochSpent(address asset, uint256 epoch)`
- `authorization()`
- `policy()`
- `budgets()`

Execution checks:
- state must be `SCHEDULED`;
- current time must be inside the execution window;
- `vaultReleaseHash != bytes32(0)`;
- parent budget remains effective;
- current policy still allows the amount;
- exact executor capability must authorize the disbursement/action/scope/amount;
- current asset epoch cap must not be exceeded.

### TreasuryRouter420

Constructor:
- `TreasuryRouter420(address budgets, address disbursements)`

Reads:
- `budgets()`
- `disbursements()`
- `remainingBudget(bytes32 budgetId)`
- `isExecutable(bytes32 id)`

The router is read-only and does not gain custody, governance or execution authority.

## 420Indexer HTTP read API

Treasury read routes are derived and non-authoritative.

### Budget

`GET /v1/treasury/budgets/:budgetId?chainId=<unsigned integer>`

Returned Treasury budget fields include:

- `chainId`
- `budgetId`
- `vaultId`
- `category`
- `asset`
- `ceiling`
- `committed`
- `executed`
- `validFrom`
- `validUntil`
- `civicActionHash`
- `metadataHash`
- block/transaction/log provenance
- `authoritative: false`

The Indexer fails closed on malformed event history, multiple creation events, `executed > committed`, or `committed > ceiling`.

### Disbursement

`GET /v1/treasury/disbursements/:disbursementId?chainId=<unsigned integer>`

Returned fields include:

- `chainId`
- `disbursementId`
- `budgetId`
- `recipient`
- `asset`
- `amount`
- `notBefore`
- `expiresAt`
- `civicActionHash`
- `purposeHash`
- `vaultReleaseHash`
- `executor`
- `state`
- block/transaction/log provenance
- `authoritative: false`

The Indexer fails closed on terminal replay or an executed history containing a zero Vault release commitment.

### HTTP envelopes

Success uses the Indexer API envelope with `apiVersion` and `data`.

Relevant error behavior:
- malformed/missing `chainId`: HTTP 400 `invalid_request`;
- missing Treasury object: HTTP 404 `not_found`;
- unsupported method: HTTP 405 `method_not_allowed`;
- unexpected backend/reconstruction failure: HTTP 500 `internal_error`.

## Canonical authority warning

Indexer, Explorer and Analytics data are derived projections. They must not be used to override or mutate canonical Treasury contract state.

The authoritative operational model and incident/recovery procedures are in `docs/apps/treasury/operator-guide.md`.

## Vault release evidence warning

`DisbursementExecuted` records a nonzero `vaultReleaseHash`, but Treasury does not cryptographically verify the actual 420Vault release. See:

- `docs/architecture/decisions/TREASURY-AUDIT-4-VAULT-RELEASE-EVIDENCE-MODEL.md`;
- `docs/apps/treasury/operator-guide.md`.

Production-equivalent evidence must correlate the commitment to the real Vault transaction/event/receipt.

# 420 Governance permissions

420 Governance separates **who may trigger a function** from **what state may authorize the result**.

| Operation | Caller model | Authority constraint |
|---|---|---|
| create Civic proposal | permissionless | nonzero commitments; current constitutional rule exists; rule/electorate snapshot frozen |
| cast vote | electorate member | proposal ACTIVE; within window; required house; valid frozen electorate proof; one ballot only |
| finalize | permissionless | voting ended; result computed from frozen rule and tallies |
| queue passed proposal | permissionless | Timelock Civic authority active; proposal PASSED; exact committed action batch |
| execute Timelock operation | permissionless trigger | operation exists, is mature, unexecuted/uncancelled, exact target/value/data fixed |
| execute queued Civic batch | GovernanceTimelock only | proposal QUEUED; action hashes match; exact value supplied |
| set constitutional rule | GovernanceTimelock only | delay floors and threshold invariants enforced |
| set electorate source | GovernanceTimelock only | deployed source exposing nonzero source type |
| publish electorate checkpoint | GovernanceTimelock only | prospective block, nonzero root/weight, monotonic checkpoint |
| bind proposal/snapshot authority | GovernanceTimelock only, one time | candidate must prove matching Civic graph and Timelock |
| bootstrap schedule | permissionless trigger before activation | Governance420 schedules only the hard-coded canonical plan |
| bootstrap activation | permissionless trigger after verification | exact graph/rules/Registry state required; one-way handoff |

## No hidden owner

The canonical Civic contracts do not introduce an owner/admin key that can override proposal results.

## No capability-derived voting authority

Smart Account capabilities, Wallet permissions, Treasury/Vault capabilities, Registry publication, Identity credentials, Search results and Notifications do not manufacture Civic voting or execution authority.

## Governance420 compatibility boundary

The legacy `Governance420.createProposal`, `applyVote` and `applyResult` selectors are permanently retired and revert. They must never be used as canonical Civic state.

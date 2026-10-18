# LIFTd PT-09 — security and adversarial review

**Scope:** repository-side Level 1 adversarial review, without independent deployed acceptance. Canonical L03.9–L03.12 unchanged.

## Review matrix
| Threat | Repository control | PT-09 disposition |
| --- | --- | --- |
| Account takeover / recovered device | `identity-consent-guard.mjs`, `auth.mjs` | **Fixed demonstrated defect**: reauthorization after asynchronous preference read now requires unchanged action and exact account-resource binding; validates device/recovery fields on initial admission |
| Authority spoofing | `auth.mjs`, `eligibility.mjs` | Existing signed Identity/Registry/transport issuer separation retained; negative regression against forged pilot projection |
| Forged driver/vehicle proof | `eligibility.mjs` | Existing cryptographic bindings, fresh driver/vehicle and separate transport approval reused, not replaced with local pilot fixtures |
| Replay / economic duplication | `payments.mjs`, `payment-protocol.mjs`, `economic-reconciliation.mjs` | Existing payment-ID, idempotency, ledger and reconciliation tests retained; additional live chain/reorg evidence remains testnet-gated |
| Concurrent race / stale leases | `dispatch.mjs`, `reliability.mjs` | Existing PostgreSQL fencing and multiworker evidence preserved; no duplicate global integration qualification |
| Cross-trip access | `trip-communications.mjs`, `privacy-retention.mjs`, `support-cases.mjs` | Existing exact trip/subject/role reauthorization; cross-resource negative tests included in retained suites |
| Escalation abuse | `operational-safety.mjs`, `operational-recovery.mjs`, `pilot-configuration.mjs` | Unauthorized/stale revision emergency stop, independent rollback and protected audit/holds denied |
| Stale provider data / compromised provider | `eligibility.mjs`, `privacy-operations-controls.mjs` | Signed fresh authority projections; signed provider receipt inventory and failure-closed controls; provider-side independent custody requires deployed verification |
| Revocation after asynchronous I/O | `identity-consent-guard.mjs` | **Fixed** wrong action/resource on second proof; deny altered device and recovery epoch; test covers account takeover race |

## Independent deployment boundaries
Testnet TN-0–TN-6 remains NOT ACCEPTED for independent Identity/Registry/transport issuer ownership and revocation, actual financial finality/reorg and duplicate settlement, private vault, cross-instance races and moderation, incident/safety IAM, deployed provider response and regulator signoffs. Existing production traffic remains disabled. A single scoped Level 1 LIFTd workflow must pass the exact SHA; this document is not an independent professional security audit.

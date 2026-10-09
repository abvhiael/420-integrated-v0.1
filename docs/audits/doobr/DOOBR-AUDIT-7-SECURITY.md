# DOOBR-AUDIT-7 — Authentication, transaction security, privacy, recovery and external-provider boundaries

**Scope:** frozen GEN-SVC-3.9 DOOBR compatibility contracts only; not a standalone DOOBR delivery system.
**PR:** #598; branch `audit/doobr-audit-1-inventory-20261009`.
**Inspected main:** `f8bbb62e1cdfe68cff25261fd4a036db1840a15c`.
**Level:** 1; later Level 2 and phase Level 3 not automatically triggered.

## Confirmed security architecture
- DOOBR `ServiceProvider`, `ServiceArea`, `DeliveryWindow` and `ServiceRequest` carry untrusted **structural** data. `IdentityRef` and `RequesterIdentityRef` are references, *not* authenticated identities, active credentials, age or license proof.
- `GenesisTravelTransactions` is a stateless empty struct with seven unconditional `ErrTravelTransactionDisabled` methods. It contains no payment provider, delivery adapter, escrow, authorization session, persistent queue, retry policy or external network invocation. Consequently every authentication, payment, settlement, replay and recovery attempt must **fail closed**, including when context is nil, cancelled, or deadline-exceeded.
- `ServiceArea` is coarse geography and rejects zero/empty/oversized region/country and NUL/CR/LF, but its strings are not a verified jurisdiction or complete private-address classifier. No public DOOBR address/identity index is authorized by this contract.
- Exact permission, provider regulatory qualification and operational delivery acceptance require separately approved post-Genesis integration and cannot be established through schema validation.
- The default-off feature flag and frozen catalog prohibition persist. No new authority, payment contract, delivery channel or identity policy is installed by this audit.

## Security and failure case matrix

| Attack / failure | Expected present behavior | Verification |
| --- | --- | --- |
| Anonymous or unknown identity | Reference may validate structurally, but cannot authorize transaction | all gateway methods disabled |
| Forged, empty, whitespace or control-character identity refs | Invalid structure rejected | AUDIT-7 negative Go tests |
| Oversize reference | Invalid structure rejected | 257-character Go test |
| Unknown/revoked external provider | Cannot advance delivery or settlement | no external adapter, disabled gateway |
| Invalid, missing or private-address newline region | Rejected by structural validator | AUDIT-7 negative Go tests |
| One-line address or unauthorized jurisdiction | **Not safely classified by current schema** | separately gated future service; no execution |
| Replayed payments, refunds or delivery requests | Repeated calls always reject | three attempts across all gateway methods |
| Cancelled/deadline context | No recovery bypass or side effect | cancelled/deadline contexts across seven gateway operations |
| Nil context or malformed request | Still disabled, no panic | nil-context and zero-value request cases |
| Upstream timeout/service outage | Cannot create false success or reconcile money | no external transaction/provider path exists |
| Search/Indexer privacy leakage | Not qualified as independently deployed interface | prospective service must test before activation |

## Code/evidence changes
- Added `genesis/svc3/travelapp/doobr_audit7_security_test.go` with negative identity/reference/privacy cases, repeated transaction attempts, nil and cancelled context and expired-deadline behavior.
- Extended `.github/workflows/doobr-audit-1-level1.yml` with uncached `go test -count=1 ./genesis/svc3/travelapp -run '^TestDOOBRAudit7' -v` and relevant trigger.
- Retains AUDIT-2/5/6 authority verifiers, GEN-SVC-0/3 validators, noncached compatibility tests, affected Go tests/vet/build, and exact SHA check.

## Limitations and future acceptance gates
No live authentication token, delivery provider, age/license checking, financial custody or settlement interface exists within confirmed DOOBR scope. Therefore there are **no real external-provider credentials, payment receipts, refund funds, operational retries, revocations or deployed order lifecycles** to integration-test today. Those are gated on the separate standalone DOOBR authorization and actual integrations. Passing fail-closed security tests must not be represented as a live-service security audit or regulatory/legal certification.

## Exit and evidence
This scope is complete only after targeted exact-SHA Level 1 CI PASS for all relevant checks and evidence commit. Level 2 not required because no cross-service execution was introduced; full Level 3 deferred to final app-phase reconciliation. Unrelated workflows and Cloudflare builds do not constitute this app's Level 1 results.

Next canonical step: **not yet identified in approved repository roadmap; verify before advancing**.

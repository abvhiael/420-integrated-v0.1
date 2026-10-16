# BNB-5.2 — Level 1 qualification certificate

**COMPLETE — REPOSITORY LEVEL 1 PASS, 2026-10-14. No testnet/production release acceptance.**

## Identity and reconciliation

- Step: **BNB-5.2 — Supervised background-worker runtime**.
- Qualified implementation: `fd2612e695337faed1d6bfba0ff2ab04dcc43c08`.
- Main/base: `3f2cf64897e96c4f16213bcaf93564db72a174c9`, reverified unchanged after qualification.
- Prior BNB-5.1 evidence HEAD: `55aed5e5b0a3f76f4ca66e13974c9433852c6fb9`.
- [PR #644](https://github.com/abvhiael/420-integrated-v0.1/pull/644), audit branch `audit/bnb-phase5-bnb-5-1-baseline-20261014`: draft/open/unmerged.
- Evidence SHA: the commit adding this certificate (discover with Git history for this path). It changes only this certificate, the implementation report's evidence/status and roadmap status. Source/tests/workflows/configuration/runtime artifacts and substantive requirements remain unchanged; qualification inherits the exact implementation above without recursive reruns.

## Implementation and individual canonical exit criteria

[Implementation/operations report](BNB-5.2-SUPERVISED-WORKER.md) records the gap analysis, changed files and operating procedure. Implementation changes eight files: worker, outbox, Dockerfile, production Compose, worker tests, BnB workflow, report and Phase 5 roadmap. Existing migrations 001–026, API/interface, contract/address authority and external gate criteria are unchanged.

| Original exit criterion | Verified result |
| --- | --- |
| Deployable bounded outbox worker entry point | PASS: nonroot packaged `worker.py`, one in-flight event, bounded poll/delivery/reconnect waits; hardened opt-in Compose profile; packaged missing-bindings rejection |
| Graceful shutdown | PASS: stop signal drains current completed delivery without claiming next work; actual SIGTERM bounds blocked delivery and exits for restart; uncertain acceptance remains unacknowledged until expiry/reclaim |
| Connection recovery | PASS: fresh connections, capped outage backoff, no credential output; actual verified-TLS least-privilege runtime role executes worker/sink/ack; production mount/image/role validation retained |
| Lease renewal/fencing | PASS: in-flight heartbeat, unique per-claim owner; wrong/expired/reclaimed owners rejected; wall-clock checks after lock waits prevent revival and stale receipt/failure writes |
| Competing-worker qualification | PASS: two supervisors process isolated shared PostgreSQL stream once per durable local event; no overlapping live claim or receipt |
| Restart/crash qualification | PASS: real process death after durable accept/before ack, expiry and idempotent restart; blocked adapter bounded; repeated crashes dead-letter at existing eight-attempt bound |
| Security/invariants and app regression | PASS: poison payload isolation, conflicting-envelope rejection, fail-closed/redacted startup, bounded configuration, no stale completion; complete retained BnB runtime/API/security directory succeeds |

Independent per-consumer state remains BNB-5.3. The durable local-validation receipt is not Search/Travel/provider acceptance and cannot be used to certify downstream delivery. This is an opt-in local rehearsal sink; do not consume a real stream as a substitute for approved consumers. Actual transports remain BNB-5.6. No live deployment occurred.

## Exact-source executed evidence

[420BnB Runtime Slice run 38606011412](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38606011412), [job 115996970065](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38606011412/job/115996970065): **SUCCESS**, all steps successful. Exact job logs inspected.

- Checkout, explicit HEAD assertion, OCI revision and build evidence all bind `fd2612e695337faed1d6bfba0ff2ab04dcc43c08`.
- Dedicated migration/parallel operations suite: **8 passed**, zero failed.
- Complete BnB test directory: **327 passed**, zero failed, including **19 new BNB-5.2 cases**.
- The eight dedicated operations tests also occur in the complete directory: 335 successful executions, **327 distinct directory tests**, not 335 distinct tests.
- Transactional migrations, verified PostgreSQL TLS/roles, isolated backup/restore, Python compilation, packaged migration, nonroot API/web builds, staging readiness, worker fail-closed/redaction, browser/axe, front-end surfaces, restricted static surface, production command, Compose worker profile and ingress/TLS syntax: **PASS**.
- Exact-source infrastructure artifact ID **11916696192**, `bnb32-infrastructure-fd2612e695337faed1d6bfba0ff2ab04dcc43c08`: uploaded. Local API image config `sha256:9db8a36a2bc1309313c14d113ab6fad2b9502d9da5565b76265ddd854462a32c`; local web image config `sha256:48ccc6fd9d824c8b0a1cb9f97d7b3e34e991d5525dcd34eed3832c34b2802af8`. `registry_publication_verified=false`, `live_accepted=false`.

Both pytest invocations reported the existing Starlette/httpx test-client deprecation warning; no failed/skipped tests in their result summaries. Build/action deprecation notices did not fail required checks; no dependency/security check was disabled.

Supplemental retained BnB workflow runs all concluded SUCCESS: 1.1 `38606011520`, 1.2 `38606011565`, 1.3 `38606011458`, 1.4 `38606012025`, 1.5 `38606011658`, 1.6 `38606011950`, 1.7 `38606012119`, 1.8 `38606011604`, 1.9 `38606011902`. These are supplemental owner results, not relabeled synthetic-merge evidence. Required exact-head qualification is established by the runtime logs above.

Superseded runtime runs 38605712407 / 38605803644 were cancelled, not passing evidence. The final run initially waited for GitHub serialization, then executed successfully; no implementation test failure required a rerun. Global Docs run 38606012104 was skipped and is not PASS; Oracle 38606011372 was in progress at certification and is not counted. Neither is required for this app-only Level 1 step. Inherited unrelated 420Hz/Governance workflow defects remain outside this step, not waived.

## Completion, deferrals and next canonical step

All six original worker exit criteria and their security/regression requirements passed. No remaining repository-side BNB-5.2 blocker.

Level 2 intentionally remains at BNB-5.7 and BNB-5.13. Solidity full inventory, independent Genesis/address authority, Integrated, global Docs and other Level 3 checks remain at BNB-5.14; no redundant global qualification was dispatched.

Preserve T-BNB-OPS-214, T-BNB-SECURITY-213 and all other existing external gates. Independent Identity/property/media/calendar/reputation, Pay/Wallet, Compliance/legal, Search/Travel, human accessibility and production operational acceptance remain required. Keep `travel.bnb_booking=false`, `booking_enabled=false`, `financial_execution=false`. CI rehearsal is not real provider delivery, registry publication, authority approval, production rollout or live failover acceptance.

Next: **BNB-5.3 — Independent consumer delivery state**. PR remains draft/open/unmerged.

# BG-20 — operational launch hardening (pre-launch preparation)

**Status:** BG-20.1 code and regression tests started on BG-19 feature branch, PR #350. **Not launched. Not approved for canary.** The BG-19 roadmap explicitly makes BG-20 operational launch *conditional on BG-19 closeout*. Work on preparatory hardening is permitted; it must not change release flags, expose private routes, imply an approved launch, or merge PR #350 without a separate request.

## BG-20.1 — fail-closed operator canary assessment

`bong-goggles/web/core/operational-rollout.js` accepts an immutable deployment identity and independently evidenced BG-19 release approval, rollback readiness, measured traffic windows and numerical thresholds. It produces **blocked**, **rollback_required**, or **hold_for_operator**. It cannot deploy, approve a launch, promote canary traffic or enable a feature; `eligibleForPromotion` is always false. Operators must authenticate evidence and choose any production action through separately authorized deployment controls. Evidence URLs supplied to the evaluator are references, **not proof of authenticity**. The module is not imported by the browser application and therefore changes no live state.

BG-19 remains blocked on independently verified Wallet/Identity session and canonical audience/moderation-policy providers, safe authorization for private feeds, real API deployment, browser denial and policy-withdrawal tests, accessibility/performance, operator approval and rollback drill. Prior BG-19 CI green is only repository-code evidence. The BG-19.19 HTTP adapter stays disabled by default, and `launchApproved` must stay false until the actual release authority records a qualified release for the precise build and environment.

## Follow-on execution order

1. **BG-20.2 — observability:** specify privacy-safe server-side latency, error, index/finality lag, moderation-policy and authorization-denial counters. Never label sensitive identities, payloads, message content or session tokens. Define per-environment alert owners, thresholds and retention; prove monitors against staged fault injections.
2. **BG-20.3 — rollback, backups and recovery:** attest immutable deployment artifact, configuration and policy version; verify disabled-by-default ingress and feature flags. Exercise rollback after policy outage, chain reorg, access revocation, database restore and media unavailability; record RTO/RPO measurements and operator signatures.
3. **BG-20.4 — controlled staging/canary:** only after BG-19 signoff, bind measured windows to a named deployed release and independently attest their origin. Stop or roll back on privacy, auth, moderation, reorg or SLO breaches. A clean window requires an *additional* human release decision and cannot automatically promote.
4. **BG-20.5 — launch operations:** real desktop/mobile accessibility checks, abuse and incident escalation, on-call rotation, alert verification, backup retention, dependency and security regression cadence; capture concrete evidence and disabled-feature decisions.

## BG-20.1 evidence and limitations

`bong-goggles/web/test/operational-rollout.test.js` checks missing approvals, wrong releases, insufficient data, and safety/SLO regression conditions. GitHub Actions test success qualifies these deterministic decisions only. No named deployment, real telemetry, actual rollback drill, incident rehearsal, operator approval, canary run or production launch has been demonstrated by this increment. Track BG-19 and BG-20 independently; do not mark either complete based only on this module.

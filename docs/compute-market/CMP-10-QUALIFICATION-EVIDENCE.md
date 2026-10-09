# CMP-10 — Security and adversarial qualification evidence

**Operational outcome: NO-GO; actual CMP-10 security qualification NOT COMPLETE.**

- Implementation SHA: `f6a730377fce1df62426a2a31bb67fa1bafd96ff`; main at initial inspection `ffc6a4028676907c266714b5c1ae8ba3af9a7137`. Stacked PR #589 branch `cmp-10-security-adversarial-20261008`; prior CMP-9.15 evidence HEAD `b243a3ab10f581413ed1a80fcd5d7cf2dc4f7b74`.
- Source/tests: `compute/ingestion/src/cmp10-security.mjs`, `compute/ingestion/test/cmp10-security.test.mjs`, `compute/ingestion/package.json`, `.github/workflows/cmp-10-security.yml`, `docs/compute-market/CMP-10-SECURITY-HANDOFF.md`.
- Required [CMP 10 Security Readiness run 37864563673](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37864563673) exact SHA. CI outcome **must be checked before declaring Level 1 PASS**. Tests use Node 22, targeted security preflight plus all retained S-02–S-10/CMP-9.13–9.15 science-ingestion regressions.
- Offline gate inventory tracks all 16 canonical attack campaigns. Negative tests cover missing or duplicated campaign, unreviewed PASS assertion, absent evidence, unqualified CMP-0, unsigned/unreviewed external audit, offline fixture, high/critical findings and missing remediation requalification. Structural manifest truth is NOT independently authenticated.
- Live requirements NOT met: real incentivized testnet, independently scoped external Solidity audit and worker sandbox audit, real penetration and collusion/farming/poisoning/escape/DoS campaigns, signed findings, demonstrated remediation on new SHA, independent review and final funded operational receipt evidence. Previous CMP-0 remains NO-GO and cannot authorize production.
- Level 2 real security campaign remains testnet-blocked. Level 3 accumulated app-phase comprehensive qualification intentionally deferred; Solidity full Foundry single owner and Genesis address verification remain distinct.
- Next canonical CMP phase is **CMP-11 — Mainnet Compute Market**, strictly blocked until CMP-9/CMP-10 real live closeouts.

No source credential, transfer, contract, deployed address or operational security outcome is changed by the offline preflight.

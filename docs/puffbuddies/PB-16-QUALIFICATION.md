# PB-16 qualification evidence

## Step
**PB-16 — Security/privacy audit — COMPLETE**

## Qualification
- **Level 1 — app-scoped PB-16 security/privacy audit — COMPLETE**
- Level 2: not triggered; PB-15 already completed milestone E immediately before PB-16.
- Level 3: intentionally deferred to complete app-phase closeout.

## Qualified implementation SHA
`1f7cb6e93cf9338af748fc27e94ae485a183e9ce`

## Repository relationship
- branch: `puffbuddies-pb16-security-privacy-audit-20261006`
- PR: #554
- stacked base branch: `puffbuddies-pb15-qualification-20261006`
- stacked base SHA: `b3932d1537f5903179ba03a1a0166b1b8a782681`
- current repository `main` at qualification: `f0f64ecfe28c4390b524baaf7382ef82808aaa17`
- PR #554 was open and mergeable at qualification inspection.

## Audit scope
PB-16 reviewed the accumulated PuffBuddies implementation against:
- PB-0.4 privacy invariants;
- PB-0.5 consent invariants;
- PB-0.6 adult eligibility;
- PB-0.7 threat/trust model;
- PB-0.9 state ownership;
- PB-0.10 safety/moderation;
- PB-0.11 data lifecycle/deletion;
- PB-0.12 user lifecycle;
- PB-0.15 visibility;
- PB-0.16 reconciled non-goals;
- PB-13 cross-app authority boundaries;
- PB-14 hardened API boundary;
- PB-15 accumulated qualification state.

## Finding and remediation

### PB16-F1 — client-controlled request correlation metadata
**Severity:** medium privacy/audit-integrity risk — **REMEDIATED**

PB-14 accepted a syntactically valid client `X-Request-Id`, then reflected it and wrote it into protected audit metadata. Because PB-0.4 explicitly treats request IDs/logging metadata as privacy-sensitive, a client could encode protected relationship/profile text into audit correlation data or deliberately collide correlation identifiers.

**Fix:** authoritative PuffBuddies request IDs are now server-generated only using a `pb-` prefix plus 128 bits of random hex. Client `X-Request-Id` is ignored for canonical audit correlation. The generated ID is used consistently for gateway dispatch, response correlation and protected audit metadata.

## Files changed
- `puffbuddies/api/hardening.py`
- `puffbuddies/tests/test_pb_16_security_privacy_audit.py`
- `scripts/verify-puffbuddies-pb16.py`
- `.github/workflows/puffbuddies-pb16.yml`
- `docs/puffbuddies/PB-16-SECURITY-PRIVACY-AUDIT.md`
- `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`
- `docs/puffbuddies/PB-0.19-MASTER-IMPLEMENTATION-ROADMAP.md`

## Exact-SHA qualification

### PuffBuddies PB-16 Security Privacy Audit
- workflow: **PuffBuddies PB-16 Security Privacy Audit**
- run: `37557088934` — **SUCCESS**
- run number: `7`
- job: `112585695138` (`pb16`) — **SUCCESS**
- exact-head verification — PASS
- Python compilation — PASS
- focused PB-16 security/privacy tests — PASS
- PB-16 audit verifier — PASS
- complete retained PuffBuddies regression suite — PASS
- retained PB-11 web tests/build — PASS
- retained PB-12 mobile tests/build — PASS
- PB-0 verifier — PASS
- PB-13 verifier — PASS
- PB-14 verifier — PASS
- PB-15 verifier — PASS
- privacy/security/deployment negative gate — PASS

### Directly affected PB-0 owner
- workflow: **PuffBuddies PB-0 Qualification**
- run: `37557089012` — **SUCCESS**
- run number: `383`
- PB-0 canonical architecture/invariant qualification — PASS on the same implementation SHA.

## Diagnosed superseded CI failures
PB-16 had two superseded workflow failures after all substantive audit tests/verifiers were already green.

1. Candidate `305ee1ed79fb593dc594e7ee0ccca270d6b53df6`: final static negative gate failed with a Bash syntax error caused by quoting in the secret-assignment grep expression.
2. Candidate `598730f73275a8242419a799bc455223772dd3da`: the attempted quoting repair did not actually replace the malformed expression, so the same syntax defect persisted.

These were **CI/workflow harness defects**, not PuffBuddies security/protocol failures. The exact expression was then repaired and the complete workflow reran from the top against `1f7cb6e93cf9338af748fc27e94ae485a183e9ce`, where every required gate passed. Skipped or failed prior checks are not counted as green evidence.

## Security/adversarial/privacy results
PASS for:
- client-controlled audit correlation metadata rejection;
- server-generated request correlation;
- public aggregate minimum cohort and protected-dimension rejection;
- wallet→PuffBuddies membership nondisclosure;
- no dynamic `eval`/`exec`, `os.system`, or subprocess execution in PuffBuddies Python runtime;
- no committed PuffBuddies contract surface;
- no source-assigned private key/mnemonic/seed/government-ID/DOB/provider secret;
- no public member/match/block/safety/moderation graph assignment;
- no live/production/mainnet runtime configuration claim;
- retained stale-state/replay/revocation/deletion anti-resurrection;
- consent/block supremacy;
- adult-eligibility fail-closed behavior;
- safety least-privilege/human-review boundaries;
- premium/payment non-consent;
- dependency authority limitation;
- client presentation-only authority;
- API host/origin/session/body/rate-limit/replay hardening.

## Residual risks / live-environment limitations
Repository qualification does not prove:
- production secrets rotation or infrastructure IAM;
- deployed TLS/proxy/WAF correctness;
- data-at-rest encryption and key management;
- live rate-limit capacity/Sybil resistance;
- production operator/moderator access controls;
- backup expiry/restore deletion enforcement;
- processor/dependency deletion behavior;
- production telemetry/logging minimization;
- device/store signing and distribution controls;
- deployed dependency compromise behavior;
- live incident-response/rollback drills.

These are explicit later live/testnet/operations gates, not hidden PB-16 passes.

## Milestone status
No new Level-2 milestone is required. PB-15 milestone E remains the accumulated app-specific integration/release-candidate milestone; PB-16 is its dedicated security/privacy audit.

## Intentionally deferred Level 3
Deferred:
- final reconciliation of the complete accumulated PuffBuddies phase with then-current `main`;
- canonical full Solidity inventory;
- Genesis address/namespace/collision/predeploy/frozen-address/manifest-authority qualification;
- 420 Integrated/global qualification;
- Docs/global reconciliation;
- Geth/fault/soak;
- complete deployment/config verification;
- final merge-candidate closeout evidence.

## Blockers
**None for repository PB-16 qualification.**

## Completion state
**PB-16 COMPLETE** against exact implementation SHA `1f7cb6e93cf9338af748fc27e94ae485a183e9ce`.

## Evidence inheritance
Subsequent commits adding this evidence record and roadmap COMPLETE marker are evidence-only if they change no executable source, tests, workflows, dependencies, configuration, generated/runtime artifacts, interfaces, deployment state or substantive requirements.

## Next canonical roadmap step
**PB-17 — Closed testnet**

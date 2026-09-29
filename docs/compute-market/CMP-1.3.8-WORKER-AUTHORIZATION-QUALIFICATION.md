# CMP-1.3.8 — Mutation-time capability authorization and delegated worker authority qualification

Status: **COMPLETE**

## Canonical definition

CMP-1.3.8 integrates every mutable `ComputeWorkerRegistry420` action with the shared `ComputeAuthorization420` / Capability Registry model.

Required by the controlling roadmap:

- worker-scoped action IDs and object scopes;
- narrowly delegated operator/session authority only when explicitly granted;
- revision guards and revocation behavior;
- preserved provider/node/resource ancestry checks;
- no capability grant may imply Vault, governance, verifier, bridge, validator, settlement, or arbitrary wallet authority;
- negative tests for wrong action/scope/object, stale revision, revoked authority, governance substitution, and mutation atomicity.

Exit criterion: every mutable WorkerRegistry action is both identity-safe and capability-scoped, with rejected actions leaving canonical state unchanged.

## Repository baseline and gap analysis

Implementation branch was created from current `main` at:

`f437378664059a51f854d45bf48594930f070f6f`

The approved CMP-1.3.8 definition was committed in PR #383 but that PR had not been merged when implementation began. The roadmap/audit records were carried forward exactly onto this branch before implementation.

Pre-step WorkerRegistry state:

- registration required canonical provider/node operator identity but no Capability Registry grant;
- activate/profile refresh/key rotation required direct `msg.sender == worker.operator`;
- suspend/retire also allowed the governance timelock solely by address identity;
- no worker-specific actions existed in `ComputeAuthorization420`;
- no worker scope existed;
- successful mutations incremented revisions, but authorization was not revision-bound;
- execution-key registration/rotation proofs were already domain separated and are preserved;
- provider/node/resource ancestry and resource-revision checks already existed and are preserved.

Disposition: authorization/delegation/revocation/replay-hardening was missing; identity/history logic was retained.

## Implementation

### ComputeAuthorization420

Added exact WorkerRegistry action IDs:

- `ACTION_REGISTER_WORKER`
- `ACTION_ACTIVATE_WORKER`
- `ACTION_SUSPEND_WORKER`
- `ACTION_RETIRE_WORKER`
- `ACTION_REFRESH_WORKER_PROFILE`
- `ACTION_ROTATE_WORKER_EXECUTION_KEY`

Added `scopeWorker(workerId, workerRevision)`.

The worker revision is part of the capability scope. Therefore, after every successful WorkerRegistry mutation increments the worker revision, a grant for the prior revision becomes stale automatically. This supplies deterministic replay/stale-authority rejection without introducing mutable authorization state into WorkerRegistry.

### ComputeWorkerRegistry420

- binds an immutable `ComputeAuthorization420` adapter at construction;
- every mutable action requires the exact action + exact worker/revision scope;
- direct canonical operators require capabilities too—identity alone is no longer sufficient;
- added `registerFor(...)` for explicit delegated registration;
- delegated registration preserves `worker.operator` as the canonical provider/node operator rather than the caller;
- registration authorization is scoped to the deterministic prospective worker ID at revision 1;
- parent/resource/operator validation remains mandatory independently of capabilities;
- profile refresh validates canonical operator/provider/node ancestry using stored worker identity, not delegate identity;
- execution-key rotation retains possession proof and historical key revisions;
- automatic governance bypass for suspend/retire was removed; governance can act only if separately granted the exact worker action/scope capability;
- all capability checks use amount `0`; WorkerRegistry capabilities cannot create custody/spend entitlement.

### Canonical wiring

`ComputeWorkerCanonicalWiring420` now fails closed unless the WorkerRegistry authorization adapter equals the accepted-job worker-evidence authorization adapter.

This keeps mutation authority and accepted-job execution authority anchored to the same qualified ComputeMarket capability authority.

## Security and authority analysis

### Delegation

A delegate can mutate only when the Capability Registry returns true for:

- the delegate principal;
- `COMPONENT_COMPUTE`;
- the exact WorkerRegistry action;
- the exact worker/revision scope;
- zero economic amount.

The capability does not alter canonical worker ownership. Provider/node/resource ancestry remains independently validated.

### Revocation and expiry

WorkerRegistry intentionally does not cache capability decisions. Every mutation reads `ComputeAuthorization420`, which reads the live shared Capability Registry. Revoked or expired grants therefore fail closed at mutation time.

### Replay / stale grants

Because worker revision is part of the scope, a successful mutation invalidates the old authorization scope for future mutations. Reusing a prior-revision grant fails unless a new exact-revision grant exists.

Registration uses the deterministic next worker ID and revision 1, while failed registration does not consume `nextSerial`.

### Failure atomicity

Authorization checks occur before mutation commits. Negative tests assert rejected registration does not consume serials and rejected stale/wrong/revoked/expired/governance actions do not advance worker revisions or alter worker state.

### Unrelated authority

A WorkerRegistry action grant is a distinct capability ID. Tests prove an activation grant does not authorize settlement or another WorkerRegistry action. WorkerRegistry itself still exposes no Vault custody, verifier correctness, bridge, validator, settlement, slashing, or arbitrary wallet execution path.

## Tests

Dedicated CMP-1.3.8 tests cover:

- explicitly delegated registration while preserving canonical operator identity;
- direct operator cannot bypass Capability Registry;
- exact-revision delegated activation/suspension;
- stale-revision capability replay rejection;
- wrong action rejection;
- wrong worker/object scope rejection;
- revoked grant rejection;
- expired grant rejection;
- governance-address substitution rejection without a grant;
- failed mutation state/serial atomicity;
- delegated capability-profile refresh;
- delegated execution-key rotation with new-key possession proof;
- historical execution key preservation;
- WorkerRegistry grant does not imply settlement or other worker actions.

Retained regression suites are updated to bind WorkerRegistry to a test Capability Registry while preserving their original 1.3.1–1.3.7 assertions.

## Frozen invariant mapping

Directly exercised/preserved:

- **CMP-INV-003** — worker IDs/revisions are not reassigned; failed registration does not consume identity.
- **CMP-INV-004** — delegated authority cannot move node/provider ancestry.
- **CMP-INV-005** — worker registration/mutation grants no custody, validator, governance, bridge, settlement, or arbitrary wallet authority.
- **CMP-INV-020** — suspension remains a WorkerRegistry admission-state mutation and creates no confiscation path.
- **CMP-INV-023** — authorization does not grant Trust/correctness/settlement authority.
- **CMP-INV-026** — exact historical worker revisions remain reconstructable.
- **CMP-INV-028** — capability-profile changes create a new suspended revision; old accepted semantics remain historical.
- **CMP-INV-029** — key/profile mutation cannot rewrite previously committed worker revisions.

No custody/accounting balance is changed by CMP-1.3.8.

## Deployment/publication boundary

CMP-1.3.8 changes WorkerRegistry runtime code and its constructor graph. Therefore the historical CMP-1.3.7 code-hash/deployment package remains a historical qualification record for the pre-1.3.8 graph and must not be represented as the final release package.

The canonical roadmap assigns final release-candidate hash/wiring/publication refresh to **CMP-1.3.15**. CMP-1.3.8 does not fabricate new live deployment evidence and does not prematurely perform 1.3.15.

## Qualification evidence

Candidate implementation SHA: `b4b8b4963ec0f773f7cbe36c05cea6a7c371c06e`

Candidate exact-head qualification:

- Solidity Contracts #3256 — **SUCCESS**, 16/16 `pr-shards` successful. The workflow's aggregate `foundry` wrapper was intentionally skipped by workflow design and is not counted as a passing gate; the 16 shard jobs are the retained Solidity gate.
- 420 Integrated Qualification #5856 — **SUCCESS**:
  - fault-matrix — success
  - production-dependencies — success
  - offline-core — success
  - geth-engine — success
- 420Docs Qualification #3239 — **SUCCESS**

Current `main` remained `f437378664059a51f854d45bf48594930f070f6f` after candidate CI. The candidate branch was 0 commits behind main, so no reconciliation commit was required before evidence recording.

Final evidence-recording SHA: `e66460626828a9b2543df4c399e03a3f50e945e3`

Final exact-head qualification:

- Solidity Contracts #3258 — **SUCCESS**, all 16/16 `pr-shards` successful. The aggregate `foundry` wrapper was skipped by workflow design and is not counted as a passing gate.
- 420 Integrated Qualification #5859 — **SUCCESS**.
- 420Docs Qualification #3242 — **SUCCESS**.

Current `main` remained `f437378664059a51f854d45bf48594930f070f6f`; the qualified branch was 0 commits behind main, so no reconciliation commit was required before the final retained-suite run.

Every canonical CMP-1.3.8 exit criterion is satisfied on the exact qualified tree at `e66460626828a9b2543df4c399e03a3f50e945e3`.

## Completion

**COMPLETE** at exact qualified implementation/evidence tree `e66460626828a9b2543df4c399e03a3f50e945e3`.

This closeout-text commit changes documentation only. Per exact-head discipline, it must itself pass the retained qualification suite before it is used as the branch point for CMP-1.3.9.

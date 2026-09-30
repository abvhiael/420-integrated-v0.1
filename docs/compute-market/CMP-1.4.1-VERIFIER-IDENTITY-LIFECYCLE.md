# CMP-1.4.1 — Verifier identity & lifecycle

Status: **COMPLETE. LEVEL 1 EXACT-HEAD QUALIFICATION GREEN. NO LIVE DEPLOYMENT/PUBLICATION CLAIM.**

## Canonical definition

The detailed Compute Market roadmap defines CMP-1.4.1 exactly as:

> Register, activate, suspend, rotate and retire verifier identities without granting unrelated authority.

Parent CMP-1.4 purpose:

> Separate workers from verification authorities.

## Repository baseline and gap analysis

Baseline current `main` for runtime work: `ddf07305444faefa6ce779565b00b185f390822e`.

CMP-1.4.0 froze identity/lifecycle ownership to CMP-1.4.1 and explicitly prohibited treating `ComputeVerifierIndependencePolicy420` controller attestations or appointments as the canonical verifier lifecycle registry. At intake there was no `ComputeVerifierRegistry420` source or dedicated verifier lifecycle test. The requirement was therefore missing, not partial.

The CI optimization work is stacked separately in PR #431. This step is based on the same qualified runtime `main` state and uses the repository-backed Compute-specific Level 1 workflow from that CI branch.

## Implementation

`contracts/src/compute/ComputeVerifierRegistry420.sol` now provides the canonical verifier identity/lifecycle surface.

- domain-separated verifier IDs bind chain ID, registry address, verifier tag and monotonic serial;
- self-registration proves control of the current transaction authority and starts at `REGISTERED`;
- governance alone activates or retires identities;
- an ACTIVE verifier may fail-closed suspend itself and governance may also suspend it;
- lifecycle is `REGISTERED -> ACTIVE <-> SUSPENDED -> RETIRED`;
- `RETIRED` is terminal;
- every successful lifecycle mutation creates a new immutable revision while prior revisions remain queryable;
- `isActive` requires exact current verifier ID, authority and revision;
- one authority cannot be concurrently bound to multiple current verifier identities.

Rotation is deliberately two-party. Governance proposes a new authority and registration-manifest commitment. The proposed new authority must explicitly accept. Acceptance replaces the current authority, preserves the prior revision, and leaves the verifier `SUSPENDED` until explicit governance reactivation. A pending rotation can be cancelled by governance.

## Authority separation

The registry grants **identity and lifecycle status only**. It does not grant or imply:

- verification capability or `ACTION_VERIFY_RESULT`;
- verifier class or workload capability (CMP-1.4.2);
- verification profile/policy publication (CMP-1.4.3);
- job appointment or independent selection (CMP-1.4.5);
- correctness proof or signed-verdict acceptance;
- settlement, Vault custody/withdrawal, beneficiary selection or refunds;
- stake/slash power;
- worker/provider/resource authority;
- governance, validator, bridge or arbitrary-wallet authority.

Existing beneficial-controller attestation and conflict policy in `ComputeVerifierIndependencePolicy420` remains separate evidence/policy and is not duplicated here.

## Security and invariant disposition

The implementation preserves the CMP-1.4.0 authority freeze and relevant V1 invariants:

- CMP-INV-005: identity registration does not imply unrelated authority;
- CMP-INV-016: identity/activation is not correctness proof;
- CMP-INV-020: suspension does not rewrite historical evidence or confiscate valid entitlement;
- CMP-INV-023: Trust/reputation remains separate from verifier identity;
- CMP-INV-025: governance lifecycle power is non-confiscatory and cannot fabricate outcomes;
- CMP-INV-026: revision history preserves reconstructability;
- CMP-INV-027: off-chain services gain no hidden canonical privilege;
- CMP-INV-030: no 420AI dependency is introduced.

No fixed Genesis predeploy, deployment address, runtime-code-hash claim, ProtocolRegistry publication, Vault grant or settlement grant is introduced.

## Level 1 qualification requirements

CMP-1.4.1 requires only directly affected qualification:

1. compile Compute Market Solidity;
2. run retained `Compute*.t.sol` suite including `ComputeVerifierRegistry420.t.sol`;
3. adversarial lifecycle tests for unauthorized activation/suspension/rotation, duplicate authority, stale revision and terminal retirement;
4. mechanical CMP-1.4.1 verifier;
5. dedicated Compute Market Qualification workflow on the exact implementation SHA.

Level 2 is not required yet. The first sensible CMP-1.4 integration milestone is after CMP-1.4.3, when verifier identity/lifecycle, classes/capabilities and exact versioned verification policy can be validated together.

## Exit criteria

CMP-1.4.1 is COMPLETE only when every criterion below is individually satisfied:

- register, activate, suspend, rotate and retire are implemented;
- lifecycle and revision history are fail-closed;
- rotation requires the new authority to accept and cannot auto-reactivate;
- retired identities cannot return to service;
- exact-current identity eligibility is available to later components;
- no unrelated authority is granted;
- Level 1 tests and verifier are green on the exact implementation SHA;
- durable evidence records that SHA and results.

## Completion

**COMPLETE.** Exact implementation head `64e6c8cb71223879e403068bb403841995a7aee9` passed Level 1 qualification.

Required step-specific results:

- Compute Market Qualification #3 — run `36776041067` — success
- Solidity Contracts #3429 — run `36776041186` — success

Additional triggered retained checks also passed on the same implementation head:

- Genesis Address Authority #257 — run `36776041374` — success
- 420Docs Qualification #3481 — run `36776041045` — success
- 420Indexer #1054 — run `36776041009` — success
- 420Registry REG-AUDIT-4 #92 — run `36776041052` — success

Level 2 remains intentionally deferred to the CMP-1.4 identity/classes/policy integration milestone after CMP-1.4.3. Level 3 remains deferred to complete Compute Market phase closeout.

This completion update is evidence-only and references the already-qualified implementation SHA above; it changes no executable code, tests, workflow behavior, dependencies, interfaces, deployment state, or runtime configuration.

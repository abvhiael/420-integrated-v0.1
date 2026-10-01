# CMP-1.4.5 — Independent verifier selection

Status: **COMPLETE. LEVEL 1 EXACT-HEAD QUALIFICATION GREEN. NO LIVE DEPLOYMENT/PUBLICATION CLAIM.**

## Canonical definition

> Prevent worker-selected friendly verifiers and preserve conflict-of-interest controls.

CMP-1.4.0 additionally froze these compatible selection rules:

- verifier cannot self-appoint;
- selector cannot grant verification capability or publish profiles;
- identity attestor cannot appoint;
- governance / selector / attestor separation is explicit;
- controller conflicts fail closed.

## Repository baseline and roadmap-order note

Baseline current `main`: `8fbc37f254666fad5088d31101582a3cf292de9a`.

CMP-1.4.4 is still open on this baseline. There is no repository evidence marking signed verdict/provenance step CMP-1.4.4 complete. This work therefore does **not** claim sequential completion of CMP-1.4 or silently complete CMP-1.4.4.

CMP-1.4.5 is independently implementable because its authority boundary is selection/appointment before execution. Its later verdict consumption remains subject to CMP-1.4.4.

## Gap analysis

Before this step, `ComputeVerifierIndependencePolicy420` already enforced controller-attestation conflicts and allowed only its configured `verifierSelector` address to call `appoint`. That was a useful policy primitive but not a complete canonical selector: the configured selector was still an unconstrained address and there was no canonical component proving that a selected verifier was the current active verifier identity, possessed exact `INDEPENDENT_VERIFIER` workload capability, was selected before execution, or that canonical owner/payer/operator values were resolved by the selector itself.

The requirement was therefore **partial**.

## Implementation

`ComputeIndependentVerifierSelector420` is the canonical selector layer for this step.

For every selection it resolves authoritative state rather than trusting caller-supplied party identities:

- job owner, workload, accepted job revision and frozen verification policy from `ComputeJobRegistry420`;
- actual payer from the canonical request/funding authority;
- accepted operator from the canonical match runtime;
- verifier authority/revision/status from `ComputeVerifierRegistry420`;
- exact `INDEPENDENT_VERIFIER` workload capability from `ComputeVerifierCapabilityRegistry420`;
- current controller-conflict policy from `ComputeVerifierIndependencePolicy420`.

Selection is accepted only when the job remains exactly `ACCEPTED`, has a nonzero accepted verification-policy ID/revision/commitment, and no worker has started execution.

The selected verifier must:

- be the exact current verifier authority and revision;
- be ACTIVE;
- hold `INDEPENDENT_VERIFIER` capability for the job's exact workload class;
- differ directly from owner, payer and matched operator;
- not be the selector authority;
- hold a current controller attestation independent from owner, payer and operator.

The final conflict check and job/profile appointment remain in `ComputeVerifierIndependencePolicy420`. The selector cannot bypass that policy.

## Selection provenance

Each selection record binds:

- selector domain, chain ID and selector contract;
- job ID and exact accepted job revision;
- verifier ID, verifier authority and verifier revision;
- exact workload class;
- profile ID;
- accepted verification policy ID, revision and commitment;
- reviewed selection/conflict evidence commitment;
- expiry;
- selector-local selection revision.

Revocation creates a new selector revision rather than rewriting the prior active selection. A reviewed replacement may be selected before execution after the prior appointment is revoked.

## Authority separation

The selector has no surface to:

- register/activate/suspend/rotate/retire verifier identity;
- grant verifier class or workload capability;
- publish verification policy;
- approve verifier profiles;
- submit signed verdicts;
- prove output correctness;
- mutate worker/provider/resource identity or lifecycle;
- release/cancel/withdraw/claim Vault funds;
- choose settlement beneficiary or amount;
- stake/slash;
- govern, validate, bridge, or control wallets.

The identity attestor cannot appoint because policy appointment remains callable only by the policy-configured selector contract. Policy rotation away from this selector invalidates it immediately for new selections.

## Level 1 qualification

Required step-specific qualification:

1. affected Compute Solidity compiles;
2. retained `Compute*.t.sol` tests pass;
3. dedicated selector tests prove authorized selection, exact capability/workload gating, active-revision gating, direct-party exclusion, controller-conflict rejection, pre-execution timing, revocation/history, replacement and selector rotation;
4. CMP-1.4.5 mechanical verifier passes;
5. dedicated Compute Market Qualification and focused Solidity Contracts workflows pass on the exact implementation SHA.

## Level 2 status

Level 2 is not required for this step. CMP-1.4.5 does not modify the shared JobRegistry or independence-policy ABI; its Level 1 suite already integrates the real job/policy/verifier lifecycle/capability components.

The next sensible app-specific milestone is after CMP-1.4.6 when independent selection feeds replicated / N-of-M verification.

## Exit criteria

CMP-1.4.5 is COMPLETE only when every machine-readable exit criterion is satisfied and exact-head Level 1 qualification is green.

## Completion

**COMPLETE.** Exact implementation head `c6187d5188b2d2c0e5af05df03ec6a5c7efbedc1` passed the required Level 1 qualification.

Required step-specific results:

- Compute Market Qualification #14 — run `36790158443` — **success**
- Solidity Contracts #3445 — run `36790158418` — **success** using the Compute-only focused path; monolithic repository Foundry shards were skipped

Additional triggered retained checks on the same implementation head:

- Genesis Address Authority #269 — run `36790158473` — success; duplicate full Foundry inventory skipped
- 420Docs Qualification #3558 — run `36790158371` — success
- 420Indexer #1070 — run `36790158396` — success
- 420Registry REG-AUDIT-4 #104 — run `36790158453` — success

Every CMP-1.4.5 exit criterion is satisfied on the qualified implementation SHA:

- only the separately designated selector path can create the qualified appointment;
- owner, payer, matched worker/operator, selected verifier and outsiders cannot choose the verifier;
- exact ACTIVE verifier revision and exact `INDEPENDENT_VERIFIER` workload capability are required;
- current controller conflicts fail closed under the independence policy;
- selection is exact-job-revision, workload, accepted-policy, profile, evidence, expiry and selector-domain bound;
- selection is pre-execution only;
- revocation/replacement is versioned without rewriting history;
- no unrelated authority is granted.

Level 2 remains intentionally deferred to the selector/quorum integration milestone after CMP-1.4.6. Level 3 remains deferred to complete Compute Market phase closeout.

Roadmap-order limitation remains explicit: CMP-1.4.4 is still open on the qualified baseline and is **not** implied complete by this step.

This completion update is evidence-only and references the already-qualified implementation SHA above; it changes no executable code, tests, workflows, dependencies, configuration, interfaces, deployment state, or substantive requirement.

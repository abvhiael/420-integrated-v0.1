# LIFTd PT-09 — Security and adversarial Level 1 certificate

**Disposition:** repository-side PT-09 **LEVEL 1 PASS**. Independent deployed/testnet security acceptance **NOT ACCEPTED**.

- **Canonical step:** PT-09 — Security and adversarial review: account takeover, authority spoofing, forged driver/vehicle proofs, replay, payment duplication, races, cross-trip access, escalation abuse, stale data, compromised provider and revocation behavior; fix demonstrated gaps.
- **Exact implementation SHA:** `49c4b9b9a3d90b53aa58280f89e13542a826c6c4`.
- **Base main at branch creation:** `84def966b1a8c0bd32a3cbc582758b6d3a76d81d`.
- **PR:** [#723](https://github.com/abvhiael/420-integrated-v0.1/pull/723); branch `audit/liftd-pt09-security-adversarial-20261018`.
- **Qualification:** [PT-09 Level 1 GitHub run #39095748690](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39095748690), job `117581710475` **SUCCESS**, checked out exact implementation SHA.
- **Tests:** `npm test --prefix rideshare` **152 passed / 0 failed**. Node 22 syntax check and locked dependency install also completed.
- **Demonstrated defect remediated:** `rideshare/src/identity-consent-guard.mjs` now requires that post-I/O Identity/session reauthorization matches the original action and account resource; initial authorization rejects missing device ID or invalid recovery epoch. PT-01 regressions retained and expanded in `rideshare/test/identity-consent-guard.test.mjs`.
- **Added adversarial tests:** `rideshare/test/pt09-adversarial.test.mjs` covers wrong action/account reauthorization, device/recovery swap, forged driver–vehicle association in dry-run pilot eligibility, stale emergency-stop revision, restored evidence/hold tampering, and missing signed erasure-provider coverage.
- **Reviewed retained owners:** `auth.mjs` (signed Identity/session scopes), `eligibility.mjs` (separate signed driver/vehicle/transport authorities), `payments.mjs`/`payment-protocol.mjs` (payment ID, settlement idempotency), `dispatch.mjs`/`reliability.mjs` (PostgreSQL fencing), `trip-communications.mjs`/`privacy-retention.mjs` (trip participant scope), `operational-safety.mjs`/`operational-recovery.mjs` (escalation, approval and hold integrity), `privacy-operations-controls.mjs` (signed provider erasure). Review matrix: `docs/rideshare/PT-09-SECURITY-ADVERSARIAL.md`.
- **No Level 2 or Level 3 initiated**, no unrelated global Solidity, Genesis, Integrated, Geth or Docs qualification.
- **External NOT ACCEPTED:** independent live issuer identities and revocation, deployed cross-instance security checks, real chain payment finality/reorg, provider compromise response, safety/IAM approval, private vault, operational acceptance and regulated pilot remain in the unchanged TN-0–TN-6 roadmap. No simulated acceptance or release permissions.
- **Merge:** not performed; check current main and GitHub policy before authorized merge.
- **Next step:** canonical L03.9–L03.12 remain unchanged. PT-09 is supplemental pretestnet readiness.
This is an evidence-only certificate; no qualified inputs change.

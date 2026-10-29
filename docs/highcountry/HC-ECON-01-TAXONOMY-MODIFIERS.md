# HC-ECON-01 — Universal Object Taxonomy and Modifier Framework

Scope: Level 1 ordinary HighCountry roadmap step. Implements the HC-ECON-00 E13 semantic classification and modifier-policy foundation, preserving item, placement, inventory, and chain authorities.

## Contracts
- `services/highcountry-economy/src/object-taxonomy.js` defines qualified exact-shaped, versioned types with roles, decorated/functional status, and HC-PLACE-02-compatible surfaces/layers.
- Eligible effects derive from immutable server-maintained role definitions, not arbitrary creator submissions.
- Validated modifier policies pin unique type, ID and revision, permitted effects, positive integer weights, exact minimum/maximum basis points, maximum simultaneous benefits and worst-case aggregate per-item cap. Stacking caps are enforced by role.
- Catalogs sort deterministically, bind SHA-256 and are revalidated on lookup; caller mutations or unqualified types/policies fail closed.
- Outcome validation is **bounds only**, not a random draw/proof. Neither user nor developer chooses outcomes here: HC-ECON-02 must implement verifiable entropy selection, one-time edition issuance, permanent burn accounting and proof verification. HC-ECON-03 owns actual building compatibility and placement-based application.

## Security and implementation boundaries
Pure, server-side policy functions only. No deployed HTTP endpoints, new issuer roles, live transfers, BUDS/$420 settlement, genome price logic, or database migrations. A `qualified` field is authoritative service input, **not** authorization to publish. Reviews and publication require the later signed-certification contract. No invocation of client RNG, HC-SEED pack pools or mock-verifier acceptance.

## Qualification
Level 1 targeted command: `node --test services/highcountry-economy/test/object-taxonomy.test.js`.
Workflow: `.github/workflows/highcountry-hc-econ-01-l1.yml`.
Test cases cover qualified/certified type and policy constraints, shape, immutable catalogs, semantic mapping, aggregate caps, duplicate detection, tampering, outcome validation and stacked totals.
No global Foundry/Genesis/Integrated/Geth/Docs or Level 3 work is required for a pure Level 1 policy contract.

## Unfinished later roadmap work
HC-ECON-02 owns edition cap 420, independently verifiable random issuance and immutability. HC-ECON-03 owns building/function equipment compatibility. Deployment-sensitive live randomness remains in HC-ECON-TN. Do not claim these are delivered by HC-ECON-01.

# HC-ECON-01 — Universal Object Taxonomy and Modifier Framework

Scope: Level 1 ordinary HighCountry roadmap step. Implements the HC-ECON-00 E13 semantic classification and modifier-policy foundation, preserving item, placement, inventory, and chain authorities.

## Contracts
- `services/highcountry-economy/src/object-taxonomy.js` defines qualified exact-shaped, versioned types with roles, decorated/functional status, and HC-PLACE-02-compatible surfaces/layers.
- Eligible effects derive from immutable server-maintained role definitions, not arbitrary creator submissions.
- Validated modifier policies pin unique type, ID and revision, permitted effects, positive integer weights, exact minimum/maximum basis points, maximum simultaneous benefits and worst-case aggregate per-item cap. Ordinary creator-made and 420Corp developer-made assets are hard-capped at **500 basis points (5%)**. Creator random-policy ranges are required to have a **2–3% aggregate midpoint target** (the actual distribution and mean must be verified in HC-ECON-02). Developer policies contain only fixed min=max values with all defined effects applied and cannot stack duplicate developer effect types. Quest-issued policies may exceed 500bps under distinct quest authorization. Ordinary stacking caps are 500bps per role.
- Catalogs sort deterministically, bind SHA-256 and are revalidated on lookup; caller mutations or unqualified types/policies fail closed.
- Creator outcome reveal is denied until a finalized purchase and authorized issuer are asserted by the calling authoritative service. This helper does not authenticate caller assertions; signed settlement evidence and unbiased post-payment draws remain mandatory HC-ECON-02 acceptance. Outcome validation is **bounds only**, not a random draw/proof. Neither user nor developer chooses outcomes here: HC-ECON-02 must implement verifiable entropy selection, one-time edition issuance, permanent burn accounting and proof verification. HC-ECON-03 owns actual building compatibility and placement-based application.

## Security and implementation boundaries
Pure, server-side policy functions only. No deployed HTTP endpoints, new issuer roles, live transfers, BUDS/$420 settlement, genome price logic, or database migrations. A `qualified` field is authoritative service input, **not** authorization to publish. Reviews and publication require the later signed-certification contract. No invocation of client RNG, HC-SEED pack pools or mock-verifier acceptance.

## Qualification
Level 1 targeted command: `node --test services/highcountry-economy/test/object-taxonomy.test.js`.
Workflow: `.github/workflows/highcountry-hc-econ-01-l1.yml`.
Test cases cover qualified/certified type and policy constraints, shape, immutable catalogs, semantic mapping, aggregate caps, duplicate detection, tampering, outcome validation and stacked totals.
No global Foundry/Genesis/Integrated/Geth/Docs or Level 3 work is required for a pure Level 1 policy contract.

## Unfinished later roadmap work
HC-ECON-02 owns edition cap 420, independently verifiable random issuance and immutability. HC-ECON-03 owns building/function equipment compatibility. Deployment-sensitive live randomness remains in HC-ECON-TN. Do not claim these are delivered by HC-ECON-01.

## Revised canonical modifier limits (2026-10-29)
* Marketplace user-built objects: independently verifiable, post-purchase random modifier values, no more than 5%; aggregate policy midpoint target 2–3%, with an unbiased actual expected value to be proven at issuance integration.
* Ready-made developer/420Corp objects or buildings: same fixed locked modifier per SKU, at most 5%, no duplicate developer-effect stacking; no random rerolls.
* Quest-issued rewards: separately authorized type/policy may exceed 5%, with no permission to relabel a marketplace item as a quest reward. The quest-specific application cap and gameplay effect integration must be completed with HC-ECON-03.
* A client-provided purchase-finalized Boolean is not proof of settlement. The final reveal gate must verify the canonical authoritative payment receipt in HC-ECON-02; never activate this standalone pure helper as a public API.

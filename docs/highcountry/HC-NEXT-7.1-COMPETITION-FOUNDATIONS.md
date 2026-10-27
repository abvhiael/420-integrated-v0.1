# HC-NEXT-7.1 — Competition foundations

## Canonical contracts and authority

Continue the R04.12 SeasonRegistry, CompetitionTemplateRegistry and CompetitionEngine rather than introducing a competing competition ledger.

- **Seasons**: immutable identity, future opening/closing time, nonzero rules commitment and season authority. The authority can cancel before the season begins; completed seasons are not rewritten.
- **Categories and policy revisions**: template identity commits to nonzero rules hash, version and optional eligibility scope. A category may have multiple immutable revisions, each at a fresh template ID, recorded by `categoryVersionTemplate`. Reusing category/version is forbidden. Historical competitions retain their exact template ID.
- **Registration**: season authority alone creates event windows bounded by season times. Each entrant self-registers once, within opening and closing, maximum 128, and optional scoped entitlements are checked without introducing paid scoring multipliers. Base template events require no optional entitlement.
- **Scoring**: one distinct canonical FLOWER harvest per player per event; score = verified quality in basis points, 0–10,000. Harvest finalization must occur at/after event opening and before submission. Finality verifier must attest exact harvest ID, participant, score and timestamp.
- **Evidence and anti-cheat**: reject fabricated evidence, future or pre-event timestamps, duplicate submissions, duplicate harvest IDs within an event, unentitled submissions, late entries and replayed finalization. Independent adjudicator can reject evidence during challenge period. At finalization, every candidate is reverified against canonical evidence and current optional entitlements to fail closed on revocation or reorganization.
- **Results**: finalize once after challenge deadline; highest quality wins. Deterministic ties: earliest harvest finalized timestamp, then numerically smaller canonical harvest ID. No valid entries produce zero-address winner. No reward transfer, prize funding, minting or cross-game issuance is implied.

## Trust and remaining integration boundaries

Production deployment must bind canonical evidence and optional entitlement adapters to separately qualified authority addresses. The `verifiedFlower` adapter contract alone cannot demonstrate provenance, finality or anti-sybil policy. Category revision hashes must reference published, independently reviewed scoring policy. Base identity is an address in the current Solidity API, not an anonymous browser session. Cross-event reuse of a single harvest is **not prohibited** by this foundation and must be explicitly resolved in a later tournament policy if needed.

Level 1: exact-head Foundry compilation, scoped static lint and R04.12 adversarial/unit regression tests, including immutable category versions and pre-event evidence denial. Level 2: production-equivalent harvest verifier, game registration client, indexer/reorg handling and entitlement integration before claiming complete competition feature delivery. Level 3: release reconciliation only at High Country phase closeout. Unrelated global CI must not be rerun for this step.

# EXP-2.2 — Explorer HTTP/API route-contract qualification

## Objective

Qualify the repository HTTP/API contract for the core 420Explorer service layer without expanding Explorer into an independent canonical data source.

## Qualified contract

EXP-2.2 owns the HTTP boundary for status/readiness, block list/detail/trace, transaction/receipt detail, Registry service/version access, and the surrounding validation/provenance behavior.

The capability document must advertise the complete registered API route set. Block-list pagination is bounded to 1–250 at the Explorer boundary. Unknown or unsupported `/v1` requests must fail as JSON API requests and must never fall through to the SPA handler.

## Qualification gate

The dedicated workflow verifies the exact checkout SHA, runs representative and negative API/service tests, runs the full Explorer regression suite and vet, executes the fail-closed milestone verifier, and uploads the EXP-2.2 evidence artifact.

## Scope boundary

This milestone does not claim live testnet deployment, Registry runtime/code-hash authority, deployed frontend workflow qualification, or Genesis readiness. Those remain later EXP milestones.

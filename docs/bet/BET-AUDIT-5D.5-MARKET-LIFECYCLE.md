# 420Bet 5D.5 — Market suspension, closure and event cancellations

## Discovery and scope

Based on the repository's current market and event registries, existing authenticated transitions are the source of truth. Market `suspend` (OPEN/APPROVED), `resume` (SUSPENDED + readiness), and `close` (terminal) advance the quote epoch. Event `setStatus` authenticates scheduling transitions, including POSTPONED, CANCELLED and ABANDONED; source epochs and health invalidate pricing. Funding always evaluates current eligibility, digest and epoch. No new operator override for tickets was introduced.

## Implementation and unchanged protections

`SportsFundedTickets420` now rejects winner/loser settlement after a CANCELLED, POSTPONED or ABANDONED event, even if a result has been certified. Anyone may invoke a **stake-only** ticket refund once the linked event is officially POSTPONED, CANCELLED or ABANDONED. The existing certified VOID and refund-timeout paths remain. Refunds preserve the immutable player payee, atomically decrement open stake and reserved operator-profit exposure, and forbid double closure. Suspension and terminal market closure reject new admission while leaving already-funded ticket credits and controlled refund paths intact.

## Qualification ownership

Level 1: `.github/workflows/420bet-sports-5d5.yml` runs `SportsMarketLifecycle420Test`, inheriting all 5D.4 acceptance, funded ticket and lifecycle assertions. Tests exercise state authority, quote epoch invalidation, suspended/resumed stale prices, canceled and postponed admission rejection, abandoned event refunds, closure terminality, refund conservation, unauthorized transitions and duplicate refunds. `contracts-foundry.yml` classifies pure 5D.5 changes so global shards do not run.

## Known limitations and external dependencies

Canonical roadmap wording and its exact independent exit matrix were not located by accessible code search. This audit note records verified existing contract behavior and additive protections; do not infer that additional unpublished roadmap requirements are waived.

Operational event-source finality, real provider incidents, revised/postponed schedules, adjudication processes, multi-organization independence, regulated wagering requirements and active testnet verification remain mandated in `docs/bet/BET-5D4-TESTNET-ROADMAP.md`. Pre-testnet unit tests cannot certify those operational facts. Never authorize live wagering solely from this milestone.

# Original Sixteen — archive discovery service and sixteen canonical journeys

**Owner decision:** permanent; free to complete; four historically grounded, event-driven discoveries per founder; one final revelation per founder; master reward after all 16. The canonical journey map is `deployments/highcountry/original-sixteen-discovery-journeys.v1.json`. Its 16×4 objective IDs, specific locations, trusted gameplay event types and accessible alternate research route are part of the V1 game specification. Exact historical fragment titles and revelation names are sourced from the approved original-sixteen archive file.

## How to play
Each founder's public card provides region and clue; getting a seed packet opens more history but is not a mandatory paid gate. Players can physically investigate the first designated landmark, use the region's public archival record, finish a legitimate preservation/restoration milestone, and reconstruct a source clue at the final site. If a player cannot access that activity, the corresponding public archive research objective provides an accessible and repeatable alternative. The four fragments can unlock in any order. The trusted server awards the final revelation automatically on the fourth distinct fragment.

Final reward per founder: full story, cosmetic Archive Edition seed packet, nontransferable Founder Seal, museum exhibit entry. Master reward: **Keeper of the Original Sixteen** title, **MASTER_FOUNDER_SEAL**, **ORIGINAL_SIXTEEN_MUSEUM_EXHIBITION**. No $420 fee, purchases, potency/yield bonus, or genetic modification.

## Implementation and safety gates
`ArchiveDiscoveryService` is executable domain logic, keyed by verified objective IDs, with replay rejection and DB-transaction-protected once-only award methods. The reference PostgreSQL migration adds event, fragment and entitlement uniqueness. **A deployed service is not yet assembled**: integration requires a live PostgreSQL transaction adapter with concurrency-safe unique event claiming; signed trusted event-issuer adapters from exploration/archives/preservation; scoped backend auth and secure player identity; server API; game user interface and museum, collection and cosmetics entitlement consumers; operational monitoring, recovery and negative end-to-end tests. Direct client event claims must always be rejected. No wallet or testnet is necessary for those integrations.

Run only High Country Archive Discovery Level 1 checks on affected changes. This step is not a Level 2 milestone, Level 3 phase closeout or testnet acceptance.

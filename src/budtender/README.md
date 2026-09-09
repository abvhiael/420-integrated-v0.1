# Budtender Simulation Core

`BudtenderStore.ts` is the BUD-1 deterministic gameplay-domain core. It intentionally contains no rendering, wallet, chain, account, or live-ops dependencies.

The mobile/UI layer should treat it as authoritative for starter-store state transitions while BUD-1 is developed. Later phases may wrap or split this module as customer AI, staff automation, persistence, districts, and shared 420GameIdentity are introduced.

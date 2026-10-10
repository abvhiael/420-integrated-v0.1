# High Country HC-6 — Cultivation Simulation

HC-6 closes the first persistent plant-simulation layer on top of HC-3 land and HC-4/HC-5 genetics.

## Plant lifecycle

`PlantRegistry` keeps active plants non-transferable and bound to an immutable genome, grower, canonical land parcel, and canonical region. Lifecycle progression is forward-only:

1. germination — 1 day
2. seedling — 2 days
3. vegetative — 7 days
4. flowering — 7 days
5. ready
6. terminated

`syncOfflineGrowth()` deterministically catches a plant up after player absence while retaining canonical stage-boundary timestamps. Source-backed registration requires an owner-approved eligible seed/clone. Private admission requires the grower to be the parcel's effective operator; public admission requires the grower's plot allocation. Reservations plus private plants cannot exceed parcel growCapacity. Legacy source-less methods fail closed. Termination releases capacity once without restoring the resource. See docs/highcountry/R02.4-PLANT-SOURCE-CONSUMPTION.md for constructor/binding/grant/approval instructions.

## Environment model

`CultivationEngine` records six dimensions:

- temperature, represented as centi-degrees Celsius and bounded to 10.00–40.00 °C
- humidity, normalized 0–10,000
- light, normalized 0–10,000
- water, normalized 0–10,000
- nutrients, normalized 0–10,000
- airflow, normalized 0–10,000

Accepted environments deterministically derive `stressBps` and `qualityBps`. Both are bounded to 0–10,000 and always conserve `stressBps + qualityBps == 10,000`. Stress is the mean normalized deviation outside the V1 ideal band for each dimension; conditions inside an ideal band contribute zero stress.

Phenotype expression verifies the supplied genome equals the canonical plant genome, then seals the genome ID, ruleset ID, six-dimensional environment, stress score, and quality score into one immutable expression hash. After expression, environment mutation and phenotype rerolling are denied.

## HC-6 invariants

- `HC-INV-CULTIVATION-016`: plant identity, genome, land/region binding and forward lifecycle do not regress, and active plants never exceed parcel grow capacity.
- `HC-INV-CULTIVATION-017`: once phenotype expression is sealed, the expression hash, environment snapshot, stress, and quality remain immutable.
- `HC-INV-CULTIVATION-018`: accepted environment values remain inside canonical bounds; stress and quality remain individually bounded and always sum to 10,000.

## Phase boundary

HC-6 owns active plant lifecycle, offline growth, environmental state, deterministic stress/quality derivation, and phenotype sealing. HC-4 owns seed/clone/mother records; R02.4 connects source consumption to HC-6 admission. Harvest resolution and product grading belong to HC-7, with downstream economic objects in later phases.

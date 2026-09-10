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

`syncOfflineGrowth()` deterministically catches a plant up after player absence while retaining canonical stage-boundary timestamps. Registration requires the grower to be the parcel's effective operator and cannot exceed the parcel's `growCapacity`.

## Environment model

`CultivationEngine` records six dimensions:

- temperature, represented as centi-degrees Celsius and bounded to 10.00–40.00 °C
- humidity, normalized 0–10,000
- light, normalized 0–10,000
- water, normalized 0–10,000
- nutrients, normalized 0–10,000
- airflow, normalized 0–10,000

Accepted environments deterministically derive `stressBps` and `qualityBps`. Both are bounded to 0–10,000 and always conserve `stressBps + qualityBps == 10,000`. Stress is the mean normalized deviation outside the V1 ideal band for each dimension; conditions inside an ideal band contribute zero stress.

Phenotype expression seals the genome ID, ruleset ID, six-dimensional environment, stress score, and quality score into one immutable expression hash. After expression, environment mutation and phenotype rerolling are denied.

## HC-6 invariants

- `HC-INV-CULTIVATION-016`: plant identity, genome, land/region binding and forward lifecycle do not regress, and active plants never exceed parcel grow capacity.
- `HC-INV-CULTIVATION-017`: once phenotype expression is sealed, the expression hash, environment snapshot, stress, and quality remain immutable.
- `HC-INV-CULTIVATION-018`: accepted environment values remain inside canonical bounds; stress and quality remain individually bounded and always sum to 10,000.

## Phase boundary

HC-6 owns active plant lifecycle, offline growth, environmental state, deterministic stress/quality derivation, and phenotype sealing. Harvest resolution, product grading, seeds/clones/mothers and downstream economic objects belong to HC-7 and later phases.

# Analytics concepts

## Metric definition
Every published metric should define its source domain, unit, filters, aggregation function, time/block window and finality policy.

## Derived state
Analytics output can be rebuilt from qualified public source data. Deleting a dashboard database must not alter chain/protocol state.

## Windows
Time-based and block-based windows are different. Implementations should document which is used and how boundary timestamps are handled.

## Finality
Head-based metrics are freshest but reorg-sensitive. Safe/finalized metrics trade freshness for stronger stability.

## Reproducibility
A metric should be reproducible from the documented source version and rule set. Changes to formulas should be versioned rather than silently rewriting meaning.

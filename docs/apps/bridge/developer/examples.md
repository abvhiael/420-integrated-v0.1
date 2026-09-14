# Bridge integration examples

A safe inbound flow is: resolve chain/asset/route → verify source-network identity/finality → submit proof through the approved adapter → recheck local route/risk/replay state → follow canonical transfer lifecycle → wait for completed/finalized destination state.

For user interfaces, always display the exact external network and canonical local asset representation, not only ticker symbols.

# Token events and finality

Template lifecycle and factory deployment events follow canonical chain history. Consumers must reconcile pre-finality reorgs.

Only surface a deployment as durable after the application's required finality threshold; provenance should remain tied to the canonical deployment transaction and contract address.

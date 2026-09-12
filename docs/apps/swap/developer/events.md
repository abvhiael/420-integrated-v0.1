# Swap events and finality

Trade/swap events follow canonical chain history. Consumers must distinguish observed, safe and finalized states as appropriate and reconcile pre-finality reorgs.

Deduplicate using canonical transaction/log identity rather than presentation-layer request IDs alone.

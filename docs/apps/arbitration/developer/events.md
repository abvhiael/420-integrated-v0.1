# Arbitration events and finality

Case opening, evidence commitments, rulings, appeals and finalization are canonical state transitions. Indexed clients must preserve round history and reconcile reorgs.

A case marked `FINALIZED` in execution state still requires the consuming protocol's normal chain-finality policy before irreversible action.
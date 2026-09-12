# 420 Stake events and finality

Validator registration, collateral/lifecycle changes, exits and reward accounting produce canonical events/state transitions. Indexed consumers must reconcile reorgs and distinguish head observations from finalized state.

A pre-finality lifecycle transition should not be treated as irreversible.
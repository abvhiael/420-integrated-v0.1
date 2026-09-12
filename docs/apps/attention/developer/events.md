# 420 Attention events and finality

Consent updates, campaign lifecycle changes, proof commitments, reward reservations/claims and sponsor funding/refunds produce canonical events.

Indexed consumers must preserve block/finality context and reconcile reorgs. A pre-finality reward observation should not be treated as irreversible unless the application intentionally accepts that risk.
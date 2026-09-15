# Identity events and finality

Profile updates, controller transfers, issuer changes, issuance, revocation and rejection are on-chain lifecycle events. Indexed consumers must preserve canonicality/finality context and reconcile reorgs.

A pre-finality credential issuance should not be treated as irreversible unless the application deliberately accepts that risk.
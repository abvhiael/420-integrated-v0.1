# Bridge events and finality

Bridge events follow canonical local-chain history while also depending on source-network finality/proof rules. Consumers must model both domains.

Do not mark a transfer completed from an early source observation. Reconcile reorgs and only surface irreversible completion when the canonical bridge lifecycle says so.

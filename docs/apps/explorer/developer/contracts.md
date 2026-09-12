# Explorer contracts

420 Explorer requires no Explorer-specific Genesis contract. Its contract relationships are observational: execution contracts and canonical protocol contracts produce state/events; Registry supplies service/version context; 420Indexer projects that information.

A developer must never infer authority from an Explorer-owned address because the Genesis profile intentionally has no such canonical contract.

Use canonical deployment/Registry data when a contract identity matters. Generated ABI and deployment reference belongs in DOC-10.

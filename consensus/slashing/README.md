# Slashing protection

The durable protector binds history to chain/genesis, validator identity and BLS
public key. It rejects double proposals, double targets/slots, both surround
relations and conflicting recovery records. Missing, corrupt, replaced or
ambiguous journals fail closed. Exclusive locks and file/directory fsync preserve
protection across restart. Volatile protectors are test-only for production
signing purposes.

The production [signing boundary](../signing/README.md) adds local and remote
protection, typed domain/context roots, authenticated isolated key custody and
an independent complete-history witness. That witness is required to detect an
integrity-valid offline journal rollback; a local checksum cannot do so alone.
`Snapshot` and explicit `RestoreWitnessHistory` preserve and semantically verify
all prior records. Normal startup never initializes or resets history.

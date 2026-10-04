# 420 Arbitration threat model

## Protected assets and authority

420Arbitration protects the integrity of dispute identity, policy snapshots, evidence commitments, resolver authority, ruling history, appeal bounds and finalization. It intentionally does not custody funds or directly execute remedies in external protocols.

## Primary threats

### Governance policy substitution
Risk: governance changes a domain resolver or deadlines after a case opens and attempts to apply the new policy retroactively.

Mitigation: the case registry snapshots resolver, appeal resolver, evidence window, appeal window and appeal cap at case creation.

### Resolver impersonation
Risk: an unauthorized account submits a ruling.

Mitigation: the ruling registry derives the selected resolver from the current case round and rejects every other caller.

### Evidence replay or log spam
Risk: the same evidence commitment is repeatedly submitted to create ambiguous duplicate history.

Mitigation: evidence is bound to case and round, must be nonzero, must come from a party during the evidence window, and duplicate commitments in the same case/round are rejected.

### Remedy ambiguity
Risk: a case or ruling omits the remedy commitment even though the canonical invariants require one.

Mitigation: case opening requires a nonzero requested-remedy commitment and ruling submission requires a nonzero remedy commitment.

### Appeal abuse
Risk: unbounded or unauthorized appeals prevent terminal resolution.

Mitigation: only parties may appeal, only during the appeal window, and the snapshotted appeal cap is bounded to at most three.

### Premature finalization
Risk: a ruling becomes terminal before appeal rights expire.

Mitigation: finalization is rejected until the appeal deadline is strictly past.

### Cross-domain authority escalation
Risk: a valid ruling is treated as authorization to move assets, rewrite Rights, slash validators, reverse bridges or override governance.

Mitigation: Arbitration records commitments only. Every consuming protocol must independently verify domain/origin/finality/replay and apply its own authorization and accounting rules.

### Off-chain evidence disclosure
Risk: private evidence is leaked by a frontend, evidence host, resolver or diagnostic process.

Mitigation: only commitments belong on chain. Encryption, access control, retention and key management remain explicit off-chain responsibilities.

## Accepted design risks

- Governance controls future domain policy.
- A configured resolver can make an incorrect or malicious ruling within its assigned domain.
- Evidence availability is not guaranteed by an on-chain hash.
- Arbitration finality is distinct from consensus finality.
- Origin protocols may choose whether and how to consume finalized rulings.

## Unresolved release risks

- no canonical Registry-resolved Arbitration service endpoint/address authority is defined;
- no production-equivalent testnet deployment evidence exists;
- no live resolver key-custody/rotation operating procedure is qualified;
- no independent external security review is retained for a production release.

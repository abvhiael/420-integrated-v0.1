# Arbitration contracts

Primary protocol surfaces include the arbitration policy registry, case registry, ruling registry and the read-only `ArbitrationRouter420` discovery/read endpoint used by 420Arbitration.

`ArbitrationCaseRegistry420` exposes purpose-specific ruling-submission and finalization context reads so `ArbitrationRulingRegistry420` consumes only the canonical fields required by each transition. The complete case record remains available through `getCase`.

Generated ABI/NatSpec belongs in DOC-10; this manual documents snapshot, resolver, appeal, finality and remedy-consumption semantics.

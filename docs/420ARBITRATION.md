# 420Arbitration — Genesis Profile

420Arbitration is the shared dispute-resolution coordination protocol for 420 Integrated. It provides domain-scoped case creation, evidence commitments, explicit resolver binding, rulings, bounded appeals and finality while leaving custody and remedy execution with the protocol that owns the disputed state.

A case permanently binds the parties, arbitration domain, originating component/object, claim commitment and requested-remedy commitment. The active domain policy is snapshotted when the case opens, preventing later policy changes from silently replacing the resolver or appeal terms for an existing dispute.

Evidence is commitment-based. Private evidence may remain in an external encrypted or content-addressed store; committing a hash on chain does not authorize disclosure. Each round has exactly one authorized resolver and accepts at most one ruling. Rulings commit the outcome, reasoning record, remedy and optional panel transcript/selection proof. Appeals are time-bounded and capped.

420Arbitration intentionally has no custody or blanket enforcement path. It cannot seize assets, reverse payments, rewrite Rights records, slash validators, unwind bridges or override Civic governance. A protocol such as 420 Market, 420 Rights, 420 Grants or ComputeMarket may consume a finalized ruling only through a separately implemented, explicitly authorized domain transition.

The resulting case history is auditable and reconstructable from chain state and events while frontends, evidence hosts and indexes remain replaceable non-canonical infrastructure.

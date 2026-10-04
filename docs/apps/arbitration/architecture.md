# 420 Arbitration architecture

Governance configures domain policy; the case registry binds parties, origin, policy snapshot, rounds and deadlines; the ruling registry accepts exactly one ruling per round from the selected resolver; the originating protocol optionally consumes a finalized ruling through its own bounded transition.

`ArbitrationRouter420` is the canonical read/discovery endpoint published for `420/service/arbitration/v1`. It is Registry-resolved with no fixed Genesis address. Its immutable dependencies are the exact policy, case and ruling registries, and its constructor rejects an inconsistent dependency graph. The router aggregates canonical reads only; state-changing authority remains in the registries.

The canonical user-facing repository path is the Wallet-integrated Genesis application surface. The Wallet runtime must fail closed unless the Arbitration service, router, chain/version and all three registry code identities are verified. It may prepare and explain an Arbitration action but does not auto-sign, become a resolver, mutate governance policy, or execute an origin-protocol remedy.

Arbitration cannot directly seize funds, reverse Bridge transfers, rewrite Rights, slash validators, grant Wallet capabilities or override Governance.

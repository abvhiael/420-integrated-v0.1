# 420Automation architecture and trust boundary

420Automation is replaceable off-chain infrastructure that coordinates protocol-defined jobs. Its job is to observe bounded trigger conditions, determine whether a registered job is eligible for an execution attempt, and coordinate a worker transaction that remains constrained by the job and the target protocol.

## Trust boundary

A worker is not protocol authority. A worker may possess an operator key for its own transaction submission, but it never possesses a user's wallet key and never acts as the user. Contracts remain responsible for validating the caller, job identity, timing, replay state, value, arguments, permissions and resulting transition.

A trigger is evidence of possible eligibility, not permission. This rule applies equally to time, block, event, oracle and manual trigger classes.

For 420Oracle integration, an `AUTOMATION` feed is consumed only as a canonical trigger fact under the Oracle feed's configured freshness, epoch, quorum, confidence and risk rules. Even a successful Oracle read does not authorize an arbitrary target or call. The job and target protocol still determine what may happen.

## Execution-intent boundary

420Automation must not invent execution intent. A qualified job definition must eventually bind, directly or through a deterministic template:

- chain/domain;
- target contract;
- callable selector or bounded call template;
- allowed native value/gas budget;
- trigger policy;
- replay/idempotency domain;
- owner/protocol authority and revision;
- enable/disable state.

Workers may materialize deterministic dynamic fields that a job specification explicitly permits, but may not expand the authority of the registered envelope.

## Separation from other trust domains

- **420RPC:** Automation may submit public transactions and perform reads through 420RPC, but RPC routing does not authorize a job.
- **420Oracle:** Oracle supplies qualified external facts; it does not execute jobs.
- **420Bridge:** bridge finality/proof semantics cannot be replaced by an automation trigger.
- **Wallet/Identity:** Automation does not custody or impersonate user credentials.
- **Consensus/Engine:** Automation never participates in fork choice or exposes private Engine API semantics.
- **420Gas/Paymaster:** future gas sponsorship may fund qualified execution, but sponsorship does not expand job authority.

## AUT-0 invariants

- **AUT-INFRA-001** — workers are replaceable off-chain infrastructure and never protocol authority.
- **AUT-INFRA-002** — all Automation operation is pinned to chain ID 420 unless a future explicitly versioned multi-chain design changes that rule.
- **AUT-INFRA-003** — triggers provide eligibility evidence only and never ambient execution authority.
- **AUT-INFRA-004** — workers never custody user keys or sign transactions as users.
- **AUT-INFRA-005** — workers cannot invent target, calldata or native value outside the registered job envelope.
- **AUT-INFRA-006** — target protocols retain authorization and state-transition authority.
- **AUT-INFRA-007** — Automation cannot define canonical chain state, safe/finalized checkpoints or fork choice.
- **AUT-INFRA-008** — an Oracle `AUTOMATION` result is not a remote-execution channel.
- **AUT-INFRA-009** — Automation evidence cannot substitute for bridge proofs or settlement rules.
- **AUT-INFRA-010** — private Engine API surfaces remain outside Automation.
- **AUT-INFRA-011** — failure of Automation may delay eligible jobs but must not halt consensus or redefine chain truth.
- **AUT-INFRA-012** — duplicate/retry/reorg behavior must fail safe and is explicitly hardened in later phases before testnet closeout.

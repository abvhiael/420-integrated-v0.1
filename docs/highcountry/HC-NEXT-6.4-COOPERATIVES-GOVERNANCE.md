# HC-NEXT-6.4 — Cooperatives and governance

## Authority and design
Reuses canonical R04.11 `CooperativeRegistry`, `CooperativeGovernance` and `GovernanceExecutor`. Cooperative enrollment is explicit per-wallet consent, contingent on current canonical organization membership. An enrolled voter can `withdraw` consent. The historic roster is append-only and limited to 64 *distinct lifetime enrollments*; withdrawn addresses cannot enroll again without a separately reviewed migration and cannot cast further votes. A roster snapshot includes only members with current consent and active organization membership.

Proposals freeze the eligible electorate, use one address/one vote, strict majority quorum, three-day voting and a two-day execution timelock. The proposer can cancel while voting. Current enrollment and active organization membership are required when voting. The proposer must retain cooperative consent and organization membership for execution. Existing votes remain historical records when a member withdraws; they are not retrospectively deleted. At execution, an additional live tally of the frozen eligible roster excludes withdrawn or no-longer-active voters, and the remaining affirmative votes must independently meet the frozen quorum and defeat opposition. Revoked consent never supplies an executable majority. No arbitrary executable target calls are allowed.

### Treasury is independently authoritative
The governance executor can **only** write scoped, inert policy metadata. It cannot transfer money, grant token approvals, sign wallets, move property rights or call external treasury contracts. `OrganizationTreasuryPermissions` is an approval record, not a transfer receipt. Any actual movement of funds requires a separately authenticated canonical Treasury transaction, independently executed, settled and proven by the canonical ledger. Even successful policy execution proves **no payment**.

### Emergency intervention
R04 EmergencyState controls the cooperative-governance domain. Restricted status blocks new co-op creation/enrollment/proposals/votes and executions, and `executable` fails closed. Removing the restriction resumes only operations still valid under their unchanged deadlines, membership and approvals; emergency intervention does not rewrite voting evidence or create settlement.

### Qualification boundaries
Level 1: exact-head Foundry compile, formatting, lint, existing R04.11 security tests plus new withdrawal/replay/execute-denial tests. Level 2: affected organization + integration interfaces, no unbounded global requalification for an ordinary step. Production indexers, real Treasury ledgers, actual fund movement, statutory cooperative recognition and operational signers remain distinct testnet gates. Level 3 only at phase closeout.

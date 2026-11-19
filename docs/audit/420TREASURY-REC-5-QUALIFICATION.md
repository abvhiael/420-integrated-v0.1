# TREASURY-REC-5 — Governance and capability authorization

Status: **IMPLEMENTATION CANDIDATE — exact-head qualification pending**. Baseline main: `acc737d60b5e13858b34847c7dfd3a903233d65c` (REC-4 merged).

## Corrected authority boundary

CivicGovernor previously invoked governed targets directly, so after activation SystemAccess's Timelock-only Treasury writes failed despite a passed and matured proposal. The bootstrap-only integration did not exercise that path. GovernanceTimelock now dispatches the exact Governor-verified action from an active mature operation; only the activated scheduler may request that dispatch. The context is suspended during target calls to reject nested/borrowed contexts and the Governor checks the operation ID. Existing class delays, exact batch commitments, once-only execution, atomic rollback, frozen addresses, immutable bootstrap retirement, and no Civic cancellation/emergency override remain intact. All governed targets retain Timelock caller identity, including the CapabilityRegistry registrar/component authority where bound to Timelock.

No Treasury, Vault or CapabilityRegistry write-path permissions or ID preimages are widened. The separate adopted direct-executor commitment-only trust boundary remains unchanged. The exact per-disbursement grant is one-shot by Treasury lifecycle; period capacity is checked by the registry and not consumed a second time by Treasury. Grant revocation and governed disbursement cancellation are distinct from Civic proposal cancellation. No new emergency authority is introduced.

## Executable qualification

`contracts/test/TreasuryGovernanceAuthorization420.t.sol` uses the real Timelock, Civic Governor, Merkle electorate, voting, proposal registry, CapabilityRegistry and Treasury contracts. It exercises actual proposal voting, queue and delayed execution (no mocked positive Timelock calls), policy/budget/controller/scheduling/cancellation, exact authorization tuples and limits, expiry/revocation, malformed or reverting registry calls, unchanged accounting on denial, emergency containment, retired bootstrap powers, batch rollback and nested delay bypass rejection. The two fault cases deliberately inject registry response failures using Foundry cheatcodes; no fabricated successful authorization is used.

`.github/workflows/treasury-governance-authorization.yml` compiles the exact import closure; rematerializes Governance artifacts using the retained GOV-AUDIT-6 generator and checks the committed artifacts and scoped executable regressions at the final PR head. Historic GOV-AUDIT-6 hashes remain historical, not evidence for the new runtime. The predeploy addresses and constructor inputs are unchanged. No public deployment is claimed.

Final implementation SHA, exact-head workflow result and test counts must be retained before REC-5 may be marked complete. No merge is authorized by this assignment.

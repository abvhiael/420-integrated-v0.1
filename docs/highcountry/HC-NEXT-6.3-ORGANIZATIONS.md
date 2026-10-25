# HC-NEXT-6.3 — Organizations

## Canonical implementation

The chain's sole authoritative organization register is `contracts/src/highcountry/organization/OrganizationRegistry.sol`. `OrganizationAuthority` remains the sole bounded nonfinancial delegation issuer; `OrganizationTreasuryPermissions` separately requires a financial approver and an authorized treasury adapter. This step deliberately does not create a competing off-chain membership or financial authorization registry.

### Lifecycle and consent

1. Create a unique organization with its creator as the active founding administrator; metadata is content-addressed, not proof of legal incorporation.
2. A current administrator explicitly invites a nonadministrator wallet; each invitation lasts seven days. A revoked or expired invitation cannot be consumed; an old invitation is destroyed upon joining, departure or removal. New join requires direct consent from the invited address, no unsettled obligations and a fresh active invitation.
3. Member departure and administrative removal immediately end active delegated access. Outstanding obligation counters move the user into a Leaving state; final exit requires independently attested bilateral accounting and cannot transfer or forgive treasury assets. All underlying canonical contract authorities still apply.
4. Only the current administrator may propose an **active and obligation-free** successor. An invitation is not leadership. The nominated successor must expressly call `acceptAdmin` within two days while remaining active and obligation-free, and the current administrator must have no recorded pending obligations. Expiration, removal, a wrong sender or an emergency governance restriction fails closed. The previous unilateral `transferAdmin` entry point is permanently rejected rather than silently upgrading someone else's identity.
5. Succession immediately invalidates old administrator-issued organization delegations and treasury proposals because their issuer no longer equals the current administrator. A new leader can issue only allowed bounded permissions; administrative control confers no implicit property/lease, wallet, identity, cash, legal corporation or protocol rights.

### Delegated roles

General org delegation remains bounded to CULTIVATION, ROSTER and NOTICES with explicit delegate, action, scope, time window, nonce, use counter and unilateral revocation. Delegates must be active members; their own calls consume their grants. Wallet, treasury and property actions are ineligible and must be authorized by their respective canonical owners. Governance emergency restrictions prohibit issuing and consuming grants.

### Acceptance and deployment gates

Level 1: targeted Foundry R04.10 organization regression and new adversarial invitation/leadership tests; formatting, lint, deployed-size check and exact SHA. Level 2: retain the R04 application integration gate and separately review any consumer adopting the new two-step leadership transition. Phase Level 3 is single closeout, not repeated for this ordinary HC-NEXT step.

Production-equivalent acceptance additionally requires deployed-chain signer identities, event-indexer catch-up/finality, organization role UX, external accounting proofs and testnet signer rotation. Do not claim statutory incorporation, custody authority or external ecosystem licensing from game membership.

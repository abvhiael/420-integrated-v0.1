# Explorer permissions

420 Explorer's normal Genesis role is read-only and requires no reusable Wallet capability.

Explorer must not request spending authority, token approvals, Smart Account operators, session keys or recovery permissions simply to inspect public data. If a future feature links to a state-changing action, the transition must occur through the responsible application/Wallet flow with a fresh, explicit authorization review.

Browser permissions, cookies or local preferences are client concerns and do not become protocol authority.

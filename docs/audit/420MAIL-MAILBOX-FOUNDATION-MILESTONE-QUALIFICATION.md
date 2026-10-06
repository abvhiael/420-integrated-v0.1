# 420Mail Mailbox Foundation milestone qualification

Milestone: **MAIL-2.1 through MAIL-2.10 — Mailbox Foundation**  
Status: **COMPLETE**  
Qualification level: **Level 2 — retained 420Mail app integration**

## Qualified repository state

- Branch: `mail-2-1-mailbox-state-model-20261005`
- PR: **#530**
- Qualified implementation SHA: `a8b646134893a9c07a35e1cc998d8d397c449059`
- Exact tested PR merge candidate: `c5632c6`
- Tested current-main parent: `c32e5aeb0b0e79643dfdffbbee50096b5fbba1a7`
- Workflow run: **37422199872** (#176)
- Job: **112133813986** — PASS

## Milestone scope

The milestone retains and integrates:

1. MAIL-2.1 — Mailbox State Model
2. MAIL-2.2 — Durable Mail Storage
3. MAIL-2.3 — Labels & Custom Folders
4. MAIL-2.4 — Private Mail Search
5. MAIL-2.5 — User Filters & Rules Engine
6. MAIL-2.6 — Blocklists, Allowlists & Trust Controls
7. MAIL-2.7 — Spam, Junk & Phishing Protection
8. MAIL-2.8 — Threads & Conversations
9. MAIL-2.9 — Drafts System
10. MAIL-2.10 — Outbox & Delivery Queue

## Retained integration result

The final exact-head 420Mail workflow ran the complete Mail package tests, race detector, vet, and cumulative repository verifier after MAIL-2.10 was implemented.

All passed.

The verifier explicitly reported every milestone step MAIL-2.1 through MAIL-2.10 as qualified on that run. This is the retained app-integration boundary required by the canonical Phase 2 roadmap.

The milestone therefore does not require a duplicate second execution of the identical broad Mail suite on the identical implementation SHA. Such a rerun would add no coverage and would violate the phase policy's objective of avoiding redundant broad qualification.

## Integrated behaviors retained

The passing suite jointly covers mailbox lifecycle, durable transactional metadata and migrations, labels/custom folders, private search, rules, trust controls, spam/phishing quarantine, conversations/replies, optimistic multi-device drafts, and queued outbox delivery through the same canonical send pipeline.

MAIL-2.10 specifically proves the new queue converges into already-qualified recipient rules/trust/spam/conversation behavior rather than creating a parallel unqualified delivery path.

## Boundaries retained

The milestone does not:

- claim live Identity/Messenger/Storage/Notifications deployment evidence;
- claim public-testnet readiness;
- enable external SMTP;
- move body plaintext on-chain or into public search;
- add custodial/signing authority;
- promote 420Mail into the frozen Genesis catalog;
- substitute repository fixtures for later MAIL-AUDIT-7+ live evidence.

## Level 3

Level 3 remains deferred to the applicable complete Phase 2/release closeout. No unrelated global repository suite is required for this milestone.

## Result

**Mailbox Foundation milestone (MAIL-2.1–MAIL-2.10): COMPLETE — Level 2 PASS.**

Next canonical Phase 2 step: **MAIL-2.11 — Email-as-a-Wallet Onboarding**.

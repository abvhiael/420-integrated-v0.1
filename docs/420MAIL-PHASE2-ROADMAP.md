# 420Mail Phase 2 roadmap

Status: **REPOSITORY PHASE COMPLETE — remaining MAIL-2.37 through MAIL-2.40 handed off to testnet/Genesis/production roadmap**

This roadmap records the completed repository-side 420Mail Phase 2 work without changing canonical authority. MAIL-2.1 through MAIL-2.36 are repository-complete. Unfinished MAIL-2.37 through MAIL-2.40 are handed off to the canonical testnet work roadmap in `docs/ROADMAP.md`, aligned respectively with MAIL-AUDIT-7 through MAIL-AUDIT-10. This handoff does not claim live-testnet, Genesis, security/operations, or production completion.

## Qualification model

Ordinary MAIL-2 steps use app-scoped Level 1 qualification. Broader retained Mail integration qualification is reserved for meaningful milestones; comprehensive repository-wide Level 3 qualification is reserved for phase closeout. Exact-SHA evidence is authoritative.

## Ordered roadmap

1. **MAIL-2.1 — Mailbox State Model** — Add Inbox, Sent, Outbox, Drafts, Archive, Junk, Trash, permanent delete, restore from Trash, read/unread, starred, pinned, and muted state semantics. Define owner-scoped lifecycle transitions and timestamps without moving private message bodies on-chain. **Exit criteria:** delivered mail materializes recipient INBOX and sender SENT state; all system folders are defined; Archive/Junk/Trash transitions, Trash restore, permanent delete, read/unread, starred/pinned/muted state are authorization-safe and tested; Drafts/Outbox are reserved state classes for their later dedicated implementation steps rather than user-move targets; legacy inbox/read behavior remains compatible.
2. **MAIL-2.2 — Durable Mail Storage** — Replace in-memory mailbox/message metadata state with persistent transactional storage, indexes, migrations, restart recovery, and distributed idempotency.
3. **MAIL-2.3 — Labels & Custom Folders** — Add user-defined labels, custom organization, bulk assignment, and system labels.
4. **MAIL-2.4 — Private Mail Search** — Add private mailbox search without exposing private content to public 420Search.
5. **MAIL-2.5 — User Filters & Rules Engine** — Add sender/content/source conditions and automated mailbox actions.
6. **MAIL-2.6 — Blocklists, Allowlists & Trust Controls** — Add user-controlled blocked/trusted identities, phrases, applications, and mutes.
7. **MAIL-2.7 — Spam, Junk & Phishing Protection** — Add reputation, abuse, quarantine, and phishing defenses.
8. **MAIL-2.8 — Threads & Conversations** — Add replies, participant/thread views, thread archive/mute, and conversation ordering.
9. **MAIL-2.9 — Drafts System** — Add encrypted autosave/recovery/edit/discard and multi-device draft behavior.
10. **MAIL-2.10 — Outbox & Delivery Queue** — Add queued/sending/retrying/delivered/failed/cancelled delivery lifecycle.
11. **MAIL-2.11 — Email-as-a-Wallet Onboarding** — Add Google/Apple/passkey/existing-wallet onboarding without custodial signing authority.
12. **MAIL-2.12 — Passkey-First Security** — Add passkeys, device enrollment, recovery, session revocation, and security alerts.
13. **MAIL-2.13 — Wallet Functions Inside Mail** — Add non-custodial wallet-aware actions and verification handoffs.
14. **MAIL-2.14 — External Integrations Framework** — Add provider-neutral connector architecture.
15. **MAIL-2.15 — Discord Account Linking**
16. **MAIL-2.16 — Discord → 420Mail Sync**
17. **MAIL-2.17 — 420Mail → Discord Delivery**
18. **MAIL-2.18 — Discord Wallet Verification**
19. **MAIL-2.19 — Signal Integration Boundary**
20. **MAIL-2.20 — 420Mail → Signal Notifications**
21. **MAIL-2.21 — Signal Share & Forward**
22. **MAIL-2.22 — Signal Deep Sync** — conditional on a stable supported integration surface.
23. **MAIL-2.23 — Telegram Account Linking**
24. **MAIL-2.24 — Telegram → 420Mail Sync**
25. **MAIL-2.25 — 420Mail → Telegram Delivery**
26. **MAIL-2.26 — Unified Integrations Inbox**
27. **MAIL-2.27 — Cross-Platform Verified Identity**
28. **MAIL-2.28 — Integration-Specific Filters**
29. **MAIL-2.29 — Unified Notification Routing**
30. **MAIL-2.30 — Full Desktop Mail UI**
31. **MAIL-2.31 — Mail Settings Center**
32. **MAIL-2.32 — Connector Isolation**
33. **MAIL-2.33 — Encryption & Leakage Controls**
34. **MAIL-2.34 — Phishing & Impersonation Protection**
35. **MAIL-2.35 — Abuse Controls**
36. **MAIL-2.36 — Repository Qualification**
37. **MAIL-2.37 — Live Testnet Integration** — **HANDED OFF to `docs/ROADMAP.md` testnet work; not repository-complete.**
38. **MAIL-2.38 — Security & Operations Qualification** — **HANDED OFF to `docs/ROADMAP.md` testnet/operations work; not complete.**
39. **MAIL-2.39 — Genesis Catalog Decision** — **HANDED OFF to `docs/ROADMAP.md`; explicit catalog decision still required.**
40. **MAIL-2.40 — Production Release** — **HANDED OFF to `docs/ROADMAP.md`; production release remains gated.**

## Milestones

- **Mailbox foundation milestone:** MAIL-2.1 through MAIL-2.10 — **COMPLETE, Level 2 PASS** on qualified implementation SHA `a8b646134893a9c07a35e1cc998d8d397c449059`; durable evidence: `docs/audit/420MAIL-MAILBOX-FOUNDATION-MILESTONE-QUALIFICATION.md`.
- **Wallet-native identity milestone:** MAIL-2.11 through MAIL-2.14 — **COMPLETE, Level 2 PASS** on qualified implementation SHA `aa299b706ff2739e9e010f1140c435af3fdd0218`; durable evidence: `docs/audit/420MAIL-WALLET-NATIVE-IDENTITY-MILESTONE-QUALIFICATION.md`.
- **External bridge milestone:** MAIL-2.15 through MAIL-2.29 — **COMPLETE, Level 2 PASS** on exact tested PR merge-candidate SHA `7d9e4860a8d8c82283dc7bf6c19ba304106bcea5` (feature parent `07243b332b6e752475985878049bc84b9b5d952b`, tested `main` parent `d1e6dae8cf6cc8ea513ffaf26d1dbad6d3c7f0b4`); durable evidence: `docs/audit/420MAIL-EXTERNAL-BRIDGE-MILESTONE-QUALIFICATION.md`.
- **Product/security milestone:** MAIL-2.30 through MAIL-2.35.
- **Phase closeout:** MAIL-2.36 through MAIL-2.40, with Level 3 only at the applicable complete app-phase closeout.

## Current step

**MAIL-2.1 — Mailbox State Model** through **MAIL-2.36 — Repository Qualification** are COMPLETE at the applicable repository qualification levels. MAIL-2.22 remains a qualified conditional-gate outcome with Signal deep sync disabled because its prerequisite integration surface is unavailable. The **Mailbox Foundation**, **Wallet-native identity**, **External bridge**, and **Product/security** milestones are COMPLETE at Level 2. Repository qualification MAIL-2.36 passed on exact tested PR merge-candidate SHA `f0ab41aef75ca85421fb417529b6c188c3e92daa` before handoff. **MAIL-2.37 through MAIL-2.40 are intentionally unfinished and have been moved to the canonical testnet work roadmap in `docs/ROADMAP.md`.** No live-testnet, Genesis catalog, security/operations, production, or Level-3 completion is claimed by this repository handoff.


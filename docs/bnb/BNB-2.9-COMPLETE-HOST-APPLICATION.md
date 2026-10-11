# BNB-2.9 — Complete Host Application

**Canonical roadmap step:** Host dashboard, property administration, calendars, reservation management, earnings, notifications, delegated managers. **PR:** #600. Existing BNB-2.1/2.2/2.3/2.5/2.7/2.8 interfaces and security semantics remain authoritative.

## Implemented host operations

- `GET /v1/bnb/account/hosting`: signed Identity-scoped host workspace, showing owner properties and only current active grants with an authorized reservation/request capability; no cross-property or nonpublic private address disclosure.
- Property administration: existing version-controlled draft, unit, listing-policy, media, independent review and publication-gated operations remain in the host editor. Publication or verified ownership cannot be self-approved.
- Calendar: existing quantity-aware unit/property closures, multi-instance row locks, UTC range/DST validation and calendar-sync fail-closed semantics are retained; the host workspace shows existing closures. Delegated `edit_calendar` capability is now checked under the same property lock and version-CAS controls for draft closures, with current grants and immediate revocation, and prevents modifying another manager's closure. Ownership preserves full property authority.
- Reservation management: private property-scoped reservation list, request inbox, accept/decline decisions and existing booking-scoped host/guest messages. Authorized `handle_requests` managers may decide when the property remains published and under the original host, with fresh nonrevoked grant. **No guest can approve their own request even if delegated.** Host cannot self-issue Pay finality or inventory confirmation.
- Earnings: owner-only read model of frozen **420Pay** economic split and finalized/reserved host disbursement references, denominated in canonical asset units; no BnB wallet custody or payout instruction. Managers are explicitly excluded from this financial projection.
- Notifications: bounded authenticated property audit/activity feed, labeled `in_app_only`, not presented as proof of pushed, delivered or read external notifications.
- Delegated managers: independent verified-property owner grant/revoke boundary is retained, with fresh Identity session, allowed capability types, maximum 90-day expiry, no financial authority and immediate revocation. New owner-only grant visibility, responsive interface and capability-scoped host lists.

## Security and acceptance

Targeted PostgreSQL/API tests check owner/guest isolation, disabled anonymous endpoints, manager visibility, no financial permission, immediate revoke and expired-grant behavior, delegated calendar edits and version conflicts, and host-manager versus guest self-approval separation. Existing BnB runs cover inventory, Pay integration, quote/replay, app browser/axe, staging nonroot container, identity/recovery and claims.

**Explicitly withheld live acceptance:** independently authorized host/property claims, actual issuer operations and 420Pay/420Swap transfers, payout controller, canonical financial finality, truly delivered push/email/SMS notification integration, production-equivalent accessibility/operational security and deployment. These remain separate upstream/testnet gates, not locally mock-approved.

**Qualification:** Level 1 scoped BnB CI on exact implementation SHA; Level 2 only at a true host front/backend app convergence milestone with all retained app-specific checks on that SHA; Level 3 is deferred until complete BnB audit-phase reconciliation with current main. Canonical full Solidity inventory and Genesis authority must have separate workflow owners without duplicate Foundry.

## Final host capability and application reconciliation

The host workspace enumerates the current owner's properties and effective time-limited manager capabilities, dynamically showing only authorized operations. The owner can issue and revoke an independently verified property's scoped grants from the host interface. Manager access to reservation views, request decisions, calendar restrictions and listing presentation is checked server-side, not merely hidden in the browser. Delegated `edit_listing` changes only draft title/public region under version CAS; **rate plans, payouts, merchant controls, private addresses, approval and publication are never delegated**.

The calendar engine admits draft and published listing closures only while the listing is not suspended, using existing lock/CAS/quantity and occupancy checks. Delegated managers may edit their own blocks; the owner can manage any property block. Booking-request approval additionally enforces separation of duties so a guest who is also a current manager cannot approve their own request. The income view is owner-only 420Pay settlement evidence, not a local spendable balance. Audit notifications are bounded, in-app-only events; external delivery is intentionally not claimed.

**Scope of completion:** repository-side host application and BnB-specific qualification. Independent property licensing, external notification transport/delivery acknowledgement, live Pay merchant/payout authorization, human accessibility and production operational signoff are distinct testnet/external release gates. Level 3 remains deferred to the final full audit-phase merge candidate. Any later code/test/frontend/CI commit requires a new exact-SHA Level 1 pass.

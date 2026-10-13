# BNB-3.8 — Host experience Level 1 qualification ledger

**Status: PARTIAL / NOT YET CERTIFIED.** Canonical scope: `docs/bnb/BNB-PHASE3-ROADMAP.md` BNB-3.8: property, listing, calendar and reservation management, scoped managers, Pay-derived earnings, notifications, concurrent edits, revoked managers/controllers, cross-property isolation, stale state, browser accessibility, outage/recovery. This record does not approve testnet or property authority.

## Exact implementation

Candidate implementation SHA: `1c0b97dc9e589a8331f6012d5ed8c67a183fb767`.
PR #620 (draft, open, unmerged), branch `audit/bnb-phase3-infrastructure-20261012`.
Observed PR base SHA: `fa3ebf8bf70df341a91ad2efa701827ca2bea7e7` (not evidence that latest main has been reconciled; Level 3 is BNB-3.12).

Modified `web/bnb/index.html` host operations workspace and `services/420bnb/tests/browser_accessibility.py` browser fixture.
Host operations now independently report each restricted section's unavailable/revoked state when its provider fails or its access is rejected, rather than blanking every other authorized section. Server-side capability checks remain authoritative; no role expansion or payment signing. Playwright browser smoke deliberately makes notifications return 503 and checks that a warning appears while reservations and Pay-reported earnings still render.

## Preserved already-present implementation (requires current exact-SHA verification)

Existing API and UI expose private property/draft edits with optimistic `expected_version`, calendar restrictions and capacity protection, scoped manager grants/revocations, permission-filtered host dashboard, requests/reservations and Pay-derived read-only earnings and notifications. Existing adversarial PostgreSQL coverage includes authority boundaries, stale/version and concurrency scenarios; this patch does not modify API, schema, authority, frozen addresses or external finance.

## CI

- Exact-SHA `420BnB Runtime Slice` run: https://github.com/abvhiael/420-integrated-v0.1/actions/runs/38336722081 — **pending when this ledger was authored**, NOT PASS; must inspect full runtime/security, Playwright responsiveness and axe accessibility before certification.
- Retained BNB-1.1–1.9 app workflows were queued at evidence-authoring time. Obtain nine terminal successes on this implementation SHA; none may be assumed.
- `420Docs Qualification` was running automatically; broad/global qualification is not a per-step prerequisite. No duplicate Solidity/Genesis/Integrated jobs requested.
- M3-B Level 2 only after BNB-3.10; Level 3 after BNB-3.12. Independent property/controller/operations and accessibility/manual assistive-technology authority remain external testnet gates.

## Exit reconciliation still required

1. Verify all 9 retained BNB workflows and the complete runtime/browser job on this exact SHA.
2. Check negative authorization and cross-property delegated manager tests, concurrent calendar/presentation edits, stale version and controller revocation coverage against BNB-3.8 wording. Add coverage/implementation if any are missing.
3. Confirm browser host flows on mobile/desktop and keyboard and axe, error/outage recovery and Pay view isolation; manual assistive technology remains `T-BNB-ACCESSIBILITY-1`.
4. Record exact final implementation SHA and terminal workflow/job links and observed current main SHA, then mark BNB-3.8 complete only if all repository-side criteria hold.

**No claim of complete Level 1 certification is made by this document.** Next canonical step after passing BNB-3.8: **BNB-3.9 — Trust and safety**.

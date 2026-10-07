# 420Mail MAIL-2.30 Qualification

## Step

**MAIL-2.30 — Full Desktop Mail UI**

## Completion

- Status: **COMPLETE**
- Qualification level: **Level 1 — app-scoped step qualification**
- Qualified feature SHA: `aeb602f5e30ac4a0c9a02398e7e43c95e722e72e`
- Exact tested PR merge-candidate SHA: `b8ea56ad8ceed8d5f6d7acf2c8ec8860f05dbca8`
- Tested/current `main` parent: `7700caec39c6ef4212a433b493faa9876f3d7ece`
- Audit branch: `mail-2-11-email-wallet-onboarding-20261006`
- PR: #537

## Canonical definition

The canonical Phase 2 roadmap defines MAIL-2.30 as **Full Desktop Mail UI** and places it as the first step in the **Product/security milestone (MAIL-2.30 through MAIL-2.35)**.

The roadmap does not define a separate desktop backend or new authority. Repository truth therefore bounds MAIL-2.30 to a full desktop product surface over already-qualified Mail APIs.

## Gap analysis

Before this step, `mail/web/index.html` was a vertically stacked thin demonstration surface. It exposed selected capabilities but did not provide a desktop mail workspace with:

- persistent mailbox navigation;
- mailbox/smart-view switching;
- message list + reader split;
- qualified lifecycle controls in the reader;
- private search as a first-class desktop surface;
- labels/custom-folder navigation;
- conversations;
- Outbox operations;
- coherent desktop access to already-qualified onboarding/security/wallet/integration handoffs.

No backend authority gap was identified.

## Implementation summary

### `mail/web/index.html`

Replaced the thin page with a responsive desktop shell consisting of:

- top application/search bar;
- persistent navigation sidebar;
- three-pane desktop layout;
- mailbox and smart-view navigation;
- message list;
- reading pane;
- compose/draft dialog;
- integration, security, Wallet, and onboarding dialogs.

Qualified mailbox surfaces exposed:

- Inbox
- Sent
- Drafts
- Outbox
- Archive
- Junk
- Trash
- Unread
- Starred
- Conversations
- Integrations
- Labels
- Custom folders
- Private search

Reader actions expose already-qualified Mail transitions only:

- mark read / unread;
- star / unstar;
- archive;
- Junk;
- Trash;
- restore from Trash;
- permanent delete from Trash;
- reply composition;
- explicit Signal share / forward.

Draft autosave/recovery/discard and Outbox process/retry/cancel remain bound to their existing qualified APIs.

### `mail/web_ui_test.go`

Added app-scoped static UI regression coverage for:

- desktop layout landmarks;
- mailbox/view coverage;
- Mail endpoint coverage;
- reader lifecycle functions;
- responsive breakpoints;
- basic accessibility landmarks;
- inert private-body rendering.

### `config/420mail-service-v1.json`

Added explicit `desktopMailUI` contract describing:

- three-pane responsive layout;
- supported mailboxes and smart views;
- private search/labels/custom folders;
- draft/outbox lifecycle;
- allowed mailbox actions;
- inert body rendering;
- retained integration/security/Wallet surfaces;
- explicit MAIL-2.31 settings-center deferral;
- no new backend authority/public indexing/on-chain body storage.

### `docs/420MAIL.md`

Added MAIL-2.30 desktop architecture, behavior, privacy, lifecycle, and MAIL-2.31 boundary documentation.

### `scripts/verify-420mail-audit.py`

Extended the cumulative verifier with MAIL-2.30 config and UI invariants and explicit active-HTML-sink rejection for private message bodies.

## Exit criteria / invariants individually verified

### Desktop mail workspace

The UI now provides one coherent desktop workspace rather than disconnected vertical demonstration panels.

### Canonical mailbox lifecycle

The UI calls the existing authenticated owner-scoped Mail endpoints and does not create a parallel mailbox state model.

### Search and organization

Private search, labels, and custom folders use existing private Mail APIs. No public 420Search indexing is introduced.

### Drafts and Outbox

The existing optimistic draft version contract and qualified Outbox lifecycle remain authoritative.

The desktop UI does not bypass delivery state transitions.

### Private-body safety

Private message bodies remain rendered through:

`body.textContent=d.body`

Tests and the static verifier reject known active HTML sinks for the body.

### Authority boundary

MAIL-2.30 adds no backend authority, provider authority, signing authority, connector capability, public index, or on-chain body storage.

### MAIL-2.31 boundary

The desktop shell retains existing account/security/integration handoffs but does **not** claim a consolidated Mail Settings Center.

Settings-center policy/schema work remains MAIL-2.31.

## Qualification history

### Initial run — formatting defect

420Mail Audit Qualification:

- Run: **37527971577** (#403)
- Job: **112489723077**
- Exact head — PASS
- Go format — FAIL
- remaining required gates — correctly SKIPPED

Diagnosis: the new `mail/web_ui_test.go` had ordinary gofmt-only formatting drift. This was a test-harness formatting defect, not a protocol/UI semantic failure.

Repair commit:

`aeb602f5e30ac4a0c9a02398e7e43c95e722e72e`

No assertions or behavior were weakened.

### Final Level 1 qualification

Workflow: **420Mail Audit Qualification**

- Run: **37528080624** (#404)
- Job: **112490091924**
- Qualified feature SHA: `aeb602f5e30ac4a0c9a02398e7e43c95e722e72e`
- Exact tested PR merge candidate: `b8ea56ad8ceed8d5f6d7acf2c8ec8860f05dbca8`
- Exact checkout:
  `HEAD is now at b8ea56a Merge aeb602f5e30ac4a0c9a02398e7e43c95e722e72e into 7700caec39c6ef4212a433b493faa9876f3d7ece`

Results:

- Exact head — PASS
- Go format — PASS
- `go test ./mail/...` — PASS
- `go test -race ./mail/...` — PASS
- `go vet ./mail/...` — PASS
- `python3 scripts/verify-420mail-audit.py` — PASS
- verifier output:
  `MAIL-2.30 full desktop mail UI: qualified by app-scoped checks`

## Level 2 status

**NOT RUN / NOT DUE.**

MAIL-2.30 begins the documented **Product/security milestone (MAIL-2.30 through MAIL-2.35)**.

No material shared-dependency change was introduced that requires an early Level-2 boundary.

## Intentionally deferred Level 3

Level 3 is **NOT RUN / NOT DUE**.

No repository-wide Solidity inventory, Genesis/global qualification, 420 Integrated qualification, Geth/global fault/soak suite, unrelated app audit, or complete app-phase closeout is claimed.

## Limitations / blockers

No repository-side blocker remains for MAIL-2.30.

Live browser/deployment behavior, deployed onboarding/provider adapters, public-testnet operation, production accessibility/load evidence, production provider availability, and security/operations qualification remain later roadmap gates.

## Evidence inheritance

This evidence file and companion roadmap/PR bookkeeping are documentation/evidence-only and inherit qualification from exact tested merge-candidate SHA `b8ea56ad8ceed8d5f6d7acf2c8ec8860f05dbca8` without recursive qualification.

## Next canonical step

**MAIL-2.31 — Mail Settings Center**

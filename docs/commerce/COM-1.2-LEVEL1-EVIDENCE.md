# COM-1.2 — Level 1 targeted qualification evidence

**Step:** COM-1.2 — Protocol requirements, canonical ownership, and ecosystem dependency mapping  
**Status:** DOCUMENTED / TARGETED CHECKS PASS; automated CI not yet concluded  
**Implementation SHA:** `5482f83bdc03dfc6c60f3693c0b5c332b1a57bd3`  
**Base main SHA:** `ffc6a4028676907c266714b5c1ae8ba3af9a7137`  
**PR/branch:** #588, `commerce/com-1-architecture-reconciliation`  
**Scope:** docs-only architecture and roadmap. No executable source, tests, workflow, ABI, address, application registry or deployment changes.

## Changes and deliverables

- `docs/commerce/COM-1.2-DEPENDENCY-AND-AUTHORITY-MAP.md`: requirement-to-authority matrix, user/admin trust boundaries, service identity decision, dependency graph, upstream owner and next-step handoffs.
- `docs/commerce/COM-1-ARCHITECTURE-AND-ROADMAP.md`: reconciles COM-1.2 decision and next canonical step.
- COM-1.1 source inventory retained unchanged.

## Targeted Level 1 checks — exact SHA

Authenticated GitHub reads of all affected documents and canonical `ServiceIds420.sol`, `420-MARKET-V1-MODEL.md`, Wallet W14.5 app catalogue, Pay implementation status were checked against the exact implementation SHA. Scripted consistency assertions: **13 of 13 PASS**:

1. Exact step identity present.
2. Authority matrix present.
3. Branded noncanonical app identity documented.
4. No invented Genesis service ID allowed.
5. Listing ownership grounded in frozen Market V1.
6. Settlement ownership grounded in Pay.
7. Existing canonical MARKET and PAY IDs present.
8. No separate COMMERCE service constant exists.
9. Wallet W14.5 confirms unresolved Commerce identity.
10. Privacy and no-duplicate financial inventory restrictions recorded.
11. Evidence policy rejects premature CI PASS claims.
12. Parent roadmap includes COM-1.2 evidence reference.
13. Next step retained as COM-1.3 smart contract architecture.

`main...implementation` comparison: **ahead 4; behind 0** at check time. Only 3 Commerce docs paths changed. No conflict or shared-executable divergence was reported.

## CI observation

GitHub Actions results associated with the implementation SHA at time of evidence capture:
- `420Oracle audit qualification`, run `37866106578`: PENDING. Not an app-specific COM-1.2 qualification.
- `420Docs Qualification`, run `37866106650`: PENDING. Neither pending nor skipped status is PASS.

No dedicated Commerce fast CI qualification workflow was established by this isolated docs change. These targeted 13 assertions provide a bounded source consistency check, **not** an independent GitHub Actions PASS. Review any mandatory Docs status before phase closeout, but do not repeat broad inventories for COM-1.2.

## Deferred and blocked

- **Level 2:** deferred to relevant app integration milestone (not due for this documentary mapping step).
- **Level 3:** deferred to COM-1.8 exact-SHA architecture phase closeout; canonical Solidity, Genesis-address, Docs and global suites retain separate ownership.
- **Testnet:** COM-8 real blockchain integration, pending an operational testnet.
- **Mainnet:** COM-9 pending testnet and explicit deployment authorization.
- **Open dependency:** exact runtime Pay-to-Market approved settlement reporter binding not proven; COM-1.3/1.5 must inspect it.
- **Open governance question:** a future *distinct* canonical Commerce service requires an explicit governed decision. V1 proceeds as noncanonical application.

**Next canonical step: COM-1.3 — Smart contract architecture.**
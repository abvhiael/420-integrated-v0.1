# COM-6B — Dispute workflow qualification

Canonical source: `docs/commerce/COM-1-ARCHITECTURE-AND-ROADMAP.md`, COM-6 Merchant operations, dispute handoff. Proposed COM-6B subpackage; **not** a new canonical roadmap number.

## Verified authority boundary

`OrderRegistry420.disputeOrder(orderId,disputeHash)` is the canonical Market V1 contract entrypoint. The *actual buyer or seller* must submit the on-chain transaction; it accepts only `PAID` or `FULFILLED` states and records the supplied nonzero dispute commitment with status `DISPUTED`. 420Arbitration is an independent case/policy/ruling protocol; a Market dispute does not automatically create an arbitration case, bind an independent resolver, obtain a ruling or execute a remedy. Arbitration itself does not custody or return funds. Do not blur these authorities.

## Implemented

- SQLite v4 `004-dispute-requests.sql`: durable request with unique order/commitment binding and store index, compatible v1→v4 migration.
- Signed merchant-only `merchantRemedy(...,'dispute',{disputeHash})`: rechecks merchant-controller identity, canonical seller and eligible Market state before creating idempotent, serialized request. Returns a non-executing canonical Market Wallet intent for `disputeOrder`; a different second commitment fails closed.
- Signed `GET /v1/merchant/storefronts/{storeId}/operations/disputes` and `merchantDisputes` SDK: verifies finalized Market `DISPUTED` state and exact commitment, rejects mismatches, never claims Arbitration case/ruling or payment remedy. Dashboard includes evidence commitment and order-linked status.
- Regression suite `commerce/test/com6b-dispute.test.mjs` tests idempotency, eligibility, role/tenant isolation, malformed and forged commitments and false finality.

## Remaining original exit criteria / blockers

1. **Actual user Wallet submission and transaction finality:** the current UI surfaces a Market transaction intent; it does not submit a transaction. No actual Wallet signature, mined transaction or live chain proof is asserted.
2. **Qualified arbitration case adapter:** 420Arbitration's registered case/policy/router must be verified from approved manifests and tested for case creation, claimant/defendant provenance, evidence, resolver independence, appeal and finalized ruling. No approved, proven end-to-end case binding has yet been integrated.
3. **Governed remedy handoff:** arbitration rulings cannot mutate Market or Pay automatically; any final remedy must go through the originating protocol's separately qualified authority, with permission, accounting and replay checks. Not implemented.
4. **Milestone / live acceptance:** production-equivalent testnet, canonical deployment/manifest bindings, authorized case reviewers, end-to-end chain acceptance. No live dispute has been created.
5. **Exact SHA qualification:** app-scoped service and merchant-browser workflows must complete green; pending checks cannot be treated as pass.

**Disposition: COM-6B PARTIAL until the original exit criteria above are fulfilled.** Do not advance to COM-6C or merge PR #594 on the strength of a mere dispute-request record. No global Level 3 requested; Level 2 app milestone only when integrated authorities converge.

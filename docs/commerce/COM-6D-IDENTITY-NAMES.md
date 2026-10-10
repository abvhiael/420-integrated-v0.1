# COM-6D — Identity / Names

Canonical parent: COM-6 Merchant operations, credentials/names. COM-6D is a substep, not a replacement roadmap number.

Repository canonical contracts: contracts/src/apps/Identity420.sol and contracts/src/apps/Names420.sol; each reports protocolVersion 3. Payment/merchant authority stays exclusively in Pay MerchantRegistry420, not merchant profile badges or .420 name claims.

The optional read-only Identity/Names adapter is commerce/src/identity-names.mjs. An approved operator-supplied binding must provide exact chain, distinct contract addresses, approved deployed code hashes and protocol version. Every merchant integration read uses one finalized RPC block; it validates code/version and ties the active Identity profile controller to the canonical Pay merchant controller. An explicitly configured credential type must pass hasValidCredential to display CREDENTIAL_VALID; profile ownership alone is only PROFILE_CONTROLLER_MATCH. Reverse Names resolution is rechecked against forward resolution, expiry and profile claim; the result uses a label hash, never a fabricated human-readable name. Missing optional config returns NOT_VERIFIED. Identity or Names never authorize store changes, payout, refunds or approvals.

Service/SDK/browser retain existing merchant signed permission boundaries and display statuses only. The tests in commerce/test/com6d-identity-names.test.mjs cover positive profile/name/credential, expiry, revocation/inactive profile, absent reverse entry, wrong bytecode, disabled or aliased binding, no optional integration and store IDOR. No Solidity code, canonical Genesis addresses or frozen ABI changed; only app-specific Level 1 service/browser tests are required, not repository-wide Level 3.

This is not real-world Identity/Names/Verify acceptance. A config flag does not establish ProtocolRegistry publication, human-readable label attestation, provider-issued trust class or a live on-chain credential; these remain testnet/release gates. COM-6E analytics and the later complete COM-6 phase milestone remain outstanding. Next top-level canonical step after COM-6 is COM-7 Security/ops.

Level 1 exact-SHA evidence to be appended only after required workflows finish.

## COM-6D exact-SHA Level 1 closeout — October 9, 2026

**Implementation SHA:** `9e10283c5271008d15d358493a9fc889d10c11ea`.
**PR:** [#594](https://github.com/abvhiael/420-integrated-v0.1/pull/594), `audit/420commerce-com-2-upstream-adaptations` (draft/unmerged).
**PR base SHA:** `41d173dbcfbeb8299f54f22e7c049f1fec20336d`.
**Current main SHA at evidence capture:** `f8bbb62e1cdfe68cff25261fd4a036db1840a15c`.

Exact implementation-SHA CI completed **SUCCESS** in every triggered applicable Commerce workflow:

- [Commerce service fast qualification 37992245829](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37992245829) — PASS: app service, source adapters, SDK, Indexer, negative/adversarial, affected lint/build.
- [Commerce merchant builder fast qualification 37992245912](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37992245912) — PASS: builder, Wallet, browser UX and accessibility regressions.
- [Commerce upstream contracts 37992246037](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37992246037) — PASS: retained Market/Pay/Arbitration targeted tests, with no new Solidity source.
- [Commerce governed Pay refund qualification 37992245847](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/37992245847) — PASS: retained Pay authority/security regressions.

No applicable workflow is failed, queued, skipped or cancelled at this implementation SHA.

**Implementation delivered:** optional finalized-block Identity420 profile/credential proof and Names420 forward/reverse/expiry/profile resolution, verified contract runtime code/chain/version from approved config, presentation-only merchant integration status, and explicit non-authorization of changes to merchant ownership, payment or payout. Adversarial tests cover expired resolution, inactive profile, revoked/absent credential, wrong code, wrong/aliased binding, missing service and cross-tenant access. No prior qualified COM-6A/B/C source was discarded.

**Disposition: COM-6D repository-side Level 1 COMPLETE / PASS.** This is not proof of a live mainnet/testnet profile credential or name. No external identity/name deployment was changed. Qualified Registry service publications, issuer trust/420Verify proof beyond Identity's typed valid-credential reader, end-user human-readable label attestation, real chain expiry/revocation events and production-equivalent acceptance remain release/testnet gates. Component-level Level 2 retained Commerce milestone and Level 3 full phase qualification remain deferred; no global Foundry/Genesis duplicates were executed for this step.

**Next planned package:** COM-6E merchant analytics/phase evidence. **Next canonical top-level step after COM-6:** COM-7 — Security/ops. PR #594 is not yet ready to merge and requires accumulated reconciliation with newer main.

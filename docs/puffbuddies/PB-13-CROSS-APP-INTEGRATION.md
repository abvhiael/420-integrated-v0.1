# PB-13 — 420Integrated cross-app integration

## Purpose
Harden the accumulated PuffBuddies integration surface across approved 420Integrated dependencies without transferring PuffBuddies profile, eligibility-decision, relationship, consent, safety, lifecycle, deletion, visibility or premium/private-access authority.

Current PB-13 carries forward the legacy PB-0.19 **PB-8 — Bounded ecosystem integration hardening** scope.

## Canonical dependency set
PB-13 covers:
- 420Wallet
- 420Identity
- 420Names
- 420Messenger
- 420Notifications
- 420Pay
- 420Registry / ProtocolRegistry
- 420AppStore
- 420Analytics
- 420Indexer
- 420Explorer
- 420Search
- 420Verify

No PuffBuddies service ID is invented by PB-13.

## Canonical requirements
1. Every dependency remains capability-limited to its repository-defined authority.
2. All protected PuffBuddies application decisions remain PuffBuddies-owned.
3. Registry-backed dependencies must match the exact canonical ServiceIds420 service ID.
4. Inactive or deprecated Registry services fail closed.
5. Wrong-chain Registry snapshots fail closed.
6. Future or stale Registry observations fail closed.
7. 420Indexer remains derived infrastructure and is not assigned a fabricated Registry service ID.
8. Wallet account-control/signature/session capability cannot create membership, eligibility, match, block, safety or lifecycle authority.
9. Identity credential/eligibility evidence cannot become the PuffBuddies eligibility decision.
10. Names current-resolution/name-binding state cannot become legal identity, eligibility, membership or reputation authority.
11. Messenger conversation/endpoint/native-block state cannot create PuffBuddies match or messaging authorization.
12. Notifications subscription/delivery state cannot create or preserve PuffBuddies authorization.
13. Pay settlement/refund state cannot purchase consent, eligibility, match, unblock, messaging or protected-person access.
14. Registry identity/version/active state cannot grant application authorization beyond service discovery.
15. AppStore catalogue/listing/ranking/sponsorship state cannot rewrite Registry service identity, version or active state.
16. AppStore presentation remains non-canonical.
17. Analytics accepts privacy-safe aggregate data only.
18. Analytics rejects user-identifying or protected private PuffBuddies payloads.
19. Indexer/Explorer/Search projections remain derived, right-chain, fresh and explicitly non-canonical.
20. Derived services cannot claim canonical protocol authority.
21. Verify evidence is bounded to deployment/source-build authenticity and cannot become personal identity, adult eligibility, reputation, match consent or safety authority.
22. Authority inheritance between dependencies is prohibited.
23. Any dependency claiming ownership of a protected PuffBuddies decision fails closed.
24. Dependency failure/staleness cannot broaden access.
25. Existing PB-2/PB-6/PB-7/PB-9/PB-10 integrations remain authoritative for their already-qualified narrow domains.
26. PB-13 introduces no new contract, fixed address, PuffBuddies service ID, provider credential, production endpoint, deployment or live-wiring claim.
27. PB-14 remains owner of production API/transport hardening.
28. PB-17+ remain owners of live environment/release qualification.

## Qualification
PB-13 requires:
- **Level 1** exact-head cross-app qualification: targeted dependency/interface tests, stale/revoked/wrong-chain/failure/authority-conflict tests, privacy/static checks and direct applicable verifier scripts.
- **Level 2 milestone D**: complete retained PuffBuddies integration suite, as explicitly defined by the legacy implementation roadmap.

Level 2 remains app-focused. PB-13 does not trigger the Level-3 full repository Solidity/Genesis/420 Integrated/Geth/fault/soak closeout.

## Direct dependency verification
PB-13 validates repository identity/interface assumptions using:
- `scripts/verify-genesis-dapps.py`
- `scripts/verify-reg-audit-7-integration.py`
- `scripts/verify-420pay-audit.py`
- `scripts/verify-puffbuddies-pb0.py`

These checks have distinct coverage. PB-13 does not rerun a full dependency audit or full Foundry inventory.

## Affected components
- `puffbuddies/integrations/ecosystem.py`
- `puffbuddies/tests/test_pb_13_cross_app_integration.py`
- `puffbuddies/tests/test_pb_13_integration.py`
- PB-13 workflow
- canonical roadmap/master mapping
- durable qualification evidence

## Dependencies
PB-0.3, PB-0.7, PB-0.8, PB-0.9, PB-0.16; PB-2, PB-6, PB-7, PB-9, PB-10; **PB-12 — Mobile applications — COMPLETE**.

## Exit criteria
- exact dependency inventory is implemented;
- canonical service IDs are bound to repository ServiceIds420 values;
- stale/inactive/deprecated/wrong-chain dependency admission fails closed;
- authority inheritance and authority conflicts fail closed;
- AppStore cannot rewrite Registry truth;
- Analytics and derived services preserve privacy/non-canonical status;
- Verify remains bounded to protocol/deployment evidence;
- direct repository dependency verifiers pass;
- complete retained PuffBuddies integration suite passes;
- exact implementation SHA is durably recorded;
- Level-3/global/live-deployment checks remain explicitly deferred.

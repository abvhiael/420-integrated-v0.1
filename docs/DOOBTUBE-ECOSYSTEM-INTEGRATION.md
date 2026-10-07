# DoobTube — ecosystem integration milestone

Roadmap step: **DOOBTUBE-8 — Ecosystem integration milestone**
Status: **ADOPTED / IMPLEMENTED**
Qualification level: **Level 2 — retained app integration milestone**
Date: 2026-10-07

## 1. Purpose

DOOBTUBE-8 is the retained Level 2 milestone for the accumulated DOOBTUBE-0 through DOOBTUBE-7 implementation.

It does not add a new product feature. It proves that the already-adopted 420Integrated dependencies compose together on one exact DoobTube implementation SHA without transferring authority, widening privacy, introducing custody, or silently adopting unrelated services.

Executable milestone:

- `doobtube/integration/milestone.py`
- `doobtube/tests/test_doobtube_level2_integration.py`
- `scripts/verify-doobtube-level2.py`

## 2. Canonical dependency disposition

### 2.1 Direct required

The application-level authority/dependency graph requires:

- ProtocolRegistry — `420/service/protocol-registry/v1`
- Wallet — `420/service/wallet/v1`
- Smart Accounts — `420/service/smart-accounts/v1`
- 420Media — `420/service/media/v1`
- 420Rights — `420/service/rights/v1`
- 420Storage / Resource Protocol — `420/service/resource-protocol/v1`
- 420Search — `420/service/search/v1`
- 420Notifications — `420/service/notifications/v1`

### 2.2 Direct optional

- 420Identity — `420/service/identity/v1`

If Identity is unavailable, V1 degrades to Wallet-only pseudonymous operation rather than blocking public or Wallet-authorized workflows that do not require profile enrichment.

### 2.3 Transitive through Media

- 420Pay — `420/service/pay/v1`
- 420 Compute Market — `420/service/compute-market/v1`

DoobTube has no direct Pay or Compute call path.

### 2.4 Not adopted in V1

- 420Arbitration
- 420Analytics
- 420Verify
- 420Explorer

These may exist elsewhere in the ecosystem, but DOOBTUBE-8 does not promote them into correctness or authorization dependencies.

## 3. Registry discovery integration

### DT-INT-REG-001 — Exact service identity

Every retained dependency snapshot must match the exact canonical service ID.

### DT-INT-REG-002 — Active lifecycle

Inactive/deprecated service snapshots fail closed.

### DT-INT-REG-003 — Chain/freshness

Wrong-chain, stale or future observations fail closed.

### DT-INT-REG-004 — Optional Identity exception

Identity may be absent because it is explicitly optional. Required dependencies may not be absent.

## 4. Wallet / Smart Account / Identity integration

### DT-INT-AUTH-001 — Wallet mutation authority

Integrated mutation flow requires a non-empty Wallet reference.

### DT-INT-AUTH-002 — Optional Identity

When Identity is available, its Wallet/controller binding must match the Wallet actor and profile/controller references must be complete.

When unavailable, Identity contributes no authority fields.

### DT-INT-AUTH-003 — No authority substitution

Neither Identity nor DoobTube may replace Wallet signing or Smart Account execution authority.

## 5. Media compatibility

### DT-INT-MEDIA-001 — Exact Media service

The Media dependency must remain:

`420/service/media/v1`

### DT-INT-MEDIA-002 — Exact V1 compatibility

Required:

- API version `v1`
- compatibility major `1`
- expected chain/network
- upload capability
- livestream capability

This reuses the DOOBTUBE-4 adapter contract.

## 6. Rights / provenance

### DT-INT-RIGHTS-001 — Publication gate

Public-integrated flow requires live Rights publication authorization and no revocation.

### DT-INT-RIGHTS-002 — Asset identity

Rights media asset ID must match the Media/public-projection asset ID.

### DT-INT-RIGHTS-003 — Provenance

Non-empty provenance reference is required.

Rights failure cannot widen publication.

## 7. Storage

### DT-INT-STORAGE-001 — Canonical readiness

Integrated public flow requires the DOOBTUBE-3/4 complete Storage identity and:

- sealed;
- retrievable;
- live.

Storage transport alone is insufficient.

## 8. Search / indexing

### DT-INT-SEARCH-001 — Search authority

Search source identity must be exactly:

`420/service/search/v1`

### DT-INT-SEARCH-002 — Public-only eligibility

Search/public projection remains gated by:

- READY;
- PUBLIC;
- Rights authorization;
- expected chain.

### DT-INT-SEARCH-003 — Derived only

Search may not claim canonical authority.

Search asset identity must match Media/Rights identity.

### DT-INT-SEARCH-004 — Finality sanity

Search finalized height may not exceed indexed height.

The current V1 web application consumes the qualified Media `GET /v1/search` composition route. This does not transfer Search authority to Media or DoobTube: the canonical Search service remains the derived discovery owner and Media exposes the already-qualified composition boundary.

## 9. Notifications

### DT-INT-NOTIFY-001 — Actor binding

Notification subscription user reference must match the Wallet actor.

### DT-INT-NOTIFY-002 — Confirmed durable state

Only confirmed owning-service subscription state is accepted as durable.

### DT-INT-NOTIFY-003 — No entitlement/Wallet authority

Subscription cannot become:

- paid entitlement;
- signing authority;
- spending authority;
- implicit promotional consent.

The V1 web client uses the qualified Media `POST /v1/notifications/subscriptions` composition endpoint while 420Notifications remains the owning delivery/preferences service.

## 10. Pay / settlement

V1 has no viewer/creator monetization, custody, tips, PPV, paid subscription or creator payout workflow.

Therefore Level 2 qualifies Pay by proving:

- canonical service identity remains known;
- it remains `TRANSITIVE_MEDIA`;
- direct DoobTube calls are rejected;
- no DoobTube balance/escrow/refund/settlement ledger exists.

This is the correct qualification for the canonical V1 scope; inventing a settlement flow would violate DOOBTUBE-1.

## 11. Compute / media processing

420 Compute Market remains `TRANSITIVE_MEDIA`.

DOOBTUBE-6 already qualifies processing provider/result admission, resource bounds, deadlines and output-readiness separation.

The Level 2 retained suite reruns the DOOBTUBE-6 media integration tests on the exact milestone SHA together with the ecosystem harness.

Therefore Compute/media processing is revalidated without introducing a direct Compute client.

## 12. Moderation / arbitration

### Moderation

Moderation is adopted only as app-scoped Media behavior.

The retained browser/API fixtures exercise:

- report route;
- appeal route;
- actor binding;
- non-authoritative client presentation.

### Arbitration

420Arbitration remains **NOT_ADOPTED_V1**.

No moderation report or appeal is promoted into protocol Arbitration, and Arbitration is not silently required for application operation.

## 13. Analytics / Verify / Explorer

Analytics, Verify and Explorer are **NOT_ADOPTED_V1** dependencies.

They may expose ecosystem visibility elsewhere, but:

- DoobTube correctness does not depend on them;
- they cannot authorize playback/publication;
- their absence cannot block canonical V1 operation;
- DOOBTUBE-8 adds no direct client, Registry dependency or authority for them.

## 14. Full retained Level 2 suite

The dedicated Level 2 workflow runs against one exact SHA:

1. exact SHA assertion;
2. Python compile;
3. protocol-adapter suite;
4. backend/control-plane suite;
5. media integration/adversarial suite;
6. dedicated ecosystem-integration suite;
7. static web structural/security/browser fixture/build qualification;
8. cumulative DOOBTUBE-0 through -8 verifier;
9. dedicated Level 2 repository/schema/interface verifier.

This is intentionally broader than ordinary Level 1 while remaining app-focused.

## 15. Failure / degraded-mode revalidation

Level 2 explicitly verifies:

- optional Identity absence -> Wallet-only pseudonymous mode;
- stale/wrong-chain/inactive Registry -> fail closed;
- wrong Media compatibility -> fail closed;
- Rights revocation -> public flow blocked;
- unready Storage -> public flow blocked;
- Search privacy widening -> blocked;
- Search authority claim -> blocked;
- notification actor substitution -> blocked;
- notification entitlement/marketing/sign/spend escalation -> blocked;
- direct Pay/Compute promotion -> blocked;
- shadow authority transfer to DoobTube -> blocked.

## 16. Cross-component invariants

- **DT-INT-INV-001:** exact canonical service IDs remain stable across the retained graph.
- **DT-INT-INV-002:** Wallet/Smart Account authority is never replaced by DoobTube or optional Identity.
- **DT-INT-INV-003:** optional Identity failure cannot block Wallet-only pseudonymous operation.
- **DT-INT-INV-004:** Rights revocation cannot widen public publication.
- **DT-INT-INV-005:** Storage transport cannot replace canonical readiness.
- **DT-INT-INV-006:** Search cannot widen visibility or claim canonical authority.
- **DT-INT-INV-007:** Notifications cannot create entitlement, signing or spending authority.
- **DT-INT-INV-008:** Pay and Compute remain Media-transitive.
- **DT-INT-INV-009:** Media processing cannot bypass output Storage/Media readiness.
- **DT-INT-INV-010:** moderation remains app-scoped and does not silently invoke Arbitration.
- **DT-INT-INV-011:** Analytics/Verify/Explorer remain non-dependencies.
- **DT-INT-INV-012:** no canonical authority domain may be reassigned to DoobTube.

## 17. Level 3 boundary

DOOBTUBE-8 is not the repository phase closeout.

It intentionally does not run:

- canonical full repository Solidity inventory;
- Genesis/address-authority full verification;
- 420 Integrated global qualification;
- repository-wide Docs reconciliation;
- unrelated app audits;
- global fault/soak suites.

Those remain DOOBTUBE-11 Level 3 ownership.

## 18. Exit decision

DOOBTUBE-8 is satisfied only when:

1. all adopted dependencies are mapped to exact identities/interfaces;
2. optional/non-adopted/transitive classifications remain explicit;
3. retained cross-component positive path passes;
4. cross-component negative/authority/privacy paths pass;
5. all retained DOOBTUBE-4..7 app suites pass together;
6. the web build/fixtures pass;
7. the cumulative baseline verifier passes;
8. the dedicated Level 2 verifier passes;
9. the dedicated Level 2 workflow passes on the same exact implementation SHA;
10. roadmap/audit/evidence record the milestone result.

**Next canonical roadmap step: DOOBTUBE-9 — Security, abuse and moderation qualification.**

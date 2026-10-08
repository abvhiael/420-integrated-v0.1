# DoobTube — contracts and protocol adapters

Roadmap step: **DOOBTUBE-4 — Contracts and protocol adapters**
Status: **ADOPTED / IMPLEMENTED**
Date: 2026-10-06

## 1. Contract-scope decision

DOOBTUBE-0 through DOOBTUBE-3 prove that **no DoobTube-owned smart contract is required for V1**.

Therefore DOOBTUBE-4 introduces:

- no Solidity contract;
- no DoobTube protocol/service ID;
- no frozen/reserved address;
- no deployment graph;
- no upgrade/admin role;
- no app-owned settlement/custody;
- no app-owned Registry publication;
- no new on-chain event/error namespace.

This is not a missing implementation. It is the canonical contract scope for V1.

Creating a DoobTube contract merely to proxy 420Media, Wallet/Smart Accounts, Identity, Rights, Storage, Search, Notifications, Pay or Compute would violate the no-shadow-authority decisions already qualified in DOOBTUBE-0 through DOOBTUBE-3.

## 2. Applicability of original DOOBTUBE-4 contract requirements

| Original requirement | DOOBTUBE-4 disposition |
|---|---|
| Interfaces | **APPLICABLE as external adapter bindings**, implemented in `doobtube/integrations/ecosystem.py` |
| Access control / roles | **APPLICABLE as authority admission policy**; canonical owners remain external services |
| Initialization/deployment graph | **NOT APPLICABLE to DoobTube contracts** because none exist |
| Signatures/domain separation/nonces/replay | **DELEGATED** to Wallet/SmartAccount and qualified Media API/signing/idempotency contracts; DoobTube creates no signing domain |
| Accounting/settlement/refunds | **TRANSITIVE_MEDIA**; Pay/Compute remain behind qualified 420Media integration |
| Pausing/emergency controls | **NOT APPLICABLE to DoobTube contracts**; dependency failure is handled fail-closed/degraded by adapters |
| Registry integration | **APPLICABLE**; exact service identity/version/active/deprecation/chain/freshness admission is implemented |
| Events/errors | **No DoobTube on-chain events/errors**; adapter failures use bounded `AdapterDenied` errors |
| Adversarial/fuzz/invariant/property tests | **APPLICABLE to adapter policy**; negative/boundary unit tests cover wrong ID/chain/staleness, authority escalation, privacy widening and transitive bypass |

## 3. Executable adapter surface

Repository package:

`doobtube/integrations/ecosystem.py`

The package is deliberately an executable **binding/admission policy**, not a live backend. Network/API implementation remains DOOBTUBE-5.

### 3.1 Canonical dependency bindings

The adapter binds:

- 420 Registry — `420/service/protocol-registry/v1`
- 420 Wallet — `420/service/wallet/v1`
- 420 Smart Accounts — `420/service/smart-accounts/v1`
- 420Media — `420/service/media/v1`
- 420Identity — `420/service/identity/v1`
- 420Rights — `420/service/rights/v1`
- 420Storage / Resource Protocol — `420/service/resource-protocol/v1`
- 420Search — `420/service/search/v1`
- 420Notifications — `420/service/notifications/v1`
- 420Pay — `420/service/pay/v1`
- 420 Compute Market — `420/service/compute-market/v1`

DoobTube itself receives no service ID.

### 3.2 Dependency modes

The executable policy preserves DOOBTUBE-2:

- `DIRECT_REQUIRED`
- `DIRECT_OPTIONAL`
- `TRANSITIVE_MEDIA`
- `NOT_ADOPTED_V1`

420Pay and 420 Compute Market are explicitly `TRANSITIVE_MEDIA` and direct calls are rejected.

## 4. Registry adapter

### DT-ADAPT-REG-001 — Exact service identity

A Registry snapshot must match the exact service ID for the requested dependency.

Branding, DNS or implementation references cannot replace the canonical ID.

### DT-ADAPT-REG-002 — Lifecycle admission

Inactive or deprecated services fail closed.

### DT-ADAPT-REG-003 — Chain binding

Wrong-chain service snapshots fail closed.

### DT-ADAPT-REG-004 — Freshness

Future or stale Registry observations fail closed.

### DT-ADAPT-REG-005 — Bounded implementation reference

Implementation references must be present and bounded; they are discovery data, not authority for user/content decisions.

## 5. Media compatibility adapter

### DT-ADAPT-MEDIA-001 — Service identity

The admitted service must be exactly:

`420/service/media/v1`

### DT-ADAPT-MEDIA-002 — Version

V1 requires:

- API version `v1`;
- compatibility major `1`.

Unsupported versions fail closed.

### DT-ADAPT-MEDIA-003 — Chain/network

The Media service must agree with the expected chain/network.

### DT-ADAPT-MEDIA-004 — Required capabilities

The V1 adapter requires at least:

- `media.uploads`;
- `media.livestreaming`.

Missing capability disables the dependent workflow rather than pretending support.

## 6. Storage-readiness adapter

### DT-ADAPT-STORAGE-001 — Complete identity

Storage readiness requires complete object identity:

- object ID;
- manifest ID;
- shard index;
- shard root;
- byte size;
- commitment ID.

### DT-ADAPT-STORAGE-002 — Canonical readiness

`sealed && retrievable && live` are required before the adapter accepts a Storage object as ready.

This policy cannot be satisfied by provider upload success alone.

## 7. Search/public-projection adapter

### DT-ADAPT-SEARCH-001 — Public eligibility

A public projection is admitted only when:

- Media state is `READY`;
- visibility is `PUBLIC`;
- Rights/publication authorization is true;
- chain matches the expected chain.

### DT-ADAPT-SEARCH-002 — Derived authority boundary

A Search projection that claims canonical authority is rejected.

PRIVATE/UNLISTED/UPLOADED/not-Rights-authorized media is rejected from public projection admission.

## 8. Notifications adapter

### DT-ADAPT-NOTIFY-001 — Confirmed durable state

A local optimistic Subscribe state is not treated as durable until Notifications confirms it.

### DT-ADAPT-NOTIFY-002 — No paid entitlement

Creator-update subscription cannot become a paid-access entitlement.

### DT-ADAPT-NOTIFY-003 — No Wallet authority

Notifications cannot inherit signing or spending authority.

### DT-ADAPT-NOTIFY-004 — Promotional consent separation

Promotional consent is rejected by the base creator-update adapter because it requires a separate explicit flow.

## 9. Wallet / Smart Account authority boundary

DoobTube's adapter package does not implement a signer.

Wallet and Smart Account authority remain external:

- Wallet supplies account/network context and explicit signing;
- Smart Accounts / canonical capability policy own scoped reusable execution;
- DoobTube stores no private keys, seed phrases or signing domain;
- a connected Wallet is not blanket Media/Rights/Storage/moderation authority.

## 10. Rights boundary

The adapter allowlists Rights consumption for:

- rights state;
- provenance;
- license state.

Rights cannot become Wallet, Media, Storage, Pay or Compute authority.

DoobTube does not make a Rights claim externally legally dispositive beyond its protocol meaning.

## 11. Pay / Compute boundary

### DT-ADAPT-ECON-001 — No direct V1 calls

`assert_direct_call_allowed("420Pay")` and `assert_direct_call_allowed("420Compute")` fail closed.

### DT-ADAPT-ECON-002 — Media owns transitive integration

Pay/Compute state may reach DoobTube only as qualified Media-owned operation/result state unless a later architecture amendment creates an explicit direct workflow.

### DT-ADAPT-ECON-003 — No custody/accounting

DoobTube introduces no balance, escrow, refund, settlement or provider-payment ledger.

## 12. Authority-conflict adapter

The executable canonical owner map covers:

- service discovery;
- wallet signing;
- account execution;
- Media lifecycle;
- stream controller;
- Identity profile;
- Rights/provenance;
- Storage readiness;
- public discovery;
- notification subscription;
- payment settlement;
- compute processing.

Any attempt to replace an owning authority with DoobTube or another dependency fails closed.

## 13. Tests

Repository tests:

`doobtube/tests/test_doobtube_adapters.py`

Required negative/boundary coverage includes:

- wrong Registry service ID;
- wrong chain;
- stale/future/inactive/deprecated Registry state;
- wrong Media ID/version/chain/network/capabilities;
- incomplete/non-live Storage readiness;
- UPLOADED/UNLISTED/no-Rights/wrong-chain Search projection;
- Search canonical-authority claim;
- Notifications paid-entitlement/sign/spend/promotional/unconfirmed state;
- direct Pay/Compute bypass;
- capability escalation;
- canonical-authority substitution;
- accidental DoobTube service ID/contract requirement.

## 14. Solidity/ABI/deployment impact

There is **no DoobTube Solidity or ABI change** in DOOBTUBE-4.

Therefore:

- no DoobTube contract compilation target exists;
- no Foundry app test is applicable;
- no ABI regeneration is applicable;
- no deployment/address manifest is applicable;
- no Genesis address-authority change is applicable.

The canonical repository-wide Solidity and Genesis inventories remain Level 3 work and must not be run ceremonially for this contract-free adapter step.

## 15. Security invariants

- **DT-ADAPT-INV-001:** DoobTube has no smart contract or canonical service identity.
- **DT-ADAPT-INV-002:** exact Registry service IDs are required.
- **DT-ADAPT-INV-003:** inactive/deprecated/wrong-chain/stale service bindings fail closed.
- **DT-ADAPT-INV-004:** Media ID/version/network/capability mismatch fails closed.
- **DT-ADAPT-INV-005:** Storage readiness requires complete live canonical evidence.
- **DT-ADAPT-INV-006:** Search cannot widen privacy or claim canonical authority.
- **DT-ADAPT-INV-007:** Notifications cannot become entitlement, signing or spending authority.
- **DT-ADAPT-INV-008:** Pay and Compute are direct-call denied in V1.
- **DT-ADAPT-INV-009:** dependency capabilities are allowlisted.
- **DT-ADAPT-INV-010:** canonical authority ownership cannot be reassigned to DoobTube.
- **DT-ADAPT-INV-011:** adapter state contains no private keys/custody.
- **DT-ADAPT-INV-012:** no adapter admission result creates new protocol authority.

## 16. Exit decision

DOOBTUBE-4 is satisfied when:

1. contract necessity is resolved;
2. the no-contract decision is explicit and consistent with DOOBTUBE-0 through -3;
3. all required external service IDs are bound;
4. Registry admission fails closed;
5. Media compatibility admission fails closed;
6. Storage readiness admission preserves canonical readiness;
7. Search projection cannot widen visibility/authority;
8. Notifications cannot inherit entitlement/Wallet authority;
9. direct Pay/Compute bypass is rejected;
10. canonical authority substitution is rejected;
11. adapter negative/boundary tests pass;
12. the cumulative DoobTube verifier passes on the exact implementation SHA;
13. the app-specific fast CI workflow runs the adapter tests on the exact implementation SHA.

**Next canonical roadmap step: DOOBTUBE-5 — Backend/API/indexing/service control plane.**

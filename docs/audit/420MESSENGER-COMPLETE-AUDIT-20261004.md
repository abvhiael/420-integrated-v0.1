# 420Messenger complete repository audit — 2026-10-04

## Scope and authority

Application/protocol audited: **420Messenger**.

Authoritative baseline at audit start: repository `abvhiael/420-integrated-v0.1`, `main` at `b3cfd359db5ac84aff6213119475ea3dc770642d`.

This audit treats repository-controlled source, configuration, architecture, Genesis contract inventory, service IDs, address namespace, tests and current roadmaps as authoritative. The stray `[420Token]` reference in the audit request's repository-inventory sentence is treated as a wording error because every substantive audit heading names 420Messenger.

The repository does not define 420Messenger as one of the frozen contract-free GEN-10 public applications. It defines Messenger as a **protocol-backed Genesis implementation family** and private wallet-to-wallet coordination protocol. Therefore a fabricated standalone website/backend is not added merely to satisfy an app-shaped checklist. A useful end-user messaging journey nevertheless requires a qualified client plus encrypted off-chain transport/storage; that live application-layer evidence remains a release gate.

## Canonical sources reviewed

- `contracts/config/420messenger-genesis.json` — frozen Messenger privacy boundary and `MSG-INV-001..012`.
- `contracts/config/genesis-dapp-contract-map.json` — exact eight-file Messenger Genesis contract family.
- `contracts/config/genesis-address-namespace.json` — `messenger-router` is `REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS`.
- `contracts/src/libraries/ServiceIds420.sol` — canonical `420/service/messenger/v1`.
- `contracts/test/RegistryGenesis420.t.sol` — Messenger is in the canonical Registry service catalog.
- `docs/architecture/protocols/messenger-notifications-attention.md` — normative purpose, state machine, authority, privacy, failure/recovery and `MSG-001..010`.
- `README.md`, `docs/GENESIS-DAPPS.md`, `docs/DOCS-ROADMAP.md`, `docs/ROADMAP.md`.
- prior implementation PR #28 and DOC-7 PR #208.
- Bong Goggles Messenger consumer/integration evidence, especially `docs/BONG-GOGGLES-BG-14.md`, `docs/BONG-GOGGLES-BG-19-7.md`, `services/bong-goggles-messaging-v1` and `bong-goggles/web/core/messaging.js`.
- Notifications/Indexer privacy boundaries excluding private Messenger content.

## Intended architecture

420Messenger owns only canonical coordination metadata:

1. account endpoint key-package/transport commitments and monotonic revision;
2. unilateral block relationships;
3. deterministic two-party conversation identity and `REQUESTED -> ACTIVE -> CLOSED` lifecycle;
4. sender-authorized, per-sender strictly ordered encrypted-envelope commitments;
5. recipient delivery/read acknowledgements;
6. read-only request/send eligibility.

Plaintext, ciphertext blobs, attachment/media bytes, private keys and decryption keys remain off-chain. 420Commons remains community/channel authority. 420ResourceProtocol may transport/store encrypted payloads without becoming message authority. 420Notifications may derive metadata-only alerts without indexing protected payloads. CapabilityRegistry is the delegated-authority source; ProtocolRegistry is the service discovery/publication source.

## Repository state

Audit branch: `messenger-remediation-20261004`.

PR: #525 — `audit(messenger): repository audit and pre-testnet remediation`.

Baseline `main`: `b3cfd359db5ac84aff6213119475ea3dc770642d`.

The branch was created directly from that exact main and had no initial divergence. Final reconciliation and exact-head evidence are recorded at closeout, not inferred from earlier runs.

## File/component inventory

| Component | Repository evidence | Classification | Notes |
|---|---|---|---|
| Messenger IDs | `contracts/src/messenger/MessengerIds420.sol` | COMPLETE | Component + five action IDs frozen. |
| Authorization helper | `MessengerAuthorization420.sol` | COMPLETE | Exact component/action/account scope through CapabilityRegistry. |
| Endpoint registry | `MessengerEndpointRegistry420.sol` | COMPLETE | Commitment-only endpoint, revision, deactivate. |
| Block registry | `MessengerBlockRegistry420.sol` | COMPLETE | Directional unilateral block. |
| Conversation registry | `MessengerConversationRegistry420.sol` | COMPLETE | Deterministic ID, explicit peer acceptance, terminal close. |
| Envelope registry | `MessengerEnvelopeRegistry420.sol` | COMPLETE | Strict independent per-sender sequence, commitment-only payload metadata. |
| Receipt registry | `MessengerReceiptRegistry420.sol` | COMPLETE | Opposite-participant acknowledgement, read implies delivery. |
| Read router | `MessengerRouter420.sol` | COMPLETE | Non-mutating canRequest/canSend helper. |
| Dedicated Solidity interface package | none | NOT APPLICABLE | Current contracts consume concrete Messenger types; no canonical source requires a separate Messenger interface family. |
| Genesis profile | `contracts/config/420messenger-genesis.json` | COMPLETE | 12 frozen invariants. |
| Genesis contract map | `contracts/config/genesis-dapp-contract-map.json` | COMPLETE | Exact eight-file inventory. |
| Service ID | `ServiceIds420.MESSENGER` | COMPLETE | `420/service/messenger/v1`. |
| Address policy | `genesis-address-namespace.json` | COMPLETE | Registry-resolved, intentionally no fixed Genesis address. |
| Deployment dependency graph | `contracts/config/420messenger-deployment-v1.json` | COMPLETE | Added by audit; constructor order and publication target frozen without inventing addresses. |
| Focused Genesis tests | `contracts/test/MessengerGenesis420.t.sol` | COMPLETE | Existing core behavior coverage. |
| Focused audit/adversarial tests | `contracts/test/MessengerAudit420.t.sol` | COMPLETE | Added scoped-capability and lifecycle hardening coverage. |
| Shared Genesis verifier coverage | `scripts/verify-genesis-dapps.py` | COMPLETE | Audit added Messenger profile/inventory/service checks. |
| Dedicated audit verifier | `scripts/verify-420messenger-audit.py` | COMPLETE | Added. |
| Dedicated exact-head CI | `.github/workflows/420messenger-audit.yml` | COMPLETE | Added focused Foundry + Slither qualification. |
| Protocol architecture documentation | `docs/architecture/protocols/messenger-notifications-attention.md` | COMPLETE | Existing normative docs. |
| Messenger build/deploy/operator reference | `docs/420MESSENGER.md` | COMPLETE | Added by audit. |
| Messenger audit roadmap | `docs/420MESSENGER-ROADMAP.md` | COMPLETE | Added MESSENGER-AUDIT-1..8. |
| Readiness record | `testnet/public-services/messenger/readiness.json` | COMPLETE | Added; explicitly refuses live/testnet/production claims. |
| ABI/artifact generation | Foundry build artifacts | NOT APPLICABLE | No separately committed generated-binding requirement is canonical. |
| Messenger-owned database/indexer | none | NOT APPLICABLE | Canonical state is chain state; public derived indexers must exclude private payloads. |
| Messenger-owned standalone backend | none | NOT APPLICABLE | Transport is provider-neutral/off-chain; no canonical dedicated server implementation is frozen. |
| Messenger-owned standalone frontend | none | NOT APPLICABLE | Not a frozen GEN-10 contract-free app; consuming clients may implement Messenger. |
| Bong Goggles private-messaging consumer | BG-14/BG-19 + service/web code | PARTIAL | Metadata projection exists, but BG-19-7 explicitly records missing qualified runtime transport/client crypto and disabled compose/send. |
| Live encrypted transport/storage | deployment/provider evidence | BLOCKED | Requires production-equivalent testnet/provider infrastructure. |
| Live Wallet signing/authorization journey | deployment/client evidence | BLOCKED | Requires same-deployment Wallet + contract graph. |
| Fixed Messenger contract addresses | none | NOT APPLICABLE | Explicitly forbidden by current address namespace; router is Registry-resolved. |

No duplicate Messenger protocol authority was found. Bong Goggles deliberately consumes the canonical Messenger contracts rather than replacing them.

## Smart-contract review

### MessengerAuthorization420 — COMPLETE

- immutable CapabilityRegistry dependency;
- account-domain scope derived from a Messenger-specific domain string and account;
- exact Messenger component/action/account scope required;
- no owner, funds, delegatecall or upgrade path;
- new audit tests prove a grant for one account/action cannot cross to another account/action.

### MessengerEndpointRegistry420 — COMPLETE

- rejects zero constructor dependency;
- account or exact scoped capability only;
- nonzero account/key-package/transport commitments;
- revision increments on rotate and deactivate;
- deactivation fails when already inactive;
- no private key or payload storage.

### MessengerBlockRegistry420 — COMPLETE

- account or exact block capability;
- zero/self peer rejected;
- directional state is intentional;
- conversation request and envelope send check both directions, giving block dominance.

### MessengerConversationRegistry420 — COMPLETE

- deterministic ID orders participant addresses and binds nonzero context commitment;
- both endpoints must be active at request;
- block either direction rejects request/accept;
- only non-requesting participant may accept;
- only a participant may close;
- only REQUESTED/ACTIVE may close and CLOSED cannot reopen;
- duplicate canonical conversation ID is rejected.

### MessengerEnvelopeRegistry420 — COMPLETE

- sender or exact send capability only;
- sender/nonzero commitments validated;
- active conversation + participation required;
- current bilateral block state checked;
- sequence must equal previous sender/conversation sequence + 1;
- message ID domain separates conversation, sender, sequence and envelope hash;
- state update occurs after all external view checks; no value custody/external mutation/reentrancy surface;
- timestamp is metadata only, not authorization.

### MessengerReceiptRegistry420 — COMPLETE

- recipient or exact ack capability;
- expected recipient derived as sender's peer;
- read establishes delivery if needed;
- repeated acknowledgement is state-idempotent though it can emit another acknowledgement event. This is an accepted low-impact event-noise characteristic, not a canonical-state replay vulnerability.

### MessengerRouter420 — COMPLETE

- read-only eligibility helper;
- checks active endpoints and bilateral blocks for requests;
- checks active participation and bilateral blocks for sends;
- does not authorize or execute state changes.

## Security assessment

**Verified safe/qualified repository behavior**
- no token/native-asset custody or transfer code;
- no approvals, arbitrary calls, `delegatecall`, `selfdestruct` or `tx.origin`;
- no upgradeable proxy/storage-layout risk in the Messenger V1 contracts;
- no oracle, Bridge, cross-chain proof or price dependency;
- no unbounded loops in Messenger state transitions;
- no state-changing external callback path, materially reducing reentrancy exposure;
- exact capability domain/account/action boundaries;
- block dominance and terminal close;
- exact monotonic send sequencing and conversation-bound message identity;
- recipient-only receipt state.

**Mitigated/accepted design risks**
- encrypted content availability depends on off-chain providers; canonical commitments survive provider failure but content may not;
- on-chain commitments and participant addresses are public metadata even though payloads are private;
- transaction ordering can affect which valid state transition lands first; no value extraction surface was identified in Messenger itself;
- timestamps are block timestamps used for informational commit/receipt metadata, not permission/deadline enforcement;
- repeated receipt calls can produce duplicate events while leaving canonical receipt timestamps unchanged.

**Unresolved release-stage risk**
- device/session key custody, E2E encryption implementation, authenticated attachment retrieval, public/private logging boundaries, transport authentication, provider outage/retry behavior and real Wallet dispatch cannot be fully security-qualified from the Messenger contracts alone. These remain MESSENGER-AUDIT-7/8 live/client gates.

## Build and dependency audit

The Messenger Solidity family targets `pragma solidity ^0.8.24` and is part of the repository Foundry workspace. Direct contract dependency graph is intentionally small: CapabilityRegistry -> MessengerAuthorization -> Endpoint/Block -> Conversation -> Envelope -> Receipt, plus read-only Router.

No Messenger-specific npm/go/python runtime dependency is canonical. Off-chain providers are intentionally replaceable.

The dedicated audit workflow now enforces exact-head checkout, audit-owned formatting, full Foundry contract build, focused Messenger tests, shared Genesis verification, Messenger audit verification, forbidden-primitive scan and targeted Slither.

## Test coverage map

| Guarantee | Existing Genesis test | Audit test | Status |
|---|---:|---:|---|
| endpoint direct/delegated authorization | yes | scoped cross-account/action negative | COMPLETE |
| endpoint rotation/revision | yes | yes through scoped update | COMPLETE |
| inactive endpoint rejects new conversation | no | yes | COMPLETE |
| peer explicit acceptance | yes | inherited active helpers | COMPLETE |
| requester cannot self-accept | yes | — | COMPLETE |
| terminal close/no reopen | yes | send-after-close negative | COMPLETE |
| block prevents send | yes | yes | COMPLETE |
| block prevents request | no | both-direction case | COMPLETE |
| strict sequence/replay | yes | independent per-sender + gap negative | COMPLETE |
| canonical conversation identity | implicit | ordering/context binding | COMPLETE |
| message recipient-only receipt | yes | delegated scope boundary | COMPLETE |
| read implies delivery | yes | yes | COMPLETE |
| delegated send exact account scope | no | yes | COMPLETE |
| Router eligibility tracks endpoints/conversation/block | no | yes | COMPLETE |
| zero/invalid envelope commitments | implementation guards | explicit zero-hash negatives | COMPLETE |
| fuzz/property testing | none dedicated | none | NOT APPLICABLE for repository closeout; valuable future hardening |
| live provider/restart/reorg/client E2E | no | no | BLOCKED on testnet/client/provider |

The absence of a dedicated fuzz suite is not treated as proof failure for the small deterministic state machines because focused adversarial tests cover the frozen invariants; it remains optional hardening rather than a frozen Genesis requirement.

## Integration audit

| Dependency | Messenger relationship | Repository status |
|---|---|---|
| CapabilityRegistry / 420Wallet smart-account authority | exact capability checks | COMPLETE repository-side; live Wallet journey blocked |
| ProtocolRegistry / 420Registry | service discovery/publication | COMPLETE schema/ID/deploy graph; live publication blocked |
| 420Identity / 420Names | may be consumed by clients; no Messenger authority dependency in contracts | NOT APPLICABLE to core state |
| 420Commons | owns community spaces/channels | COMPLETE boundary |
| 420ResourceProtocol | optional encrypted transport/storage | COMPLETE boundary; live provider integration blocked |
| 420Notifications | metadata-only notification use; private payload excluded | COMPLETE boundary; live delivery integration blocked |
| 420Indexer / Search / Analytics | public/indexable metadata only; private payload excluded | COMPLETE policy boundary; live projections not qualified here |
| 420Pay / Token / Swap / Bridge / Stake / Governance / Treasury | no ambient authority/custody | COMPLETE negative boundary |
| Bong Goggles | consumer of canonical Messenger state/intents | PARTIAL E2E; fail-closed by design |

No circular canonical dependency was identified.

## Documentation audit

Before remediation, Messenger had strong protocol architecture documentation but lacked a dedicated app/protocol operational reference, deployment graph, audit roadmap, readiness record, dedicated audit verifier and dedicated exact-head audit workflow. Those gaps are repaired in this PR.

Still inherently deployment-time: exact deployed addresses/runtime hashes, public endpoints, provider/operator details, production secrets/key custody, monitoring targets, incident contacts and rollback evidence.

## Requirement matrix

| Requirement | Canonical source | Current implementation | Tests | Documentation | Status | Required remediation |
|---|---|---|---|---|---|---|
| private wallet-to-wallet protocol | architecture + Genesis profile | seven deployed contracts + IDs | Genesis/audit | architecture + Messenger ref | COMPLETE | none repo-local |
| scoped endpoint authority | MSG-INV-001 | Authorization + Endpoint | scoped delegation | documented | COMPLETE | none |
| minimum endpoint metadata | MSG-INV-002 | commitment-only struct | implementation/audit verifier | documented | COMPLETE | live privacy inspection later |
| active endpoints + peer acceptance | MSG-INV-003 | Conversation | yes | documented | COMPLETE | live E2E later |
| terminal close | MSG-INV-004 | Conversation | yes | documented | COMPLETE | none |
| bilateral block dominance | MSG-INV-005 | Conversation + Envelope + Router | request/send negatives | documented | COMPLETE | none |
| sender auth + exact sequence | MSG-INV-006 | Envelope | yes | documented | COMPLETE | none |
| replay-resistant message ID | MSG-INV-007 | canonicalId | sequence + binding checks | documented | COMPLETE | live chain provenance later |
| recipient-only receipts | MSG-INV-008 | Receipt | direct + delegated negatives | documented | COMPLETE | none |
| read implies delivery | MSG-INV-009 | Receipt | yes | documented | COMPLETE | none |
| no ambient economic/governance power | MSG-INV-010 | no such code paths | static + source review | documented | COMPLETE | none |
| Commons remains community authority | MSG-INV-011 | no group/channel authority | boundary review | documented | COMPLETE | none |
| Resource provider non-authority | MSG-INV-012 | no provider authority in contracts | boundary review | documented | COMPLETE | live provider test |
| canonical service ID | Registry docs/ServiceIds | ServiceIds420 | Registry + verifier | documented | COMPLETE | live publication |
| exact Genesis inventory | dApp map | eight files | shared verifier | documented | COMPLETE | live deployed code hashes |
| no fixed fabricated router address | address namespace | Registry-resolved policy | audit verifier | deployment doc | COMPLETE | record real address at deployment |
| deploy order/constructor bindings | Genesis readiness requirement | deployment graph added | audit verifier | documented | COMPLETE | execute on testnet |
| build from clean checkout | repository Foundry | dedicated CI | exact-head workflow | documented | COMPLETE when final exact-head CI passes |
| static/security analysis | audit requirement | Slither workflow | exact-head security job | audit record | COMPLETE when final exact-head CI passes |
| standalone Messenger frontend | frozen Genesis catalog | none | none | boundary documented | NOT APPLICABLE | clients consume protocol |
| standalone Messenger backend | provider-neutral architecture | none | none | boundary documented | NOT APPLICABLE | select qualified provider(s) at deployment |
| end-user encrypted client/send journey | protocol purpose + consumer docs | Bong Goggles projection/intents but compose/send disabled | metadata tests only | BG-19-7 admits gap | PARTIAL | qualified client crypto + Wallet dispatch |
| live transport/storage | provider-neutral architecture | no live candidate evidence | none live | release gate documented | BLOCKED | MESSENGER-AUDIT-7 |
| live Registry/Wallet integration | Genesis deployment requirements | no public-testnet evidence | none live | release gate documented | BLOCKED | MESSENGER-AUDIT-7 |
| Genesis acceptance | top-level roadmap | not deployed/reconciled live | no live evidence | planned | BLOCKED | MESSENGER-AUDIT-7 then 8 |
| production operations | release requirement | no production deployment | no live ops evidence | planned | BLOCKED | MESSENGER-AUDIT-8 |

## Remediation performed

1. closed shared Genesis-verifier blind spot for Messenger;
2. added focused exact-scope authorization/lifecycle adversarial tests;
3. added Messenger deployment/publication graph while preserving Registry-resolved addressing;
4. added dedicated Messenger audit verifier;
5. added exact-head Messenger audit + Slither workflow;
6. added Messenger build/deploy/operator reference;
7. added audit roadmap and explicit readiness record.

No Messenger protocol production-state semantics were changed by this audit.

## Readiness determination

- **CODE COMPLETE: NO (end-to-end application)** — on-chain protocol code is repository-complete, but a qualified end-to-end encrypted client/transport/send journey is not yet present as deployable Messenger evidence.
- **BUILD COMPLETE: YES, repository protocol layer** — contingent on final exact-head CI.
- **CONTRACT COMPLETE: YES** — seven deployed contracts plus IDs implement the frozen V1 protocol.
- **TEST COMPLETE: NO (release scope)** — repository contract tests are complete for the frozen invariants, but live transport/client/provider/recovery tests are outstanding.
- **DOCUMENTATION COMPLETE: YES, repository/pre-testnet scope** — deployment-specific evidence remains intentionally future-bound.
- **INTEGRATION COMPLETE: NO** — live Wallet/Registry/transport and consumer E2E are outstanding.
- **SECURITY QUALIFIED: NO (release scope)** — contract/static repository security can qualify before testnet, but client crypto/transport/key custody and live boundaries cannot.
- **TESTNET READY: NO** — no live deployed Messenger candidate/Registry publication/provider/client evidence.
- **GENESIS READY: NO** — MESSENGER-AUDIT-7 and release closeout remain.
- **PRODUCTION READY: NO** — production operations/security/deployment evidence remains.

## Remaining roadmap

1. **MESSENGER-AUDIT-6 — repository closeout**: reconcile this PR to then-current main, qualify exact final head and bind durable evidence.
2. **MESSENGER-AUDIT-7 — production-equivalent public-testnet qualification**: deploy and prove exact contract/Registry/Wallet/provider/client lineage and failure/recovery/privacy behavior.
3. **MESSENGER-AUDIT-8 — Genesis/production release closeout**: final release reconciliation, operations/monitoring/incident/recovery, production key/secrets handling and security acceptance.

A green repository test suite alone is explicitly insufficient to mark 420Messenger Genesis-ready or production-ready.

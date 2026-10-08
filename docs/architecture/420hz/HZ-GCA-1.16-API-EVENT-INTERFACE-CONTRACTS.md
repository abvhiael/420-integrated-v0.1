# HZ-GCA-1.16 — API/event/interface contracts

Status: **IMPLEMENTED — Level 1 interface-contract definition**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Machine-readable policy:

`hz/config/gca-api-interface-contracts-v1.json`

HZ-GCA-1.16 freezes the logical API, event and dependency-interface contracts that later runtime implementation must obey.

It does **not** assign a 420Hz canonical service ID, production endpoint, contract address or live adapter.

## Interface boundary

This step defines:

- request envelope;
- response envelope;
- event envelope;
- command/query catalogues;
- dependency adapters;
- versioning/compatibility;
- authorization/idempotency/replay;
- freshness/finality;
- privacy/minimum disclosure;
- error taxonomy;
- fail-closed behavior.

It does not implement HTTP routes, RPC services, SDK clients or deployed backend processes.

## Canonical dependency identities

Where repository-defined service IDs already exist, the logical contracts bind:

- ProtocolRegistry — `420/service/protocol-registry/v1`
- Wallet — `420/service/wallet/v1`
- Smart Accounts — `420/service/smart-accounts/v1`
- Identity — `420/service/identity/v1`
- Rights — `420/service/rights/v1`
- Resource Protocol — `420/service/resource-protocol/v1`
- Pay — `420/service/pay/v1`
- AI — `420/service/ai/v1`
- Compute Market — `420/service/compute-market/v1`
- Search — `420/service/search/v1`
- Notifications — `420/service/notifications/v1`
- Analytics — `420/service/analytics/v1`
- Arbitration — `420/service/arbitration/v1` (optional/explicit only under HZ-GCA-1.14)

420Hz itself receives **no new service ID** in this architecture step.

## Request envelope

Every logical request includes:

- schemaVersion;
- requestId;
- operation;
- domain;
- resourceRef;
- payload.

Authority-bearing mutations additionally require:

- actorRef;
- idempotencyKey.

Chain-sensitive or stale-state-sensitive requests may additionally bind:

- chainId/networkId;
- capabilityRef;
- deadline;
- expectedRevision;
- sourceCheckpoint.

Eligible PUBLIC reads may remain anonymous under HZ-GCA-1.10 and therefore need not invent an actorRef merely to query public state.

The request ID identifies one attempt.

The idempotency key identifies the logical mutation and is bound to operation/domain/resource/material payload.

Reusing the same idempotency key with changed material payload is a conflict/replay error.

A caller-supplied actorRef does not create authorization. For mutations it must correspond to the qualified Wallet/session actor.

## Response envelope

Every logical response includes:

- schemaVersion;
- requestId;
- status;
- source;
- sourceVersion.

It may include:

- data;
- structured error;
- sourceCheckpoint;
- finality;
- retryAfter;
- supersededBy.

Statuses:

- OK
- ACCEPTED
- PENDING
- PARTIAL
- REJECTED
- FAILED

PENDING/PARTIAL cannot be represented as final success.

Derived Search/Indexer/Analytics data remains derived even when the transport returns OK.

## Error taxonomy

Frozen logical error classes:

- INVALID_ARGUMENT
- UNAUTHORIZED
- FORBIDDEN
- NOT_FOUND
- CONFLICT
- STALE_STATE
- WRONG_NETWORK
- REPLAY_DETECTED
- EXPIRED
- RATE_LIMITED
- POLICY_DENIED
- DEPENDENCY_UNAVAILABLE
- DEPENDENCY_MISMATCH
- INTEGRITY_MISMATCH
- VERIFICATION_FAILED
- NOT_SUPPORTED
- INTERNAL_ERROR

Later transport-specific status codes must map into this logical taxonomy without changing its security meaning.

## Event envelope

Every event includes:

- schemaVersion;
- eventId;
- eventType;
- occurredAt;
- sourceDomain;
- sourceRef;
- subjectRef;
- visibility;
- payload.

Where applicable, events also bind:

- chainId;
- blockRef/finality;
- sourceRevision;
- supersedesEventId;
- payloadCommitment.

Visibility values:

- PRIVATE
- UNLISTED
- PUBLIC
- SECURITY_RESTRICTED

An event is a fact/observation. It is **not ambient authority**.

Duplicate event delivery cannot repeat the underlying source transition.

## Registry discovery interface

`RegistryDiscovery420Hz` is read-only service/version discovery.

Supported logical operations:

- ResolveService
- ResolveCompatibleVersion
- CheckActiveState

420Hz must reject inactive/deprecated/incompatible services where the operation requires an active compatible dependency.

Registry publication does not itself grant application authority.

## Wallet / Smart Account interface

`WalletAuthorization420Hz` owns user authorization handoff.

Logical operations:

- RequestActorAuthorization
- RequestTypedSignatureOrCapability
- CheckSessionCapability

420Hz never receives private keys, mnemonics, passkey secrets or recovery material.

Wallet connection alone is not operation approval.

## AI generation interface

`AIGeneration420Hz` is the 420Hz-facing AI boundary.

Logical operations:

- QuoteGeneration
- SubmitGeneration
- GetGenerationStatus
- CancelGeneration
- GetResultManifest

The interface binds GenerationIntent/request commitment, model/capability constraints, privacy/verification profile, payer max and deadline.

Returned provider/model/job/result references remain subordinate to 420AI/Compute canonical state.

Provider prose does not become canonical result success.

## Compute execution interface

`ComputeExecution420Hz` is an observation/binding interface to ComputeMarket state.

Logical operations:

- ObserveCapacityOrOffer
- ObserveAcceptedMatch
- ObserveVerification
- ObserveSettlementOrRefund

420Hz cannot rewrite matching, substitute a beneficiary, duplicate settlement, or convert an observation into broader Compute authority.

## Creative / Rights interface

`CreativeRights420Hz` preserves native Creative/Rights identity and authority.

Logical operations:

- ResolveCreatorWorkRecording
- CheckReferenceAuthorization
- CheckDerivativeAuthorization
- RegisterWorkRecordingIntent
- PublishReleaseIntent
- ResolveRightsOrLicense

420Hz never re-hashes Creator/Work/Recording IDs into competing canonical identities.

Uploads/provider metadata do not imply Rights.

## Storage interface

`Storage420Hz` handles private/public artifact references and integrity checks.

Logical operations:

- PutPrivateArtifact
- PutPublicArtifact
- GetArtifact
- VerifyArtifact
- RequestApplicationDeletion

A StorageObjectRef does not prove universal physical-deletion authority.

Integrity mismatch fails closed.

Source privacy/visibility remains the upper bound.

## Identity interface

`IdentityEligibility420Hz` supports only qualified profile/eligibility use.

Logical operations:

- ResolvePublicProfile
- CheckEligibilityPredicate
- VerifyBallotScopedEligibility

Awards voting consumes minimum-disclosure eligibility/nullifier output rather than raw legal identity.

Identity never substitutes for Wallet authorization.

## Pay interface

`PaymentHandoff420Hz` handles explicit user-facing payment intent/settlement observation where later required.

Logical operations:

- CreateExplicitPaymentIntent
- ObservePaymentSettlement

This interface does not replace ComputeMarket/Vault job funding authority.

Payment success grants no Community, Awards, moderation or interpersonal authority.

## Indexer / Search interface

`IndexerSearchRead420Hz` is public derived read infrastructure.

Logical operations:

- QueryPublicCatalog
- QueryPublicCreatorsRecordings
- QueryPublicCommunity
- QueryCharts
- QueryAwardsHistory

Responses retain cursor/freshness/source/checkpoint metadata.

Search/Indexer may never expose private/unlisted state or authorize protected writes.

## Notifications interface

`Notifications420Hz` publishes minimum-disclosure delivery events and observes delivery state.

Logical operations:

- PublishEligibleNotificationEvent
- ObserveDeliveryStatus

Delivery failure never rolls back or changes source state.

Notification actions/deep links must still pass normal Wallet/application authorization.

## Analytics interface

`Analytics420Hz` accepts public/privacy-safe aggregate signals only.

Logical operations:

- PublishPrivacySafeAggregateSignal
- QueryAggregateMetrics

Analytics does not receive raw prompts, private drafts, raw Identity proofs or moderation evidence.

It never becomes Chart/Awards/Rights/payment authority.

## Optional Arbitration interface

`Arbitration420Hz` is present only when HZ-GCA-1.14 explicit adoption rules are satisfied.

Logical operations:

- OpenExplicitCase
- ObserveCase
- SubmitAuthorizedEvidenceRef
- ObserveFinalizedRuling

There is no automatic invocation.

A ruling remains bounded evidence/input and cannot directly move funds, rewrite Rights, mutate Identity/Wallet/Governance, or overwrite finalized AwardResult bytes.

## Application commands

Frozen logical commands include:

- project/draft generation workflow;
- quote/submit/cancel/select output;
- Register & Publish;
- follow/unfollow;
- favorite/unfavorite;
- playlist creation/update/items;
- Award nomination/vote;
- moderation report/appeal.

Every mutating command binds actor/domain/resource/idempotency context.

## Application queries

Frozen logical queries include:

- generation project/job/provenance;
- published Recording;
- creator/community state;
- playlist;
- ChartSnapshot;
- Award season/ballot/result;
- moderation case.

Security-sensitive reads require source/freshness/finality context where material.

## Event catalogue

Frozen logical events include generation, release, Community, Charts, Awards, moderation, Arbitration observation and Notifications delivery events.

Important semantic rules:

- generation success does not imply REGISTERED/PUBLISHED;
- generation fail/cancel does not imply refund paid;
- release events reference canonical Creative state;
- Community events are not automatically Chart credit;
- ChartSnapshot publication is not Award eligibility;
- AwardVote is not Chart/Civic voting;
- moderation report is allegation only;
- Arbitration observation never auto-executes a remedy;
- Notifications delivery never changes source truth.

## Idempotency / replay

Every mutating command has an idempotency key scoped to:

- operation;
- domain;
- resource;
- material payload.

Retry must resolve to the existing logical result or fail without duplicate side effects.

Cross-domain reuse of authorization, voter nullifier, settlement reference or moderator capability fails closed.

## Versioning

Every envelope carries schemaVersion.

Breaking semantic changes require a new schema/interface version.

Unknown required enums/states fail closed.

Accepted jobs/ballots/results retain the versions/policies frozen when they were accepted even after a newer service version becomes active.

## Privacy / minimum disclosure

Private generation content goes only to interfaces that actually need it.

Search/Analytics/Notifications never receive raw private prompts/drafts by fallback.

Identity voting receives minimum-disclosure eligibility.

Moderation/Arbitration public event surfaces use commitments/status rather than raw private evidence.

Public query/event surfaces never widen source visibility.

## Failure behavior

The API/interface layer fails closed for:

- missing actor/domain/idempotency context;
- wrong network;
- inactive/deprecated/incompatible dependency;
- stale protected revision/checkpoint;
- dependency timeout/unavailability;
- unknown breaking schema/state;
- public fallback of private/unlisted payloads;
- duplicate command/event side effects;
- derived/canonical disagreement on protected transitions;
- Arbitration remedy outside the HZ-GCA-1.14 allowlist.

## Invariants

The machine-readable policy freezes **HZGCA-API-001 through HZGCA-API-018**.

Core guarantees:

- no 420Hz service ID/address/endpoint is invented;
- every mutation is actor/domain/resource/idempotency bound;
- Wallet signing material remains external;
- dependency identity/version/freshness is validated;
- replay cannot duplicate state;
- events do not become ambient authority;
- private data cannot fall into public derived surfaces;
- AI/Compute observations cannot bypass verification/settlement;
- Creative/Rights identity remains native;
- Storage integrity/deletion boundaries remain explicit;
- Identity remains minimum-disclosure;
- Search/Indexer/Analytics remain derived;
- Notifications remains delivery-only;
- Community events do not automatically become Charts/Awards signals;
- AwardVote remains separate from Charts/Community/Civic;
- moderation/Arbitration remain scoped;
- breaking semantics require explicit version change;
- the interface layer creates no new protocol authority.

## HZ-GCA-1.16 exit criteria

HZ-GCA-1.16 is complete when:

- request/response/event envelopes are explicit;
- commands, queries and events are explicit;
- all required dependency interfaces are explicit;
- authorization/idempotency/replay/version/freshness/error semantics are explicit;
- privacy/minimum-disclosure boundaries are explicit;
- canonical dependency service IDs are checked against repository truth where applicable;
- targeted exact-head verifier passes;
- no 420Hz service ID, endpoint, ABI/address, deployed adapter or live/testnet state is invented;
- parent HZ-GCA-1 remains open.

Next canonical work package:

**HZ-GCA-1.17 — Failure and recovery semantics**

# HZ-GCA-1.15 — Threat model

Status: **IMPLEMENTED — Level 1 threat-model definition**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Machine-readable policy:

`hz/config/gca-threat-model-v1.json`

This step freezes the 420Hz Generate + Community + Awards threat model across user authorization, AI generation, provenance/rights, storage, economics, Community, Charts, Awards, moderation/disputes and derived infrastructure.

## Protected assets

The threat model protects:

- Wallet/session actor authority and replay domains;
- private prompts, lyrics, reference audio, draft mixes, stems and project history;
- provider/model identity and result commitments;
- provenance, AI disclosure and consent references;
- Creative Work/Recording/Creator state;
- Rights claims/licenses/provenance;
- generation funding/settlement state;
- Community relations/privacy;
- qualified playback/listener evidence and Chart snapshots;
- Awards season/category/policy/nomination/ballot/vote/result/badge history;
- moderation/evidence/appeal history;
- optional Arbitration origin/finality/remedy boundaries;
- storage integrity/deletion state;
- derived Search/Indexer/Analytics/Notifications freshness;
- runtime configuration/secrets/operational credentials.

## Principal trust boundaries

Security-sensitive crossings include:

- browser → Wallet/SmartAccount;
- 420Hz → 420AI/Compute Market;
- worker/provider → result acceptance;
- 420Hz → Creative/Rights;
- 420Hz → Storage/Resource providers;
- canonical state → Indexer/Search/Analytics;
- Community → Charts;
- Wallet/Identity → Awards voting;
- moderation → application enforcement;
- 420Hz → optional Arbitration;
- 420Hz → Notifications;
- operator credentials → infrastructure.

Every crossing requires source, domain, version, authority and replay validation appropriate to that boundary.

## Adversary model

The model includes:

- unauthenticated callers;
- ordinary Wallet actors;
- Sybil Wallet operators;
- malicious prompt/tool-injection users;
- malicious reference-audio uploaders;
- voice/persona impersonators;
- compromised AI providers/workers;
- compromised storage providers/gateways;
- malicious browser/session replay clients;
- chart bot farms;
- collusive nominators/voters;
- report spammers/abusive blockers;
- compromised moderators/Awards operators;
- compromised Search/Indexer/Analytics/Notifications services;
- compromised operator/provider credentials;
- stale or malicious external evidence sources.

## Prompt / tool injection

User prompts, lyrics, metadata and reference descriptors are untrusted content.

They cannot:

- expand Wallet authority;
- expand provider tool/network capabilities;
- change payment/Rights/moderation policy;
- access secrets by instruction;
- alter canonical service identity.

Provider adapters must use structured job schemas and bounded capabilities.

Model prose is never authority.

## Provider/result spoofing

Provider/model/job/result identity must remain bound through canonical execution/provenance state.

Provider signatures alone do not prove result correctness.

A mismatched provider, model, job or result commitment fails closed.

Settlement remains verification-gated.

## Malicious media and metadata

Uploads/generated outputs may carry malicious containers, codecs, metadata, links or active content.

The architecture requires:

- MIME/type/size/hash checks;
- scan/quarantine before public release;
- sandboxed processing in later runtime implementation;
- metadata rendered as data, not executable HTML;
- safe URL schemes/origins;
- SSRF/egress protection for server-side fetches.

Production scanner/codec/CSP/egress evidence remains later implementation/testnet work.

## Unauthorized reference audio

Reference audio requires an explicit permitted path.

A private upload does not imply permission.

Where a derivative source is known, publication may require source Work/Recording/License authorization.

Missing or revoked authority fails closed.

## Unconsented voice/persona

Synthetic voice/persona use requires explicit consent/authorization metadata when that identity is claimed.

A model/provider claim does not substitute for personality/model-right permission.

Reported disputes may hide publication while source authority is reviewed, but moderation does not rewrite canonical Rights.

## Derivative-rights bypass

Transformation permission and training permission remain distinct.

Derivative registration/publication must preserve required source Work/Recording/License references and authorization.

Missing/revoked rights cannot be bypassed through generated metadata or provider claims.

## Private draft / prompt leakage

Prompts, drafts, stems, private lyrics and reference media are PRIVATE by default.

Required protections include:

- provider payload retention no longer than HZ-GCA-1.8 permits;
- private/unlisted exclusion from public Search/Indexer;
- secret/private payload exclusion from durable logs;
- public provenance using commitments instead of raw prompt/audio disclosure;
- deletion tombstones defeating stale cache/backup rebuild.

## Secret/provider-token leakage

420Hz must not custody Wallet private keys/mnemonics.

Provider credentials remain server-side secret references and must not appear in:

- client configuration;
- public manifests;
- public logs;
- generated metadata;
- model-visible prompt content unless explicitly required and bounded.

Live secret manager/key rotation remains production evidence.

## Spam / resource exhaustion

Generate may consume compute, queue, storage and money.

Architecture mitigations include:

- bounded max-spend and accepted pricing;
- actor/job idempotency;
- rate/quota controls;
- capacity-aware admission;
- cancellation/timeouts/retry bounds;
- failed/cancelled cleanup retention.

Distributed edge/load protection remains live qualification work.

## Wallet/session replay and domain substitution

Every authority-bearing mutation must bind the expected:

- actor;
- chain/network;
- action;
- resource/object;
- domain;
- replay/idempotency context;
- expiry/revocation state where applicable.

Wallet connection alone is not approval.

Changed payload under replay context fails closed.

## Payment/accounting confusion

Quote, funding, accepted price, earned provider entitlement and actual payout/refund remain separate states.

Retries may not silently recharge.

Accepted price remains bounded by payer max, actual funding and scoped capability.

Provider/payer destinations remain frozen to canonical bindings.

## Storage mismatch / resurrection

Artifact identity uses integrity/content commitments.

Wrong bytes fail closed.

Deletion/tombstone state wins over:

- replicas;
- backups;
- stale caches;
- Search/Indexer rebuild;
- provider recovery.

Restored infrastructure must reapply deletion state before serving data.

## Stale / reorged derived state

Indexer/Search/Analytics/Charts are derived and non-authoritative.

Security-sensitive actions cannot rely on stale derived state when canonical revalidation is required.

Wrong-chain, stale, reorged or unverifiable projections fail closed or are explicitly marked degraded.

## Community abuse

Community relations use logical idempotency keys so replay cannot inflate follows, favorites or playlist membership.

PRIVATE/UNLISTED state may not leak into public discovery.

Playlist visibility never widens source Recording visibility.

## Chart manipulation

A raw play is not automatically a qualified play.

Charts must reject:

- duplicate/replayed event credit;
- private/unlisted inputs;
- hidden sponsored boosts;
- manual/operator score edits;
- AwardVote reuse.

Snapshots remain versioned, deterministic and rebuildable.

## Collusive nominations

Nomination dedupe prevents multiple nominators from creating duplicate ballot candidates.

Per-nominator caps and community-threshold policies remain explicit.

Collusion cannot be eliminated entirely by static architecture; the policy must not claim stronger guarantees than it can prove.

## Vote stuffing / Sybil voting

Wallet-only mode is explicitly account uniqueness, not human uniqueness.

Unique-human claims require qualified minimum-disclosure Identity eligibility and a ballot-scoped nullifier/replay key.

One eligible voter key contributes at most one accepted vote.

Multiple wallets resolving to the same qualified human proof cannot multiply votes.

## Awards tally/result tampering

Ballot/policy are frozen before voting.

Finalization is deterministic and single-use.

Operators cannot hand-edit:

- vote choices;
- tally totals;
- winner IDs;
- finalized result bytes.

Corrections create superseding history.

## Moderation abuse / bypass

Moderation authority is scoped and explicit.

Reports are allegations, not findings.

Moderator capability cannot be manufactured by reporter status, provider status, Chart operator status or Awards participation.

Appeal history is append-only.

Comments remain gated until reporting/block/mute/hide/lock/appeal controls exist.

## Evidence/privacy leakage

Evidence commitments do not authorize public disclosure.

Private evidence remains case/role scoped.

Raw Identity proofs, wallet secrets and unrelated private data remain outside public moderation/Search/Analytics/Notifications projections.

## Arbitration authority escalation

420Arbitration is optional/explicit only.

Opening a case is not a ruling.

A finalized ruling is a bounded input.

420Hz must verify:

- canonical Arbitration service;
- registered domain;
- origin component/object;
- parties where relevant;
- finality;
- ruling/remedy commitment;
- replay;
- permitted 420Hz remedy.

Arbitration cannot become a superuser over funds, Rights, Identity, Wallet, Awards or Governance.

## Provider/operator compromise

Replaceable services may reduce availability, but may not gain canonical authority.

Compromised provider/operator credentials are bounded by:

- service identity/version;
- least privilege;
- canonical job/resource/result bindings;
- integrity/result verification;
- source-state reconciliation.

Production key rotation/suspension/runbooks remain deferred.

## Cross-component confused deputy

A valid statement from one component cannot be reused as authority in another domain merely because it is convenient.

Examples prohibited:

- Search result → publication authority;
- favorite → AwardVote;
- Chart rank → winner;
- provider signature → payment;
- moderation report → Rights mutation;
- Arbitration ruling → ambient execution.

Typed IDs, source domains, replay context and owner-protocol validation prevent such substitution.

## Accepted design risks

The model explicitly accepts that:

- model quality/safety is probabilistic;
- wallet-one-account-one-vote is not unique-human;
- social collusion cannot be fully eliminated architecturally;
- a commitment does not guarantee off-chain evidence availability;
- production anti-bot/scanner/rate-limit/provider-isolation controls need runtime evidence;
- some legal/personality-right disputes remain external until adjudicated.

These are not permission to weaken authority boundaries.

## Fail-closed rules

420Hz fails closed when required actor/domain/capability/replay context is missing, when provider/result identity does not match, when restricted reference/voice/derivative permission is missing, when private state would otherwise become public, when storage integrity fails, when economic state disagrees, when Awards policy/finality is ambiguous, or when an Arbitration/moderation action exceeds its scope.

Dependency failure never falls back to guessed authority.

## Security invariants

The machine-readable policy freezes **HZGCA-THREAT-INV-001 through HZGCA-THREAT-INV-018**.

Core guarantees:

- prompts/model output never grant authority;
- private drafts never become public by fallback;
- provider signature alone never proves accepted settlement;
- reference/voice/derivative paths fail closed without authority;
- replay never duplicates economic/community/chart/Awards effects;
- malicious media/metadata never becomes application authority;
- deletion/integrity state beats stale storage/projections;
- derived services remain non-canonical;
- Charts remain deterministic;
- Awards finalization remains deterministic/single-use;
- human-uniqueness claims require qualified proof;
- moderation remains app-scoped;
- evidence commitments do not disclose evidence;
- Arbitration remains bounded;
- operator compromise has bounded blast radius;
- stale/reorged data cannot authorize security-sensitive actions;
- cross-boundary inputs remain source/domain/version/replay bound.

## Deferred runtime evidence

HZ-GCA-1.15 does not claim completion of:

- production AI worker sandbox/network/tool isolation;
- production media scanner/codec sandbox;
- distributed edge rate limiting;
- live secret management/rotation;
- live qualified-play anti-bot controls;
- production unique-human voting verifier;
- production evidence-host key management;
- public-testnet restart/retry/reorg/rebuild abuse tests;
- live incident-response/operator-suspension runbooks.

Those remain later implementation/testnet/production work.

## HZ-GCA-1.15 exit criteria

HZ-GCA-1.15 is complete when:

- protected assets, trust boundaries and adversaries are explicit;
- every canonical threat class has a documented mitigation/residual-risk disposition;
- Generate, provider, provenance, rights, storage, privacy, economics, Community, Charts, Awards, moderation and Arbitration threats are covered;
- fail-closed rules/security invariants are explicit;
- accepted design risk is distinguished from deferred runtime evidence;
- the targeted exact-head verifier passes;
- no ABI, service deployment, address, live provider or testnet security evidence is invented;
- parent HZ-GCA-1 remains open.

Next canonical work package:

**HZ-GCA-1.16 — API/event/interface contracts**

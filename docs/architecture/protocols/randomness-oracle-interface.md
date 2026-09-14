---
title: Randomness & Oracle Interface
audience:
  - developer
  - architect
  - operator
category: architecture
status: development
version: current
---

# Randomness & Oracle Interface

420 Integrated keeps **generalized randomness** and **external facts** in separate trust domains. 420 Random produces verified entropy under a request-specific security profile. 420 Oracle turns qualified external observations into bounded provider-neutral reads. Neither protocol can silently substitute for the other.

The shared rule is fail-closed composition: applications bind their required trust policy before consuming the result, and missing verification, stale data, insufficient quorum, expired deadlines, obsolete authority epochs, or circuit-breaker state produce no canonical result.

## 420 Random canonical surface

The generalized randomness stack consists of:

- `RandomnessRouteRegistry420` — governance-versioned provider routes, operators, verifiers, methods, stake references and activation state;
- `RandomnessProfileRegistry420` — application security profiles, primary/fallback routes, timeout bounds, security tier and fallback policy;
- `RandomnessRouter420` — canonical request lifecycle, route freezing, proof verification, fallback activation and final randomness-root construction;
- `RandomnessRegistry` — immutable request/result recording behind a one-time bound canonical router;
- `IRandomnessVerifier420` — method-specific proof-verification boundary;
- `RandomnessDraw420` — deterministic domain-separated draw helpers derived from one verified randomness root.

Applications do not select arbitrary operators after a request is created. The profile and route authorities are resolved and frozen before entropy is knowable.

## Randomness request binding

A randomness request binds:

- chain ID and router address;
- requester and requester nonce;
- profile ID and profile revision;
- application domain and purpose;
- primary route and its revision;
- optional fallback route and revision;
- bound operators, verifiers and method IDs;
- requested time, primary deadline and final deadline;
- security tier and fallback policy.

The request ID is domain-separated and chain-bound. Governance changes made after request creation do not reinterpret that request because its resolved profile/route revisions and implementation addresses are captured in request state.

## Randomness fulfillment

Only the operator frozen for the active route may fulfill the request. The route-specific verifier must accept the proof against the request ID, domain, purpose and provider randomness.

After verification, `RandomnessRouter420` derives the canonical root from the request identity, profile revision, route identity/revision, method ID and provider randomness. The router stores the result through `RandomnessRegistry` with the route and proof hash.

A proposal from a recognized provider without a valid bound proof is not randomness protocol success.

## Randomness fallback and expiry

Profiles support two V1 fallback policies:

- `VOID` — no fallback route; unresolved requests become void after the deadline;
- `ONCE_THEN_VOID` — after the primary window expires, one predeclared fallback route may become active; if the final deadline passes unresolved, the request becomes void.

Fallback routes cannot equal the primary route. Callers cannot choose a new route after learning or partially observing entropy. A failed or expired route never authorizes hashing a block, oracle feed, timestamp, UI value or unrelated service response as substitute randomness.

## Deterministic draws

Applications should derive individual draws from the verified canonical root rather than asking providers for repeated ad hoc random values.

`RandomnessDraw420` domain-separates each draw by root, application domain and draw index and provides bounded integers, uniform ranges, weighted selection, shuffling and sampling without replacement. Bounded selection uses rejection sampling to avoid modulo bias.

## 420 Oracle canonical surface

420 Oracle handles external facts rather than entropy. Its canonical protocol surface consists of:

- `OracleProviderRegistry420` — provider identity, active submission operator, stake reference and provider epoch;
- `OracleFeedRegistry420` — feed type, aggregation mode, heartbeat, decimals, minimum sources, feed revision and bounded source membership;
- `OracleRiskPolicy420` — minimum confidence, maximum deviation and circuit-breaker state;
- `OracleRouter420` — replay-safe observation intake and canonical fail-closed aggregation;
- `IOracle420` — provider-neutral consumer read interface.

Provider registration grants reporting authority only. It does not grant custody, governance, validator, bridge, settlement or arbitrary execution authority.

## Oracle feed classes

V1 ordinary-oracle feeds support:

- price;
- proof of reserve;
- external outcome;
- external API result;
- automation condition;
- off-chain computation result.

Randomness is deliberately absent from this list. Applications that require entropy use 420 Random.

## Provider and source epochs

Providers have stable IDs but versioned authority. Activating a provider, replacing its operator or changing source activation advances epochs. Feed configuration revisions independently advance when the feed definition changes.

Every accepted observation snapshots:

- feed revision;
- provider epoch;
- feed-source epoch;
- observation timestamp;
- confidence;
- observation ID and data/result commitment.

An observation from an obsolete feed/provider/source epoch cannot become current again merely because a provider or source is later re-enabled.

## Observation intake and replay resistance

`OracleRouter420` accepts an observation only when:

1. the feed exists and is active;
2. the caller is the provider's current authorized operator;
3. that provider is an active source for the feed;
4. the observation ID has never been consumed;
5. the timestamp is valid and strictly newer than that provider's previous observation for the feed;
6. the confidence value is valid.

Observation IDs are globally replay-protected. Provider timestamps advance monotonically per feed.

## Freshness and canonical reads

A stored observation is only an input. It contributes to a canonical read only while its feed revision, provider epoch and source epoch match current authority and its timestamp remains within the configured heartbeat.

Feeds are bounded to at most **16 configured sources** and a heartbeat of at most **30 days**. Consumers cannot locally extend freshness or count disabled/obsolete sources to manufacture quorum.

## Aggregation modes

### Median numeric

Numeric feeds collect eligible observations and select the deterministic median. The read also exposes source count, conservative confidence, oldest contributing timestamp and source spread.

Configured maximum deviation and minimum confidence are enforced fail closed.

### Exact-result quorum

Discrete-result feeds require at least the configured source quorum to agree on the same result hash. If no result reaches quorum, the read fails. If multiple distinct results simultaneously satisfy quorum, the read fails as ambiguous rather than choosing a winner off-chain.

## Risk policy and circuit breakers

`OracleRiskPolicy420` may require a minimum confidence level, impose a maximum numeric deviation and halt a feed.

A halted feed, low-confidence quorum, excessive deviation, stale source set or insufficient current sources produces no canonical read. Clearing a halt does not resurrect obsolete observations because normal revision, epoch and freshness checks still apply.

## Randomness versus oracle authority

The protocols are intentionally non-interchangeable:

| Question | 420 Random | 420 Oracle |
| --- | --- | --- |
| What is being established? | unpredictable verified entropy | qualified external fact/result |
| Authority is bound by | request profile + route + verifier + deadline | feed + providers/sources + epochs + freshness/risk policy |
| Normal result | canonical randomness root | canonical numeric/result read |
| Failure behavior | fallback exactly as profile allows, otherwise void | read fails until policy-qualified quorum exists |
| Can it substitute for the other? | no | no |

An oracle quorum is not a randomness proof. A verified randomness root is not evidence that an external factual claim is true.

## Consumer integration

A consuming protocol should:

1. discover the canonical router/interface;
2. bind the required randomness profile or oracle feed identity;
3. record the application-specific domain/purpose where applicable;
4. request or read through the canonical router rather than a provider directly;
5. enforce its own authorization/state/value rules after obtaining the result;
6. treat pre-finality execution history as reorganizable where relevant;
7. fail closed when the protocol result is unavailable.

A successful randomness/oracle result supplies one bounded input. It never grants the provider permission to sign for a user, move unrelated funds, bypass custody rules, rewrite application state or exercise governance.

## Failure and recovery

### Randomness provider or verifier failure

The request remains unresolved. After the configured primary window, only the frozen fallback policy may change the active route. After the final deadline, the request becomes void.

### Oracle provider outage

The provider's observation naturally becomes stale or unavailable. Reads may continue only if enough other current sources still satisfy quorum and risk policy.

### Provider compromise

Deactivate or replace the provider through the relevant canonical registry, advance authority epochs, preserve historical evidence and require fresh qualified results before sensitive application writes resume.

### Registry/configuration change

Existing randomness requests retain their frozen route/profile revisions. Oracle observations from superseded feed/provider/source epochs stop contributing to current reads.

### Router outage

Dependent operations pause. Applications must not bypass the canonical router by accepting direct provider responses as protocol truth.

## Randomness invariants

- **RAND-001** — applications bind a randomness profile, domain and purpose before entropy is knowable.
- **RAND-002** — request IDs are chain/router/requester/nonce/profile/domain/purpose/deadline bound and replay-resistant.
- **RAND-003** — active operator, verifier, method and route revisions are frozen into each request before fulfillment.
- **RAND-004** — only the frozen active-route operator may fulfill, and the bound verifier must accept the proof.
- **RAND-005** — fallback behavior is limited to the request's predeclared profile; callers cannot select a new provider after observing entropy conditions.
- **RAND-006** — expired unresolved requests become void and never authorize ad hoc randomness substitution.
- **RAND-007** — `RandomnessRegistry` records requests/results only through its one-time bound canonical router.
- **RAND-008** — derived draws remain deterministic and domain-separated from the canonical verified root.

## Oracle invariants

- **ORACLE-001** — provider registration grants feed-scoped reporting authority only and no ambient custody, governance, bridge, validator or settlement authority.
- **ORACLE-002** — feed definitions bind type, aggregation, heartbeat, source quorum, revision and bounded source membership.
- **ORACLE-003** — observation IDs are replay-safe and each provider's observation timestamp advances monotonically per feed.
- **ORACLE-004** — stale observations and observations from obsolete feed/provider/source epochs never contribute to current canonical reads.
- **ORACLE-005** — insufficient source quorum, low confidence, excessive configured deviation or active circuit breakers fail closed.
- **ORACLE-006** — exact-result ambiguity fails closed rather than selecting a winner outside the protocol.
- **ORACLE-007** — consumers use canonical `OracleRouter420`/`IOracle420` reads rather than raw provider submissions as protocol truth.
- **ORACLE-008** — ordinary oracle feeds never synthesize or silently substitute generalized randomness.

## Related documentation

- [Protocol integration model](protocol-integration-model.md)
- [Infrastructure: Oracle & external-provider infrastructure](../infrastructure/oracle-external-provider-infrastructure.md)
- [Pay, Token, Swap/Exchange & Bridge](pay-token-exchange-bridge.md)
- [Trust-boundary model](../trust-boundary-model.md)

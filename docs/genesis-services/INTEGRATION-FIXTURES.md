# GEN-SVC-0 Integration Fixture Contract

## Purpose

Later GEN-SVC applications must be testable together. This fixture contract defines reusable personas, relationships and stable scenario IDs so tests do not invent incompatible users for every application.

Fixtures are synthetic test identities only. They do not imply production roles, privileges or universal reputation.

## Canonical personas

| Persona | Baseline role | Required cross-app use |
|---|---|---|
| `USER` | ordinary pseudonymous user | search, social, mail, calendar |
| `BUSINESS` | verified organization operator | Registry/place pages, events, reviews |
| `CREATOR` | media/publishing creator | Media, Reefer Review, subscriptions |
| `MODERATOR` | domain-scoped moderator | Town/content moderation only |
| `BUYER` | purchaser | Marketplace/Classifieds review flows |
| `SELLER` | P2P seller | Classifieds listing/offers/reputation |
| `STUDENT` | learner | Learn, Knowledge, credentials |
| `PUBLISHER` | publication operator | Reefer Review editorial workflows |
| `BACKER` | crowdfunding contributor | Launchpad contribution/update flows |
| `TRAVELLER` | travel user | place/event discovery and reviews |
| `FREELANCER` | post-Genesis worker fixture | gig/proposal/milestone schema tests |
| `CLIENT` | post-Genesis gig buyer fixture | contract/escrow/review schema tests |

## Stable relationships

The harness should create at least these relationships:

- `USER` follows `CREATOR`.
- `USER` joins a community moderated by `MODERATOR`.
- `BUSINESS` owns one verified public `Place` and publishes one `Event`.
- `SELLER` publishes one local-pickup `Listing` and one shippable `Listing`.
- `BUYER` messages `SELLER`, makes an offer and completes one verified interaction.
- `TRAVELLER` saves the `BUSINESS` place/event and creates one verified review fixture.
- `CREATOR` owns one `MediaAsset`, one scheduled `Stream` and one `Publication` article fixture.
- `PUBLISHER` can review/publish creator/editorial content but has no wallet authority over the creator.
- `BACKER` contributes to one reward-crowdfunding `Campaign`.
- `STUDENT` enrolls in one course, asks one question and earns one `Credential` fixture.
- `FREELANCER` submits one proposal to `CLIENT`; the resulting `Gig`/milestone remains schema-only until the Freelance UI phase.

## Scenario IDs

Later test suites should reuse these identifiers when applicable:

- `SVC-JOURNEY-001` — creator publishes media and follower receives notification.
- `SVC-JOURNEY-002` — seller lists item, buyer discovers, messages, offers and completes interaction.
- `SVC-JOURNEY-003` — traveller discovers verified place/event and submits verified review.
- `SVC-JOURNEY-004` — community user posts, receives reply and moderator performs reversible action.
- `SVC-JOURNEY-005` — backer contributes to campaign and receives campaign update.
- `SVC-JOURNEY-006` — writer publishes article and follower receives internal 420Mail/notification delivery.
- `SVC-JOURNEY-007` — student completes learning activity, answers Q&A and receives credential proof.
- `SVC-JOURNEY-008` — scheduled livestream creates Calendar event, reminder and Media live state.
- `SVC-JOURNEY-009` — private/visibility-gated object is absent from public Search/feed/geospatial projection.
- `SVC-JOURNEY-010` — rebuildable index is destroyed/rebuilt without changing canonical payment/identity/rights state.

## Data rules

1. Fixture wallet addresses, object IDs and emails/handles must be deterministic in a test environment.
2. No fixture may rely on production secrets, real personal information or external paid services.
3. Exact location fixtures use clearly synthetic/public test coordinates or named mock places; private-user coordinates are never published.
4. Verified-review fixtures must point to a synthetic verified interaction record.
5. Moderation fixtures must prove moderator scope cannot mutate wallet/payment/protocol state.
6. Escrow fixtures must support success, refund, dispute and duplicate/replay attempts.
7. Feature-gated deferred services must be testable as disabled and fail closed.

## Harness expectation

GEN-SVC application repositories/packages may implement fixtures in their native test frameworks, but fixture semantics and scenario IDs should remain compatible with this contract. Cross-application qualification may materialize the same personas into a higher-level end-to-end harness once service implementations exist.

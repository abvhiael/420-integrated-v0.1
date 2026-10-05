# PuffBuddies PB-0.5 consent invariants

## Purpose

PB-0.5 defines stable consent invariants that every later PuffBuddies matching, messaging, safety, premium, moderation, administration, and integration design must preserve.

PB-0.5 does not define the matching algorithm, storage model, moderation workflow, messaging transport, payment implementation, or lifecycle state machine. It defines the non-negotiable authorization and consent rules those later systems must enforce.

## Consent principles

PuffBuddies consent is governed by these principles:

1. **Mutuality** — ordinary private dating/social communication requires reciprocal authorized interest.
2. **Revocability** — prior consent can be withdrawn.
3. **Block supremacy** — blocking overrides prior relationship or payment state.
4. **No purchased access** — money, tokens, subscriptions, staking, or status cannot buy another person's consent.
5. **No administrative fabrication** — operators and moderators cannot manufacture mutual romantic/social consent.
6. **Purpose-bound authorization** — consent to one action is not blanket consent to every other action.
7. **Current-state authority** — stale cached authorization must not override a newer unmatch, block, suspension, deletion, or revocation.

## Canonical consent invariants

### PB-CONSENT-001 — Mutual match before ordinary private messaging

Ordinary private PuffBuddies messaging between two users requires a currently valid mutual match or another later canonical consent path that is explicitly equivalent in user authorization.

A one-sided like, profile view, payment, subscription, boost, token holding, moderator action, or administrative flag must not by itself create ordinary private messaging authority.

### PB-CONSENT-002 — Likes do not equal messaging consent

Sending or receiving a like is not equivalent to consenting to direct private communication.

A like may participate in forming a mutual match, but until the canonical match condition is satisfied, it must not grant ordinary messaging access.

### PB-CONSENT-003 — Mutual matches require independent reciprocal intent

A mutual match must derive from independent user actions or another explicitly approved reciprocal-consent mechanism.

The backend, administrator, moderator, operator, token holder, governance participant, payment system, or recommendation engine must not manufacture a mutual match.

### PB-CONSENT-004 — Unmatch is unilateral and immediate

Either participant may unmatch without approval from the other participant.

Unmatch must revoke the PuffBuddies relationship authorization that depends on the active match.

Later messaging/lifecycle work defines retention and conversation-history handling, but cached permissions must not continue treating an unmatched relationship as active.

### PB-CONSENT-005 — Block supremacy

A block overrides:

- existing match state;
- prior likes;
- prior conversation authorization;
- invitation state;
- cached authorization;
- premium/subscription state;
- paid features;
- boosts or visibility products;
- recommendation state;
- prior explicit consent to ordinary interaction.

No later feature may silently route around a current block.

### PB-CONSENT-006 — Block does not require mutual agreement

A user may block another user unilaterally.

The blocked user does not receive veto power over the block and must not retain ordinary PuffBuddies interaction authority merely because a match or conversation existed earlier.

### PB-CONSENT-007 — Consent is revocable

A user may withdraw PuffBuddies relationship consent through canonical actions such as unmatch, block, deactivation, deletion, or other later-defined revocation states.

Prior authorization must not be treated as permanent.

### PB-CONSENT-008 — Stale authorization must fail closed

Clients, APIs, caches, queues, notification workers, messaging gateways, and other services must not use stale match or permission state to continue an interaction after consent has been revoked.

Where authorization freshness is uncertain, the later implementation must fail closed for protected interaction.

### PB-CONSENT-009 — Payment cannot create consent

No payment, subscription, $420 transfer, token balance, NFT ownership, staking position, paid tier, boost, or premium entitlement may:

- create a match;
- force a reciprocal like;
- bypass a block;
- restore a revoked match;
- reveal private location/preferences;
- grant unsolicited ordinary messaging access;
- reveal private report/safety state;
- override another user's visibility or safety choice.

### PB-CONSENT-010 — Premium features may enhance tools, not access to people

Later premium features may alter the purchaser's own convenience, filters, visibility controls, cosmetics, or product tooling where canonically allowed.

They must not convert another person's private profile, attention, communication, location, preferences, or safety boundaries into a purchasable entitlement.

### PB-CONSENT-011 — Administrative roles cannot fabricate romantic/social consent

Administrators, moderators, operators, support staff, governance actors, smart contracts, automation, or recommendation systems must not create a mutual match or private relationship authorization on behalf of two users.

Administrative systems may restrict or revoke access for safety/operations, but must not manufacture positive interpersonal consent.

### PB-CONSENT-012 — Moderation authority may restrict, not compel

Moderation may suspend, restrict, hide, block system access, remove content, or revoke authorization according to later policy.

Moderation must not compel one user to communicate with, match with, unblock, re-match, or reveal private data to another user.

### PB-CONSENT-013 — Consent is scoped to the specific action

Consent to:

- appear in discovery;
- receive a like;
- match;
- exchange messages;
- share a particular profile field;
- participate in a premium feature;
- receive notifications;

must not be interpreted as blanket consent to every other PuffBuddies action or data disclosure.

Later visibility/integration steps must preserve action-scoped authorization.

### PB-CONSENT-014 — Discovery visibility is not messaging consent

Being discoverable means a profile may be shown according to canonical discovery/visibility rules.

It does not mean the user has consented to unsolicited private messaging, exact-location disclosure, unrestricted profile scraping, or public indexing.

### PB-CONSENT-015 — Match consent does not waive privacy

A mutual match authorizes only the later-defined matched-user relationship capabilities.

It does not automatically authorize disclosure of exact location, legal identity, wallet history, private preferences, safety reports, moderation records, or unrelated 420Integrated data.

### PB-CONSENT-016 — Consent does not survive account-ineligible states by default

If an account becomes suspended, banned, deleted, deactivated, or otherwise ineligible under later canonical lifecycle rules, ordinary PuffBuddies interaction authorization must not continue merely because a prior match existed.

Later lifecycle policy may define narrow read-only or appeal behavior, but must not silently preserve active relationship authority.

### PB-CONSENT-017 — Safety revocation outranks convenience and delivery

Retries, delayed queues, offline delivery, notification scheduling, message synchronization, optimistic UI, and background workers must not reintroduce an interaction that a later block/unmatch/revocation has invalidated.

Safety/consent revocation has higher authority than convenience or delivery guarantees.

### PB-CONSENT-018 — No consent from inactivity or silence

A user's failure to respond, inactivity, read receipt, profile view, presence status, or continued account existence must not be interpreted as positive consent to a new interaction.

### PB-CONSENT-019 — No consent inference from economic or reputation signals

Wallet balance, token holdings, staking, verification badges, reputation credentials, popularity, profile ranking, prior purchases, or activity score must not be treated as evidence that another user has consented to match, message, disclose private data, or remove a block.

### PB-CONSENT-020 — Consent changes must be auditable without becoming public relationship records

Later implementation must provide enough protected internal evidence to diagnose authorization and abuse incidents involving consent changes, while preserving PB-0.3/PB-0.4 confidentiality.

Auditability must not create a public match/block/unmatch graph.

## Consent state implications

PB-0.5 does not freeze the later state machine, but the following relationships are canonical:

- **like A→B alone:** no ordinary private messaging authority;
- **like A→B + like B→A / approved reciprocal mechanism:** may create active match authority;
- **active match:** may authorize later-defined matched capabilities;
- **unmatch by either side:** active match authority revoked;
- **block by either side:** ordinary interaction authority revoked and block supremacy applies;
- **deactivation/deletion/ineligibility:** ordinary active relationship authorization must fail according to later lifecycle policy;
- **payment/premium state:** never substitutes for reciprocal consent.

## Failure-path expectations

Later implementations must explicitly test at least these classes of failure:

- stale cache says matched after authoritative unmatch;
- queued message attempts delivery after block;
- premium entitlement remains active after block;
- retry worker replays a pre-block interaction;
- user is suspended after match but before message send;
- one-sided like attempts to open a conversation;
- admin/support attempts to force a match;
- payment tries to unlock unmatched messaging;
- client locally shows matched while server authority says unmatched;
- deleted/deactivated user remains in a cached interaction list.

These are canonical consent failure classes, not implementation claims.

## PB-0.5 completion boundary

PB-0.5 is satisfied when the repository:

- records PB-CONSENT-001 through PB-CONSENT-020 exactly once and in sequence;
- requires mutual/reciprocal authorization before ordinary private messaging;
- makes unmatch unilateral and revoking;
- makes block supremacy explicit;
- prohibits purchased access and tokenized consent;
- prohibits administrative fabrication or coercion of interpersonal consent;
- defines scoped consent, revocability, stale-authorization failure, and ineligible-account behavior;
- defines canonical consent failure-path classes for later testing;
- preserves PB-0.1 product identity, PB-0.2 MVP scope, PB-0.3 data boundary, and PB-0.4 privacy invariants;
- introduces no contract, fixed address, service ID, matching implementation, messaging implementation, payment implementation, or false live-integration claim.

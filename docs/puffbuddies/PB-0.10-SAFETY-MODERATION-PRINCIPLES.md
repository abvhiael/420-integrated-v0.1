# PuffBuddies PB-0.10 safety and moderation principles

## Purpose

PB-0.10 defines the canonical safety and moderation principles for PuffBuddies.

It establishes:

- report classes;
- moderation states;
- stable safety invariants;
- escalation boundaries;
- privacy and evidence handling expectations;
- action/review/appeal principles;
- interaction with blocks, consent, eligibility, lifecycle, and ecosystem dependencies.

PB-0.10 does not implement moderation tooling, automated classifiers, operator consoles, evidence storage, legal workflows, law-enforcement interfaces, contracts, addresses, service IDs, deployments, or live enforcement.

## Safety principles

1. User safety outranks growth, engagement, monetization, recommendation, and delivery convenience.
2. A user may block independently of whether a report is filed or substantiated.
3. A report may trigger review/restriction but is not itself proof of guilt.
4. Moderation authority may restrict platform participation but must not manufacture interpersonal consent.
5. Safety decisions must be explainable enough for protected internal audit without publishing private relationship or moderation records.
6. Moderation access follows least privilege and purpose limitation.
7. Payments, premium status, token holdings, popularity, or operator preference cannot purchase safety exceptions.
8. Safety controls must remain effective when downstream systems, notifications, clients, or caches are stale.

## Canonical report classes

### PB-SAFETY-001 — Harassment, threats, and abusive conduct

Reports may cover harassment, intimidation, threats, repeated unwanted contact, coercion, targeted abuse, or conduct that makes another user reasonably unsafe.

### PB-SAFETY-002 — Stalking, doxxing, and location-safety abuse

Reports may cover stalking behavior, doxxing, attempted exposure of private identifying information, location triangulation, unwanted real-world tracking, or misuse of location/discovery features.

### PB-SAFETY-003 — Impersonation, deceptive identity, and catfishing

Reports may cover impersonation, stolen identity/media, materially deceptive identity presentation, compromised-account impersonation, or manipulation of verification indicators.

### PB-SAFETY-004 — Minor / adult-eligibility concern

Reports may cover suspected underage participation, falsified age evidence, credential misuse, adult-eligibility bypass, or participation that conflicts with PB-0.6.

A minor/eligibility concern is a high-priority safety class because ordinary participation requires valid adult eligibility.

### PB-SAFETY-005 — Sexual exploitation and non-consensual sexual content

Reports may cover sexual coercion, exploitation, non-consensual intimate material, threats involving intimate material, or conduct that violates later-defined sexual-safety policy.

### PB-SAFETY-006 — Fraud, scam, financial coercion, and extortion

Reports may cover scams, financial deception, extortion, blackmail, coercive requests for value, fraudulent payment behavior, or attempts to use dating/social access to obtain assets dishonestly.

### PB-SAFETY-007 — Hate, targeted dehumanization, and severe discriminatory abuse

Reports may cover targeted hateful or dehumanizing abuse directed at protected or vulnerable persons/groups under later canonical policy.

### PB-SAFETY-008 — Spam, botting, scraping, and platform manipulation

Reports may cover automated spam, mass solicitation, scraping, bulk account activity, Sybil abuse, fake engagement, automated harassment, or manipulation of discovery/matching surfaces.

### PB-SAFETY-009 — Block/ban evasion and unauthorized contact

Reports may cover attempts to route around a block, ban, unmatch, suspension, communication restriction, or other current deny state using alternate accounts, stale sessions, integrations, payments, or indirect contact mechanisms.

### PB-SAFETY-010 — Dangerous or unlawful conduct requiring special review

Reports may cover conduct that presents serious safety concerns or potentially unlawful activity requiring specialized review under later legal/operations policy.

This class does not make ordinary moderators law-enforcement authorities and does not itself determine criminality.

### PB-SAFETY-011 — Cannabis-related coercion or unsafe transactional conduct

Reports may cover coercion involving cannabis use, pressure to consume, unsafe transactional behavior, or attempts to use PuffBuddies as an unauthorized marketplace contrary to the product scope.

Cannabis compatibility never implies consent to consume, purchase, sell, deliver, or participate in illegal conduct.

### PB-SAFETY-012 — Other / policy-unclear safety concern

Users may report conduct that does not fit a predefined category.

"Other" reports must still receive triage rather than being discarded solely because classification is uncertain.

## Canonical moderation states

PB-0.10 defines policy-level states. Exact database enums and workflow mechanics are later implementation scope.

### PB-SAFETY-013 — RECEIVED

The report has been accepted by PuffBuddies safety state.

Receipt confirms ingestion only; it is not a finding against the reported user.

### PB-SAFETY-014 — TRIAGED

The report has been classified for priority, safety class, evidence needs, conflict checks, and appropriate review path.

### PB-SAFETY-015 — REVIEWING

Authorized moderation personnel or approved review systems are evaluating available evidence under applicable policy.

### PB-SAFETY-016 — RESTRICTED_PENDING_REVIEW

A temporary protective restriction may be imposed before final adjudication when current risk justifies limiting discovery, matching, messaging, account activity, or other affected capabilities.

Temporary restriction is a safety measure, not a public declaration of guilt.

### PB-SAFETY-017 — ACTIONED

The review resulted in a canonical PuffBuddies moderation action such as warning, feature restriction, suspension, ban, eligibility hold, or another later-defined remedy.

### PB-SAFETY-018 — NO_ACTION

The available evidence/policy did not justify a moderation action at that time.

NO_ACTION does not automatically invalidate the reporter's experience or remove an independently chosen block.

### PB-SAFETY-019 — APPEALED

A moderation action is under an allowed review/appeal process.

Appeal does not automatically restore permissions that remain safety-restricted.

### PB-SAFETY-020 — CLOSED

The current moderation case is closed for ordinary workflow purposes, with protected audit history retained only as allowed by later retention policy.

Closure does not erase independent block state or automatically restore a prior match.

## Canonical safety invariants

### PB-SAFETY-021 — Block is immediate and independent

A user may block without waiting for moderation review.

Block effectiveness must not depend on reporter proof, moderator approval, payment status, notification delivery, or case outcome.

### PB-SAFETY-022 — Report and block are separate authorities

Filing a report does not automatically create a block unless later UX explicitly performs both actions.

Blocking does not require filing a report.

Neither action should silently mutate the other into a different state.

### PB-SAFETY-023 — Report count is not guilt

Number of reports, popularity, reputation, payment status, or engagement score must not be treated as conclusive proof of misconduct.

Risk scoring may prioritize review but must remain subordinate to evidence and policy.

### PB-SAFETY-024 — Safety action may restrict but never compel consent

Moderators may restrict discovery, matching, messaging, visibility, eligibility-dependent participation, or account access.

They must not force a like, match, unblock, rematch, message, profile disclosure, or interpersonal contact.

### PB-SAFETY-025 — Reporter identity and evidence remain private

Reporter linkage, report content, evidence, moderation notes, internal risk signals, and case history are private safety state.

They must not become public profile data, Search/Explorer records, AppStore metadata, payment metadata, or public-chain relationship records.

### PB-SAFETY-026 — No retaliation enablement

Moderation responses, notifications, reasons, and APIs must minimize disclosure that would unnecessarily identify a reporter, witness, or protected evidence source.

### PB-SAFETY-027 — Safety actions override convenience and monetization

Current block, suspension, ban, eligibility hold, or communication restriction outranks premium entitlement, payment success, boosts, recommendation state, cached match state, queued delivery, or other engagement features.

### PB-SAFETY-028 — Stale authorization fails closed after safety action

Clients, queues, workers, Messenger integration, Notifications, caches, and retries must not preserve interaction authority after canonical PuffBuddies safety state revokes it.

### PB-SAFETY-029 — Safety actions are scoped and auditable

A moderation action must identify the scope of restriction, policy basis, actor/authority, relevant case reference, timing, and current lifecycle state in protected audit evidence.

Auditability must not require public disclosure of the case.

### PB-SAFETY-030 — Moderator access follows least privilege

Moderators, support, administrators, and operators receive only the private data and actions required for their assigned role.

Ordinary moderation access must not imply unrestricted access to private messages, identity evidence, precise location, payment history, or unrelated ecosystem state.

### PB-SAFETY-031 — Payments and status cannot buy safety exceptions

Payment, subscription, premium status, token holdings, stake, badges, reputation, ranking, sponsorship, or operator favoritism must not bypass a block, suspension, ban, eligibility hold, report handling, or evidence rule.

### PB-SAFETY-032 — Safety state remains private and non-enumerable

There must be no public endpoint, Registry record, Search/Explorer index, chain event, analytics ranking, or wallet lookup that exposes a user's private PuffBuddies report history, moderation status, reporter identity, or case evidence.

### PB-SAFETY-033 — Automated systems cannot be sole irreversible adjudicator by default

Automation may assist prioritization, spam/bot detection, duplicate detection, or evidence organization.

A later policy must explicitly authorize any irreversible action performed without human review and define appeal/error protections.

### PB-SAFETY-034 — Evidence integrity matters

Later implementation must protect moderation evidence from unauthorized mutation, substitution, replay, cross-case confusion, and access outside the authorized case/purpose.

### PB-SAFETY-035 — Safety outcomes do not create public reputation scores

Moderation history, report counts, block counts, risk signals, or case outcomes must not silently become a public desirability, trust, social-credit, or dating-ranking score.

### PB-SAFETY-036 — Account compromise is considered in moderation

Moderation must allow later policy to distinguish misconduct by an account holder from activity plausibly caused by account/session compromise.

Security recovery does not automatically erase valid safety impact or evidence.

## Escalation boundaries

### PB-SAFETY-037 — Standard moderation escalation

Ordinary reports may progress through RECEIVED, TRIAGED, REVIEWING, optional RESTRICTED_PENDING_REVIEW, and a resulting ACTIONED or NO_ACTION state, with APPEALED/CLOSED as applicable.

The exact workflow, staffing model, and SLA remain later implementation scope.

### PB-SAFETY-038 — High-priority safety escalation

Credible imminent physical-safety concerns, suspected minor participation, sexual exploitation, extortion, severe stalking/doxxing, or similarly serious cases may receive expedited review and temporary protective restriction.

Expedited treatment does not eliminate evidence discipline, privacy, auditability, or applicable appeal requirements.

### PB-SAFETY-039 — Emergency / external-authority boundary

PuffBuddies moderation is not itself emergency response or law enforcement.

Any later pathway involving emergency services, legal process, regulatory reporting, law enforcement, or external safeguarding authorities must be governed by explicit legal/operations policy, jurisdiction, authorization, minimum disclosure, and protected audit.

### PB-SAFETY-040 — Cross-service escalation is capability-limited

PuffBuddies may ask 420Messenger, 420Notifications, Wallet/session infrastructure, or other approved dependencies to enforce only the narrow consequence within that dependency's authority.

A cross-service safety request must not grant PuffBuddies or moderators ambient authority over unrelated wallet, identity, payment, naming, governance, or protocol state.

## Safety action classes

Later moderation implementation may define specific actions within these policy classes:

- informational warning;
- content/profile remediation;
- discovery/visibility restriction;
- messaging restriction;
- feature restriction;
- temporary account restriction;
- eligibility hold/reverification requirement;
- suspension;
- ban;
- evidence preservation;
- appeal/review outcome.

These classes do not imply that every action is implemented today.

## Appeals and restoration principles

Where later policy provides appeal:

- the appealing user must not gain access to reporter identity or unnecessary protected evidence;
- an appeal is reviewed under current canonical policy;
- restoration must explicitly re-evaluate current block, eligibility, lifecycle, Messenger, and other deny states;
- reversal of a moderation action does not force another user to unblock, rematch, restore a conversation, or resume contact;
- prior payment/premium status does not create a restoration entitlement to another person.

## PB-0.10 completion boundary

PB-0.10 is satisfied when the repository:

- records PB-SAFETY-001 through PB-SAFETY-040 exactly once and in sequence;
- defines canonical report classes including harassment/threats, stalking/doxxing/location abuse, impersonation, minor/eligibility concerns, sexual exploitation, fraud/extortion, hate abuse, spam/bot manipulation, block/ban evasion, serious unlawful/dangerous conduct, cannabis-related coercion/unsafe transactions, and other/unclear concerns;
- defines canonical moderation states RECEIVED, TRIAGED, REVIEWING, RESTRICTED_PENDING_REVIEW, ACTIONED, NO_ACTION, APPEALED, and CLOSED;
- preserves immediate independent block authority and separation of report vs block;
- prohibits report-count guilt, purchased safety exceptions, moderator-manufactured consent, retaliation enablement, public moderation/reputation state, and stale-authority bypass;
- defines least privilege, protected evidence, auditability, automation limits, evidence integrity, and compromised-account considerations;
- defines standard, high-priority, emergency/external-authority, and cross-service escalation boundaries;
- preserves PB-0.1 through PB-0.9;
- introduces no moderation runtime, classifier, operator console, evidence database, contract, address, service ID, deployment, or false live-enforcement claim.

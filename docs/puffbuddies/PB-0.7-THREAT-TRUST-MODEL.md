# PuffBuddies PB-0.7 threat/trust model

## Purpose

PB-0.7 defines the canonical threat model, trust boundaries, protected assets, actor classes, abuse cases, failure assumptions, and authority ownership constraints for PuffBuddies.

It builds on PB-0.3 through PB-0.6 but does not implement defenses, choose vendors, deploy contracts, or define final operational runbooks.

## Protected assets

PuffBuddies must protect:

- adult eligibility conclusions and underlying evidence;
- profile identity and profile media;
- sexual, romantic, gender, cannabis, lifestyle, and distance preferences;
- likes, passes, matches, unmatches, blocks, and reports;
- precise location and movement data;
- private messages and attachments;
- wallet/profile unlinkability;
- moderation evidence and internal risk signals;
- account/session credentials;
- payment/entitlement context;
- deletion/deactivation intent;
- audit trails needed for safety and abuse response.

## Actor classes

### PB-THREAT-001 — Ordinary authenticated user

An ordinary user is trusted only for actions authorized to their own account and current relationship state. User-supplied profile data, claims, media, client state, and requests are untrusted inputs.

### PB-THREAT-002 — Malicious or abusive user

A malicious user may attempt harassment, stalking, scraping, triangulation, impersonation, spam, coercion, ban evasion, fraud, doxxing, sexual exploitation, social engineering, or safety-control bypass.

### PB-THREAT-003 — Sybil / multi-account adversary

An adversary may create or control multiple accounts to evade blocks, manipulate discovery, scrape profiles, probe visibility, mass-like users, coordinate harassment, or test moderation boundaries.

### PB-THREAT-004 — Compromised account adversary

An attacker controlling a legitimate account or session may abuse its existing trust, matches, messages, profile access, payment state, or stored private data.

### PB-THREAT-005 — Curious or malicious operator

Support staff, moderators, administrators, infrastructure operators, or developers may have privileged access and must not be trusted with unrestricted private-data visibility or arbitrary authority.

### PB-THREAT-006 — Compromised backend/service

A PuffBuddies service may be buggy, compromised, misconfigured, stale, replaying old state, or operating with excessive privilege.

### PB-THREAT-007 — Compromised client

Web/mobile clients may be modified, rooted, instrumented, automated, reverse engineered, or controlled by the user. Client-side checks are never the sole authority boundary.

### PB-THREAT-008 — External integration failure/adversary

Identity, messaging, notification, payment, registry, analytics, storage, CDN, email, push, or other dependencies may fail, return stale data, be unavailable, be compromised, or violate assumptions.

### PB-THREAT-009 — Public-chain observer

Any third party may inspect public chain state, calldata, logs, addresses, timing, value transfers, registry entries, and public indexer/search projections indefinitely.

### PB-THREAT-010 — Network observer

A network observer may correlate timing, IP/network metadata, request patterns, push/email events, or service endpoints even where content is encrypted.

### PB-THREAT-011 — Data-breach adversary

An attacker may obtain database snapshots, logs, backups, caches, analytics exports, object storage, moderation evidence, or secrets.

### PB-THREAT-012 — Automation/bot adversary

Bots may enumerate profiles, mass-like, scrape media, probe private state, spam reports, brute-force identifiers, automate harassment, or exploit rate-limit gaps.

## Trust boundaries

### PB-THREAT-013 — Client/server boundary

Clients are untrusted presentation and interaction surfaces. Authorization, eligibility, privacy, consent, and safety decisions must be enforced by authoritative backend/service boundaries or approved cryptographic authorities.

### PB-THREAT-014 — PuffBuddies / 420Identity boundary

PuffBuddies trusts only the minimum canonical eligibility/identity conclusion defined by later integration, not arbitrary raw provider assertions or client-provided age claims.

### PB-THREAT-015 — PuffBuddies / 420Messenger boundary

PuffBuddies must provide only current authorized messaging relationship context. Messenger must not independently manufacture PuffBuddies consent or treat stale match state as current.

### PB-THREAT-016 — PuffBuddies / 420Notifications boundary

Notification systems receive only minimum event data and are not trusted as an authority for relationship, eligibility, or account state.

### PB-THREAT-017 — PuffBuddies / 420Pay boundary

Payments may establish entitlement state but are not trusted to establish consent, eligibility, identity, safety overrides, or access to another user's private data.

### PB-THREAT-018 — PuffBuddies / public-chain boundary

Public-chain state is globally observable, durable, and unsuitable for private relationship data. Any on-chain design must assume permanent third-party observation and correlation.

### PB-THREAT-019 — PuffBuddies / Search-Indexer-Explorer boundary

Public indexing/search services are not trusted with private profile, match, block, preference, location, message, or moderation state.

### PB-THREAT-020 — Operator / private-data boundary

Privileged human roles are trusted only for the minimum functions assigned to them. Access must be role-limited, purpose-limited, auditable, and revocable.

## Canonical abuse cases

### PB-THREAT-021 — Location triangulation

Attackers may infer precise location by repeated distance/discovery queries, timing, sorting, map cells, or correlated observations.

### PB-THREAT-022 — Relationship graph reconstruction

Attackers may infer likes, matches, blocks, conversations, or relationship history from APIs, notifications, public chain events, payment timing, identifiers, or error differences.

### PB-THREAT-023 — Wallet/profile correlation

Attackers may connect a wallet, 420Name, transaction history, token balance, or public identity record to PuffBuddies membership/profile identity.

### PB-THREAT-024 — Block bypass / ban evasion

Attackers may use alternate accounts, stale sessions, cached authorization, retries, direct endpoints, premium state, or another integration to bypass a block or ban.

### PB-THREAT-025 — Messaging after revocation

Queued, retried, offline, or stale messages may be delivered after unmatch, block, suspension, or other revocation.

### PB-THREAT-026 — Eligibility bypass

Attackers may self-assert age, replay another person's credential, exploit stale eligibility, provider outage, policy-version mismatch, admin override, or payment path to bypass adult eligibility.

### PB-THREAT-027 — Profile scraping and enumeration

Attackers may enumerate accounts, scrape photos/profile fields, build shadow databases, or correlate identifiers across services.

### PB-THREAT-028 — Impersonation and identity deception

Attackers may use stolen media, misleading profile identity, compromised accounts, or manipulated verification state to impersonate others.

### PB-THREAT-029 — Report/moderation abuse

Attackers may file false reports, coordinate report brigades, probe report outcomes, retaliate against reporters, or exploit moderation workflows to expose private evidence.

### PB-THREAT-030 — Privileged insider misuse

Privileged personnel may browse profiles, messages, reports, identity evidence, or location without a legitimate purpose, or misuse admin functions to alter state.

### PB-THREAT-031 — Metadata leakage

Logs, traces, analytics, object keys, URLs, error messages, notification payloads, or payment metadata may reveal protected state even when primary content is private.

### PB-THREAT-032 — Data-remanence after deletion

Deleted/deactivated data may persist in caches, backups, indexes, analytics, derived systems, logs, or replicas beyond intended lifecycle rules.

### PB-THREAT-033 — Secret/session compromise

Stolen sessions, API keys, signing keys, service credentials, or recovery artifacts may allow unauthorized account/service actions.

### PB-THREAT-034 — Rate-limit and resource abuse

Attackers may brute-force APIs, enumerate identifiers, flood likes/messages/reports, exhaust resources, or exploit asymmetrical-cost operations.

### PB-THREAT-035 — Dependency compromise/failure

An external dependency may be unavailable, stale, malicious, misconfigured, or compromised. PuffBuddies must fail according to the authority of that dependency rather than silently broadening access.

### PB-THREAT-036 — Replay and stale-state attacks

Attackers or workers may replay old eligibility, match, payment, session, invitation, notification, or authorization state after it has expired or been revoked.

## Authority ownership principles

### PB-THREAT-037 — One authority per decision class

Later architecture must assign a canonical authority owner for each critical decision class: eligibility, profile state, discovery state, match state, block state, messaging authorization, moderation state, entitlement, and registry/configuration.

Conflicting authorities must not silently resolve in favor of broader access.

### PB-THREAT-038 — Safety and consent fail closed

Where current block, match, eligibility, suspension, or authorization state cannot be established, protected interaction must fail closed rather than infer permission from stale or missing state.

### PB-THREAT-039 — External services are capability-limited

Dependencies receive only the permissions and data required for their documented role. Compromise of one dependency should not automatically expose all PuffBuddies private data or authorities.

### PB-THREAT-040 — Auditability without public exposure

Security and abuse investigation must retain sufficient protected evidence to diagnose incidents, while avoiding public logs or globally queryable relationship/safety records.

## Security control expectations

Later implementation must address, as applicable:

- authentication and session hardening;
- authorization at every protected API boundary;
- short-lived/correctly revocable capabilities;
- server-side block/consent/eligibility enforcement;
- encryption in transit and at rest where appropriate;
- key/secret rotation and least privilege;
- rate limiting and anti-automation;
- media/content validation;
- replay protection;
- cache invalidation and freshness;
- privacy-safe logging/telemetry;
- abuse detection and moderation tooling;
- backup/index/cache lifecycle enforcement;
- dependency isolation and circuit-breaker/fail-closed behavior;
- protected operator access with audit trails.

PB-0.7 defines expectations, not an implementation claim.

## Threat acceptance rule

A later design may accept a residual risk only when:

1. the protected asset and attacker are identified;
2. the trust boundary is explicit;
3. likelihood/impact are documented;
4. compensating controls are defined;
5. the residual risk does not violate PB-0.1 through PB-0.7 invariants;
6. the acceptance is recorded by the canonical authority for that risk.

Convenience, cost, or "blockchain transparency" alone is not sufficient justification for violating a privacy/consent invariant.

## PB-0.7 completion boundary

PB-0.7 is satisfied when the repository:

- records PB-THREAT-001 through PB-THREAT-040 exactly once and in sequence;
- identifies protected assets and actor classes;
- defines trust boundaries for clients, operators, identity, Messenger, Notifications, Pay, public chain, Search/Indexer/Explorer, and private data;
- covers location triangulation, graph reconstruction, wallet correlation, block bypass, post-revocation messaging, eligibility bypass, scraping, impersonation, moderation abuse, insider misuse, metadata leakage, deletion remanence, credential compromise, rate/resource abuse, dependency compromise, and replay/stale state;
- defines canonical authority-ownership and fail-closed principles;
- defines later security-control expectations and residual-risk acceptance criteria;
- preserves PB-0.1 through PB-0.6;
- introduces no runtime security implementation, contract, fixed address, service ID, deployment, or false live-integration claim.

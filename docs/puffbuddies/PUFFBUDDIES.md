# PuffBuddies

## Canonical application identity

**PuffBuddies** is the canonical 420Integrated adult dating and social-discovery application.

- **Canonical name:** PuffBuddies
- **Ecosystem:** 420Integrated
- **Application class:** adult dating and social discovery
- **Primary modes:** Dating, Buddy, Both
- **Audience:** adults who satisfy PuffBuddies eligibility policy
- **Cannabis relationship:** cannabis compatibility is a first-class discovery dimension, but cannabis consumption is not required
- **Blockchain posture:** privacy-preserving hybrid application; blockchain is used only where it provides a concrete trust, authorization, attestation, registry, or settlement function
- **User-facing posture:** ordinary users must not need to understand blockchain internals to use the application
- **Wallet posture:** wallet ownership or wallet address alone must not publicly reveal whether a person has a PuffBuddies profile

## Purpose

PuffBuddies provides consent-based discovery for adults seeking romantic relationships, friendship, cannabis-compatible social connections, or a combination of those goals within the 420Integrated ecosystem.

The application is intended to support:

- romantic dating;
- friendship and social discovery;
- cannabis-friendly or cannabis-compatible connections;
- local discovery subject to privacy-preserving location handling;
- mutual matching before ordinary private messaging;
- safety controls including unmatch, block, report, deactivate, and delete.

## Product identity

PuffBuddies is not a public relationship registry, public cannabis-use registry, public sexual-orientation registry, NFT dating marketplace, token-wealth ranking service, wagering product, or a mechanism for purchasing access to another person.

No future feature may redefine PuffBuddies into one of those categories without an explicit canonical architecture and roadmap change.

## Initial user journey

The intended high-level product journey is:

```text
sign in / connect
  -> prove application eligibility
  -> create PuffBuddies profile
  -> choose Dating / Buddy / Both
  -> discover eligible profiles
  -> like or pass
  -> mutual match
  -> private conversation
  -> continue, unmatch, block, report, deactivate, or delete
```

This sequence is descriptive product identity, not an assertion that those later roadmap features are already implemented.

## Relationship to 420Integrated

PuffBuddies is an application within 420Integrated. It should reuse canonical ecosystem authorities rather than create conflicting copies of them.

Expected future integrations include 420Wallet, 420Identity, 420Names, 420Messenger, 420Notifications, 420Pay, 420Registry, 420AppStore, and privacy-preserving aggregate analytics where appropriate.

PB-0.1 does **not** claim those integrations are implemented, deployed, qualified, or live. Their exact authority boundaries and implementation requirements belong to later canonical roadmap steps.

## PB-0.1 authority boundary

PB-0.1 establishes application identity only. It does not establish:

- a PuffBuddies smart contract;
- a frozen or reserved Genesis address;
- a service ID;
- a registry publication;
- profile, discovery, matching, messaging, moderation, payment, or storage implementations;
- testnet or production deployment;
- mobile or web clients;
- live eligibility or identity policy.

Those items must be introduced only by their later canonical roadmap steps and qualified at the level appropriate to the change.

## Canonical identity invariants

### PB-ID-001 — Name authority

The canonical product name is **PuffBuddies**. Alternate spellings, temporary codenames, and UI labels do not create separate application identities.

### PB-ID-002 — Adult application class

PuffBuddies is an adult-only dating and social-discovery application. Eligibility details are defined later, but no implementation may silently broaden the product to minors.

### PB-ID-003 — Three discovery modes

The canonical discovery intent modes are **Dating**, **Buddy**, and **Both**. These describe user intent and do not themselves grant message, match, or visibility authority.

### PB-ID-004 — Cannabis-compatible, not cannabis-mandatory

Cannabis compatibility is core to the application identity, but a user need not consume cannabis to be eligible solely on product-positioning grounds.

### PB-ID-005 — No wallet-to-dating-profile public implication

A public wallet address, 420Name, or other ecosystem identifier must not by itself be defined as public evidence that the holder operates a PuffBuddies profile.

### PB-ID-006 — No tokenized consent

PuffBuddies product identity does not permit $420, NFTs, wallet balance, staking status, or any other economic asset to create romantic consent, force matching, bypass blocking, or buy unsolicited private access.

### PB-ID-007 — Hybrid privacy posture

PuffBuddies is not defined as an "everything on-chain" dating system. Sensitive application state may remain off-chain or encrypted when public-chain persistence would conflict with privacy, safety, or consent.

### PB-ID-008 — No implied implementation

Canonical naming and product definition are documentation authority only. They must never be treated as proof that contracts, services, integrations, deployments, clients, or policies exist.

## Non-goals fixed by PB-0.1

PuffBuddies is not defined as:

- a public on-chain relationship graph;
- a public list of cannabis consumers;
- a public list of user sexual or romantic preferences;
- an escrow marketplace for dates;
- a pay-to-message strangers service;
- a gambling, wagering, or prediction product;
- a social-credit or dating-desirability score;
- a substitute for emergency, law-enforcement, or crisis services.

## Canonical source

For PB-0.1, this document is the authoritative repository definition of PuffBuddies application identity. The canonical roadmap is `docs/puffbuddies/PUFFBUDDIES-ROADMAP.md`.

Later documents may refine architecture and implementation while preserving these identity invariants unless an explicit canonical roadmap change intentionally revises them.

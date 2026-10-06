# PB-0.14 qualification evidence

## Step

**PB-0.14 — Cannabis taxonomy**

## Qualification level

**Level 1 — per-roadmap-step fast qualification**

## Canonical definition

PB-0.14 defines canonical cannabis-compatibility vocabulary without turning cannabis fields into public or tokenized identity.

## Implementation summary

PB-0.14 adds:

- PB-CANNABIS-001 through PB-CANNABIS-040;
- optional use-status/frequency vocabulary;
- optional method, social-context, environment-boundary, partner-compatibility, interest, and enthusiasm vocabulary;
- first-class NON_USER and PREFER_NOT_TO_SAY states;
- privacy/public-identity boundaries;
- matching/consent constraints;
- economic/tokenization prohibitions;
- safety/legal/health boundaries;
- a taxonomy-extension decision rule.

No profile implementation, database, matching engine, public registry, token/NFT credential, API, contract, fixed address, service ID, deployment, or live taxonomy is introduced by PB-0.14.

## Files changed

- docs/puffbuddies/PB-0.14-CANNABIS-TAXONOMY.md
- docs/puffbuddies/PUFFBUDDIES-ROADMAP.md
- scripts/verify-puffbuddies-pb0.py
- docs/puffbuddies/PB-0.14-QUALIFICATION.md

## Requirements satisfied

- PB-CANNABIS-001 through PB-CANNABIS-040 exist exactly once and in sequence;
- canonical private vocabulary is defined for use status/frequency, methods, social context, environment boundaries, partner compatibility, interests, and optional knowledge/enthusiasm;
- NON_USER and PREFER_NOT_TO_SAY are valid first-class states;
- cannabis-use status, preferences, methods, contexts, and boundaries are private PuffBuddies state by default;
- Wallet, 420Identity, 420Names, Registry, AppStore, Search, Explorer, Analytics, public chain, deterministic hashes, tokens, NFTs, payments, staking, and transaction history cannot become cannabis identity authority;
- cannabis compatibility may influence private matching only under PB-0.13 and cannot bypass consent, block, safety, lifecycle, eligibility, visibility, or deletion;
- cannabis similarity does not create likes, matches, messaging permission, or consent to consume;
- public/purchasable cannabis desirability or reputation scoring is prohibited;
- ordinary cannabis taxonomy fields cannot establish medical, legal, impairment, professional-expertise, cultivation-authority, or product-safety conclusions;
- cannabis-related coercion and unauthorized marketplace/brokering semantics are prohibited;
- the taxonomy-extension decision rule covers purpose, type, privacy, visibility, matching use, prohibited inference, retention/deletion, safety/legal/health ambiguity, economic influence, and public representation;
- no profile implementation, database, matching engine, token/NFT credential, public registry, API, contract, fixed address, service ID, deployment, or live taxonomy is claimed.

## Implementation SHA

`a57f07fb8607ddbfbf32eaa649ee00719e85788b`

## Current main/base SHA

Current main observed at PB-0.14 start: f5a0d703ca015962e49e95d075ff582d833a7c33

PR #526 remains open on the cumulative PB-0 branch. Current-main merge-candidate reconciliation remains deferred to the applicable Level 3 phase boundary.

## CI evidence

Workflow: **PuffBuddies PB-0 Qualification**

Superseded candidate:
- implementation SHA: `f14400a230366bf9e2ad3be3a5d3f8d8a3260b52`
- push run: `37395394919` — **FAIL**
- job: `112050036706` — **FAIL**
- diagnosis: verifier/document exact-wording mismatch for the guarantee that cannabis fields are private PuffBuddies state; the canonical document already had equivalent privacy semantics and was clarified without weakening the verifier.

Corrected exact-head push qualification:
- run: `37395441562` — **PASS**
- job: `112050185738` (`pb0-fast`) — **PASS**
- exact-head checkout — **PASS**
- exact-head SHA verification — **PASS**
- cumulative PB-0 verifier — **PASS**
- accidental PuffBuddies runtime/contract implementation rejection — **PASS**

Corrected exact-head pull-request qualification:
- run: `37395445111` — **PASS**
- job: `112050196741` (`pb0-fast`) — **PASS**

## Security/adversarial/invariant scope

The cumulative verifier must reject missing/duplicate/reordered PB-CANNABIS identifiers; public/tokenized cannabis identity; wallet/token/payment proof of use; cannabis fields bypassing consent/safety/lifecycle; non-user exclusion; hidden substance-use inference; medical/legal/impairment conclusions; coercion; unauthorized marketplace semantics; and false live taxonomy claims.

## Milestone status

PB-0.14 is not a Level 2 integration milestone. It defines vocabulary/data semantics only and introduces no executable matching/profile/shared runtime integration.

## Intentionally deferred checks

Level 2 retained PuffBuddies integration is not required for PB-0.14.

Level 3 comprehensive repository qualification and current-main merge-candidate reconciliation remain deferred to the applicable phase boundary.

## Limitations

PB-0.14 defines vocabulary and semantic boundaries only. Exact UI controls, localization, product copy, matching weights, database schema, profile APIs, analytics implementation, moderation tooling, jurisdiction-specific legality, and health information remain later work.

## Blockers

None for PB-0.14.

## Completion state

**PB-0.14 — COMPLETE**

All canonical PB-0.14 exit criteria are satisfied on exact implementation SHA `a57f07fb8607ddbfbf32eaa649ee00719e85788b`.

## Next canonical roadmap step

**PB-0.15 — Visibility model**

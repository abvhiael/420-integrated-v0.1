# ID-AUDIT-7 — 420Wallet & User-Facing Identity Application

**Status:** IMPLEMENTED — Level 1 qualification pending exact-head CI  
**Repository:** `abvhiael/420-integrated-v0.1`  
**Working PR:** #438  
**Canonical roadmap:** `docs/audit/420IDENTITY-AUDIT-REMEDIATION-ROADMAP.md`

## Original step

ID-AUDIT-7 requires the canonical user-facing Identity journey.

Required workflows:

- create profile;
- update metadata/activity;
- nominate/accept controller transfer;
- link/unlink or change primary `.420` name with bilateral validation messaging;
- inspect credentials;
- reject credential;
- display validity/trust source without implying legal identity or wallet ownership.

Exit: **real contract-backed workflow with loading/empty/error/transaction/recovery/accessibility coverage.**

The adopted product architecture is 420Wallet; no separate Identity website is introduced.

## Gap analysis

At the start of ID-AUDIT-7, Wallet runtime generation already knew the canonical
Identity420 deployment address, but the audit branch had no Identity management
client and no complete Wallet user-facing Identity journey.

The canonical contract ABI and user guide defined the domain behavior, but no
Wallet code provided:

- exact Identity420 reads;
- guarded Identity writes;
- two-step controller management;
- bilateral Names420↔Identity420 primary-name validation;
- credential inspection/rejection;
- current validity/trust presentation;
- explicit anti-overclaim language;
- loading/empty/error/recovery/accessibility states.

## Implementation

Added:

- `wallet/web/core/identity-management.js`
- `wallet/web/identity-management-ui.js`
- `wallet/web/test/identity-management.test.js`
- `wallet/web/test/identity-management-ui.test.js`
- `scripts/verify-id-audit-7-wallet-identity.py`
- `.github/workflows/identity-id-audit-7.yml`
- this evidence record.

Updated:

- `wallet/web/index.html`
- `wallet/web/scripts/check.mjs`
- `docs/apps/identity/user-guide.md`

## Canonical Wallet client

The client binds to the configured chain-specific:

- Identity420 address;
- Names420 address;
- connected EIP-1193 account.

Before writes it verifies:

1. exact chain ID;
2. deployed code at Identity420;
3. deployed code at Names420;
4. Identity420 `systemName() == "Identity420"`;
5. Identity420 `protocolVersion() == 3`;
6. the expected connected account remains authorized by the provider.

All mutation paths:

- re-read canonical authorization/state;
- simulate with `eth_call`;
- estimate gas;
- revalidate again before broadcast;
- use explicit `eth_sendTransaction`;
- require a successful receipt before UI confirmation.

The client does not store or handle private keys, seed phrases, mnemonics or
persistent browser signing secrets.

## User workflows

### Profile lifecycle

Wallet supports:

- profile creation;
- profile load/empty state;
- metadata commitment update;
- active/inactive update;
- current/pending controller display.

### Controller transfer

Wallet supports:

- nomination by the current controller;
- acceptance only by the current pending controller;
- state reload after transaction confirmation.

No one-step controller replacement is presented.

### Primary .420 name

Wallet uses the existing two-contract architecture rather than treating either
one-sided pointer as sufficient.

For a nonzero primary label:

- Names420 `nameClaimsProfile(labelHash, profileId)` must be true before Wallet
  submits Identity420 `setPrimaryName`;
- Wallet only displays **bilateral binding verified** when Identity420's
  `primaryName` and Names420's profile claim agree.

Wallet supports:

- set/change primary pointer;
- clear/unlink Identity primary pointer;
- explicit messaging that unlinking Identity does not mutate Names420.

### Credential inspection and rejection

Wallet reads:

- credential subject;
- issuer;
- credential type;
- claim commitment;
- current credential validity;
- current issuer trust class/activity.

Credential rejection is allowed only when the connected account currently
controls the subject profile. The Wallet blocks duplicate rejection and warns
that subject rejection is irreversible in the current protocol.

## Trust and legal-identity boundary

The UI explicitly states:

- Identity420 is optional pseudonymous identity;
- it does not prove legal identity;
- it does not prove wallet ownership;
- issuer trust class is an issuer-policy source, not universal truth;
- credential validity is not reputation or authorization.

This preserves the canonical Identity authority boundary.

## UX and accessibility coverage

The Wallet surface contains explicit:

- loading/submitted/confirmed transaction states;
- empty profile and empty credential states;
- actionable error/recovery text;
- account/network-change invalidation;
- `role="status"` live regions;
- `role="alert"` assertive recovery output;
- explicit form labels and native buttons/select controls;
- focus return to the triggering control after blocked actions.

## Level 1 qualification

Required exact-head checks:

1. mechanical artifact/client/UI compatibility verifier;
2. Wallet static qualification;
3. focused Identity Wallet client tests;
4. focused Identity Wallet UI/accessibility tests;
5. full retained Wallet Web regression;
6. explicit no-secret-persistence scan.

The focused client suite covers:

- chain/code/contract/version/account preflight;
- profile/issuer/credential decoding;
- bilateral Names validation;
- blocked one-sided primary-name binding;
- simulated/gas-estimated/revalidated writes;
- unauthorized profile updates/controller nominations;
- invalid controller acceptance;
- subject-only credential rejection;
- duplicate rejection;
- primary-name unlink behavior.

## Level 2 disposition

No additional Level 2 milestone is required for ID-AUDIT-7.

ID-AUDIT-6 already qualified the Identity cross-service convergence milestone.
ID-AUDIT-7 introduces a Wallet consumer of the already qualified ABI rather than
a new shared authority or lifecycle dependency. The full retained Wallet Web
suite is run as direct Level 1 regression protection because the shared Wallet
shell is modified.

## Level 3 disposition

Current-main reconciliation, mobile/extension/global Wallet release
qualification, full repository Solidity/Genesis reconciliation and complete
cross-app release qualification remain intentionally deferred to:

**ID-AUDIT-10 — phase closeout, reconciliation and retained evidence**

Live testnet Wallet/Identity operation remains ID-AUDIT-9 scope.

## Exact-head qualification evidence

Pending.

## Completion state

**PENDING LEVEL 1 EXACT-HEAD QUALIFICATION**

Next canonical step after successful closeout:

**ID-AUDIT-8 — operator/deployment documentation and smoke tooling**

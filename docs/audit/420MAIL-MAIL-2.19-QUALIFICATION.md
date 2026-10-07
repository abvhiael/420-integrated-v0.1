# 420Mail MAIL-2.19 Qualification

## Step

**MAIL-2.19 — Signal Integration Boundary**

## Completion

- Status: **COMPLETE**
- Qualification level: **Level 1 — app-scoped step qualification**
- Qualified implementation SHA: `8e7643c7857583e3824d81b9ac722f20e689c61c`
- Exact qualified PR merge-candidate SHA: `533b56e3f40326826a5b24f2fc709896377af8d7`
- Current `main` / base SHA: `23ebff000a471bfbc4439894f797f3b17a530867`
- Audit branch: `mail-2-11-email-wallet-onboarding-20261006`
- PR: #537

## Canonical requirement satisfied

MAIL-2.19 establishes the architectural, credential, identity, capability, privacy and stability boundary for later Signal integration work.

It intentionally does not claim a supported operational Signal transport and does not implement MAIL-2.20, MAIL-2.21, or MAIL-2.22.

## Implementation summary

Implemented/updated repository surfaces:

- `mail/signal_boundary.go`
  - `SignalProvider`
  - `SignalIntegrationBoundary`
  - `CanonicalSignalIntegrationBoundary`
  - `validateSignalIntegrationBoundary`
  - fail-closed capability inventory
  - stable-surface gate for deep sync
- `mail/signal_boundary_test.go`
  - canonical boundary validation
  - capability-promotion rejection
  - proof that Signal is not registered as an operational connector in this step
  - authenticated/read-only HTTP boundary behavior
- `mail/http.go`
  - authenticated read-only `GET /v1/connectors/signal/boundary`
- `mail/client/client.go`
  - typed `SignalIntegrationBoundary`
- `mail/web/index.html`
  - thin UI displays Signal boundary state only
  - no Signal operation buttons are exposed
- `config/420mail-service-v1.json`
  - explicit Signal boundary policy
- `docs/420MAIL.md`
  - documented identity/credential/transport/deep-sync boundaries
- `scripts/verify-420mail-audit.py`
  - retained MAIL-2.19 config/source/API/client/UI checks

## Exit criteria / invariants individually verified

### Signal is boundary-only

Canonical status is:
- provider: `signal`
- status: `BOUNDARY_ONLY`
- architecture: `EXTERNAL_SIGNAL_TRANSPORT_ADAPTER`
- transport authority: `SIGNAL_CLIENT_OR_SECURE_BROKER_ONLY`

Signal is not registered as an operational connector by MAIL-2.19.

### Mail does not own Signal identity or credentials

The canonical boundary requires:
- `mailOwnsSignalIdentity=false`
- `mailStoresProviderSecrets=false`
- raw access-token input disabled
- raw refresh-token input disabled
- raw client-secret input disabled
- phone-number credential input disabled
- verification-code input disabled

420Mail therefore does not bootstrap, impersonate, or silently manage a Signal account/client identity.

### Later Signal capabilities remain disabled

MAIL-2.19 keeps all later operational Signal features disabled:
- account linking
- outbound notifications
- share/forward
- inbound sync
- webhook ingestion
- deep sync
- provider registration

The validator rejects any boundary value that promotes these features inside this step.

### Deep-sync safety gate

Deep sync remains explicitly conditional on:
`STABLE_SUPPORTED_INTEGRATION_SURFACE_REQUIRED`

MAIL-2.22 therefore cannot be considered implemented merely because an unofficial or unstable transport exists.

### Provider-neutral architecture remains intact

MAIL-2.19 does not alter the generic connector capability inventory or add Signal-specific transport semantics to `mail/integrations.go`.

The boundary is provider-specific policy layered outside the connector core.

### Privacy boundary

MAIL-2.19 does not:
- materialize Signal inbox state
- persist Signal message bodies
- index Signal data in public 420Search
- place Signal message bodies on-chain
- persist Signal credentials

### Read-only exposure

Authenticated users may inspect the canonical boundary through:
`GET /v1/connectors/signal/boundary`

The endpoint is read-only and does not authorize any Signal operation.

## Level 1 qualification

Workflow: **420Mail Audit Qualification**

- Run: **37510429398** (#292)
- Job: **112429847347**
- Qualified implementation SHA: `8e7643c7857583e3824d81b9ac722f20e689c61c`
- Exact tested merge candidate: `533b56e3f40326826a5b24f2fc709896377af8d7`
- Current-main parent: `23ebff000a471bfbc4439894f797f3b17a530867`

Exact checkout evidence:
`HEAD is now at 533b56e Merge 8e7643c7857583e3824d81b9ac722f20e689c61c into 23ebff000a471bfbc4439894f797f3b17a530867`

Results:
- Exact head — PASS
- Go format — PASS
- `go test ./mail/...` — PASS
- `go test -race ./mail/...` — PASS
- `go vet ./mail/...` — PASS
- `python3 scripts/verify-420mail-audit.py` — PASS
- verifier explicitly reported: `MAIL-2.19 Signal integration boundary: qualified by app-scoped checks`

## Superseded attempt / diagnosed failure

### Run 37510338262 / job 112429534761
- Exact head — PASS
- Go format — FAIL
- downstream checks skipped
- diagnosis: formatting-only client change
- action: exact formatter output applied

The superseded run is not completion evidence.

## Main reconciliation status

At MAIL-2.19 qualification:
- current `main`: `23ebff000a471bfbc4439894f797f3b17a530867`
- branch compare status: ahead
- branch behind count: 0
- PR mergeable: true

No additional main reconciliation commit was required because current `main` remained the already-reconciled base throughout MAIL-2.19.

## Milestone status

MAIL-2.19 is an ordinary step inside the documented **External bridge milestone (MAIL-2.15 through MAIL-2.29)**.

- Level 2: **NOT RUN / NOT DUE**
- prior Mailbox Foundation and Wallet-native identity Level 2 evidence remains valid
- External bridge Level 2 remains deferred to the documented milestone boundary or an earlier material shared-dependency reason

## Intentionally deferred Level 3

Level 3 remains reserved for complete app-phase closeout.

No deliberate full repository Solidity inventory, duplicate Genesis full Foundry inventory, 420 Integrated/global qualification, Geth/global fault/soak suite, unrelated app audit, or broad repository closeout was run for this ordinary step.

Automatically triggered unrelated workflows are not claimed as MAIL-2.19 evidence.

## Live/deployment limitations

Repository completion does not claim:
- a supported live Signal API
- live Signal registration or account ownership
- production Signal credentials
- live notification delivery
- share/forward behavior
- inbound/deep synchronization
- public-testnet Signal integration

Those remain later roadmap/live testnet/security/operations gates.

## Evidence inheritance

This evidence file and companion roadmap/PR bookkeeping are documentation/evidence-only and inherit qualification from the exact implementation SHA above without recursive requalification.

## Next canonical step

**MAIL-2.20 — 420Mail → Signal Notifications**

# DoobTube

DoobTube is the 420Integrated user-facing video application/client built over the canonical **420Media** service.

It is a replaceable application layer. It does not create a second Media authority, a DoobTube protocol contract, a frozen Genesis app, a reserved address, or custody of user funds/private keys.

Canonical Media service:

`420/service/media/v1`

## Current repository scope

Implemented and qualified on the audit branch:

- anonymous public discovery and playback presentation;
- Wallet-gated creator/controller actions;
- optional 420Identity presentation;
- creator library and upload preparation;
- Search-backed public discovery;
- livestream create/control through Media;
- creator-update subscriptions;
- report/appeal presentation;
- backend preferences/feed/projection control plane;
- replay-safe durable jobs;
- Storage/Media/Compute integration boundaries;
- Level 2 ecosystem integration;
- app security/abuse/moderation controls;
- loopback-only non-production deployment profile.

Not claimed here:

- public-testnet readiness;
- production endpoints/TLS;
- live Registry deployment evidence;
- production scanner/egress/secret manager;
- production monitoring/backups;
- Genesis/production release.

## Repository map

- `doobtube/api/` — versioned app backend/control plane.
- `doobtube/integrations/` — canonical external authority adapters/policy.
- `doobtube/media/` — Media upload/process/playback/livestream integration.
- `doobtube/integration/` — retained Level 2 app integration harness.
- `doobtube/security/` — app abuse/privacy/logging controls.
- `doobtube/web/` — dependency-free static browser client.
- `doobtube/ops/` — non-production deployment helpers.
- `doobtube/deploy/` — non-production deployment profile.
- `doobtube/release/` — repository release manifest.
- `doobtube/tests/` — app qualification tests.
- `docs/DOOBTUBE-*.md` — canonical architecture, product, security, operator and reference documents.

## Clean build and qualification

Requirements:

- Python 3.12+
- Node.js 22+
- Go version declared by repository `go.mod` for focused Media dependency qualification

From repository root:

```bash
python3 -m compileall -q doobtube
python3 -m unittest -v doobtube.tests.test_doobtube_adapters
python3 -m unittest -v doobtube.tests.test_doobtube_backend
python3 -m unittest -v doobtube.tests.test_doobtube_media
python3 -m unittest -v doobtube.tests.test_doobtube_security
npm --prefix doobtube/web run qualify
```

DOOBTUBE-10 additionally qualifies the operations/deployment suite and documentation verifier.

Do not substitute broad repository CI for the app-specific gate during ordinary roadmap steps.

## Non-production deployment

Build the web application:

```bash
npm --prefix doobtube/web run build
```

Then run:

```bash
python3 -m doobtube.ops.server --config doobtube/deploy/nonproduction.example.json
```

Open:

`http://127.0.0.1:8420/`

Expected default behavior:

- static DoobTube UI loads;
- `GET /v1/health` returns healthy;
- `GET /v1/readiness` returns **not_ready** because canonical external dependencies are intentionally unresolved;
- authority-bearing HTTP writes return `NONPRODUCTION_AUTH_NOT_CONFIGURED`;
- launcher binds loopback only.

This is intentional fail-closed behavior, not an error in the deployment profile.

## Configuration

Repository example:

`doobtube/deploy/nonproduction.example.json`

Browser schema:

`doobtube-web-runtime-v1`

The repository profile contains no secret.

Never put private keys, mnemonics, seed phrases, bearer tokens, stream keys or provider credentials in committed JSON.

## Documentation

Start here:

- `docs/DOOBTUBE-REFERENCE.md` — architecture/component/API/roles/state reference.
- `docs/DOOBTUBE-USER-GUIDE.md` — user workflows.
- `docs/DOOBTUBE-DEVELOPER-GUIDE.md` — developer build/test/integration.
- `docs/DOOBTUBE-OPERATOR-GUIDE.md` — deployment, migration, monitoring, recovery.
- `docs/DOOBTUBE-SECURITY-ABUSE-MODERATION.md` — threat model.
- `docs/DOOBTUBE-ROADMAP.md` — stable audit roadmap.

## Release boundary

Repository release manifest:

`doobtube/release/manifest-v1.json`

It deliberately records:

- production = false;
- testnet/genesis/production ready = false;
- no DoobTube contracts or reserved addresses;
- canonical Media service identity;
- source SHA must be materialized at final release qualification.

DOOBTUBE-11 owns the final repository Level 3 exact-head closeout.

DOOBTUBE-12 and DOOBTUBE-13 separately own public-testnet and production/Genesis release evidence.

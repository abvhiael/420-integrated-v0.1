# DoobTube — developer guide

## Prerequisites

Use repository-supported toolchains:

- Python 3.12+
- Node.js 22+
- repository Go version for focused Media dependency tests.

DoobTube has no application-owned Solidity contract.

## Clean checkout qualification

From repository root:

```bash
python3 -m compileall -q doobtube
python3 -m unittest -v doobtube.tests.test_doobtube_adapters
python3 -m unittest -v doobtube.tests.test_doobtube_backend
python3 -m unittest -v doobtube.tests.test_doobtube_media
python3 -m unittest -v doobtube.tests.test_doobtube_security
python3 -m unittest -v doobtube.tests.test_doobtube_ops
npm --prefix doobtube/web run qualify
python3 scripts/verify-doobtube-security.py
python3 scripts/verify-doobtube-docs.py
python3 scripts/verify-doobtube-baseline.py
```

The app-specific GitHub Actions workflow also asserts the exact PR implementation SHA.

## Static web build

```bash
npm --prefix doobtube/web run build
```

Output:

`doobtube/web/dist/`

The build is deterministic from repository inputs and carries no production origin claim.

## Local non-production deployment

```bash
python3 -m doobtube.ops.server --config doobtube/deploy/nonproduction.example.json
```

The launcher is loopback-only.

It deliberately exposes only public app backend reads and static web content.

Authority-bearing HTTP writes are disabled because the repository does not invent a production authentication/session issuer.

## Backend construction

The backend requires:

- chain ID;
- network name;
- SQLite path;
- optional secret-provider reference;
- dependency readiness probe.

Raw secret material is rejected by RuntimeConfig.

## Authorization

Do not use browser visibility/buttons as authorization.

DoobTube backend authorization consumes an `AuthContext` with:

- Wallet;
- chain ID;
- network;
- capability set.

Canonical Wallet/Smart Account/Media authority remains external.

## Idempotency

For app mutations:

- require bounded `Idempotency-Key`;
- scope by actor + operation;
- hash semantic request body;
- exact replay returns prior result;
- changed payload under same key fails conflict.

Do not move abuse throttling outside the first-execution effect, or exact replay will consume a new rate slot.

## Projection integration

Projection data is derived.

Rules:

- strictly ordered events;
- finalized history cannot be crossed by rollback;
- block parent/hash consistency is enforced;
- only READY + PUBLIC + Rights-authorized state may become public feed state;
- projection state may be rebuilt.

Never treat feed/Search as protocol authority.

## Media integration

DoobTube reuses 420Media interfaces.

Do not create alternative upload/readiness/livestream semantics.

Important boundaries:

- scanner before safe promotion;
- exact upload-plan binding;
- Storage manifest revision match;
- safe playback URL;
- provider freshness/identity;
- processing deadline;
- canonical controller revalidation.

## Database migrations

Current schema version is 2.

The Store automatically migrates older recognized schemas forward.

A database newer than the runtime fails closed.

Before upgrading:

1. stop app writes;
2. snapshot the SQLite database;
3. record source SHA/schema version;
4. run the new runtime against a copy;
5. verify migrations and retained tests;
6. resume only after health/readiness/rebuild checks.

Rollback across a schema migration should restore the pre-upgrade snapshot with the previous qualified source SHA; do not run an older runtime against a newer schema.

## Adding dependencies

Do not adopt an ecosystem service merely because it exists.

A new dependency requires:

1. canonical architecture/dependency decision;
2. exact Registry/service identity;
3. authority/failure semantics;
4. tests;
5. roadmap qualification at the appropriate level.

## Adding contracts

Current V1 proves no DoobTube contract is required.

Any future contract requires an explicit architecture decision and then normal repository contract/Genesis ownership qualification.

## Security

Read:

`docs/DOOBTUBE-SECURITY-ABUSE-MODERATION.md`

Never:

- accept raw private keys;
- log bearer/stream credentials;
- widen public visibility from Search/index data;
- treat upload transport success as READY;
- bypass Media/Storage/Rights canonical state;
- silently add direct Pay/Compute/Bridge/Oracle calls.

## Pull request qualification

Ordinary roadmap steps use the DoobTube fast gate.

DOOBTUBE-8 Level 2 is retained as a milestone/manual workflow.

DOOBTUBE-11 owns the final expensive repository Level 3 closeout.

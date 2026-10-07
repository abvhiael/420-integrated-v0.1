# DoobTube — operator guide

## Qualification boundary

This guide covers repository and non-production operation.

It does **not** claim public-testnet or production readiness.

DOOBTUBE-12/13 own live environment evidence.

## Preflight

Before starting a non-production instance verify:

1. exact intended source SHA;
2. Python/Node/Go supported toolchains;
3. web build passed;
4. DoobTube app tests passed;
5. deployment profile has `production:false`;
6. bind host is loopback;
7. intended chain/network values;
8. database path and backup location;
9. canonical dependencies are not falsely marked available;
10. no secret is committed into JSON.

## Build

```bash
npm --prefix doobtube/web run build
python3 -m compileall -q doobtube
```

## Launch

```bash
python3 -m doobtube.ops.server --config doobtube/deploy/nonproduction.example.json
```

Default endpoint:

`http://127.0.0.1:8420`

Expected:

- `/v1/health` = 200/ok;
- `/v1/readiness` = 503/not_ready while external dependencies are unresolved;
- web files load;
- mutation HTTP methods return `NONPRODUCTION_AUTH_NOT_CONFIGURED`.

A 503 readiness response in the default profile is a **successful fail-closed deployment check**.

## Configuration reference

### Deployment schema

`doobtube-nonproduction-v1`

Required fields:

- `production` — must be false;
- `bind.host` — loopback only;
- `bind.port` — 1..65535;
- `runtime.chainId` — positive integer;
- `runtime.network` — non-empty;
- `runtime.databasePath` — SQLite path;
- `runtime.webRoot` — built web root;
- `dependencies.420Media`;
- `dependencies.420Registry`.

### Browser runtime

Schema:

`doobtube-web-runtime-v1`

Production origin remains null in repository configuration.

Canonical external service IDs must not drift.

## Secrets

Repository configuration may contain only opaque references.

Do not store:

- private keys;
- mnemonics;
- seed phrases;
- Wallet session bearer tokens;
- stream keys;
- provider credentials;
- scanner credentials.

Production/live operation requires an external secret manager and rotation policy.

## Database and migrations

Current schema: 2.

Backup before any upgrade.

Safe upgrade sequence:

1. stop writes;
2. backup database and record checksum/source SHA;
3. test migration on a copy;
4. start new runtime;
5. inspect health/readiness;
6. rebuild derived projection if necessary;
7. verify canonical dependency state;
8. resume writes only after checks pass.

Rollback:

- stop new runtime;
- restore pre-upgrade DB snapshot;
- restore previous qualified source SHA/config;
- restart;
- rebuild derived state from canonical source;
- verify health/readiness.

Never run an older binary against a newer unsupported schema.

## Projection recovery

Feed/index state is rebuildable.

On suspected projection corruption:

1. stop authority-bearing writes;
2. preserve logs and database backup;
3. identify trusted finalized source point;
4. execute qualified projection rebuild;
5. verify PRIVATE/UNLISTED exclusion;
6. compare canonical Media/Rights state;
7. resume only after readiness checks.

## Livestream recovery

Persisted session state contains opaque credential references only.

After restart:

- revalidate canonical stream controller;
- respect reconnect bound;
- do not infer active state locally;
- treat failed recovery as failed until Media confirms canonical state.

## Incident response

### Suspected credential leak

1. disable affected operation/session;
2. rotate at owning secret/provider system;
3. invalidate affected session;
4. inspect redacted logs/audit identifiers;
5. verify canonical state;
6. resume with new opaque credential reference.

### Suspected operator/provider compromise

1. stop new jobs/sessions to affected provider;
2. deactivate through owning Media governance path where applicable;
3. rotate credentials;
4. quarantine suspect outputs;
5. compare canonical state;
6. rebuild derived projections;
7. requalify before restoring service.

### Malicious upload/scanner anomaly

1. quarantine;
2. stop downstream publication/processing;
3. preserve hashes/provenance;
4. alert security/operator;
5. do not publish Search result;
6. require clean re-scan/review before restore.

## Monitoring / SLOs

Repository target SLOs are operational targets, not production evidence.

Monitor at minimum:

- health/readiness;
- dependency availability/drift;
- API error counts;
- rate-limit saturation;
- idempotency conflicts/replays;
- job retries/failures;
- projection rebuild/reorg failures;
- scanner unavailable/quarantine/reject;
- upload/readiness latency;
- livestream reconnect exhaustion;
- moderation volume/denials;
- webhook signature/replay failures at Media;
- secret-redaction regressions.

Recommended non-production targets:

- health endpoint availability: >= 99% during scheduled test window;
- no accepted authority-bearing write while auth gateway absent;
- zero PRIVATE/UNLISTED items in public feed;
- zero unredacted recognized secrets in durable error fields;
- zero projection advance past finalized-history conflict.

Production SLOs require separate approved deployment values and alert thresholds in DOOBTUBE-12/13.

## Troubleshooting

### Web says runtime unresolved

Expected when Media/DoobTube service origins are not materialized.

Check runtime-config and intended environment.

Do not bypass the fail-closed gate.

### Readiness returns 503

Inspect dependency readiness.

The default local profile intentionally reports Media/Registry unavailable.

Do not change readiness to green solely to make smoke tests pass.

### Upload never reaches READY

Check canonical Media/Storage state.

Do not treat transport success as readiness.

### Livestream start uncertain

Refresh canonical status before retry.

Do not assume the local desired-live flag means Media is active.

### Search missing media

Check:

- Media READY;
- PUBLIC visibility;
- Rights authorization;
- Search projection/index finality.

Do not manually inject a public Search item to bypass canonical eligibility.

### Rate limited

Wait for the configured window.

Do not disable limits to clear load.

### Database schema newer than runtime

Stop.

Use the qualified newer runtime or restore a compatible pre-upgrade snapshot.

## Backup policy

Back up only non-rebuildable continuity data required by the deployment.

Derived feed/Search state should be reconstructed from canonical sources when possible.

Backups must be protected as application data and must not include raw private keys/secrets.

## Release manifest

Repository manifest:

`doobtube/release/manifest-v1.json`

Before any release handoff materialize:

- exact source SHA;
- environment/network;
- endpoints;
- live dependency identities;
- qualification lineage.

Do not flip readiness booleans merely because repository tests pass.

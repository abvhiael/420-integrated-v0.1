# BNB-3.2 — Production infrastructure

Status: REPOSITORY IMPLEMENTATION COMPLETE / LEVEL 1 PASS / LIVE OPERATIONS DEFERRED.

Authority: [approved Phase 3 roadmap](BNB-PHASE3-ROADMAP.md), BNB-3.2. Phase 2 qualified source and merged baseline remain preserved. This is a repository implementation, not independent deployment/issuer/legal approval. Keep the Phase 3 audit PR open and unmerged until its authorized phase integration.

## Requirements and implementation

| Canonical requirement | Repository implementation / exit verification |
| --- | --- |
| Deployable API/web/database topology | `compose.production.yml`: two API instances, immutable static web, explicit HTTPS ingress, external dedicated managed PostgreSQL and separate migration profile. Only ingress is host-published. Web `/v1/bnb/*` forwards to the API so existing relative browser requests preserve origin/session boundaries. |
| Immutable images | API build accepts a digest-pinned Python base and embeds exact build SHA/OCI revision. Web build requires an explicit base. Deployment contract requires manifest digests for API/web/ingress, matching configured deployment images and exact API build SHA. CI resolves official base/ingress images to digests and validates builds; no image publication or deployment is claimed. |
| Authenticated secret/issuer bindings | `production.py` reads mounted runtime or migrator DSN with owner-only permissions; no inline DSN/retired HMAC secret/public issuer-key overrides. Complete twelve-prefix RS256 issuer/audience/public-key-file/SHA256 inventory, scoped references and HTTPS origins. Public keys must be RSA >=2048 bits, never private keys. Files must be bounded regular files under the mount, not symlinks/escapes or writable by other users. |
| Verified TLS | PostgreSQL `verify-full`, mounted root CA, SCRAM channel binding required, actual negotiated TLS check, fixed timeout and search path. Ingress explicitly serves HTTPS with operator-supplied certificate/key and HSTS; no HTTP listener or automatic unapproved certificate provisioning. CI witnesses valid CA/hostname and rejects wrong CA/hostname. Internal Docker backend HTTP is a private network segment, not claimed to have mutual TLS; cross-host deployments require separately approved network/TLS policy. |
| Least privilege | Dedicated database roles: NOLOGIN owner; separately credentialed migration role; runtime has no elevated attributes, memberships, schema/database CREATE, TEMP, table ownership, TRUNCATE or ledger writes. Runtime gets only required DML and ledger SELECT. Startup detects role/ownership/privilege drift. |
| Controlled migrations | Operator-reviewed role bootstrap; separate migration command/credentials; canonical sequential/checksummed ledger and advisory lock retained. SET LOCAL owner role, migrations and runtime grants commit atomically; unknown preexisting schema/drift are never silently adopted. Parallel/repeat and wrong-role tests. No automatic migration on API startup. |
| Failure-path qualification | Retained app runtime/security/PostgreSQL/browser/container suite plus new configuration, mounted-file, issuer, immutable-image, activation, TLS, privilege, migration and static-web negative tests. Unconfigured production command and direct API startup fail closed with sanitized errors. |

API import independently validates the production contract; starting uvicorn directly cannot bypass mounted bindings or database privilege checks when `BNB_ENV=production`. The ordinary local/test DSN path remains explicitly local. Local Compose no longer requests the retired HMAC assertion secret; protected routes still require external RS256 issuers.

## Operator preparation (not executed by this source change)

1. Allocate a **dedicated** approved PostgreSQL database. Independently review `database-roles.sql` before administrator execution: it revokes PUBLIC schema/database privileges and therefore must not be applied to a shared database. Provision SCRAM credentials in the approved external secret manager, not Git or image layers. Existing deployments require independently reviewed ownership/ledger reconciliation; never fabricate a ledger or replay old DDL against unknown state.
2. Publish qualified API/web images and record actual OCI manifest digests, build/source SHA and dependency/SBOM provenance. Supply an approved digest-pinned ingress image. Registry publication credentials, signing, network access and operator authority are external prerequisites. The CI-local image/configuration fixtures are not registry publication or immutable deployed witnesses.
3. Populate `deployment.template.json` only with independently approved real issuer metadata/public-key fingerprints/reference provenance and actual HTTPS origins. Its replacement markers intentionally fail validation; it contains no usable keys, credentials, approvals or deployable fake authority. A reference string binds configuration but is never self-authenticating: runtime status explicitly reports operator approval unverified and live acceptance false.
4. Runtime binding directory: `deployment.json`, `runtime.dsn`, trusted database CA and approved public issuer keys. Migration binding directory: its own `deployment.json`, `migrator.dsn`, CA and public keys. **Never put migrator.dsn in an API mount or runtime.dsn in the migration mount.** DSN files must be 0600, readable by UID 10001. Public configuration/keys may be 0644, not group/world writable. Mount all bundles read-only. Do not put credentials in Compose environment interpolation.
5. Runtime DSN must identify `bnb_runtime`; migration DSN identifies `bnb_migrator`. Both specify an approved database hostname/name, password, `sslmode=verify-full` and mounted `sslrootcert`. Hostaddr/service/passfile/options/private client-key overrides are prohibited. Launch supplies fixed timeout, search path and required TLS channel binding. Run the approved migration profile once, then start API replicas; API never self-migrates.
6. Supply valid HTTPS certificate/key files outside Git, managed rotation, matching API/web DNS names, external ingress configuration path and separate binding directories. API and static-web origins must be distinct; the web ingress proxies only the canonical API prefix. Run ingress configuration validation, authenticated health/permission probes and independent certificate/issuer revocation drills before external exposure. Read-only containers, UID 10001, dropped capabilities and no-new-privileges remain mandatory. Never publish API/web or database host ports directly.

Production configuration/startup validation does not verify real organizational approval, domain ownership, deployed image provenance, authorization of public exposure, human acceptance or chain/payment finality. Operators must independently verify those release witnesses. No infrastructure is provisioned and no credentials/keys are generated for production by this change.

## Qualification scope and retained boundaries

Level 1 uses the existing exact-head `bnb-runtime.yml` owner, preserving every previous check and adding BNB-3.2 fixture/build/configuration checks. The TLS preparation helper operates **only on the explicit ephemeral GitHub service container** and uses two-day CI certificates/fixture passwords. No test-generated issuer/certificate is accepted as a production approval. PostgreSQL integration checks must actually run with their explicit TLS fixture; skipped integration is not PASS.

No Solidity, Genesis addresses/catalogs, Pay finality semantics, Identity role authority or Travel booking flags are changed. No full Foundry, global Integrated/Geth/fault/soak or global Docs run belongs to this ordinary step. Level 2 M3-A follows BNB-3.6; M3-B follows BNB-3.10; Level 3 remains BNB-3.12.

## Genuine external deferrals (not waived)

T-BNB-OPS-214 still requires independently administered infrastructure, managed secret/database/TLS provenance, at least two actual API instances, verified database failover/connection exhaustion, encrypted off-host backup/restore, measured RTO/RPO, incident/on-call and independent operator/security signoff. T-BNB-IDENTITY-1/2, PROPERTY-1 and the other issuer/legal/Pay/Location/Compliance/Reputation gates still require authentic approvals and witnesses. Readiness references and CI fixtures cannot substitute.

Repository-side exit is complete only after all applicable Level 1 jobs/test/build/configuration checks pass on one exact implementation SHA and durable evidence is recorded. Overall live operational acceptance remains DEFERRED until those original external criteria pass. Next canonical step after repository qualification: **BNB-3.3 — Identity and host verification**, preserving its independent acceptance gates.

## Exact-source Level 1 completion evidence — 2026-10-12

Qualified implementation: `5ce7059b17af1dfd76405f97570f189541817a81`. Audit branch: `audit/bnb-phase3-infrastructure-20261012`; draft PR #620 stays open and unmerged. Branch source base: `835e9ec8a43481f65f0b68ae83b399743efee5b2`. Main observed during qualification: `bc0faa5dafecda3de0620a9581f9953b89cd95fb`; its two later commits contain only unrelated Budtender assets, with no BnB/shared executable overlap. This is scoped qualification of the branch source, not qualification of an untested synthetic merge or a Phase 3 closeout.

Runtime workflow `38308097570`, job `115006913036`: terminal SUCCESS. Actual checkout and exact-head assertion both bind the full implementation SHA above. All declared required runtime steps completed SUCCESS; no required skipped, cancelled, missing or stale step is counted as passing. Full runtime inventory: **207 passed, zero failed/skipped** (163 retained plus 44 BNB-3.2 cases, including thirteen real verified-TLS PostgreSQL cases). Six migration/parallel-ledger cases also passed in the separately retained operations stage; they are a subset, not six additional unique tests.

| Required exit criterion | Exact-source verification |
| --- | --- |
| Deployable topology | Rendered Compose validates API A/B, web, HTTPS ingress and isolated migration profile; immutable image references, read-only filesystems, all capabilities dropped, no-new-privileges, non-public backend ports and separate credential bundles. Configuration fixture only, no actual independent production deployment. |
| Immutable images | API and web built from resolved official Python manifest; API OCI revision equals implementation SHA; non-root UID 10001; read-only web container smoke. Build evidence below distinguishes local config IDs from published/deployed manifest provenance. |
| Secret/issuer bindings | Complete twelve-prefix inventory, pinned RSA public-key hashes, HTTPS issuer/audience checks, bounded mounted-file inventory and credential separation; root, inline/hidden/admin credentials, writable/symlink/escape, missing issuer and weak/private key negative cases PASS. Approval references remain unverified provenance, never self-issued approval. |
| Verified TLS | Ephemeral PostgreSQL fixture negotiates verify-full/SCRAM channel binding; wrong CA/hostname fail. Official ingress image validates explicit certificate configuration. Production certificates, managed database and network policy still need independent witnesses. |
| Least privilege | Runtime DML works; DDL, table TRUNCATE, ledger writes and owner role assumption fail. Elevated role/schema privilege drift and six accidental TRUNCATE/REFERENCES/TRIGGER grants on ledger/property are rejected at startup. |
| Controlled migrations | All twenty canonical checksummed migrations retained; separate migrator role, atomic owner-role DDL/DML grants, repeat/parallel and wrong-role qualification PASS; packaged non-root migrations and staging ready/listing smoke PASS. |
| Failure and preserved regressions | 207 runtime/security/API tests, backup/restore ledger/data comparison, Python compilation, UI Node syntax, browser axe smoke, static CSP hash and private-file 404, unconfigured production CLI and direct API fail-closed startup without input disclosure PASS. Manual accessibility and real off-host restore are not inferred. |

### Retained source/architecture evidence

Implementation delta: `.github/workflows/bnb-runtime.yml`; `services/420bnb/{Dockerfile,Dockerfile.web,api.py,production.py,web_server.py,compose.local.yml,compose.production.yml,Caddyfile.production,database-roles.sql,deployment.template.json}`; `services/420bnb/tests/{prepare_tls_fixture.py,test_bnb32_infrastructure.py}`; this evidence document. All fourteen candidate files were checked against intended file bytes by Git blob SHA; the final follow-up candidate changes only the workflow fixture path. Roadmap status is a subsequent evidence-only addition.

| Retained app workflow | Run / job | Result / checkout |
| --- | --- | --- |
| 420BnB BNB-1.4 Authority Boundaries | `38308097408` / `115006911567` | PASS / exact `5ce7059b17af1dfd76405f97570f189541817a81` |
| 420BnB BNB-1.3 Domain and M1 | `38308097659` / `115006912955` | PASS / exact `5ce7059b17af1dfd76405f97570f189541817a81` |
| 420BnB BNB-1.5 Financial Architecture M2 | `38308097592` / `115006912558` | PASS / exact `5ce7059b17af1dfd76405f97570f189541817a81` |
| 420BnB BNB-1.7 Guest Host Experience | `38308097532` / `115006912066` | PASS / exact `5ce7059b17af1dfd76405f97570f189541817a81` |
| 420BnB BNB-1.9 Deployment Operations | `38308097549` / `115006912314` | PASS / exact `5ce7059b17af1dfd76405f97570f189541817a81` |
| 420BnB BNB-1.8 Security Privacy Abuse | `38308097614` / `115006912977` | PASS / exact `5ce7059b17af1dfd76405f97570f189541817a81` |
| 420BnB BNB-1.6 Backend Architecture | `38308097525` / `115006913235` | PASS / exact `5ce7059b17af1dfd76405f97570f189541817a81` |

Every counted source check above actually checked out the qualified implementation. Standalone BNB-1.1/1.2 PR workflows use GitHub's synthetic merge checkout and are excluded from exact-implementation PASS; their verifiers are also executed by exact-head BNB-1.3/1.5. Legacy workflow names mentioning M1/M2 are retained source consistency checks and do not declare Phase 3 M3-A/M3-B milestones complete.

### Build provenance and artifact

Artifact `bnb32-infrastructure-5ce7059b17af1dfd76405f97570f189541817a81`, ID `11773586419`, archive digest `sha256:6001cdb14d933ee2eea548a0184e8406acf2452c93f7e5c1ef4a665feb71405c`, size 552 bytes, created `2026-10-12T21:04:19Z`; seven-day retention (expiry `2026-10-19T21:02:23Z`). Job-produced `build-evidence.json` and artifact metadata both bind the exact qualified SHA.

```json
{
  "api": {
    "local_image_config_id": "sha256:e62e5304f4845ceef0d83e9fd1c1c4746192b230b48eb57971067212c3ea7f66",
    "user": "bnb"
  },
  "ingress_manifest": "caddy@sha256:f2a1290d0463aad60660d4ec134943f183ee2a5f6c3eb7bf32dd984f2f020772",
  "live_accepted": false,
  "python_base_manifest": "python@sha256:a6e34c598f2467ed0e9a8d349809fcd8b5c603269512df273a0bb1784edc11b1",
  "qualified_sha": "5ce7059b17af1dfd76405f97570f189541817a81",
  "registry_publication_verified": false,
  "schema": "420.bnb.infrastructure.ci.v1",
  "web": {
    "local_image_config_id": "sha256:c19f594d3f95d9f47c480e8e544972155e95e0be75cb2044caf2561ac23b9eec",
    "user": "10001:10001"
  }
}
```

The artifact is retained seven days; the values recorded here and job logs provide durable provenance after expiration. Registry publication and independent live acceptance are explicitly false. No generated CI issuer/password/certificate becomes a production witness.

### Failure reconciliation and bounded security assessment

Superseded run `38306378005` at `690ab4b1fc2f94e9f4a472cac9decbaaf319d8b6` failed its web assertion because hosted runners lacked `rg`; 201 tests had passed, but downstream checks were skipped and the run is not PASS. Portable grep preserves all assertions. Run `38307674452` at `ab3baa613cba3545f22914ed1f13f97280a8e65d` passed 207 tests and all steps through production startup, then failed because the CI ingress configuration path was relative and Compose interpreted it as an undefined volume. The final candidate corrects that fixture to the absolute GitHub workspace path without changing production security semantics. Previously cancelled/queued/superseded candidates provide no completion credit. Workflow byte content was independently verified after correcting a stale staged-file upload; final workflow blob is `03d81590595d2253f5ed901b9cee4f8d1c841b79`.

Security review added startup rejection of extra runtime table privileges and six actual PostgreSQL regressions. Repository checks establish fail-closed configured startup, bounded mounted secrets, external RS256 authority, verified database TLS, migration/runtime separation and disabled activation. They do not prove approval legitimacy, operator independence, domain ownership, certificate rotation, managed infrastructure, public ingress exposure approval, deployed immutable image provenance, legal eligibility or live funds/finality. No frozen Genesis map/catalog, Solidity/ABI, Identity controller authority, Pay accounting/finality/refund/payout semantics, or disabled Travel booking/financial flags changed. Review is bounded source/configuration evidence, not an independent production security certificate.

Level 2 M3-A remains scheduled after BNB-3.6 and M3-B after BNB-3.10; final app end-to-end milestone is BNB-3.11. Level 3 canonical Solidity/Genesis/Integrated/global Docs/client/shared closeout remains intentionally deferred to BNB-3.12; no broad qualification was manually dispatched for this ordinary step. Auto-triggered skipped global Docs is not PASS; unrelated automatic Oracle/publication checks are not the BNB-3.2 qualification owner.

Repository-side BNB-3.2 exit criteria are individually satisfied above. **Live operational acceptance remains DEFERRED**, principally T-BNB-OPS-214 and authentic managed secret/issuer/database/TLS/operator/security witnesses; original external requirements are not waived. Phase integration/monolithic merge remains gated by BNB-3.12 and owner approval. Next canonical roadmap step: **BNB-3.3 — Identity and host verification**. This completion record and subsequent roadmap status update are evidence-only: they change no executable source, tests, workflows, dependencies, configuration, generated artifacts, interfaces, deployment state or substantive requirements.

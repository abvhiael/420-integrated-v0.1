# CMP-3.13 — Windows/Linux/macOS packaging qualification evidence

Status: **COMPLETE**

## Roadmap step

- Step: **CMP-3.13 — Windows/Linux/macOS packaging**
- Qualification level: **Level 1**
- Level 2: **not required**
- Level 3: deferred to **CMP-3.14 — Phase closeout**

## Qualified implementation/specification/workflow

- Implementation/spec/workflow SHA: `6a5e82bbaa2fd9073c8d6f3415f2460048f115ca`
- Audit branch: `cmp-3.1-worker-daemon-20261004`
- Pull request: **#512 — CMP-3: node420 compute worker runtime**
- Current `main` at qualification review: `b338b9c9c140957b0ea8619b0b20bfed415f2c6d`
- Qualified-candidate divergence: **228 ahead / 380 behind** current `main`
- Merge base: `2280fb6f9915b849560d9d4d5a95d999c4adc669`

The accumulated CMP-3 branch remains intentionally unreconciled during this ordinary packaging step. Full current-main reconciliation and exact accumulated merge-candidate qualification remain CMP-3.14 Level 3 work.

## Current-main packaging dependency review

The directly relevant pre-existing packaging/build inputs were compared between current `main` and this branch and were blob-identical:

- `go.mod` — identical;
- `VERSION` — identical;
- `scripts/build-testnet-rc.py` — identical;
- `docs/STEP-4.9-TESTNET-RELEASE-CANDIDATE.md` — identical.

Therefore current-main drift did not change the Go toolchain declaration, repository version, or release-packaging precedent used by CMP-3.13.

## Canonical definition and derived boundary

The canonical roadmap defines CMP-3.13 exactly as:

**Windows/Linux/macOS packaging.**

It does not prescribe a release framework, package manager, native service API, code-signing provider or architecture matrix.

Repository release precedent requires exact source identity, machine-readable build metadata, checksums and no readiness/promotion claim merely because an archive exists.

CMP-3.13 therefore freezes a worker-only deterministic package matrix and platform startup/install material without fabricating native runtime or production-distribution evidence.

## Target matrix

The exact supported package build matrix is:

- Linux amd64;
- Linux arm64;
- Windows amd64;
- Windows arm64;
- macOS/darwin amd64;
- macOS/darwin arm64.

All targets are built with:

- `CGO_ENABLED=0`;
- exact `GOOS`;
- exact `GOARCH`;
- `-trimpath`;
- `-buildvcs=false`;
- linker-injected repository version;
- linker-injected exact source commit.

## Binary source identity

`node420-compute` now exposes `--version`.

Release binaries report:

- repository version from `VERSION`;
- exact source commit;
- target GOOS;
- target GOARCH.

The generated-artifact verifier checks that the version and source SHA are physically embedded in every binary and actually executes the Linux/amd64 packaged binary with `--version`.

## Deterministic package builder

Qualification-relevant builder:

`scripts/build-cmp-3-13-packages.py`

It:

- derives exact repository version/commit/source epoch;
- cross-builds all six targets;
- stages only explicit package files;
- replaces the state-directory placeholder with the platform-specific path;
- emits `BUILD-METADATA.json` in every package;
- creates deterministic tar.gz for Linux/macOS;
- creates deterministic ZIP for Windows;
- emits `node420-compute-package-manifest.json`;
- emits top-level `SHA256SUMS.txt`.

### Archive normalization

tar.gz packages use:

- deterministic sorted file order;
- source-commit mtime;
- normalized uid/gid zero;
- normalized root owner/group names;
- explicit file modes;
- gzip source-commit mtime.

ZIP packages use:

- deterministic sorted file order;
- source-derived ZIP timestamps;
- explicit stored UNIX mode bits.

## Per-package metadata

Each `BUILD-METADATA.json` binds:

- schema;
- version;
- commit;
- source epoch/time;
- GOOS;
- GOARCH;
- CGO disabled;
- binary filename;
- binary SHA-256;
- platform state-directory example;
- `package_authoritative=false`;
- `platform_runtime_qualified=false`.

The top-level manifest additionally records:

- exact six-target list;
- per-package archive SHA-256;
- per-package binary SHA-256;
- `platform_runtime_qualified=false`;
- `level3_merge_candidate=false`.

Packaging therefore cannot silently become runtime qualification or Level 3 evidence.

## Platform argument/config model

Every package includes `worker.args.example` using one exact CLI argument per non-comment line.

The file is not shell-evaluated.

It contains no requested:

- private key;
- password;
- mnemonic;
- seed phrase.

Platform state paths are explicitly materialized:

- Linux: `/var/lib/420integrated/node420-compute`;
- macOS: `/Library/Application Support/420Integrated/node420-compute`;
- Windows: `C:\ProgramData\420Integrated\node420-compute`.

The package archive records the example config with mode `0600` where archive mode metadata is represented.

## Linux packaging

Linux archives contain:

- `node420-compute`;
- `README.txt`;
- `worker.args.example`;
- `BUILD-METADATA.json`;
- `run-node420-compute.sh`;
- `install.sh`;
- `node420-compute.service`.

The systemd template:

- uses dedicated `node420compute` user/group;
- uses explicit persistent state;
- sets `NoNewPrivileges=true`;
- sets `ProtectSystem=strict`;
- sets `ProtectHome=true`;
- protects kernel tunables/modules/control groups;
- limits writable paths to worker state.

The installer creates the dedicated system account and explicit directories/modes but does **not** enable/start/restart the unit or create an active placeholder `worker.args`.

The launcher reads the argument file line-by-line into a Bash array and does not use `eval`, `bash -c` or `sh -c`.

## macOS packaging

macOS archives contain:

- `node420-compute`;
- `README.txt`;
- `worker.args.example`;
- `BUILD-METADATA.json`;
- `run-node420-compute.sh`;
- `install.sh`;
- `org.420integrated.node420-compute.plist`.

The LaunchDaemon template:

- runs as dedicated `node420compute`;
- uses explicit Application Support state/config paths;
- uses explicit logs;
- runs as a background process;
- does not specify root.

The installer requires the dedicated account to already exist. It does not silently create one and does not call `launchctl bootstrap`/load.

The launcher does not evaluate argument-file contents as shell.

## Windows packaging

Windows archives contain:

- `node420-compute.exe`;
- `README.txt`;
- `worker.args.example`;
- `BUILD-METADATA.json`;
- `run-node420-compute.ps1`;
- `install.ps1`;
- `register-startup-task.ps1`.

The installer requires elevation to write Program Files/ProgramData but does not register/start the worker.

Startup registration is explicit and requires a caller-supplied `UserId`.

The scheduled task uses:

- AtStartup trigger;
- S4U logon;
- Limited run level.

It does not silently use SYSTEM or Highest run level.

The PowerShell launcher reads each non-comment line as a literal CLI argument and does not use `Invoke-Expression` or equivalent code evaluation.

The package deliberately does not claim Windows Service Control Manager support.

## Generated-artifact verification

`scripts/verify-cmp-3-13-packaging.py` validates both source/package policy and generated package bytes.

It verifies:

- exact six target records;
- current Git commit and repository version;
- source epoch;
- top-level package manifest schema;
- package count;
- archive existence;
- archive SHA-256;
- top-level SHA256SUMS;
- safe archive paths/no traversal;
- deterministic package root;
- exact target-specific package contents;
- normalized timestamps;
- normalized tar ownership;
- binary executable modes;
- private example-config archive mode;
- BUILD-METADATA fields;
- platform state-directory substitution;
- embedded version/source SHA in every binary;
- actual Linux/amd64 version output.

Binary platform/architecture is checked directly from executable headers:

- ELF `e_machine` for Linux;
- PE machine field for Windows;
- Mach-O CPU type for macOS.

## Exact-head Level 1 qualification

Required owner: **Compute Worker Fast Qualification**.

- Workflow run number: **#344**
- Run ID: `37269147888`
- Job ID: `111632222887`
- Exact implementation/spec/workflow SHA: `6a5e82bbaa2fd9073c8d6f3415f2460048f115ca`
- Result: **SUCCESS**

Passing exact-head steps:

- checkout exact qualification head — PASS;
- verify exact qualification head — PASS;
- setup Go/Python — PASS;
- full worker runtime tests — PASS;
- `node420-compute` tests — PASS;
- Go vet — PASS;
- native Linux command build — PASS;
- real Docker CMP-3.4 sandbox integration — PASS;
- real Docker CMP-3.7 checkpoint/resume integration — PASS;
- real Docker CMP-3.8 result commitment integration — PASS;
- CMP-3.1 verifier — PASS;
- CMP-3.2 verifier — PASS;
- CMP-3.3 verifier — PASS;
- CMP-3.4 verifier — PASS;
- CMP-3.5 verifier — PASS;
- CMP-3.6 verifier — PASS;
- CMP-3.7 verifier — PASS;
- CMP-3.8 verifier — PASS;
- CMP-3.9 verifier — PASS;
- CMP-3.10 verifier — PASS;
- CMP-3.11 verifier — PASS;
- CMP-3.12 verifier — PASS;
- build all six CMP-3.13 platform packages — PASS;
- CMP-3.13 generated-artifact verifier — PASS;
- upload CMP-3.13 package artifact bundle — PASS.

No required CMP-3.13 Level 1 check was skipped, cancelled, missing, stale or substituted.

The same-SHA push run #343 was cancelled by same-branch concurrency and is **not** counted as passing evidence.

## CI package artifact

Fast #344 uploaded one GitHub Actions artifact:

- artifact ID: `11327388973`;
- name: `node420-compute-packages-6a5e82bbaa2fd9073c8d6f3415f2460048f115ca`;
- size: `8,982,077` bytes;
- workflow artifact digest: `sha256:30ea79aadf46401450682b51994a8b84ecb22b23dc765b1bc0153d0c5d662629`;
- source workflow head: `6a5e82bbaa2fd9073c8d6f3415f2460048f115ca`.

The CI artifact is ephemeral workflow evidence, not a public production release.

## Level 2 status

Compute Worker Integration Qualification **#124** on the exact qualified SHA completed **SKIPPED** because no `cmp-worker-level2` milestone label was present.

That skip is expected and is **not counted as passing evidence**.

CMP-3.13 introduces package/build/startup surfaces but no new shared protocol contract, canonical lifecycle authority, shared backend or cross-component execution semantics.

Running Level 2 immediately before CMP-3.14 would duplicate app-wide integration work without a distinct coverage purpose. Comprehensive accumulated qualification belongs to CMP-3.14 Level 3.

## Broad-workflow classification

Automatically triggered broad workflows are not CMP-3.13 Level 1 owners.

At exact-head closeout review, several broad workflows were queued/in progress because of monorepo PR trigger behavior. They are not promoted to CMP-3.13 passing evidence.

Any broad failure must be diagnosed if it is caused by CMP-3.13, but broad repository qualification is not substituted for the app-specific exact-head package gate.

## Security and release truth

CMP-3.13 preserves the already-qualified worker controls and introduces no canonical authority.

It does not claim:

- Windows/macOS native runtime execution was exercised;
- Docker/Podman behavior was live-qualified on Windows/macOS;
- Windows/macOS thermal/GPU adapters exist;
- production GPU-share backends exist;
- Authenticode signing;
- Apple Developer ID signing/notarization;
- package-manager publication;
- MSI/PKG/DEB/RPM production installer qualification;
- Windows SCM service support;
- live worker deployment;
- public production readiness.

Those absences are explicit rather than silently passing.

## Exit-criterion disposition

1. Canonical target matrix includes Linux/Windows/macOS — **PASS**.
2. amd64 and arm64 produced for every OS family — **PASS**.
3. every target built with CGO disabled — **PASS**.
4. every binary embeds repository version/source commit — **PASS**.
5. node420-compute exposes exact version/commit/target identity — **PASS**.
6. release build uses trimmed paths and explicit VCS identity — **PASS**.
7. tar.gz order/time/ownership/modes normalized — **PASS**.
8. ZIP order/time/modes normalized — **PASS**.
9. every archive SHA-256 recorded in package manifest — **PASS**.
10. top-level SHA256SUMS validates archives/manifest — **PASS**.
11. archive paths confined to deterministic package root — **PASS**.
12. binary headers match declared OS/architecture — **PASS**.
13. BUILD-METADATA matches binary/package identity — **PASS**.
14. metadata explicitly avoids runtime/readiness/Level-3 claims — **PASS**.
15. example args contain no requested secret material — **PASS**.
16. platform state directory explicitly materialized — **PASS**.
17. Linux package contains unprivileged hardened systemd material — **PASS**.
18. Linux installer does not auto-start placeholder configuration — **PASS**.
19. macOS package contains dedicated-user launchd material — **PASS**.
20. macOS installer does not auto-start/create service identity — **PASS**.
21. Windows package contains launcher/install material — **PASS**.
22. Windows startup registration requires explicit limited user/no SYSTEM-highest — **PASS**.
23. launchers preserve one-argument-per-line non-shell semantics — **PASS**.
24. packaged Linux/amd64 binary reports exact expected version identity — **PASS**.
25. CMP-3.1 through CMP-3.12 retained regressions remain green — **PASS**.
26. CMP-3.13 generated-artifact verifier — **PASS**.
27. exact-head Compute Worker Fast Qualification — **PASS**.

## Intentionally deferred / external

- Windows Authenticode signing;
- Apple Developer ID signing/notarization;
- package-manager publication;
- MSI/PKG/DEB/RPM production installers;
- native Windows SCM service implementation;
- real Windows/macOS workload execution qualification;
- Windows/macOS telemetry/security adapter qualification;
- platform-specific production GPU-share backends;
- live worker deployment;
- public production distribution;
- complete current-main reconciliation and CMP-3.14 Level 3 closeout.

These are not represented as completed evidence.

## Blockers

**No repository blocker remains for CMP-3.13 packaging itself.**

External signing/notarization and real target-host operational qualification may be required by a later release policy, but the canonical CMP-3.13 roadmap step does not define them as prerequisites for repository packaging completion.

## Evidence-only closeout rule

Commits after the exact qualified implementation/spec/workflow SHA modify only durable evidence/status bookkeeping. They change no executable source, tests, workflows, dependencies, configuration, package builder, package templates, interfaces, deployment state, or substantive requirements. They may therefore reference the exact qualified SHA without recursive Level 1 qualification.

## Formal status

**CMP-3.13 — Windows/Linux/macOS packaging: COMPLETE.**

Next canonical step: **CMP-3.14 — Phase closeout**.

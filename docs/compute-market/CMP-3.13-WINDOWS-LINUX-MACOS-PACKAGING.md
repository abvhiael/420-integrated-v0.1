# CMP-3.13 — Windows/Linux/macOS packaging

Status: **IMPLEMENTED / LEVEL 1 QUALIFICATION PENDING**

## Canonical definition

**Windows/Linux/macOS packaging.**

The canonical roadmap names this step without prescribing a release framework, installer technology, native service API, code-signing provider, or CPU architecture matrix.

Repository precedent for release packaging requires explicit source identity, machine-readable build metadata, release checksums, and no promotion/readiness claim from packaging alone.

CMP-3.13 therefore packages the accumulated node420-compute worker as deterministic, content-verifiable platform archives while preserving the authority and security boundaries qualified in CMP-3.1 through CMP-3.12.

## Frozen package target matrix

CMP-3.13 builds exactly these CGO-disabled Go targets:

- Linux amd64;
- Linux arm64;
- Windows amd64;
- Windows arm64;
- macOS/darwin amd64;
- macOS/darwin arm64.

The package matrix is intentionally architecture-explicit. A target is not considered packaged merely because the source should theoretically compile there.

## Exact source identity

Every package is built from the exact checked-out Git commit.

The builder derives:

- version from repository `VERSION`;
- source commit from `git rev-parse HEAD`;
- source date epoch from the exact commit.

The node420-compute binary now exposes:

`--version`

and prints:

- package version;
- exact source commit;
- runtime GOOS;
- runtime GOARCH.

Release builds inject version and commit with Go linker variables while using `-trimpath`, `-buildvcs=false`, and `CGO_ENABLED=0`.

## Deterministic archive construction

The package builder normalizes archive metadata rather than relying on host filesystem timestamps.

For tar.gz packages:

- file ordering is deterministic;
- mtime is the exact source commit epoch;
- uid/gid are normalized to zero;
- owner/group names are normalized;
- file modes are explicit;
- gzip mtime is the source epoch.

For ZIP packages:

- file ordering is deterministic;
- timestamps are source-derived within ZIP timestamp precision;
- UNIX mode bits are explicitly recorded.

The package output contains a machine-readable top-level manifest and SHA-256 inventory.

## Per-package contents

Every target archive contains:

- node420-compute binary for the exact OS/architecture;
- `README.txt`;
- `worker.args.example`;
- `BUILD-METADATA.json`;
- platform launcher material;
- platform installation/startup material.

`BUILD-METADATA.json` binds:

- schema;
- version;
- exact source commit;
- source timestamp;
- GOOS;
- GOARCH;
- CGO disabled state;
- binary name;
- binary SHA-256;
- platform state-directory example;
- explicit non-authoritative/non-runtime-qualified status.

## Argument-file model

Platform launchers consume a plain argument file with **one exact CLI argument per non-comment line**.

The argument file is not evaluated as shell code.

The example contains only public/canonical identifiers and local worker policy. It explicitly does not solicit:

- private keys;
- seed phrases;
- mnemonics;
- passwords.

The packaged example is mode 0600 in archive metadata where that mode is represented.

Platform-specific state directory examples are materialized during packaging:

- Linux: `/var/lib/420integrated/node420-compute`;
- macOS: `/Library/Application Support/420Integrated/node420-compute`;
- Windows: `C:\ProgramData\420Integrated\node420-compute`.

## Linux package

Linux packages include:

- `run-node420-compute.sh`;
- `install.sh`;
- `node420-compute.service`.

The systemd template:

- runs as dedicated `node420compute` user/group;
- uses an explicit persistent state directory;
- sets `NoNewPrivileges=true`;
- uses `ProtectSystem=strict`;
- uses `ProtectHome=true`;
- restricts kernel/module/control-group mutation;
- explicitly grants write access only to worker state.

The install helper:

- requires root only for installation;
- creates the dedicated unprivileged account if missing;
- installs binary/launcher/unit/config example with explicit modes;
- creates the state directory privately;
- reloads systemd;
- **does not enable or start the worker**.

The operator must first create a valid private `worker.args` with canonical identities.

## macOS package

macOS packages include:

- `run-node420-compute.sh`;
- `install.sh`;
- `org.420integrated.node420-compute.plist`.

The launchd template:

- uses a dedicated `node420compute` account;
- uses explicit Application Support state/config paths;
- uses explicit log paths;
- runs as a background process;
- does not run as root.

The installer deliberately refuses to invent/create a macOS service account. The account must be created explicitly by the operator/management system.

The installer copies launch material but **does not bootstrap/start the LaunchDaemon** until valid configuration exists.

## Windows package

Windows packages include:

- `node420-compute.exe`;
- `run-node420-compute.ps1`;
- `install.ps1`;
- `register-startup-task.ps1`.

The install helper requires an elevated session only to place files under Program Files/ProgramData.

It does not automatically register or start the worker.

Startup registration is a separate explicit action requiring a caller-supplied `UserId`.

The startup task uses:

- `AtStartup`;
- S4U logon;
- `RunLevel Limited`.

It does not silently install the worker as SYSTEM or request highest run level.

CMP-3.13 does not claim a Windows Service Control Manager implementation. The package uses a native Scheduled Task startup path because the current Go binary is a console process, not an SCM service executable.

## Package verification

The CMP-3.13 verifier checks generated artifacts, not only source tokens.

It validates:

- exact six-target manifest;
- exact current commit/version identity;
- package/archive SHA-256;
- top-level SHA256SUMS inventory;
- safe archive paths;
- expected package root;
- exact required files;
- normalized timestamps/ownership/modes;
- ELF architecture for Linux packages;
- PE machine architecture for Windows packages;
- Mach-O CPU architecture for macOS packages;
- embedded version and commit strings in every binary;
- BUILD-METADATA identity;
- explicit non-authoritative/runtime-unqualified package flags;
- platform state-directory materialization;
- executable binary modes;
- private example-config mode;
- actual Linux/amd64 `--version` execution on the CI runner.

## Runtime-security preservation

Packaging does not weaken or replace any existing worker control.

The packages retain:

- CMP-3.4 sandbox isolation;
- CMP-3.5 content-addressed download;
- CMP-3.6 execution authorization/lifecycle;
- CMP-3.7 checkpoint/resume;
- CMP-3.8 result commitments;
- CMP-3.9 execution-key receipts;
- CMP-3.10 upload integrity;
- CMP-3.11 local resource controls;
- CMP-3.12 malicious-workload containment.

Platform packaging does not gain canonical job, verifier, correctness, payment, settlement, slashing, governance, bridge, wallet, or deployment authority.

## Platform-runtime truth boundary

Cross-compilation and artifact inspection prove that a target package is structurally buildable for that target.

They do **not** prove that:

- Docker/Podman semantics are identical on every host;
- Windows/macOS thermal/GPU telemetry adapters exist;
- a GPU percentage backend exists;
- the packaged startup integration has been exercised on production hosts;
- code signing/notarization has been performed;
- OS trust stores accept the artifacts;
- a live worker fleet has been deployed.

These are not silently promoted to PASS.

CMP-3.11 already fails closed when requested platform telemetry/enforcement is unavailable.

## Qualification level

CMP-3.13 is an **ordinary Level 1 app-scoped packaging step**.

The directly applicable qualification is:

- worker unit/adversarial regression suite;
- node420-compute tests/vet/build;
- retained real-Docker Linux regressions;
- CMP-3.1 through CMP-3.12 mechanical regressions;
- exact six-target package build;
- CMP-3.13 generated-artifact verifier.

Level 2 is not required because this step introduces no new protocol/shared authority or cross-component lifecycle integration, and CMP-3.14 immediately performs the accumulated Level 3 phase closeout.

## Exit criteria

CMP-3.13 is complete only when one exact implementation/spec/workflow SHA proves:

1. canonical target matrix includes Linux, Windows and macOS;
2. amd64 and arm64 artifacts are produced for every OS family;
3. every target builds with CGO disabled;
4. every binary embeds exact repository version and source commit;
5. node420-compute exposes exact version/commit/target identity;
6. release builds use trimmed source paths and explicit VCS identity;
7. tar.gz package construction has normalized file order/time/ownership/modes;
8. ZIP package construction has normalized order/time/modes;
9. every archive has a SHA-256 recorded in the package manifest;
10. top-level SHA256SUMS validates every archive and the package manifest;
11. archive paths are safe and confined to one deterministic package root;
12. binary file headers match the declared OS family and architecture;
13. package-local BUILD-METADATA matches binary/package identity;
14. package metadata explicitly avoids runtime/readiness/Level-3 claims;
15. example argument file contains no requested secret material;
16. platform state directory is explicitly materialized in each package;
17. Linux package supplies unprivileged hardened systemd startup material;
18. Linux installer does not auto-start placeholder configuration;
19. macOS package supplies dedicated-user launchd startup material;
20. macOS installer does not auto-start or silently create privileged identity;
21. Windows package supplies PowerShell launcher/install material;
22. Windows startup registration requires an explicit caller-supplied limited user and does not silently use SYSTEM/highest;
23. generated packages retain one-argument-per-line non-shell configuration semantics;
24. actual Linux/amd64 packaged binary reports expected --version identity;
25. CMP-3.1 through CMP-3.12 retained regressions remain green;
26. CMP-3.13 generated-artifact verifier passes;
27. exact-head Compute Worker Fast Qualification passes.

## Intentionally deferred / external

- Windows Authenticode signing;
- Apple Developer ID signing/notarization;
- package-manager publication;
- MSI/PKG/DEB/RPM production installers;
- native Windows SCM service implementation;
- Windows/macOS hardware/runtime fleet qualification;
- platform-specific GPU percentage backends;
- live worker deployment;
- full current-main reconciliation and comprehensive Level 3 qualification.

Those items are not represented as completed evidence by CMP-3.13.

## Blocker boundary

The deferred signing/notarization/native-host evidence does not block this repository packaging step because the canonical roadmap requires packaging, not public production distribution.

Any later release policy that requires signed/notarized artifacts must add and qualify that gate before release.

Next canonical step: **CMP-3.14 — Phase closeout**.

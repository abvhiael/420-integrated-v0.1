# LIFTd PT-11 — Durable exact-SHA Level 1 qualification

**Disposition:** repository-local PT-11 **LEVEL 1 PASS**, deployment and testnet handoff implemented; live testnet and independent operational authorization **NOT ACCEPTED**.

- **Canonical step:** PT-11 — Deployment and testnet handoff: environment configuration validation, nonproduction deployment manifests, secure service wiring, managed secret references, health/readiness, observability, deployment verification and evidence capture.
- **Qualified implementation SHA:** `0d62b5eaa93e43e27b83d6d574a1da5b3ef04978`.
- **Reconciliation base main SHA:** `37f98f4d04cce26a9e1c7f18b5543cd425cb3a5d`.
- **Branch:** `audit/liftd-pt11-deployment-testnet-handoff-20261018`; [PR #730](https://github.com/abvhiael/420-integrated-v0.1/pull/730).
- **Workflow:** `.github/workflows/liftd-pt11-level1.yml`; [run #39158745270](https://github.com/abvhiael/420-integrated-v0.1/actions/runs/39158745270), **job #117767338748**, completed **SUCCESS**.
- **Exact checkout in CI:** `git checkout --force 0d62b5eaa93e43e27b83d6d574a1da5b3ef04978`.
- **Tests:** 11 targeted deployment/security tests **PASS / 0 FAIL** and 158 retained LIFTd tests **PASS / 0 FAIL**, **169 total / 0 failures**.
- **Other verifier commands:** Node syntax verification of `testnet-deployment-handoff.mjs`, `testnet-handoff.mjs`, `start-admitted-runtime.mjs` and `probe-admitted-runtime.mjs`; explicit inert-template verification; retained deployment security and loopback runtime tests.
- **Implementation:** abstract immutable testnet manifest + hardened **zero-replica** Kubernetes reference, default-deny ingress/egress, managed CSI secret refs, loopback-only liveness/readiness, read-only/nonroot runtime, digest validation and strict redacted evidence capture. Placeholder deployment digests/image explicitly rejected in deployable candidate mode.
- **Relevant files:** `rideshare/src/testnet-deployment-handoff.mjs`, `rideshare/deployment/testnet-manifest.template.json`, `rideshare/deployment/kubernetes-testnet.disabled.yaml`, `rideshare/scripts/testnet-handoff.mjs`, `rideshare/scripts/start-admitted-runtime.mjs`, `rideshare/scripts/probe-admitted-runtime.mjs`, `rideshare/test/testnet-deployment-handoff.test.mjs`, `rideshare/test/testnet-deployment-files.test.mjs`, `docs/rideshare/PT-11-DEPLOYMENT-TESTNET-HANDOFF.md`.
- **Security boundary:** no live service permissions, traffic, payments, production credentials, independent signed provider checks or externally deployed acceptance conferred by CI.
- **Level 2:** not run; **Level 3:** not run. No global Solidity, Genesis, Integrated, Geth or Docs inventories dispatched.
- **Deferred external dependencies:** independent infrastructure operator and provider credentials, real managed secret mounts/CA, actual provider and payment integrations, signed health/observability and recovery receipts, testnet authority acceptance, accessibility and safety signoffs and regulated controlled pilot; maintain `LIFTD-TESTNET-ROADMAP.md` TN-0–TN-6 as **NOT ACCEPTED**.
- **Next canonical roadmap:** locked L03.9 → L03.10 → M-L03-B → L03.11 → L03.12; do not reinterpret or advance those gates.
- **Evidence-only SHA:** the SHA created by this certificate commit is distinct from qualified implementation SHA. Verify the exact diff contains this document only; do not rerun qualification for an administrative certificate.

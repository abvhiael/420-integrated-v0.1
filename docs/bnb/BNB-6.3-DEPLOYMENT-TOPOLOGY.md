# BNB-6.3 — Reproducible deployment topology and external boundaries

**Scope:** repository-side production-equivalent assembly, not independently approved deployment. The authoritative testnet/external-acceptance roadmap remains controlling.

- API: two unprivileged, read-only, resource-bounded replicas with health readiness that checks a 30-migration ledger. Mutable image tags are disallowed by the mounted BNB production contract; registry digests must be supplied by an operator.
- Worker: explicitly bnb-worker identity, bounded process and memory, mandatory mounted runtime credentials and local-validation sink. No external Search or Travel delivery approval.
- PostgreSQL: operator-managed PostgreSQL 16+ is an **external dependency**, intentionally no production database container or publicly exposed port. Separate migrator/runtime credentials, verify-full TLS and channel binding remain mandatory in `production.py`. Isolated CI uses its own Postgres 16 fixture and must never be called production acceptance.
- Ingress: HTTPS 443 at nonroot Caddy on 8443, mounted certificate/key, disabled admin interface and HSTS, private API/Web backends. Operator must independently supply issued TLS certificates.
- Search and Travel consumers: independent deployable consumer runtime exists in `discovery_consumer_service.py`, but remains explicitly fixture-gated; this release manifest records separate external deployments and signed receipt requirements without granting production keys, audience, public ingress or approval. Independent provider deployments and acceptance are deferred.
- Supply chain: image-reference `@sha256:` requirements, exact release SHA in production launcher, OCI image revision, CI immutable parent manifests and local image IDs. Operator registry promotion/digest signatures are not claimed.
- Resource and privilege constraints and prohibited activation validated by `validate_deployment.py` and `tests/test_bnb63_deployment.py` alongside retained runtime CI. Negative cases reject mutable tags, exposed PostgreSQL, invalid service identity, permissive feature gates and insufficient limits.

**No production permission is granted.** Required independent issuer/operator approvals, actual TLS and managed PostgreSQL acceptance, registry promotion and remote independently operated consumer acceptance stay in `docs/bnb/BNB-TESTNET-WORK-ROADMAP.md`.

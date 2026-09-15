# DOC-17.2 — Pages build and deployment hardening

## Result

**PASS — production Pages deployment is now gated by the unified 420Docs qualification pipeline.**

The Pages workflow no longer performs an independent partial build path. Before any Pages artifact is uploaded, it runs `python scripts/qualify-documentation.py`, which owns metadata/version checks, contextual and Ask 420 validation, Genesis matrix evidence, links/orphans/troubleshooting IDs, required coverage, generated-reference qualification, strict MkDocs build, version-context rendering, version-selector injection and search/navigation qualification.

## Qualified artifact identity

After qualification, the build job writes `site/publication.json` containing:

- schema version;
- exact Git commit SHA;
- repository identity;
- Git ref;
- `qualified: true`.

That file is part of the uploaded Pages artifact, binding the rendered publication to the exact repository commit that passed the deployment gate.

## Deployment ordering

The production path is now:

1. checkout exact commit;
2. install pinned documentation dependencies;
3. run the unified qualification pipeline;
4. record exact publication identity in the built site;
5. configure Pages;
6. upload the qualified `site/` artifact;
7. deploy only from the successful build job.

A failed qualification cannot reach artifact upload or deployment.

## Permissions and concurrency

The workflow retains the minimum Pages publication permissions already required by GitHub Pages:

- `contents: read`;
- `pages: write`;
- `id-token: write`.

Deployment remains serialized through `concurrency.group: pages` with `cancel-in-progress: false`, preventing a newer run from cancelling an already executing production publication midway through deployment.

## Deterministic policy validation

`scripts/validate-doc-pages-publication.py` now verifies that:

- the unified qualification command exists in the build job;
- qualification occurs before artifact upload;
- publication commit identity is recorded before upload;
- the deploy job depends on the build job;
- the deployment environment is `github-pages`;
- Pages permissions remain bounded;
- Pages deployment concurrency remains rollback-safe.

The validator is part of `scripts/qualify-documentation.py`, and edits to the validator itself trigger the regular `420Docs Qualification` workflow.

## Authority boundary

A qualified Pages artifact proves only that a specific documentation render passed the repository's documentation publication gates. It does not prove live chain state, application health, deployment authenticity beyond published evidence, or any signing/finality/protocol outcome.

Production reachability and post-deploy route smoke checks remain owned by DOC-17.9.

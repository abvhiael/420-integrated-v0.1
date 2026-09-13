# Repository integration

DOC-17.4 binds the repository-facing documentation links to the same production publication target used by 420Docs without making the repository README or GitHub Pages runtime authority.

## Repository entry points

`README.md` remains the repository landing page. Its documentation section exposes:

- the canonical public 420Docs root;
- Get Started;
- user documentation;
- developer documentation;
- operator documentation;
- architecture;
- reference;
- troubleshooting;
- the documentation roadmap.

The machine-readable contract is `docs/publication/repository-entrypoints.json`.

## Public versus source links

The README deliberately exposes both forms:

- the public 420Docs root is the presentation/discovery entry point;
- repository-relative `docs/...` links remain stable source-navigation paths for contributors, reviewers and users browsing GitHub directly.

The public base URL comes only from `docs/publication/production-target.json`. A hostname change must therefore update the production target and pass publication qualification rather than silently changing README text alone.

## Authority boundary

Repository navigation does not prove live chain, deployment, transaction, account, provider, governance or finality state. It only points readers to documentation. Runtime decisions continue to use the canonical owning subsystem.

## Qualification

`scripts/validate-doc-repository-integration.py` verifies that:

1. the README public 420Docs root equals the committed production target;
2. required audience/source entry points exist;
3. every source entry resolves to a repository file;
4. public paths are relative to the production target and cannot substitute another host/environment;
5. required architecture, user, developer, operator, reference and troubleshooting families remain discoverable from the README.

The validator is part of unified 420Docs qualification. Changes to README, publication contracts or the validator therefore participate in the normal documentation qualification and Pages publication path.

## DOC-17.4 result

Repository integration is complete for the current production target. No separate repository-specific documentation authority is introduced, and publication routing remains owned by DOC-13/DOC-17 contracts.

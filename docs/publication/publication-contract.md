# 420Docs production publication contract

## Purpose

This contract defines what it means for 420Docs to be published for production use and how repository/runtime surfaces may link into it safely.

420Docs is documentation. It does not become chain, protocol, Wallet, deployment, provider, governance, identity, finality or signing authority merely because it is publicly hosted.

## Source of truth

Repository-controlled Markdown, generated reference inputs and the DOC-13 version registry remain the documentation source of truth. A deployed site is a rendered publication of qualified repository state.

A production publication must be reproducible from a specific repository commit. If the deployed site cannot be tied to a qualified commit/artifact, its freshness or authority must not be inferred.

## Current production publication target

The repository currently publishes through `.github/workflows/docs-pages.yml` to GitHub Pages. The current public entry used by the repository is:

`https://abvhiael.github.io/420-integrated-v0.1/`

DOC-17 treats that URL as the current production presentation target until an explicitly configured replacement/custom domain is committed and qualified. No custom domain is assumed merely because one may exist elsewhere in the ecosystem.

Changing the production hostname requires an explicit repository change, publication qualification and update of repository/runtime integration targets. Silent hostname substitution is not allowed.

## Publication authority boundary

The production site may publish:

- architecture and system-design documentation;
- Wallet/user guidance;
- Genesis application manuals;
- developer integration guidance;
- troubleshooting/recovery documentation;
- generated reference subject to DOC-10/DOC-13 provenance rules;
- DOC-14 contextual navigation;
- Ask 420 documentation-assistant source material.

The site must never claim that publication proves:

- live chain or protocol state;
- deployment authenticity beyond the evidence actually published;
- transaction success/finality;
- account ownership or signing authority;
- bridge/provider availability or correctness;
- governance/Arbitration outcomes;
- network launch readiness;
- testnet/mainnet documentation availability when DOC-13 marks those tracks unpublished.

## Publication gate

A commit is publication-eligible only after the documentation qualification pipeline succeeds for the content being deployed. DOC-17.2 will make this a deployment workflow invariant rather than relying on a separate workflow having happened previously.

At minimum, publication qualification must cover:

1. documentation metadata/version rules;
2. contextual-link safety;
3. Ask 420 source/citation/privacy rules;
4. Genesis documentation matrix evidence targets;
5. internal links, troubleshooting IDs and orphan detection;
6. required coverage and publication safety;
7. generated-reference freshness/provenance;
8. strict MkDocs build;
9. version-context rendering and selector injection;
10. search/navigation qualification.

## Environment and version behavior

DOC-13 remains the publication/version authority.

- `development/current` may resolve to the mutable development documentation track.
- `genesis/current` resolves to the immutable Genesis documentation release.
- testnet and mainnet remain unavailable until explicitly published by DOC-13.
- publication must not fall back across environments or releases.
- an unknown, unpublished or unsupported environment/version must fail closed to an explicit unavailable state rather than silently showing another track.

A semantic environment accepted by a client is not evidence that documentation for that environment has been published.

## Runtime integration contract

Wallet, Explorer, Developer Hub and Genesis dApps should prefer stable DOC-14 contextual identifiers where contextual help exists. A runtime client may resolve a stable contextual identifier into the current production documentation route, but it must not hard-code documentation text as runtime authority.

Runtime integrations must preserve:

- explicit environment/version context where material;
- no secrets/private payloads in documentation URLs;
- no cross-environment fallback;
- safe unavailable behavior when a target is unpublished or cannot be resolved;
- canonical runtime state checks independent of documentation availability.

Documentation outage or stale presentation must never authorize a write, change signing policy, alter finality interpretation, bypass verification or change protocol eligibility.

## Required publication evidence

A production deployment is healthy only when evidence establishes all of the following for one publication attempt:

- source commit identity;
- successful documentation qualification/build;
- successful artifact upload;
- successful Pages deployment;
- reachable site root;
- reachable search index;
- rendered version context/version selector;
- critical audience entry points;
- representative contextual deep links;
- no redirect/substitution into an unpublished environment.

A deploy action reporting success is necessary but not sufficient evidence that every critical route is usable; DOC-17.9 owns production smoke/health qualification.

## Failure behavior

If publication fails before deployment, the previously deployed qualified site remains the production presentation. A failed candidate must not be described as published.

If the production site is unavailable or inconsistent:

- runtime clients must fail navigation safely;
- users/operators must continue to rely on canonical runtime/protocol evidence for state decisions;
- no application may weaken security or retry/finality rules because documentation is unavailable;
- recovery should redeploy a previously qualified artifact/commit or a newly qualified fix;
- immutable release history must not be rewritten to repair presentation availability.

## Rollback rule

Rollback is a publication operation, not a protocol rollback. It may change which qualified documentation artifact is served, but it must not mutate canonical chain/protocol history or silently change DOC-13 release meaning.

Genesis documentation marked immutable must continue to resolve to the same release semantics even if the site presentation layer is redeployed.

## Current deployment inventory

At DOC-17.1 start:

- publication workflow: `.github/workflows/docs-pages.yml`;
- host: GitHub Pages;
- repository public link: `https://abvhiael.github.io/420-integrated-v0.1/`;
- build system: MkDocs Material, strict build;
- version renderer: `scripts/render-doc-version-context.py`;
- version selector injector: `scripts/inject-doc-version-selector.py`;
- search/navigation qualifier: `scripts/qualify-docs.py`;
- unified documentation qualifier: `scripts/qualify-documentation.py`;
- current known gap: Pages builds directly with `mkdocs build --strict` and selected post-build checks rather than running the complete unified documentation qualification pipeline before deploy.

That deployment-gate gap is the first implementation target of DOC-17.2.
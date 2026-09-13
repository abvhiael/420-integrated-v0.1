---
title: DOC-13.9 CI wiring handoff
audience:
  - developer
  - operator
category: contributing
status: active
version: current
---

# DOC-13.9 CI wiring handoff

The DOC-13.9 publication contract, policy and rendered-publication validator are implemented on PR #232. Final CI wiring remains intentionally unclaimed until the executable workflow and qualification runner changes are applied and exact-head qualification is green.

## Required runner change

In `scripts/qualify-documentation.py`, insert the following stage after `version-selector-render` and before `search-navigation`:

```python
Stage("versioning-publication-safety", (sys.executable, "scripts/validate-doc-versioning-ci.py", "--site-dir", "site")),
```

## Required workflow trigger changes

In both `pull_request.paths` and `push.paths` in `.github/workflows/docs-qualify.yml`, add:

```yaml
- 'scripts/validate-doc-generated-reference-version.py'
- 'scripts/validate-doc-migration-policy.py'
- 'scripts/validate-doc-versioning-ci.py'
```

The same versioning surfaces should trigger `.github/workflows/docs-pages.yml` on `main` so documentation authority changes cannot bypass publication.

## Required Pages publication change

Replace the narrower build/render/inject/search sequence in `.github/workflows/docs-pages.yml` with the unified qualification entrypoint before `actions/upload-pages-artifact`:

```yaml
- name: Run unified 420Docs qualification
  run: python scripts/qualify-documentation.py
```

The existing `site` directory produced by the unified gate remains the Pages artifact input.

## Required workflow-policy change

Update `docs/ci/workflow-policy.json` so `required_runner_stages` includes `versioning-publication-safety`, and both required trigger arrays include all three versioning validator paths listed above.

## Qualification required before completion

DOC-13.9 is complete only when an exact PR head shows:

- 420Docs Qualification green with the new stage visible in the runner output;
- the DOC-13 trigger audit passing;
- the rendered publication validator passing after selector injection;
- 420 Integrated Qualification green on the same head.

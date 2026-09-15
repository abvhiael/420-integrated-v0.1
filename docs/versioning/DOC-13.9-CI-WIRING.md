---
title: DOC-13.9 CI wiring closeout
audience:
  - developer
  - operator
category: contributing
status: current
version: current
---

# DOC-13.9 CI wiring closeout

The DOC-13.9 publication contract, policy, rendered-publication validator and qualification wiring are implemented on PR #232.

## Implemented runner change

`scripts/qualify-documentation.py` includes the following stage after `version-selector-render` and before `search-navigation`:

```python
Stage("versioning-publication-safety", (sys.executable, "scripts/validate-doc-versioning-ci.py", "--site-dir", "site")),
```

## Implemented workflow trigger changes

Both `pull_request.paths` and `push.paths` in `.github/workflows/docs-qualify.yml` explicitly include:

```yaml
- 'scripts/validate-doc-generated-reference-version.py'
- 'scripts/validate-doc-migration-policy.py'
- 'scripts/validate-doc-versioning-ci.py'
```

`docs/ci/workflow-policy.json` requires the same paths and requires the `versioning-publication-safety` runner stage.

## Pages publication safety

The established Pages sequence remains strict build → version context → selector injection → final site qualification → artifact upload.

`scripts/qualify-docs.py` now invokes `scripts/validate-doc-versioning-ci.py` as part of that final site qualification. The publication validator checks that the Pages qualification command occurs before artifact upload, so rendered version authority is enforced without duplicating the full local/PR qualification pipeline inside the Pages workflow.

## Completion evidence

DOC-13.9 is complete when an exact PR head shows:

- 420Docs Qualification green with `versioning-publication-safety` enabled;
- the DOC-13 trigger audit passing;
- the rendered publication validator passing after selector injection;
- 420 Integrated Qualification green on the same head.

Those exact-head checks are also carried forward into DOC-13.10 closeout before the monolithic DOC-13 merge.

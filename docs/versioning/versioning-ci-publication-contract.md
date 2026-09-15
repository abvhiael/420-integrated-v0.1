---
title: DOC-13.9 versioning CI publication contract
audience:
  - developer
  - operator
category: contributing
status: current
version: current
---

# DOC-13.9 — Versioning CI and publication safety

DOC-13.9 makes the DOC-13 version model a publication invariant.

The canonical version registry and release manifests are the only authority for environments, published releases and current aliases. Renderer output, navigation and GitHub Pages must not advertise a version/environment pair that the registry does not publish.

## Unified qualification

The DOC-12 unified documentation qualification runner remains the single local and CI entrypoint. Every DOC-13 validator is a required stage, and changes to DOC-13 validators or policy/source surfaces must trigger documentation qualification.

The final site qualification used by GitHub Pages must enforce the same DOC-13.9 rendered-publication checks after version context generation and selector injection and before the Pages artifact is uploaded.

## Rendered publication invariants

After strict MkDocs build, version-context generation and selector injection:

- every advertised environment/current choice corresponds to a registry track whose current release is published;
- every advertised immutable release is explicitly published and belongs to the same environment;
- unpublished tracks are not advertised as authoritative;
- mutable releases are not exposed through immutable release routes;
- current aliases remain environment-local;
- version-qualified links target a published current alias or immutable published release;
- unknown, cross-environment and unpublished targets fail closed without fallback to another track or the flat compatibility corpus.

The flat MkDocs output remains compatibility-only and never proves release-qualified publication.

## Pages invariant

`.github/workflows/docs-pages.yml` runs `python scripts/qualify-docs.py` after version context generation and selector injection and before `actions/upload-pages-artifact`. `scripts/qualify-docs.py` invokes `scripts/validate-doc-versioning-ci.py`, so the rendered Pages artifact cannot be uploaded unless DOC-13.9 publication authority passes.

The unified documentation runner also executes `versioning-publication-safety` directly. This gives local/PR qualification an explicit DOC-13.9 stage while preserving the established Pages build sequence.

Any mismatch between registry authority, rendered context, selector choices, version-qualified links, workflow triggers or Pages publication flow fails qualification and blocks publication.

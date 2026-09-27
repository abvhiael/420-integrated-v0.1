# EXP-0.4.8 — evidence retention and reproducibility

**Status:** implementation complete; exact-head qualification required.

## Purpose

EXP-0.4.8 makes the Explorer qualification evidence durable enough to audit and replay without depending on the continued availability of GitHub Actions artifacts.

The repository record is the durable authority. GitHub run IDs, job IDs, artifact IDs and artifact digests remain important provenance, but Actions artifacts are treated as ephemeral external evidence.

## Retention model

The manifest retains:

- the repository-resident EXP-0.4.1 through EXP-0.4.7 authority files;
- the 17 exact-head events already normalized by EXP-0.4.3;
- every currently known final EXP-0.4.3 through EXP-0.4.7 closeout SHA;
- successful workflow/run and available job IDs;
- final artifact IDs and SHA-256 digests;
- the one historical artifact whose digest was never recorded, explicitly marked unavailable rather than reconstructed;
- replay profiles for the primary Indexer/Explorer gate, Integrated qualification, documentation qualification and live Explorer validation.

## Reproducibility boundary

Repository qualification can be replayed from source and workflow definitions. The replay qualifies the head that is actually executed.

An expired Actions artifact is **not** treated as recoverable merely because its old ID or digest is known. Likewise, live/deployment evidence cannot be reproduced by local source tests; the approved environment and witnesses must be executed again.

## Current retained state

- 17 historical exact-head provenance events.
- 16/17 historical events have complete retained artifact digests.
- The single missing historical digest remains explicitly unavailable and is not fabricated.
- 5 final EXP-0.4 closeouts (0.4.3–0.4.7) are copied into this repository-resident manifest with exact heads and complete artifact digests.
- Four replay profiles define how repository, integrated, docs and live-environment evidence are regenerated.
- No runtime, deployment, live-network or Genesis qualification is created by this retention milestone.

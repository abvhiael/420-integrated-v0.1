# EXP-0.4.8 — evidence retention and reproducibility

**Status:** qualified at repository scope; final evidence-recording head requalification required.

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


## Exact-head implementation qualification

Qualified implementation head: `a54fcc9e562b77c43b2a1e5185e99cb7fc15511e`

- 420Indexer #656 — run `36299759221`, job `108565121774` — success.
- 420Docs Qualification #2992 — run `36299759222`, job `108565123153` — success.
- 420 Integrated Qualification #5609 — run `36299759355` — success.
  - production-dependencies `108565123907` — success.
  - geth-engine `108565123943` — success.
  - offline-core `108565123948` — success.
  - fault-matrix `108565123956` — success.
- EXP-0.4.8 artifact `10924919734`.
- Digest `sha256:2a9fc26cfbb084d9c33b3140c9290721ba3f49e9b99e1a7ca3ef7342e78d9784`.

This qualifies evidence retention and reproducibility at repository scope. The evidence recording changes the branch SHA, so the resulting head must be requalified before EXP-0.4.8 is marked COMPLETE.

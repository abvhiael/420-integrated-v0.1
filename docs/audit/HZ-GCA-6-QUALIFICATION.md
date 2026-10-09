# HZ-GCA-6 — 420Hz Generate Studio UX qualification evidence

Status: **COMPLETE — Level 1**

Canonical roadmap step: **HZ-GCA-6 — 420Hz Generate Studio UX**

## Qualification identity

- Repository: `abvhiael/420-integrated-v0.1`
- PR: **#565 — Add 420Hz Generate, Community & Awards roadmap phase**
- Branch: `feature/420hz-generate-community-awards-roadmap`
- Qualified implementation SHA: `a6b32e97f95d868eb89785af3dd877969d49d26c`
- Current main at evidence closeout: `ff61fc1171d422c081f4a5abb9e5828e88949c0f`
- Qualification level: **Level 1**
- Level 2: **NOT REQUIRED / NOT RUN**
- Level 3: **DEFERRED to HZ-GCA-17**

## Canonical requirements satisfied

Required screens/surfaces:

- Generate landing page;
- prompt/lyrics composer;
- advanced music controls;
- cost/capacity preview;
- generation progress;
- A/B take comparison;
- audio player and stem preview where available;
- provenance/disclosure panel;
- save/regenerate/remix controls;
- explicit Register & Publish handoff;
- failures/retry/refund state;
- responsive/mobile behavior and accessibility.

Additional canonical requirement:

- home page contains a prominent **Generate your own song** CTA.

Canonical exit:

**fully navigable Generate workflow against qualified mock/dev execution.**

## Repository inspection / current-main disposition

HZ-GCA-6 was implemented on the existing HZ-GCA branch after HZ-GCA-5 completion.

The original implementation qualified successfully, but `main` subsequently advanced through ReeferReview recovery work and the Compute scientific-ingestion/Gridcoin roadmap update.

Current `main` at final closeout is:

`ff61fc1171d422c081f4a5abb9e5828e88949c0f`

The accumulated branch/main comparison showed only one shared changed path:

`docs/ROADMAP.md`

The branch version carried the HZ-GCA phase handoff while current main added the Compute scientific-ingestion/Gridcoin roadmap. The roadmap was explicitly reconciled to preserve both bodies of work.

The feature branch was then merged with current main using:

`a6b32e97f95d868eb89785af3dd877969d49d26c`

That reconciled SHA became the final HZ-GCA-6 implementation candidate and was requalified exactly. PR #565 is open and mergeable against the current main base.

## Implementation completed

Added:

- `hz/web/generate-studio.mjs`
- `hz/web/test/generate-studio.test.mjs`
- `hz/config/gca-generate-studio-ux-v1.json`
- `docs/architecture/420hz/HZ-GCA-6-GENERATE-STUDIO-UX.md`
- `scripts/verify-420hz-gca-6.py`

Updated:

- `hz/web/index.html`
- `hz/web/styles.css`
- `docs/420HZ-WEB.md`
- `docs/420HZ-GENERATE-COMMUNITY-AWARDS-ROADMAP.md`
- `.github/workflows/420hz-web.yml`
- `.github/workflows/420hz-gca.yml`

## Generate entry point

The primary 420Hz hero now includes:

**Generate your own song**

as the prominent primary CTA.

The primary navigation also exposes a Generate entry linked to `#generate`.

## Generate landing / composer

The Generate Studio provides:

- private-development landing;
- explicit start control;
- song prompt;
- optional lyrics;
- VOCAL / INSTRUMENTAL mode;
- requested duration.

Instrumental mode clears lyric-dependent behavior in the state model.

## Advanced controls

The UX provides expandable controls for:

- genres;
- styles;
- moods;
- instrumentation.

These remain the same provider-neutral input vocabulary used by the qualified Generate model.

## Cost / capacity preview

The studio displays:

- development price/asset;
- available slots;
- queue depth;
- provider model/version.

The development quote carries:

`authoritative:false`

and is not represented as payment, settlement, production pricing or an SLA.

## Generation progress

Generation progress uses:

- native `progress`;
- live status text;
- explicit cancel action.

The deterministic development flow progresses to A/B comparison, FAILED, or CANCELLED.

## A/B take comparison

Successful mock/dev execution returns exactly:

- take A;
- take B.

Each take presents:

- duration;
- visual waveform;
- labeled audio control;
- available provider-neutral artifacts/stems;
- selection control.

No public media URL is fabricated.

The audio control remains unbound until a qualified media/storage URL exists.

## Provenance / disclosure

The selected development take displays:

- provider/model/version;
- AI disclosure class;
- result commitment;
- private-development visibility.

This is presentation of development evidence only.

It creates no Creative/rights/publication authority.

## Save / regenerate / remix

The state model implements explicit transitions for:

- selecting a take;
- saving the selected take;
- regeneration;
- remixing the selected take.

Save requires a selected take.

Remix returns the request to READY state with an explicit remix prompt.

## Register & Publish handoff

The studio exposes the required explicit:

**Register & Publish**

handoff.

It is unavailable until a complete selected take has been saved.

When available, the HZ-GCA-6 action returns only:

`REGISTER_AND_PUBLISH_HANDOFF`

with:

`enabled:false`

and an explicit reason that HZ-GCA-7 owns actual registration/publication.

HZ-GCA-6 submits no Work, Recording, release, Wallet or publication transaction.

## Failure / retry / refund state

The development model contains a deterministic provider-failure fixture.

Retry is exposed only for a retryable failure.

Cancellation and failure preserve:

`NO_SETTLEMENT_OBSERVED`

and do not fabricate PAID/REFUNDED state or successful output.

## Accessibility

Qualified UI characteristics include:

- semantic sections/headings;
- native labels and controls;
- keyboard-native buttons/selects/text inputs;
- live status regions;
- native progress;
- `aria-pressed` take selection;
- labeled audio controls;
- reduced-motion support.

## Responsive/mobile

Explicit responsive rules cover:

- composer grid collapse;
- stacked quote preview;
- one-column take comparison;
- one-column provenance;
- full-width actions;
- stacked studio status.

Breakpoints:

- tablet/narrow: 760px;
- mobile: 480px.

## Machine-readable invariants

`hz/config/gca-generate-studio-ux-v1.json` freezes:

**HZGCA6-001 through HZGCA6-018**

covering CTA/navigation, screens, non-authoritative cost/capacity, accessible progress, A/B takes, media non-fabrication, provenance, save/regenerate/remix, Register & Publish handoff, failure/refund handling, responsive/accessibility behavior and pre-testnet authority boundaries.

## Level-1 qualification

Authoritative workflow:

**420Hz Web Qualification**

Original exact-head implementation run:

- Run ID: **37826287208**
- Run number: **#237**
- Job: **HZ-GCA-6 Level 1**
- Job ID: **113479885333**
- Exact tested SHA: `d46585be81059dc1619e5005495a773e47efe5d3`
- Result: **PASS**

Final authoritative reconciled exact-head run:

- Run ID: **37841673679**
- Run number: **#241**
- Job: **HZ-GCA-6 Level 1**
- Job ID: **113532303192**
- Exact tested SHA: `a6b32e97f95d868eb89785af3dd877969d49d26c`
- Result: **PASS**

A later documentation-only evidence commit was also exercised by **420Hz Web Qualification #242**; its HZ-GCA-6 job `113533255008` passed **10/10 state-model tests**, the retained web verifier, HZ-GCA-5 verifier and HZ-GCA-6 verifier. This later run is supporting evidence only; the executable qualification identity remains the reconciled implementation SHA above.

Required results:

1. exact PR-head checkout/verification — PASS;
2. Generate Studio state-model suite — **10 PASS / 0 FAIL / 0 SKIPPED**;
3. retained 420Hz web verifier — PASS;
4. retained HZ-GCA-5 project/storage verifier — PASS;
5. HZ-GCA-6 targeted verifier — PASS;
6. retained 420Hz web job — PASS.

No required HZ-GCA-6 check was skipped, cancelled, missing, stale or untriggered on the final reconciled implementation SHA. The subsequent evidence-only head also passed the same HZ-GCA-6 job.

## Security / adversarial result

Result: **PASS**

Coverage verifies:

- no capacity keeps the request fail-closed;
- invalid/short request cannot begin generation;
- development quote is non-authoritative;
- instrumental mode strips lyric-dependent output;
- retry only follows retryable provider failure;
- cancellation creates no successful output;
- refund state is not fabricated;
- Register & Publish cannot run before a saved take;
- Register & Publish remains a disabled handoff even after readiness;
- snapshots never claim registered/published/settled completion;
- no network fetch/live Indexer path is introduced;
- no production address/endpoint is invented.

## Level 2

**Not required / not run.**

HZ-GCA-6 is an ordinary app-scoped UX step over already-qualified HZ-GCA-2 through HZ-GCA-5 application boundaries.

No major shared authority/lifecycle implementation changed.

## Intentionally deferred Level 3

Deferred to HZ-GCA-17:

- canonical full Solidity inventory;
- Genesis/address-authority qualification;
- 420 Integrated/global qualification;
- final Docs/global reconciliation;
- complete retained app/client/service/Indexer/Search/RPC/frontend/backend suites;
- global security/static/deployment/config closeout.

## Limitations

HZ-GCA-6 intentionally does not claim:

- live provider execution;
- production capacity/pricing;
- production media playback URL;
- Wallet signing;
- Work/Recording registration;
- catalog release publication;
- settlement/refund completion;
- public testnet deployment.

## Exit criteria verification

- Generate landing page: **PASS**
- prompt/lyrics composer: **PASS**
- advanced music controls: **PASS**
- cost/capacity preview: **PASS**
- generation progress: **PASS**
- A/B take comparison: **PASS**
- audio/stem preview surface: **PASS**
- provenance/disclosure panel: **PASS**
- save/regenerate/remix controls: **PASS**
- explicit Register & Publish handoff: **PASS**
- failure/retry/refund state: **PASS**
- responsive/mobile behavior: **PASS**
- accessibility: **PASS**
- prominent Generate your own song CTA: **PASS**
- fully navigable qualified mock/dev workflow: **PASS**
- exact-head Level-1 qualification: **PASS**
- required skipped/cancelled/missing checks: **NONE**

## Blockers

None. Current-main reconciliation is complete and the reconciled exact implementation SHA is qualified.

## Completion state

**HZ-GCA-6 — COMPLETE (Level 1).**

Next canonical roadmap step:

**HZ-GCA-7 — Register & Publish integration**

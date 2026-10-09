# HZ-GCA-6 — 420Hz Generate Studio UX

Status: **COMPLETE — Level 1 exact-head qualified**

Canonical roadmap step: **HZ-GCA-6 — 420Hz Generate Studio UX**

Machine-readable policy: `hz/config/gca-generate-studio-ux-v1.json`

Implementation:

- `hz/web/index.html`
- `hz/web/generate-studio.mjs`
- `hz/web/styles.css`
- `hz/web/test/generate-studio.test.mjs`

HZ-GCA-6 turns the qualified Generate application model into the primary creator-facing **Generate your own song** experience while preserving all pre-testnet and authority boundaries.

## Home-page entry point

The 420Hz hero now contains a prominent:

**Generate your own song**

CTA linking directly to the Generate Studio.

The primary navigation also contains a Generate entry.

## Generate landing

The Generate section opens with a private-development explanation and an explicit start control.

The user is told that the current flow uses qualified mock/dev execution and does not register, publish, settle, or expose drafts publicly.

## Prompt and lyrics composer

The composer provides:

- song prompt;
- optional lyrics;
- VOCAL / INSTRUMENTAL mode;
- requested duration.

Instrumental mode removes lyric-dependent behavior in the qualified model rather than pretending lyrics were used.

## Advanced music controls

Expandable advanced controls provide:

- genre;
- style;
- mood;
- instrumentation.

The controls map to the already-qualified provider-neutral Generate request vocabulary.

## Cost and capacity preview

The UX shows:

- development quote amount/asset;
- available slots;
- queue depth;
- model ID/version.

The quote is explicitly marked as a development projection and `authoritative:false`.

It is not settlement, escrow, payment, or a production provider guarantee.

## Generation progress

Generation uses an accessible native `progress` element with an associated live status.

The development model moves through explicit GENERATING progress before returning either:

- two complete development takes for comparison;
- FAILED;
- CANCELLED.

## A/B take comparison

Successful mock/dev execution produces exactly two comparable development takes:

- take A;
- take B.

Each take presents:

- duration;
- a visual mock waveform;
- an accessible audio-player control;
- available artifact/stem labels;
- selection control.

No public media URL is fabricated. The audio element remains unbound until a qualified media gateway URL exists.

## Audio and stem preview

The UX exposes the player/stem-preview surface required by the roadmap without claiming storage/media deployment that does not exist.

Qualified development artifacts can identify:

- MIX;
- vocal stem when applicable;
- instrumental stem;
- lyrics timing when applicable;
- draft artwork.

The UI does not manufacture a source URL solely to make the player appear live.

## Provenance and AI disclosure

For the selected development take, the panel shows:

- provider/model/version;
- AI disclosure class;
- result commitment;
- private-development visibility.

This is presentation of qualified development evidence, not publication authority.

## Save, regenerate and remix

Explicit controls implement:

- save selected take;
- regenerate;
- remix selected take.

Save requires a selected complete take.

Remix returns the user to a READY request with an explicit remix prompt rather than silently overwriting the prior result.

## Register & Publish handoff

The Generate Studio contains a dedicated **Register & Publish** panel.

The button remains disabled until a complete selected take has been saved.

Even when ready, activating it performs only an application-level handoff record:

`REGISTER_AND_PUBLISH_HANDOFF`

with:

`enabled:false`

and an explicit statement that **HZ-GCA-7 owns registration/publication**.

HZ-GCA-6 submits no Work/Recording/release transaction and does not represent generation success as publication success.

## Failure, retry and refund state

The UX includes a deterministic development failure fixture.

A retryable provider failure exposes:

- provider-independent failure code;
- explanatory message;
- retry control.

Cancellation and failure use:

`NO_SETTLEMENT_OBSERVED`

for refund presentation.

The UI never fabricates PAID or REFUNDED state without canonical evidence.

## Accessibility

The Generate Studio uses:

- semantic section/headings;
- native labels;
- native buttons/selects/textarea/input controls;
- live status regions;
- native progress;
- `aria-pressed` take selection;
- labeled audio controls;
- keyboard-native interactions;
- visible focus behavior inherited from the existing control system;
- `prefers-reduced-motion` support.

No custom pointer-only interaction is required.

## Responsive/mobile behavior

The Generate Studio has explicit responsive rules.

At narrower widths:

- composer grids become one column;
- quote preview stacks;
- A/B take cards become one column;
- provenance grid becomes one column;
- action controls expand to full width;
- status presentation stacks.

The existing 420Hz mobile header/hero rules remain retained.

## Development execution model

`GenerateStudioModel420` is deterministic pre-testnet UX state.

States:

- LANDING
- COMPOSING
- READY
- GENERATING
- COMPARE
- SAVED
- FAILED
- CANCELLED

The model uses the already-qualified mock identity:

- provider: `mock:420hz`;
- model: `mock:music`;
- model version: `1.0.0`.

This is not production execution evidence.

## Authority boundaries

HZ-GCA-6 creates no:

- Wallet signing/custody authority;
- Compute settlement authority;
- Creative registration authority;
- publication authority;
- Rights authority;
- storage gateway authority;
- Charts/Awards authority.

No production chain ID, transaction target, storage gateway URL, provider endpoint, or public media URL is invented.

## Qualification

HZ-GCA-6 is an ordinary **Level 1** app-scoped UX step.

Directly applicable qualification includes:

- Generate Studio Node state-model tests;
- HZ-GCA-6 targeted verifier;
- retained HZ-GCA-5 project/storage verifier;
- retained 420Hz web verifier.

No Level-2 milestone is introduced.

## Exit criteria

HZ-GCA-6 is complete when every required screen/control is present, the home-page CTA is prominent, responsive/accessibility constraints are retained, failure/retry/refund boundaries remain fail-closed, Register & Publish remains an explicit HZ-GCA-7 handoff, and the fully navigable development workflow passes exact-head Level-1 qualification.

Next canonical roadmap step:

**HZ-GCA-7 — Register & Publish integration**


## Qualification result

Qualified implementation SHA:

`a6b32e97f95d868eb89785af3dd877969d49d26c`

Authoritative workflow:

- **420Hz Web Qualification**
- Run: **37841673679** (#241)
- Job: **HZ-GCA-6 Level 1**
- Job ID: **113532303192**
- Result: **PASS**

Exact-head required results:

- Generate Studio state model: **10 PASS / 0 FAIL / 0 SKIPPED**
- retained 420Hz web verifier: **PASS**
- retained HZ-GCA-5 project/storage verifier: **PASS**
- HZ-GCA-6 targeted verifier: **PASS**
- retained web job: **PASS**

Current `main` advanced after the original HZ-GCA-6 implementation qualification through ReeferReview and Compute-roadmap work. The branch was reconciled to current `main` `ff61fc1171d422c081f4a5abb9e5828e88949c0f` using merge commit `a6b32e97f95d868eb89785af3dd877969d49d26c`. The only content conflict was global `docs/ROADMAP.md`; the merged file preserves both the HZ-GCA phase handoff and current Compute scientific-ingestion/Gridcoin roadmap additions. The exact reconciled SHA then passed the complete HZ-GCA-6 Level-1 suite.

No Level-2 milestone is required for HZ-GCA-6. Level-3 repository-wide qualification remains deferred to HZ-GCA-17.

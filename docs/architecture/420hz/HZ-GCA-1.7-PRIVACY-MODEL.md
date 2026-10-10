# HZ-GCA-1.7 — Privacy model

Status: **IMPLEMENTED — Level 1 privacy-model definition**

Canonical parent step: **HZ-GCA-1 — Scope, threat model and authority map**

Machine-readable policy:

`hz/config/gca-privacy-v1.json`

This step freezes privacy classifications and handling rules for Generate, Community and Awards without changing canonical protocol authority.

## Privacy classes

420Hz uses four logical privacy classes:

- **PUBLIC** — eligible for public publication/discovery after the relevant product/protocol gates pass;
- **UNLISTED** — shareable by explicit reference but excluded from broad Search/trending/discovery;
- **PRIVATE** — creator/account-scoped and excluded from public projections by default;
- **SECRET** — credentials/keys/tokens or equivalent sensitive data that must never be persisted in public/application records, logs or indexes.

Privacy class is separate from rights, identity, provenance, disclosure and canonical protocol status.

## Private-by-default Generate state

The following are private by default:

- GenerationProject;
- GenerationIntent;
- GenerationRunBinding;
- GenerationOutput;
- GenerationArtifact;
- ProvenanceDraft;
- PublishIntent;
- prompts;
- private lyric drafts;
- reference audio;
- draft audio;
- private stems;
- raw voice/persona consent evidence.

Successful generation does not make these public.

REVIEWED does not make them public.

REGISTERED does not make them public except for exact canonical commitments/IDs explicitly intended for publication.

PUBLISHED exposes only fields classified PUBLIC for the exact Recording/version.

## Prompts and lyrics

Prompt text and private lyric drafts stay off-chain/private by default.

They may be sent to a qualified AI provider only through the private execution path required for the exact job.

A prompt is not public simply because:

- the job succeeded;
- a result exists;
- a Recording was registered;
- provenance commitments were published;
- a link was shared.

A future feature may allow a creator to publish prompt/lyric content, but that requires an explicit visibility transition.

## Reference audio

Reference audio is private by default.

Upload possession does not imply permission and public provenance commitments do not make the underlying audio public.

Reference audio must not enter public Indexer/Search projections.

Where provider execution needs it, access must be authenticated, encrypted, least-privilege, assignment-scoped and time-bounded.

## Outputs and stems

Generated draft mixes, takes, stems and intermediate files remain private until an explicit publication path chooses them.

Only the selected output needed for the final publication path may cross into public media state after review, provenance, rights, consent, registration and publication gates.

Unused takes/stems do not become public because another take from the same project was released.

## Secrets

The following are SECRET:

- wallet private keys;
- signing secrets;
- provider API credentials;
- bearer/session tokens;
- decryption keys;
- other runtime-only credentials.

420Hz must not accept, persist, log, index or publish them as project/content data.

Secret-manager/runtime injection remains separate from user/application content storage.

## Provider / Compute privacy

Private execution payloads follow the privacy boundaries already used by 420AI and Compute Market:

- authenticated encrypted off-chain transport/storage;
- least-privilege access;
- exact assignment scope;
- time-bounded access;
- no cross-project/cross-job entitlement;
- no plaintext prompt/document/audio persistence in public runtime state;
- expired/wrong-scope access fails closed.

420Hz may send only the minimum data needed for the selected request and privacy policy.

An accepted assignment does not authorize account-wide access or access to unrelated projects/datasets.

## Encryption and commitments

Raw private media/content remains off-chain by default.

Public protocol/product state may contain bounded:

- IDs;
- hashes/commitments;
- policy/schema versions;
- public references.

A hash is not automatically confidentiality. Low-entropy protected data must not rely on a plain unsalted hash as privacy protection.

Commitments and ciphertext references do not authorize decryption or recovery.

## Indexer/Search boundaries

420Indexer and 420Search receive only data explicitly eligible for public projection.

Rules:

- PRIVATE data is excluded;
- SECRET data is excluded;
- UNLISTED data is excluded from broad Search/trending/discovery;
- draft Generate objects are excluded;
- hashes/ciphertext references do not authorize recovery of protected payloads;
- Search ranking cannot broaden source visibility.

A Search result can never make a PRIVATE object public.

## Notifications

420Notifications receives only minimal event metadata needed for opt-in delivery.

It must not receive raw:

- prompts;
- private lyrics;
- reference audio;
- stems;
- raw consent evidence;
- credentials.

Subscription state, watchlists, delivery endpoints and notification history remain private by default.

Notification delivery never republishes the underlying private object.

## Logging / telemetry / CI

Logs, traces, crash reports, metrics and CI artifacts must redact or omit:

- prompts;
- lyrics;
- raw audio bytes;
- private stems;
- access tokens;
- credentials;
- wallet secrets;
- raw consent evidence.

Aggregate latency, capacity and error metrics are permitted where they do not expose customer payload contents.

Debug mode must not silently disable privacy/redaction behavior in qualification or production.

## Community privacy

Community state is not uniformly public.

Initial policy:

- ArtistFollow may be public subject to future privacy preference support;
- favorites default PRIVATE;
- private playlists are PRIVATE;
- unlisted playlists are UNLISTED;
- public playlists are PUBLIC;
- derived activity/search visibility cannot exceed the underlying object visibility.

A direct link to an UNLISTED object does not promote it into public Search.

## Awards privacy

Award results are public only after canonical product-domain finalization.

Vote secret/signature material remains private.

Public results may expose only policy-approved aggregate/result commitments and final outcomes.

Awards participation must not leak Wallet signing material or unrelated Identity/private data.

## Provenance / consent privacy

Published provenance may expose:

- hashes;
- commitments;
- native canonical IDs;
- schema/policy versions;
- disclosure class;
- bounded source/consent references.

It must not expose protected plaintext merely because the provenance record proves linkage.

Raw voice/persona consent evidence remains private unless the qualified consent source explicitly defines it as public.

## Lifecycle privacy

### DRAFT / QUOTED / SUBMITTED / RUNNING / SUCCEEDED

Generation content remains private unless a particular field is explicitly PUBLIC.

### REVIEWED

The creator has completed review/disclosure/provenance decisions. Private payloads remain private.

### REGISTERED

Canonical Work/Recording references and commitments may become public. Hidden source payloads remain private.

### PUBLISHED

Only explicitly PUBLIC fields for the exact Recording/version become public.

Privacy visibility changes require an explicit user/policy action. They are never inferred from execution success or link sharing.

## Retention boundary

HZ-GCA-1.7 requires **bounded retention**.

Exact deletion/retention durations, archival, quotas, export and abandoned/failed-project cleanup are intentionally frozen in **HZ-GCA-1.8 — Define storage & retention rules**.

This step prohibits indefinite provider/runtime private copies by default but does not invent durations that the next step has not yet defined.

## Fail-closed behavior

420Hz must fail closed if:

- PRIVATE or SECRET data is sent to public indexing;
- UNLISTED data is sent to broad Search;
- provider access is expired or wrong-scope;
- a required private-job privacy policy/reference is missing;
- secrets are being persisted/logged;
- publication visibility is unresolved;
- a notification contains raw protected generation payloads;
- Search/discovery visibility exceeds source visibility;
- debug/telemetry settings would leak protected payloads.

## Invariants

The machine-readable policy freezes **HZGCA-PRIV-001 through HZGCA-PRIV-018**.

The core guarantees are:

- Generate drafts are private by default;
- private AI/Compute access is encrypted/scoped/bounded;
- public projections only contain public-eligible data;
- UNLISTED remains undiscoverable by broad Search;
- commitments never grant access to hidden payloads;
- logs/CI never contain protected payloads/secrets;
- publication does not broaden unrelated project data;
- exact retention policy remains HZ-GCA-1.8;
- privacy creates no new rights/protocol authority.

## Source reconciliation

The privacy model was reconciled against repository rules that already establish:

- encrypted private 420AI payload storage;
- no plaintext prompt/document persistence in provider runtime state;
- recursive observability redaction;
- Compute Market off-chain private payload boundaries;
- private data exclusion from Search;
- private notification subscriptions/delivery state;
- public projection vs canonical authority separation.

HZ-GCA-1.7 applies those existing guarantees specifically to 420Hz Generate/Community/Awards.

## HZ-GCA-1.7 exit criteria

HZ-GCA-1.7 is complete when:

- all major Generate/Community/Awards data classes have explicit privacy classes;
- private prompts/lyrics/reference audio/drafts/stems/consent evidence handling is explicit;
- provider/worker encrypted least-privilege access is explicit;
- Indexer/Search/Notifications visibility exclusions are explicit;
- logging/telemetry/CI redaction is explicit;
- lifecycle visibility changes and fail-closed ambiguity are explicit;
- retention is bounded while exact retention/deletion remains HZ-GCA-1.8;
- the targeted verifier passes on the exact implementation SHA;
- no ABI, deployment, provider or live/testnet claim is invented;
- parent HZ-GCA-1 remains open.

Next work package after qualification:

**HZ-GCA-1.8 — Define storage & retention rules**

# GEN-SVC-3.6 — descriptive cannabis-aware travel labels

The development Travel UI renders only two classes of public, non-authoritative descriptors:

- Public Location `DISPENSARY` and `FARM` categories produce **listed category** labels. Farm access is explicitly unverified. Generic hotel, rental, restaurant and business categories never imply cannabis friendliness or consumption permission.
- Explicit public event tags `cannabis` / `cannabis-event` and `grow-tour` / `grow-attraction` produce **tagged** event/attraction labels, respectively. Case and surrounding whitespace are normalized; equivalent tags are deduplicated. Unknown tags and claims such as `cannabis-friendly`, `onsite-consumption`, or `legal` are not elevated to UI assertions.

The UI explicitly warns that a category or tag is not a verified statement of cannabis-friendly status, onsite consumption rules, licensing, access, availability or legal compliance. No jurisdictional rules are inferred. Do not display a nearby dispensary recommendation unless actual public geospatial proximity is independently established; the current UI makes no proximity claim. No venue-consumption permission or other rich accommodation metadata is present in the versioned public GEN-SVC-2 `location/uikit.Item` contract; do not fabricate fields or read canonical/private metadata to fill the gap. Introduce any future consented, provenance-qualified attribute only through a separately reviewed public API version and privacy/revocation tests.

All labels operate *after* the public Location/Events adapter and the best-effort second place-projection check. An event associated with an unlisted, private or removed venue is not displayed; approximate-area coordinates are not upgraded to exact. The existing upstream atomic-publication and recurrence/visibility release gates remain open. These UI labels do not establish production readiness.

Qualification: `go test ./genesis/svc3/... ./cmd/420travel/...`, `go vet ./genesis/svc3/... ./cmd/420travel/...`, `go build ./cmd/420travel` and both the dedicated Travel and repository-wide GitHub Actions workflows on the final branch head. PR #356 is the implementation branch; no automatic merge is implied.

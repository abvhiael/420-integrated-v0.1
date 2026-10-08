# GROW-03 — Shared location consumer

**Roadmap step:** GROW-03 — Shared location consumer (Level 1).  
**Scope:** public, read-only `420Location` Place presentation; no application service ID, wallet execution, Registry authority, or new contract.

## Source and implementation

- Source contract: `genesis/svc2/sdk.Client.Places(context.Context)`, backed by `GET /v1/places` and version `v1`.
- Public upstream projection: `location/uikit.View` and `location/uikit.Item`. The server uses `location/uikit.Build` after selecting public records.
- App consumer: `grow/location/consumer.go`. Only `FARM` and `BUSINESS` categories pass the Grow view filter. Stable upstream `ID` values are preserved and no provider aliases replace them.
- Normalized card exposure: ID, name, category, kind, public city/region/country, and validated pin coordinates for `KindPin` only.
- Coarse `KindArea` cards have **no coordinates**, including those supplied maliciously. Invalid upstream data fails closed for the entire response, rather than returning a partial list.
- The current upstream `/v1/places` view does **not expose** source provenance, Registry link, Verify attestation, publisher identity, precision classification apart from pin/area, or an upstream freshness token. Grow correctly reports `provenanceAvailable:false` and does not invent verified status. This is an explicit **GROW-03 functional limitation**; implementation of real provenance may require a narrowly scoped upstream public projection extension and its own shared-dependency qualification, not a fake badge.
- The public endpoint supports an unpaginated, maximum 500-item map projection. It does not yet support requested farm/business category server filtering or cursor pagination; Grow cannot honestly claim the GEN-SVC-0 pagination contract is fully met. GROW-05/GROW-07 must resolve pagination for larger deployments without broadening private visibility.

## Invariants and qualification

1. Only `FARM` and `BUSINESS` records appear; nonmatching valid categories are excluded.
2. Every upstream item is validated, including filtered-out records, to detect unsafe view corruption.
3. Pin coordinates must be finite and within [-90,90] latitude and [-180,180] longitude; approximate cards must not contain coordinates.
4. Missing ID/name, duplicate IDs, invalid categories or kinds, inconsistent `empty` flags, and service failures all fail closed.
5. A consumer never recovers private/canonical place state outside the read-only public SDK or mutates Registry, Identity or ownership.
6. Current upstream API cannot prove provenance; no verified assertion appears in the Grow response.
7. Real SDK integration is tested with `httptest` at the exact `GET /v1/places` route. Wrong API version fails closed.

Run app-scoped verification:

```sh
go test ./grow/location ./genesis/svc2/sdk ./location/uikit ./location/privacy
go vet ./grow/location
test -z "$(gofmt -l grow/location/*.go)"
python3 scripts/verify-grow-01.py
python3 scripts/verify-grow-02.py
```

The app-local fast workflow owns these checks. No phase-wide Solidity or Genesis inventory is warranted for this Go-only consumer.

## Remaining limitations and downstream responsibility

- Real source/Registry/Verify provenance: **not provided by public SDK**; do not assume completeness. Requires upstream API design and qualification before display. Track GROW-03 acceptance explicitly as partial until provenance requirement is satisfied.
- Real provider-enforced category filtering and cursor pagination: currently unavailable on `/v1/places`. Track in GROW-05 and GROW-07.
- Production endpoint configuration, TLS, public deployment, monitoring, live data and 420Search integration: not yet covered; GROW-07/GROW-10.
- User-facing page and map/list interaction: GROW-04.
- App Level 2 convergence: after GROW-03 through GROW-07; Level 3 after phase completion.

**Next canonical roadmap step:** GROW-04 — UX.

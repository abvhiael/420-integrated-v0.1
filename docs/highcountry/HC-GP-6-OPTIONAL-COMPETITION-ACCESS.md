# HC-GP.6 — Optional Competition Entitlement Access

This slice expands High Country's use of the 420 Gaming Protocol with an optional competition-entry consumer.

## Boundary

`OptionalCompetitionAccess420` only applies to competitions explicitly registered in its own optional-content registry. Ordinary/base High Country competitions are not registered here and remain wallet-free.

Each optional competition binds:
- a High Country `competitionId`
- a 420 Gaming Protocol `entitlementId`
- an exact competition `contentId`
- an active/inactive status

Access is granted only when `IHighCountryGamingAccess420.hasCompetitionAccess(...)` confirms the matching active High Country entitlement for the bound grower profile.

## No pay-to-win effect

This gate does not change cultivation capacity, yield, genetics quality, BUDS generation, land, equipment stats, progression rates, or any other gameplay statistic. It controls entry to explicitly optional events only.

## Administration

Registration and status changes use `HighCountryAuthorization` with `ModuleIds.COMPETITION_ENGINE` and dedicated action IDs. The policy remains default-deny.

## Fail-closed behavior

Missing registrations return no optional access. Missing/revoked/wrong entitlements, inactive events, and unauthorized administration fail closed. Unregistered competitions are outside this gate and therefore are not converted into wallet-gated content.

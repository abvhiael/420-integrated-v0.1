# HC-PLACE-03-B.5 — Real PostgreSQL cross-module qualification

A dedicated PostgreSQL 16 integration test exercises real serializable row locks across independent `PostgresBudsStore`, `HighCountryPlacementTransactions`, `HighCountryMarket`, and `BudsLedger` instances. It checks placement/listing competition, bought-unit ownership, BUDS conservation, restart/replay, exact placement release, rollback under simulated pre-commit failure, and buy/cancel races.

Source-of-truth qualification workflow: `.github/workflows/highcountry-hc-place-03b5-l2.yml`. The integration uses a disposable local PostgreSQL service and test authority stubs; production user authorization, external canonical-chain finality and multi-process service transport remain separate release gates. This step does not authorize gameplay enablement or phase closeout.

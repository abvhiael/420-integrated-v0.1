#!/usr/bin/env bash
# HC-NEXT-7.5-F: one bounded exact-SHA acceptance, retaining proven authoritative paths.
set -euo pipefail
: "${HIGHCOUNTRY_CUP_POSTGRES_TEST_URL:?}"
: "${HIGHCOUNTRY_EXHIBITIONS_POSTGRES_TEST_URL:?}"
[[ "${HIGHCOUNTRY_CUP_POSTGRES_TEST_URL}" == */hc_cup_ci ]]
[[ "${HIGHCOUNTRY_EXHIBITIONS_POSTGRES_TEST_URL}" == */hc_exhibition_ci ]]
echo '7.5-F: establish distinct isolated PostgreSQL databases for Cup and issuer identities'
PGPASSWORD=test-only psql -h 127.0.0.1 -U postgres -d hc_cup_ci -v ON_ERROR_STOP=1 \
  -c 'CREATE DATABASE hc_exhibition_ci'
echo '7.5-F: real accepted harvest provenance, independently confirmed block, revocation and canonical Cup gate'
(cd contracts && forge test --match-path 'test/highcountry/integration/R04CanonicalCompetition.t.sol' -vv)
echo '7.5-F: issuer-authenticated ordinary season, registration, challenge, finalization, durable audit and restart'
(cd services/420-gaming-player-profile && node --test \
  test/highcountry-ordinary-postgres.integration.mjs \
  test/highcountry-ordinary-http.test.js \
  test/highcountry-ordinary-exhibitions.test.js)
echo '7.5-F: actual Anvil semifinal-to-final championship, finalized RPC, HTTP, durable prestige and receipt-backed revocation'
bash scripts/highcountry/hc-next-7-4-anvil-integration.sh
echo '7.5-F: PASS — both independent authority paths and recovery qualified in the same exact-SHA runner'

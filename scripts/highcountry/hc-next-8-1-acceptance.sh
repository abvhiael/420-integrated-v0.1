#!/usr/bin/env bash
set -euo pipefail
: "${HIGHCOUNTRY_R063_POSTGRES_TEST_URL:?}"
: "${GAMING_SAVE_TEST_URL:?}"
[[ "$HIGHCOUNTRY_R063_POSTGRES_TEST_URL" == */r063_ci ]]
[[ "$GAMING_SAVE_TEST_URL" == */r055_ci ]]
# Two isolated databases share a runner but never save tables or account identities.
PGPASSWORD=hc_ci_only psql -h 127.0.0.1 -U postgres -d r063_ci -v ON_ERROR_STOP=1 -c 'CREATE DATABASE r055_ci'
cd services/420-gaming-player-profile
echo 'HC-NEXT-8.1: issuer registration/login/logout/revocation and scoped authenticated HTTP'
node --test test/highcountry-local-issuer.test.js test/highcountry-local-auth-http.test.js test/highcountry-cloud-http.test.js
echo 'HC-NEXT-8.1: real issuer-account PostgreSQL with encrypted cloud state, conflict, logout, recovery and damaged storage'
node --test test/highcountry-r063-postgres.integration.mjs
echo 'HC-NEXT-8.1: versioned immutable saves, stale conflict and backup restore/revocation'
node --test test/cloud-save-lifecycle.test.js test/encrypted-local-save-provider.test.js
echo 'HC-NEXT-8.1: real PostgreSQL independent backup, redaction, retention, restore and permissions'
node --test test/save-postgres.integration.mjs
echo 'HC-NEXT-8.1: PASS'

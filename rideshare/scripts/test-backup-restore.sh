#!/usr/bin/env bash
set -euo pipefail
: "${LIFTD_DATABASE_URL:?isolated database required}"
[[ "$LIFTD_DATABASE_URL" == *'/liftd_qualification' ]] || { echo 'BACKUP_UNSAFE_DATABASE' >&2; exit 2; }
export PGPASSWORD=postgres PGHOST=127.0.0.1 PGUSER=postgres
base="liftd_qualification"
restore="liftd_restore_qualification"
trap 'psql -X -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS liftd_restore_qualification WITH (FORCE)" >/dev/null; rm -f "$archive"' EXIT
archive="$(mktemp --suffix=.dump)"
node --input-type=module -e "import {createDatabasePool,migrate} from './rideshare/src/postgres-store.mjs';let p=createDatabasePool({connectionString:process.env.LIFTD_DATABASE_URL});try{await migrate(p);await p.query(\"INSERT INTO liftd.recovery_jobs(job_id,kind,subject_id) VALUES('backup_proof','availability_sweep','driver_proof')\");}finally{await p.end()}"
pg_dump -Fc --no-owner --no-acl -d "$base" -f "$archive"
test -s "$archive"
psql -X -d postgres -v ON_ERROR_STOP=1 -c "DROP DATABASE IF EXISTS $restore WITH (FORCE)" >/dev/null
psql -X -d postgres -v ON_ERROR_STOP=1 -c "CREATE DATABASE $restore" >/dev/null
pg_restore --no-owner --no-acl --exit-on-error -d "$restore" "$archive"
src="$(psql -XAt -d "$base" -c "SELECT job_id || ':' || kind || ':' || subject_id FROM liftd.recovery_jobs WHERE job_id='backup_proof'")"
dst="$(psql -XAt -d "$restore" -c "SELECT job_id || ':' || kind || ':' || subject_id FROM liftd.recovery_jobs WHERE job_id='backup_proof'")"
[[ -n "$src" && "$src" == "$dst" ]] || { echo 'BACKUP_RESTORE_DATA_MISMATCH' >&2; exit 1; }
LIFTD_DATABASE_URL="postgres://postgres:postgres@127.0.0.1:5432/$restore" node --input-type=module -e "import {createDatabasePool,migrate} from './rideshare/src/postgres-store.mjs';let p=createDatabasePool({connectionString:process.env.LIFTD_DATABASE_URL});try{await migrate(p)}finally{await p.end()}"
src_hash="$(psql -XAt -d "$base" -c "SELECT md5(string_agg(version || ':' || checksum, ',' ORDER BY version)) FROM liftd.migrations")"
dst_hash="$(psql -XAt -d "$restore" -c "SELECT md5(string_agg(version || ':' || checksum, ',' ORDER BY version)) FROM liftd.migrations")"
[[ -n "$src_hash" && "$src_hash" == "$dst_hash" ]] || { echo 'BACKUP_RESTORE_MIGRATION_DRIFT' >&2; exit 1; }
echo 'LIFTD_BACKUP_RESTORE_ISOLATED_PASS'

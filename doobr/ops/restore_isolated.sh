#!/usr/bin/env bash
# Restore into a pre-created, isolated empty recovery DB; never overwrite production.
set -euo pipefail
umask 077
: "${RESTORE_DATABASE_URL:?Isolated recovery DB with sslmode=verify-full required}"
: "${BACKUP_FILE:?Encrypted age backup file required}"
: "${BACKUP_IDENTITY_FILE:?Protected age private identity key required}"
: "${BACKUP_CHECKSUM_FILE:?Backup SHA256 manifest required}"
case "$RESTORE_DATABASE_URL" in *sslmode=verify-full*) ;; *) echo 'Require sslmode=verify-full' >&2; exit 2 ;; esac
case "$RESTORE_DATABASE_URL" in *doobr_r02_12_restored*|*doobr_recovery_*) ;; *) echo 'Unapproved recovery database name' >&2; exit 2 ;; esac
command -v age >/dev/null
command -v pg_restore >/dev/null
test -s "$BACKUP_IDENTITY_FILE"
test -f "$BACKUP_FILE"
test -f "$BACKUP_CHECKSUM_FILE"
actual="$(sha256sum "$BACKUP_FILE" | awk '{print $1}')"
expected="$(awk '{print $1}' "$BACKUP_CHECKSUM_FILE")"
test "$actual" = "$expected" || { echo 'Encrypted backup integrity failed' >&2; exit 2; }
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
age --decrypt -i "$BACKUP_IDENTITY_FILE" -o "$tmp/recovery.dump" "$BACKUP_FILE"
pg_restore --list "$tmp/recovery.dump" >/dev/null
# Operators must create a fresh empty dedicated recovery database before invoking this.
pg_restore --exit-on-error --no-owner --no-acl --dbname="$RESTORE_DATABASE_URL" "$tmp/recovery.dump"
psql "$RESTORE_DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='doobr_private' AND c.relname IN ('operation_audit','event_outbox','return_cases','custody_evidence') AND c.relrowsecurity AND c.relforcerowsecurity" | grep -qx 4
echo 'isolated restore completed with private RLS verified; audit verification still required'

#!/usr/bin/env bash
# R02.12: encrypted PostgreSQL custom-format backup. Use trusted external vault keys.
set -euo pipefail
umask 077
: "${DATABASE_URL:?TLS PostgreSQL URL required}"
: "${BACKUP_ENCRYPTION_KEY_FILE:?Vault-mounted age recipient file required}"
: "${BACKUP_DESTINATION:?Durable private backup destination required}"
command -v pg_dump >/dev/null
command -v age >/dev/null
command -v sha256sum >/dev/null
case "$DATABASE_URL" in *sslmode=verify-full*) ;; *) echo 'Require sslmode=verify-full' >&2; exit 2 ;; esac
test -s "$BACKUP_ENCRYPTION_KEY_FILE"
test -d "$BACKUP_DESTINATION"
test ! -L "$BACKUP_DESTINATION"
stamp="$(date -u +%Y%m%dT%H%M%SZ)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
pg_dump --format=custom --no-owner --no-acl --dbname="$DATABASE_URL" --file="$tmp/backup.dump"
pg_restore --list "$tmp/backup.dump" >/dev/null
# age -R accepts recipient definitions from secured operations key mount.
age -R "$BACKUP_ENCRYPTION_KEY_FILE" -o "$tmp/backup.age" "$tmp/backup.dump"
chmod 600 "$tmp/backup.age"
sha256sum "$tmp/backup.age" | awk '{print $1}' >"$tmp/checksum"
install -m 0600 "$tmp/backup.age" "$BACKUP_DESTINATION/doobr-$stamp.age"
install -m 0600 "$tmp/checksum" "$BACKUP_DESTINATION/doobr-$stamp.sha256"
echo "encrypted backup created: doobr-$stamp.age"

#!/usr/bin/env python3
"""420Travel PostgreSQL migration runner. Requires the psql CLI and a privileged
migration-only DATABASE_URL; runtime service credentials must not run DDL.
Migration files contain their own BEGIN/COMMIT, and checksums are immutable.
"""
import hashlib
import os
import pathlib
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
MIGRATIONS = ROOT / "genesis/svc3/travelapp/migrations"
FILES = [
    "001_travel_trips.sql",
    "002_travel_trip_shares.sql",
    "003_travel_claims.sql",
]


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in {"plan", "apply", "verify"}:
        raise SystemExit("usage: python3 scripts/travel-postgres-migrate.py plan|apply|verify")
    action = sys.argv[1]
    for name in FILES:
        path = MIGRATIONS / name
        if not path.is_file():
            raise SystemExit(f"missing migration: {name}")
        print(name, sha256(path), flush=True)
    if action == "plan":
        return
    dsn = os.environ.get("TRAVEL_MIGRATION_DATABASE_URL", "")
    if not dsn or not dsn.startswith(("postgresql://", "postgres://")):
        raise SystemExit("TRAVEL_MIGRATION_DATABASE_URL must be a PostgreSQL DSN")
    # No shell invocation; never echo the credential.
    env = os.environ.copy()
    env["PGDATABASE"] = dsn
    env["PGCONNECT_TIMEOUT"] = "5"
    env["PGOPTIONS"] = "-c statement_timeout=30000 -c lock_timeout=5000"
    def sql(statement):
        result = subprocess.run(["psql", "-X", "-w", "-v", "ON_ERROR_STOP=1", "-At", "-c", statement],
                                env={**env, "PGPASSWORD": os.environ.get("PGPASSWORD", "")},
                                input=None, capture_output=True, text=True)
        if result.returncode:
            raise SystemExit("PostgreSQL migration verification failed (details redacted)")
        return result.stdout.strip()
    # Store applied checksums separately. No changing already-applied migrations.
    if action == "apply":
        sql("""CREATE TABLE IF NOT EXISTS travel_schema_migrations (
           name text PRIMARY KEY, digest text NOT NULL CHECK (length(digest)=64),
           applied_at timestamptz NOT NULL DEFAULT clock_timestamp())""")
    for name in FILES:
        digest = sha256(MIGRATIONS / name)
        row = sql("SELECT digest FROM travel_schema_migrations WHERE name='"+name+"'")
        if row and row != digest:
            raise SystemExit(f"migration checksum mismatch: {name}")
        if action == "verify" and not row:
            raise SystemExit(f"migration not applied: {name}")
        if action == "apply" and not row:
            cmd = ["psql", "-X", "-w", "-v", "ON_ERROR_STOP=1", "-f", str(MIGRATIONS / name)]
            result = subprocess.run(cmd, env=env, capture_output=True, text=True)
            if result.returncode:
                raise SystemExit(f"migration failed: {name} (details redacted)")
            sql("INSERT INTO travel_schema_migrations(name,digest) VALUES ('"+name+"','"+digest+"')")
    print("Travel migration checksums verified")


if __name__ == "__main__":
    main()

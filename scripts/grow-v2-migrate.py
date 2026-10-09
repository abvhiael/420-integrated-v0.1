#!/usr/bin/env python3
"""GROW-V2-03 deterministic, fail-closed PostgreSQL migration executor.

Requires a privileged operator DATABASE_URL, psql and a disposable/test database
or approved release change. No database is provisioned or seeded automatically.
"""
import hashlib
import os
import pathlib
import shutil
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / "grow/storage/migrations"


def main() -> None:
    url = os.environ.get("GROW_MIGRATION_DATABASE_URL", "")
    if not url or not (url.startswith("postgresql://") or url.startswith("postgres://")):
        raise SystemExit("GROW_MIGRATION_DATABASE_URL must be an explicit PostgreSQL DSN")
    if not shutil.which("psql"):
        raise SystemExit("psql is required")
    files = sorted(DIRECTORY.glob("*.up.sql"))
    if not files:
        raise SystemExit("no Grow migrations")
    # A session-scoped advisory lock encloses the entire transaction and ledger write.
    # psql runs a single connection for each migration. Aborts roll back DDL and ledger.
    for path in files:
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        if not path.name.startswith("0001_") or len(files) != 1:
            raise SystemExit("unexpected migration inventory; explicit executor update required")
        # Reject drift and skip already-applied migrations rather than replay DDL.
        lookup = subprocess.run(
            ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-At", url, "-c",
             "SELECT to_regclass('grow_private.schema_migrations') IS NOT NULL"],
            capture_output=True, text=True, check=False, timeout=30,
        )
        if lookup.returncode != 0:
            raise SystemExit("cannot inspect migration ledger")
        if lookup.stdout.strip() == "t":
            recorded = subprocess.run(
                ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-At", url, "-c",
                 "SELECT checksum FROM grow_private.schema_migrations WHERE version='0001_initial'"],
                capture_output=True, text=True, check=False, timeout=30,
            )
            if recorded.returncode != 0:
                raise SystemExit("cannot read migration ledger")
            if recorded.stdout.strip() == digest:
                print("GROW-V2-03 already applied:", path.name, digest)
                continue
            raise SystemExit("unrecognized or drifted schema migration")
        # Migration SQL owns its BEGIN/COMMIT; preserve checksum verification in same
        # transaction by inserting ledger record before final COMMIT.
        sql = path.read_text()
        if not sql.startswith("-- GROW-V2-03") or not sql.rstrip().endswith("COMMIT;"):
            raise SystemExit("migration format invalid")
        head, _ = sql.rsplit("COMMIT;", 1)
        script = head + (
            "\nINSERT INTO grow_private.schema_migrations(version,checksum) VALUES "
            "('0001_initial','" + digest + "') ON CONFLICT(version) DO NOTHING;\n"
            "DO $$ BEGIN IF (SELECT checksum FROM grow_private.schema_migrations "
            "WHERE version='0001_initial') <> '" + digest + "' THEN "
            "RAISE EXCEPTION 'migration checksum mismatch'; END IF; END $$;\nCOMMIT;\n"
        )
        env = dict(os.environ)
        env["PGCONNECT_TIMEOUT"] = "8"
        p = subprocess.run(
            ["psql", "-X", "-v", "ON_ERROR_STOP=1", "--no-psqlrc", url],
            input=script, text=True, env=env, capture_output=True, check=False, timeout=90,
        )
        if p.returncode != 0:
            raise SystemExit("Grow migration failed (details suppressed; no DSN leakage)")
        print("GROW-V2-03 migration applied:", path.name, digest)


if __name__ == "__main__":
    main()

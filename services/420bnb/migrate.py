"""420BnB ordered PostgreSQL migrations with atomic ledger and single-writer lock.

Existing deployments without a migration ledger MUST be reconciled manually:
do not re-apply DDL or fabricate an applied ledger over unknown live state.
"""
import hashlib
import os
from pathlib import Path

import psycopg

MIGRATIONS = Path(__file__).resolve().parent / "migrations"
LOCK_KEY = 420214


def apply(connection, *, directory=MIGRATIONS):
    files = sorted(directory.glob("[0-9][0-9][0-9]_*.sql"))
    if not files or [int(p.name[:3]) for p in files] != list(range(1, len(files)+1)):
        raise RuntimeError("MIGRATION_SEQUENCE_INVALID")
    with connection.transaction():
        connection.execute("SELECT pg_advisory_xact_lock(%s)", (LOCK_KEY,))
        connection.execute("""CREATE TABLE IF NOT EXISTS bnb_schema_migration (
            version integer PRIMARY KEY CHECK (version>0),
            filename text NOT NULL UNIQUE,
            sha256 char(64) NOT NULL,
            applied_at timestamptz NOT NULL DEFAULT now())""")
        registered=connection.execute(
            "SELECT version,filename,sha256 FROM bnb_schema_migration ORDER BY version").fetchall()
        if registered and [x[0] for x in registered]!=list(range(1,len(registered)+1)):
            raise RuntimeError("MIGRATION_LEDGER_GAP")
        for version,name,digest in registered:
            p=files[version-1] if version<=len(files) else None
            if p is None or p.name!=name or hashlib.sha256(p.read_bytes()).hexdigest()!=digest:
                raise RuntimeError("MIGRATION_DRIFT")
        if not registered and connection.execute(
            "SELECT to_regclass('public.bnb_property')").fetchone()[0] is not None:
            raise RuntimeError("UNTRACKED_EXISTING_SCHEMA_REQUIRES_OPERATOR_RECONCILIATION")
        for version,p in enumerate(files[len(registered):],len(registered)+1):
            data=p.read_bytes()
            connection.execute(data.decode("utf-8"))
            connection.execute(
                "INSERT INTO bnb_schema_migration(version,filename,sha256) VALUES(%s,%s,%s)",
                (version,p.name,hashlib.sha256(data).hexdigest()))
    return len(files)


if __name__ == "__main__":
    dsn=os.environ["BNB_DATABASE_URL"]
    with psycopg.connect(dsn) as conn:
        print(f"Applied/reconciled {apply(conn)} BnB migrations")

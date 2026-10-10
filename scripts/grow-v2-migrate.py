#!/usr/bin/env python3
"""Apply known ordered Grow PostgreSQL migrations with drift detection."""
import hashlib
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
DIR = ROOT / "grow/storage/migrations"

def psql(dsn, sql):
    p = subprocess.run(["psql", "-X", "-At", "-v", "ON_ERROR_STOP=1", dsn],
                       input=sql, text=True, capture_output=True, timeout=90)
    if p.returncode:
        raise SystemExit("Grow database migration/inspection failed")
    return p.stdout.strip()

def main():
    dsn = os.getenv("GROW_MIGRATION_DATABASE_URL", "")
    if not dsn.startswith(("postgresql://", "postgres://")):
        raise SystemExit("explicit PostgreSQL migration DSN required")
    names = ["0001_initial.up.sql", "0002_rooms.up.sql", "0003_plant_lifecycle.up.sql", "0004_telemetry.up.sql", "0005_equipment.up.sql", "0006_cultivation_history.up.sql", "0007_harvest_analytics.up.sql", "0008_harvest_plans.up.sql", "0009_inventory_ledger.up.sql", "0010_ai_assistance.up.sql", "0011_ecosystem_outbox.up.sql", "0012_dashboard_sessions.up.sql", "0013_dashboard_certificates.up.sql"]
    actual = sorted(x.name for x in DIR.glob("*.up.sql"))
    if actual != names:
        raise SystemExit("unexpected migration manifest")
    for name in names:
        path = DIR / name
        version = name.removesuffix(".up.sql")
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        ledger = psql(dsn, "SELECT to_regclass('grow_private.schema_migrations') IS NOT NULL;")
        if ledger.endswith("t"):
            applied = psql(dsn, "SELECT checksum FROM grow_private.schema_migrations WHERE version='" + version + "';")
            if applied == digest:
                print("verified migration:", version)
                continue
            if applied:
                raise SystemExit("migration checksum drift: " + version)
            if version == "0001_initial":
                raise SystemExit("untracked base schema")
        elif version != "0001_initial":
            raise SystemExit("migration ledger missing")
        sql = path.read_text(encoding="utf-8")
        if not sql.startswith(("-- GROW-V2-03", "-- GROW-V2-04", "-- GROW-V2-05", "-- GROW-V2-06", "-- GROW-V2-07", "-- GROW-V2-08", "-- GROW-V2-09", "-- GROW-V2-10", "-- GROW-V2-11", "-- GROW-V2-12", "-- GROW-V2-13")) or not sql.rstrip().endswith("COMMIT;"):
            raise SystemExit("migration must be explicitly transactional")
        sql = sql.rsplit("COMMIT;", 1)[0]
        sql += "\nINSERT INTO grow_private.schema_migrations(version, checksum) VALUES ('" + version + "', '" + digest + "');\nCOMMIT;\n"
        psql(dsn, sql)
        print("applied migration:", version)

if __name__ == "__main__":
    main()

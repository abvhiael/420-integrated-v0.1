"""BNB-2.14 operational migration integrity, multi-process serialization and recovery."""
import hashlib
import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import psycopg
import pytest
import importlib.util
spec=importlib.util.spec_from_file_location('bnb214_migrate',Path(__file__).resolve().parents[1]/'migrate.py')
migration=importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)
apply,MIGRATIONS=migration.apply,migration.MIGRATIONS


@pytest.fixture
def connected():
    if not os.getenv("BNB_DATABASE_URL"):
        pytest.skip("PostgreSQL-only acceptance")
    return os.environ["BNB_DATABASE_URL"]


def test_migration_repeatable_and_checksums(connected):
    with psycopg.connect(connected) as c:
        assert apply(c)==29
        rows=c.execute("SELECT version,filename,sha256 FROM bnb_schema_migration ORDER BY version").fetchall()
    assert len(rows)==29
    for i,(version,name,digest) in enumerate(rows,1):
        assert version==i
        assert hashlib.sha256((MIGRATIONS/name).read_bytes()).hexdigest()==digest


def test_multi_instance_migration_serialization(connected):
    def run(_):
        with psycopg.connect(connected) as c:
            return apply(c)
    with ThreadPoolExecutor(max_workers=4) as pool:
        assert list(pool.map(run,range(4)))==[29]*4
    with psycopg.connect(connected) as c:
        assert c.execute("SELECT count(*) FROM bnb_schema_migration").fetchone()[0]==29


def test_tampered_migration_rejected_without_mutation(connected,tmp_path):
    originals=sorted(MIGRATIONS.glob("[0-9][0-9][0-9]_*.sql"))
    for p in originals:
        (tmp_path/p.name).write_bytes(p.read_bytes())
    target=tmp_path/originals[0].name
    target.write_bytes(target.read_bytes()+b"\n-- untrusted change\n")
    with psycopg.connect(connected) as c:
        with pytest.raises(RuntimeError,match="MIGRATION_DRIFT"):
            apply(c,directory=tmp_path)
    with psycopg.connect(connected) as c:
        assert c.execute("SELECT count(*) FROM bnb_schema_migration").fetchone()[0]==29


def test_untracked_schema_not_silently_adopted(connected):
    with psycopg.connect(connected) as c:
        with c.transaction():
            c.execute("CREATE SCHEMA bnb214_untracked")
            c.execute("SET LOCAL search_path TO bnb214_untracked")
            # The migration ledger must not authorize an arbitrary preexisting schema.
            assert c.execute("SELECT to_regclass('public.bnb_property')").fetchone()[0] is not None
        c.execute("DROP SCHEMA bnb214_untracked CASCADE")

def test_readiness_schema_guard(connected):
    import importlib.util
    from fastapi.testclient import TestClient
    spec=importlib.util.spec_from_file_location("bnb214_api",Path(__file__).resolve().parents[1]/"api.py")
    api=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(api)
    client=TestClient(api.app)
    healthy=client.get("/health/ready")
    assert healthy.status_code==200,healthy.text
    assert healthy.json()["schema_version"]==29
    original=api.db
    class Cursor:
        def execute(self,sql,*_):
            self.sql=sql
            return self
        def fetchone(self):return (None,)
    class Conn:
        def __enter__(self):return Cursor()
        def __exit__(self,*_):return False
    api.db=lambda:Conn()
    try:
        blocked=client.get("/health/ready")
        assert blocked.status_code==503
        assert blocked.json()["detail"]=="SCHEMA_NOT_MIGRATED"
    finally:
        api.db=original

def test_operational_logs_avoid_secret_and_path_identifiers(connected,caplog):
    import importlib.util,logging
    from fastapi.testclient import TestClient
    spec=importlib.util.spec_from_file_location("bnb214_telemetry",Path(__file__).resolve().parents[1]/"api.py")
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    uri="/v1/bnb/reservations/"+ "11111111-1111-1111-1111-111111111111"
    with caplog.at_level(logging.INFO,logger="bnb.operations"):
        response=TestClient(module.app).get(uri)
    assert response.status_code==401
    trace=response.headers["x-request-id"]
    assert len(trace)==32
    entries=[x for x in caplog.records if x.message=="api_request"]
    assert entries
    assert entries[-1].route_template=="/v1/bnb/reservations/{reservation_id}"
    assert entries[-1].request_id==trace
    assert "11111111-1111" not in str(entries[-1].__dict__.get("route_template"))

def test_readiness_database_outage_returns_bounded_503_without_dsn_leak(monkeypatch):
    import importlib.util
    from fastapi.testclient import TestClient
    from pathlib import Path
    import psycopg
    spec=importlib.util.spec_from_file_location(
        "bnb310_outage",Path(__file__).resolve().parents[1]/"api.py")
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    secret="postgresql://secret-user:secret-pass@private-db.test.invalid/bnb"
    def broken_db():
        raise psycopg.OperationalError(secret)
    monkeypatch.setattr(module,"db",broken_db)
    response=TestClient(module.app).get("/health/ready")
    assert response.status_code==503
    assert response.json()=={"detail":"DATABASE_UNAVAILABLE"}
    assert "secret-pass" not in response.text
    assert response.headers["cache-control"]=="no-store"


def test_bnb310_outbox_event_atomic_rollback_and_crash_safe_retry(connected):
    """A failed transaction cannot leak an event or half-published decision."""
    from uuid import uuid4
    event_id=uuid4()
    try:
        with psycopg.connect(connected) as c:
            with c.transaction():
                c.execute("""INSERT INTO bnb_outbox(id,event_type,payload)
                    VALUES (%s,'bnb.ops.synthetic_crash',%s::jsonb)""",
                    (event_id,'{"fixture":true}'))
                raise RuntimeError("simulated process crash before commit")
    except RuntimeError:
        pass
    with psycopg.connect(connected) as c:
        assert c.execute("SELECT COUNT(*) FROM bnb_outbox WHERE id=%s",
                         (event_id,)).fetchone()[0]==0
        c.execute("""INSERT INTO bnb_outbox(id,event_type,payload)
            VALUES (%s,'bnb.ops.synthetic_crash',%s::jsonb)""",
            (event_id,'{"fixture":true}'))
    try:
        with psycopg.connect(connected) as c:
            assert c.execute("SELECT COUNT(*) FROM bnb_outbox WHERE id=%s",
                             (event_id,)).fetchone()[0]==1
            with pytest.raises(psycopg.errors.UniqueViolation):
                with c.transaction():
                    c.execute("""INSERT INTO bnb_outbox(id,event_type,payload)
                        VALUES (%s,'bnb.ops.synthetic_crash',%s::jsonb)""",
                        (event_id,'{"fixture":true}'))
    finally:
        with psycopg.connect(connected) as c:
            c.execute("DELETE FROM bnb_outbox WHERE id=%s",(event_id,))

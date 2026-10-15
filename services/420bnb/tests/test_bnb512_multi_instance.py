"""BNB-5.12 isolated multi-instance recovery and deployment rehearsal.

Real PostgreSQL: competing instances, worker failure, bounded exhaustion,
reconciliation before restore and compatibility with the installed migration
ledger. No real external delivery or production recovery execution.
"""
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4
import threading
import pytest
from test_bnb55_discovery_feed import database
from test_bnb32_infrastructure import database as tls_database
import worker
import outbox
import recovery_operations as recovery
import production

def _queue(conn,count):
    ids=[uuid4() for _ in range(count)]
    with conn() as c:
        for eid in ids:
            c.execute("""INSERT INTO bnb_outbox(id,event_type,payload)
                VALUES(%s,'bnb.hold.created',%s::jsonb)""",
                (eid,'{"hold_id":"fixture"}'))
    return ids

def test_two_workers_failover_and_resume_without_double_accept(database):
    connect,_,_=database
    ids=_queue(connect,6)
    barrier=threading.Barrier(2)
    def work():
        sink=worker.LocalValidationSink(connect)
        w=worker.Supervisor(connect,sink)
        barrier.wait(timeout=8)
        return [w.once() for _ in range(6)]
    with ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(lambda _:work(),range(2)))
    with connect() as c:
        delivered=c.execute("""SELECT id,attempts FROM bnb_outbox
           WHERE id=ANY(%s) AND delivered_at IS NOT NULL""",(ids,)).fetchall()
        assert {row[0] for row in delivered}==set(ids)
        assert all(attempts==1 for _,attempts in delivered)
        assert c.execute("""SELECT count(*) FROM bnb_outbox_receipt
           WHERE event_id=ANY(%s)""",(ids,)).fetchone()[0]==6
    # Simulate a new process/instance connecting after old supervisors exit.
    restarted=worker.Supervisor(connect,worker.LocalValidationSink(connect))
    assert restarted.once()=="idle"

def test_exhausted_dead_letter_blocks_restore_until_authorized_replay(database):
    connect,_,_=database
    event=_queue(connect,1)[0]
    with connect() as c:
        c.execute("""UPDATE bnb_outbox SET dead_lettered_at=clock_timestamp(),
           attempts=%s,lease_owner=NULL,lease_expires_at=NULL WHERE id=%s""",
           (outbox.MAX_ATTEMPTS,event))
    with connect() as c:
        assessment=recovery.assess(c,action="restore",approved=True)
        assert not assessment.ready
        assert assessment.reason=="OUTBOX_RECONCILIATION_REQUIRED"
        assert assessment.dead_letters>=1
        assert recovery.assess(c,action="rollback",approved=True).ready is False
    with connect() as c:
        assert outbox.replay(c,event,"rehearsal","approved incident restoration",
            authorize=lambda actor,reason:actor=="rehearsal" and reason=="approved incident restoration")
    with connect() as c:
        assert c.execute("""SELECT dead_lettered_at IS NULL,attempts
            FROM bnb_outbox WHERE id=%s""",(event,)).fetchone()==(True,0)
    assert worker.Supervisor(connect,worker.LocalValidationSink(connect)).once()=="delivered"
    with connect() as c:
        assert c.execute("""SELECT delivered_at IS NOT NULL FROM bnb_outbox
            WHERE id=%s""",(event,)).fetchone()==(True,)

def test_migration_ledger_compatible_with_new_instances(database):
    connect,_,_=database
    # Migration verifier remains authoritative. Two API/worker instances must
    # reject drift instead of silently applying new production migrations.
    with connect() as c:
        assert [r[0] for r in c.execute(
            "SELECT version FROM bnb_schema_migration ORDER BY version").fetchall()] == list(range(1,31))
        assert recovery.assess(c,action="restart",approved=True).reason=="MANUAL_EXECUTION_REQUIRED"
    with connect() as c:
        with pytest.raises(recovery.RecoveryBlocked,match="RECOVERY_SCHEMA_DRIFT"):
            # Live ledger is not modified. A thin read-only fault adapter
            # supplies corrupt versions for the negative gate.
            class Drift:
                def execute(self,query):
                    if "bnb_schema_migration" in query:
                        class Result:
                            def fetchall(self):return [(n,) for n in range(1,30)]
                        return Result()
                    raise AssertionError("unexpected DB access")
            recovery.assess(Drift(),action="restart",approved=True)

"""BNB-4.10 deterministic operational outage and replay assessment."""
import importlib.util
import os
from pathlib import Path
from uuid import uuid4
import psycopg
import pytest
P=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("bnb410",P/"recovery_operations.py")
ops=importlib.util.module_from_spec(spec);spec.loader.exec_module(ops)

class FakeCursor:
    def __init__(self,rows): self.rows=rows
    def fetchall(self):return self.rows
    def fetchone(self):return self.rows[0]

class FakeConn:
    def __init__(self,counts=(0,0,0),versions=tuple(range(1,27))):
        self.counts=counts;self.versions=versions
    def execute(self,sql):
        if "bnb_schema_migration" in sql:return FakeCursor([(v,) for v in self.versions])
        if "bnb_outbox" in sql:return FakeCursor([self.counts])
        raise AssertionError("unexpected SQL")

@pytest.mark.parametrize("action",["restart","restore","rollback","replay"])
def test_operator_authority_precedes_any_database_access(action):
    class NoDB:
        def execute(self,*_):raise AssertionError("unauthorized DB access")
    with pytest.raises(ops.RecoveryBlocked,match="INDEPENDENT_OPERATOR_AUTHORITY_REQUIRED"):
        ops.assess(NoDB(),action=action)
    with pytest.raises(ops.RecoveryBlocked,match="LIVE_RECOVERY_APPROVAL_REQUIRED"):
        ops.assess(NoDB(),action=action,approved=True,live_booking=True)

def test_recovery_blocks_schema_drift_and_automatic_rollback():
    with pytest.raises(ops.RecoveryBlocked,match="RECOVERY_SCHEMA_DRIFT"):
        ops.assess(FakeConn(versions=range(1,26)),action="restart",approved=True)
    outcome=ops.assess(FakeConn(),action="rollback",approved=True)
    assert not outcome.ready and outcome.reason=="DATABASE_ROLLBACK_FORBIDDEN"

def test_restore_replay_restart_are_conservative_and_minimized():
    denied=ops.assess(FakeConn((2,1,1)),action="restore",approved=True)
    assert not denied.ready and denied.reason=="OUTBOX_RECONCILIATION_REQUIRED"
    assert ops.assess(FakeConn(),action="replay",approved=True).ready is False
    plan=ops.assess(FakeConn((2,1,1)),action="restart",approved=True)
    assert plan.ready and plan.reason=="MANUAL_EXECUTION_REQUIRED"
    assert set(ops.alert_summary(plan))=={
        "action","ready","reason","pending_events","expired_leases","dead_letters"}
    assert "payload" not in str(ops.alert_summary(plan))

def test_real_postgres_outbox_fault_and_lease_counting():
    dsn=os.environ.get("BNB_DATABASE_URL")
    if not dsn:pytest.skip("PostgreSQL required")
    event_id=uuid4()
    with psycopg.connect(dsn) as c:
        c.execute("""INSERT INTO bnb_outbox(id,event_type,payload,lease_owner,lease_expires_at)
            VALUES(%s,'bnb.hold.created','{"hold_id":"recovery-fixture"}'::jsonb,
            'stale-operator',now()-interval '1 second')""",(event_id,))
    try:
        with psycopg.connect(dsn) as c:
            plan=ops.assess(c,action="restart",approved=True)
            assert plan.expired_leases>=1 and plan.pending>=1
            restore=ops.assess(c,action="restore",approved=True)
            assert not restore.ready
    finally:
        with psycopg.connect(dsn) as c:
            c.execute("DELETE FROM bnb_outbox WHERE id=%s",(event_id,))

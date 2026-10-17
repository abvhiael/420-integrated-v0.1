"""BNB-6.4 DB lifecycle, compatibility, retention and interrupted-upgrade gates."""
import os
import sys
from pathlib import Path
import pytest
import psycopg
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import migration_lifecycle as lifecycle

class Conn:
    def __init__(self, rows):self.rows=rows
    def execute(self,*_):return self
    def fetchall(self):return self.rows

@pytest.fixture
def expected():
    return lifecycle.inventory()

def test_inventory_tracks_all_canonical_migrations(expected):
    assert len(expected)==30
    assert [v for v,_,_ in expected]==list(range(1,31))

def test_reject_tampering_and_incomplete_inventory(tmp_path,expected):
    original=lifecycle.MIGRATIONS
    for p in original.glob("[0-9][0-9][0-9]_*.sql"):
        (tmp_path/p.name).write_bytes(p.read_bytes())
    p=next(tmp_path.glob("001_*.sql"))
    p.write_bytes(p.read_bytes()+b"\n-- drift\n")
    with pytest.raises(lifecycle.LifecycleBlocked,match="MIGRATION_LEDGER_MISMATCH"):
        lifecycle.validate_ledger(Conn(expected),tmp_path)
    p.unlink()
    with pytest.raises(lifecycle.LifecycleBlocked,match="MIGRATION_INVENTORY_INVALID"):
        lifecycle.inventory(tmp_path)

def test_rolling_compatibility_rejects_unproven_older_binaries(expected):
    c=Conn(expected)
    with pytest.raises(lifecycle.LifecycleBlocked,match="ROLLING_COMPATIBILITY_NOT_PROVEN"):
        lifecycle.deployment_gate(c,serving_version=29,operator_approved=True)
    with pytest.raises(lifecycle.LifecycleBlocked,match="OPERATOR_APPROVAL_REQUIRED"):
        lifecycle.deployment_gate(c,serving_version=30)
    assert lifecycle.deployment_gate(c,serving_version=30,operator_approved=True)["schema_version"]==30

@pytest.mark.parametrize("kw,code",[
    ({"live_booking":True},"ACTIVE_FINANCIAL_DEPLOYMENT_FORBIDDEN"),
    ({"financial_execution":True},"ACTIVE_FINANCIAL_DEPLOYMENT_FORBIDDEN"),
])
def test_forbidden_promotion_flags(expected,kw,code):
    with pytest.raises(lifecycle.LifecycleBlocked,match=code):
        lifecycle.deployment_gate(Conn(expected),serving_version=30,operator_approved=True,**kw)

def test_retention_never_grants_destructive_permission():
    with pytest.raises(lifecycle.LifecycleBlocked,match="OPERATOR_APPROVAL_REQUIRED"):
        lifecycle.retention_gate()
    with pytest.raises(lifecycle.LifecycleBlocked,match="RESTORE_PROOF_REQUIRED"):
        lifecycle.retention_gate(operator_approved=True)
    with pytest.raises(lifecycle.LifecycleBlocked,match="PENDING_DELIVERIES_FORBID_RETENTION"):
        lifecycle.retention_gate(operator_approved=True,immutable_backup_verified=True,
            restored_ledger_verified=True,pending_deliveries=1)
    allowed=lifecycle.retention_gate(operator_approved=True,immutable_backup_verified=True,restored_ledger_verified=True)
    assert allowed["retention_execution_enabled"] is False

def test_interrupted_upgrade_fail_closed(expected):
    with pytest.raises(lifecycle.LifecycleBlocked,match="OPERATOR_APPROVAL_REQUIRED"):
        lifecycle.interrupted_upgrade_gate(Conn(expected))
    with pytest.raises(lifecycle.LifecycleBlocked,match="INCOMPLETE_UPGRADE_REQUIRES_MIGRATOR"):
        lifecycle.interrupted_upgrade_gate(Conn(expected[:-1]),operator_approved=True)
    rows=expected.copy()
    rows[4]=(5,"compromised.sql",rows[4][2])
    with pytest.raises(lifecycle.LifecycleBlocked,match="INTERRUPTED_LEDGER_REQUIRES_OPERATOR_RECONCILIATION"):
        lifecycle.interrupted_upgrade_gate(Conn(rows),operator_approved=True)
    assert lifecycle.interrupted_upgrade_gate(Conn(expected),operator_approved=True)["rollback_allowed"] is False

def test_live_postgres_checks_existing_exact_ledger(expected):
    url=os.environ.get("BNB_DATABASE_URL")
    if not url:pytest.skip("isolated Postgres CI only")
    with psycopg.connect(url) as c:
        assert lifecycle.validate_ledger(c)==expected
        assert lifecycle.interrupted_upgrade_gate(c,operator_approved=True)["schema_version"]==30

"""BNB-6.6 M6-A integrated deployment, migration and provider-boundary regression."""
import json
import os
import sys
from pathlib import Path
import pytest
import psycopg

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import migration_lifecycle as migration
import provider_adapters as providers
import validate_deployment as topology
import recovery_operations as recovery

@pytest.fixture
def assembly():
    t=json.loads((ROOT/"deployment-topology.v1.json").read_text())
    p=json.loads((ROOT/"providers.template.v1.json").read_text())
    c=(ROOT/"compose.production.yml").read_text()
    return t,p,c

def test_m6a_integrated_release_boundary(assembly):
    t,p,c=assembly
    assert topology.validate(t,c)
    assert providers.validate(p)
    assert all(not t["release_policy"][f] for f in
        ("booking_enabled","travel_bnb_booking","financial_execution","operator_approval_verified","live_accepted"))
    assert p["production_acceptance_verified"] is False
    assert t["worker"]["sink"]=="local-validation"
    with pytest.raises(providers.ProviderBlocked,match="PROVIDER_UNRESOLVED_BINDINGS"):
        providers.validate(p,production=True)

def test_m6a_no_synthetic_acceptance_on_restart(assembly):
    t,p,c=assembly
    # Simulate an operator persisting a manipulated release/config across process restarts.
    altered=json.loads(json.dumps(p))
    altered["providers"]["pay_wallet"]["live_enabled"]=True
    for _ in range(3):
        with pytest.raises(providers.ProviderBlocked,match="PROVIDER_LIVE_APPROVAL_FORBIDDEN"):
            providers.validate(json.loads(json.dumps(altered)))
    t["release_policy"]["operator_approval_verified"]=True
    for _ in range(3):
        with pytest.raises(topology.TopologyError,match="RELEASE_POLICY_INVALID"):
            topology.validate(json.loads(json.dumps(t)),c)

@pytest.mark.parametrize("failure",["provider","database","restore","replay"])
def test_m6a_fault_injection_denies_unapproved_path(assembly,failure):
    t,p,c=assembly
    if failure=="provider":
        p["providers"]["identity"]["origin"]="http://insecure.example.test"
        with pytest.raises(providers.ProviderBlocked,match="PROVIDER_HTTPS_REQUIRED"):
            providers.validate(p)
    elif failure=="database":
        t["postgresql"]["sslmode"]="disable"
        with pytest.raises(topology.TopologyError,match="DATABASE_POLICY_INVALID"):
            topology.validate(t,c)
    elif failure=="restore":
        with pytest.raises(recovery.RecoveryBlocked,match="INDEPENDENT_OPERATOR_AUTHORITY_REQUIRED"):
            recovery.assess(object(),action="restore")
    else:
        with pytest.raises(recovery.RecoveryBlocked,match="INDEPENDENT_OPERATOR_AUTHORITY_REQUIRED"):
            recovery.assess(object(),action="replay")

def test_m6a_real_database_ledger_and_restart_reconciliation():
    dsn=os.environ.get("BNB_DATABASE_URL")
    if not dsn: pytest.skip("PostgreSQL integration fixture required")
    with psycopg.connect(dsn) as conn:
        observed=migration.validate_ledger(conn)
        assert len(observed)==30
        assert migration.interrupted_upgrade_gate(conn,operator_approved=True)["rollback_allowed"] is False
    # Separate connection proves committed migration state is visible across restart/reconnect.
    with psycopg.connect(dsn) as conn:
        assert migration.validate_ledger(conn)==observed
        assert migration.deployment_gate(conn,serving_version=30,operator_approved=True)["can_promote"]
        with pytest.raises(migration.LifecycleBlocked,match="ROLLING_COMPATIBILITY_NOT_PROVEN"):
            migration.deployment_gate(conn,serving_version=29,operator_approved=True)

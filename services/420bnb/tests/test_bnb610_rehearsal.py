"""BNB-6.10 fault and objective rehearsal with isolated DB connections."""
import importlib.util
import os
from pathlib import Path
import pytest
import psycopg
ROOT=Path(__file__).resolve().parents[1]
sp=importlib.util.spec_from_file_location("bnb610",ROOT/"recovery_rehearsal.py")
m=importlib.util.module_from_spec(sp);sp.loader.exec_module(m)
def observation(**updates):
 d={"scenario":"multi_instance_failure","elapsed_ms":1000,"lost_committed_events":0,
 "unresolved_deliveries":0,"healthy_instances":2,"required_instances":2,
 "restored_schema":30,"manually_authorized":True}
 return m.Observation(**(d|updates))
@pytest.mark.parametrize("scenario",sorted(m.SCENARIOS))
def test_each_rehearsal_class_is_measured_but_never_authorizes_production(scenario):
 result=m.evaluate(observation(scenario=scenario))
 assert result["rehearsal_pass"] and not result["live_accepted"]
 assert not result["production_recovery_authorized"]
@pytest.mark.parametrize("change,code",[
 ({"elapsed_ms":300001},"RTO_EXCEEDED"),
 ({"lost_committed_events":1},"RPO_EXCEEDED"),
 ({"unresolved_deliveries":1},"DELIVERY_RECONCILIATION_REQUIRED"),
 ({"restored_schema":29},"SCHEMA_RESTORE_UNVERIFIED"),
 ({"healthy_instances":1},"INSTANCE_DEGRADED"),
 ({"manually_authorized":False},"OPERATOR_APPROVAL_REQUIRED")])
def test_faults_make_rehearsal_fail(change,code):
 result=m.evaluate(observation(**change))
 assert not result["rehearsal_pass"] and code in result["failures"]
@pytest.mark.parametrize("change",[
 {"elapsed_ms":True},{"lost_committed_events":-1},{"required_instances":1},
 {"healthy_instances":3},{"manually_authorized":1}])
def test_poisoned_or_impossible_measurements_rejected(change):
 with pytest.raises(m.RehearsalBlocked):m.evaluate(observation(**change))
def test_independent_postgres_connections_validate_recovered_ledger():
 dsn=os.getenv("BNB_DATABASE_URL")
 if not dsn:pytest.skip("Postgres fixture needed")
 with psycopg.connect(dsn) as first:
  original=first.execute("SELECT version,filename,sha256 FROM bnb_schema_migration ORDER BY version").fetchall()
  assert len(original)==30
 with psycopg.connect(dsn) as second:
  recovered=second.execute("SELECT version,filename,sha256 FROM bnb_schema_migration ORDER BY version").fetchall()
  assert recovered==original
  from sys import path
  path.insert(0,str(ROOT))
  import migration_lifecycle
  assert migration_lifecycle.validate_ledger(second)==migration_lifecycle.inventory()

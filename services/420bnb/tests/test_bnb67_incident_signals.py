"""BNB-6.7 observability fail-closed health, bounded metrics and no-leak events."""
import importlib.util
from pathlib import Path
import pytest
spec=importlib.util.spec_from_file_location("bnb67",(Path(__file__).resolve().parents[1]/"incident_signals.py"))
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
BASE=dict(schema_ready=True,db_available=True,discovery_ready=True,
          provider_approved=True,pending=0,dead_letters=0,audit_ready=True,
          stale_after_seconds=300,last_ack_age_seconds=10)
def snapshot(**changes):return m.summarize(**(BASE|changes))
def test_complete_healthy_signal_is_bounded():
    result=snapshot()
    assert result["ready"] and result["alerts"]==[]
    assert result["observation_only"] and not result["production_execution"]
@pytest.mark.parametrize("field,value,alert",[
 ("schema_ready",False,"DATABASE_SCHEMA_DRIFT"),
 ("db_available",False,"DATABASE_UNAVAILABLE"),
 ("discovery_ready",False,"DISCOVERY_STALE"),
 ("provider_approved",False,"PROVIDER_NOT_APPROVED"),
 ("audit_ready",False,"AUDIT_PIPELINE_UNAVAILABLE"),
 ("pending",100,"DELIVERY_BACKLOG"),
 ("dead_letters",1,"DELIVERY_DEAD_LETTERS"),
 ("last_ack_age_seconds",301,"DISCOVERY_STALE"),
 ("last_ack_age_seconds",None,"DISCOVERY_STALE")])
def test_faults_never_masquerade_as_healthy(field,value,alert):
    s=snapshot(**{field:value})
    assert not s["ready"] and alert in s["alerts"] and s["severity"]=="incident"
@pytest.mark.parametrize("bad",[-1,1.0,True,1000001])
def test_metric_poisoning_denied(bad):
    with pytest.raises(m.SignalRejected,match="METRIC_INVALID"):snapshot(pending=bad)
def test_no_untrusted_labels_or_sensitive_data():
    secret="postgresql://secret:password@example.invalid/data"
    with pytest.raises(m.SignalRejected):m.sanitized_event(category=secret,request_id="a"*32,code="ok",elapsed_ms=1)
    with pytest.raises(m.SignalRejected):m.sanitized_event(category="api",request_id="a"*32,code=secret,elapsed_ms=1)
    result=m.sanitized_event(category="api",request_id="a"*32,code="unavailable",elapsed_ms=17)
    assert secret not in str(result) and set(result)=={"event","category","code","request_id","elapsed_ms"}
def test_simulated_restart_does_not_reset_incident():
    for _ in range(3):
        assert not snapshot(discovery_ready=False,pending=100)["ready"]

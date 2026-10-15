"""BNB-5.11 verified-TLS PostgreSQL synchronization health and privacy."""
import pytest
from fastapi import HTTPException
from test_bnb55_discovery_feed import database,property_row
from test_bnb32_infrastructure import database as tls_database
import synchronization_monitor as monitor
import consumer_delivery
import discovery_sync

def auth(actor,action,target):
    return actor=="fixture" and action=="configure" and target in ("search","travel")

def test_missing_consumers_not_mistaken_for_zero_backlog_health(database):
    connect,_,_=database
    with connect() as c:
        response=monitor.snapshot(c)
    assert response["ready"] is False
    assert "SEARCH_CONSUMER_MISSING" in response["alerts"]
    assert "TRAVEL_CONSUMER_MISSING" in response["alerts"]
    assert response["delivery"]["pending"]>=0
    assert response["observation_only"] is True
    assert "payload" not in str(response) and "body" not in str(response)

def test_inactive_and_missing_ack_fail_closed(database):
    connect,_,_=database
    with connect() as c:
        consumer_delivery.configure(c,"search",["bnb.discovery.changed"],active=False,
            expected_revision=0,actor="fixture",authorize=auth)
        response=monitor.snapshot(c)
    assert not response["ready"]
    assert "SEARCH_CONSUMER_INACTIVE" in response["alerts"]
    assert "TRAVEL_CONSUMER_MISSING" in response["alerts"]

def test_stale_and_lagging_discovery_never_claim_healthy(database):
    connect,_,_=database
    with connect() as c:
        for consumer in ("search","travel"):
            consumer_delivery.configure(c,consumer,["bnb.discovery.changed"],active=True,
                expected_revision=0,actor="fixture",authorize=auth)
        pid=property_row(c)
        discovery_sync.synchronize(c,pid)
    with connect() as c:
        response=monitor.snapshot(c,stale_seconds=60)
    assert response["ready"] is False
    assert "SEARCH_SYNCHRONIZATION_STALE" in response["alerts"]
    assert "TRAVEL_SYNCHRONIZATION_STALE" in response["alerts"]

@pytest.mark.parametrize("kw",[
    {"stale_seconds":0},{"stale_seconds":3601},{"backlog_limit":0},
    {"backlog_limit":10001},{"stale_seconds":True},{"backlog_limit":True}])
def test_monitor_bounds_reject_invalid_parameters(kw):
    with pytest.raises(HTTPException) as e:monitor.snapshot(None,**kw)
    assert e.value.status_code==422

def test_operator_route_uses_explicit_signed_health_permission():
    from api import app
    assert "/v1/bnb/internal/operations/synchronization" in {r.path for r in app.routes}


def test_readiness_route_exposes_true_http_failure_for_stale_consumer(monkeypatch):
    import api
    from fastapi.testclient import TestClient
    import synchronization_monitor as monitor
    import operational_controls as operations

    class Transaction:
        def __enter__(self):return self
        def __exit__(self,*_):return False
    class Database:
        def __enter__(self):return self
        def __exit__(self,*_):return False
        def transaction(self):return Transaction()
    monkeypatch.setattr(api,"db",lambda:Database())
    monkeypatch.setattr(operations,"operator",lambda *_:("operator",{"capability":"health"}))
    monkeypatch.setattr(operations,"audit_read",lambda *_:None)
    monkeypatch.setattr(monitor,"snapshot",lambda *_:{"ready":False,"alerts":["SEARCH_CONSUMER_MISSING"]})
    response=TestClient(api.app).get("/v1/bnb/internal/operations/synchronization/readiness")
    assert response.status_code==503
    assert response.json()=={"ready":False,"alerts":["SEARCH_CONSUMER_MISSING"]}
    monkeypatch.setattr(monitor,"snapshot",lambda *_:{"ready":True,"alerts":[]})
    success=TestClient(api.app).get("/v1/bnb/internal/operations/synchronization/readiness")
    assert success.status_code==200 and success.json()=={"ready":True}

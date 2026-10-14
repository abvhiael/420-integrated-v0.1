"""BNB-4.7 M4-A accumulated cross-provider app integration matrix.

PostgreSQL-backed checks cover durable outbox, nonbinding inventory and private
discovery, financial-recovery denial and tenant isolation in a shared transaction.
These fixture authorities are not live provider approvals.
"""
import importlib.util
import os
from datetime import datetime,timedelta,timezone
from pathlib import Path
from uuid import uuid4

import psycopg
import pytest
from fastapi import HTTPException

ROOT=Path(__file__).resolve().parents[1]


def load(filename):
    spec=importlib.util.spec_from_file_location("bnb47_"+filename.replace(".py",""),
                                                ROOT/filename)
    module=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


api=load("api.py")
availability=load("availability_projection.py")
discovery=load("discovery_sync.py")
outbox=load("outbox.py")


@pytest.fixture
def scenario(monkeypatch):
    dsn=os.environ.get("BNB_DATABASE_URL")
    if not dsn:
        pytest.fail("M4-A Level 2 requires PostgreSQL; skipping is not qualification")
    pid,hid,rid=uuid4(),uuid4(),uuid4()
    start=datetime.now(timezone.utc)+timedelta(days=3)
    with psycopg.connect(dsn) as c:
        c.execute("""INSERT INTO bnb_property(id,host_subject,title,public_region,
            private_address,status,capacity,nightly_minor,currency)
            VALUES (%s,'m4a-host','M4A test','BC','M4A-PRIVATE-NOT-PUBLIC',
                    'published',1,100,'CAD')""",(pid,))
        c.execute("""INSERT INTO bnb_hold(id,property_id,guest_subject,period,units,
            status,expires_at,quote_total_minor,policy_snapshot)
            VALUES (%s,%s,'m4a-guest',tstzrange(%s,%s,'[)'),1,
                    'held',now()+interval '1 hour',100,'{}')""",
            (hid,pid,start,start+timedelta(days=1)))
        c.execute("""INSERT INTO bnb_reservation(id,hold_id,property_id,guest_subject,status)
            VALUES (%s,%s,%s,'m4a-guest','payment_pending')""",(rid,hid,pid))
    monkeypatch.setattr(api,"DATABASE_URL",dsn)
    try:
        yield dsn,pid,hid,rid,start
    finally:
        with psycopg.connect(dsn) as c:
            c.execute("DELETE FROM bnb_outbox WHERE payload->>'property_id'=%s",(str(pid),))
            c.execute("DELETE FROM bnb_discovery_consumer WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_discovery_projection WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_availability_projection WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_reservation WHERE id=%s",(rid,))
            c.execute("DELETE FROM bnb_hold WHERE id=%s",(hid,))
            c.execute("DELETE FROM bnb_property WHERE id=%s",(pid,))


def test_m4a_provider_retraction_outbox_private_location_and_inventory_fence(scenario):
    dsn,pid,_,_,start=scenario
    with psycopg.connect(dsn) as c:
        published=discovery.synchronize(c,pid)
        assert published["payload"]["visible"] is False
        assert "M4A-PRIVATE-NOT-PUBLIC" not in str(published)
        # No independent property/location/compliance approval: never publish.
        assert published["payload"].get("booking_enabled") is not True
        event=c.execute("""SELECT id,event_type,payload FROM bnb_outbox
            WHERE event_type='bnb.discovery.changed'
              AND payload->>'property_id'=%s""",(str(pid),)).fetchone()
        assert event
        safe=outbox._event(dict(zip(("id","event_type","payload"),event)))
        assert "M4A-PRIVATE-NOT-PUBLIC" not in safe
        assert "private_address" not in safe
        refreshed=availability.refresh(c,pid,None,start,start+timedelta(days=1),
                                       occupancy=lambda *_:1)
        assert refreshed["available"]==0
        assert refreshed["nonbinding"] is True
        c.execute("UPDATE bnb_property SET status='suspended' WHERE id=%s",(pid,))
        retracted=discovery.synchronize(c,pid)
        assert retracted["payload"]["visible"] is False
        assert "M4A-PRIVATE-NOT-PUBLIC" not in str(retracted)
        with pytest.raises(HTTPException):
            availability.refresh(c,pid,None,start,start+timedelta(days=1),
                                 occupancy=lambda *_:0)


def test_m4a_cross_tenant_financial_recovery_never_authorizes_booking(scenario,monkeypatch):
    dsn,_,hid,rid,_=scenario
    monkeypatch.setattr(api,"active_subject",lambda *_:"different-tenant")
    with pytest.raises(HTTPException) as denied:
        api.read_booking_orchestration(rid,None)
    assert denied.value.status_code==404
    monkeypatch.setattr(api,"active_subject",lambda *_:"m4a-guest")
    pending=api.read_booking_orchestration(rid,None)
    assert pending["state"]=="payment_pending"
    assert pending["payment_execution_available"] is False
    with psycopg.connect(dsn) as c:
        c.execute("UPDATE bnb_reservation SET status='recovery_required' WHERE id=%s",
                  (rid,))
    recovered=api.read_booking_orchestration(rid,None)
    assert recovered["state"]=="reconciliation_required"
    assert recovered["confirmation_verified"] is False
    with psycopg.connect(dsn) as c:
        assert c.execute("SELECT status FROM bnb_hold WHERE id=%s",
                         (hid,)).fetchone()[0]=="held"


def test_m4a_dispute_redacted_event_replay_and_unsafe_payload_denial():
    event={"id":uuid4(),"event_type":"bnb.pay.case_reconciled",
           "payload":{"reservation_id":str(uuid4()),"case_id":"m4a-case",
                      "revision":1,"state":"opened"}}
    serialized=outbox._event(event)
    assert "m4a-case" in serialized
    assert "original_payer" not in serialized
    event["payload"]["token"]="cross-provider-secret"
    with pytest.raises(outbox.DeliveryError,match="PRIVATE_PAYLOAD_FORBIDDEN"):
        outbox._event(event)


def test_m4a_pay_reorg_and_refund_split_conservation():
    from booking_saga import project_saga
    base=dict(reservation_state="confirmed",hold_state="confirmed",
              intent_state="finalized",payment_id="pay-m4a",
              split=dict(captured=100,host=70,platform=15,developer=5,retained=10),
              disbursements=[{"kind":"refund","state":"reserved","amount":40}])
    good=project_saga(**base)
    assert good["refund_reserved_amount"]=="40"
    assert good["remaining_amount"]=="60"
    assert good["payment_finalized"] is True and good["bnb_custody"] is False
    bad=project_saga(**dict(base,pay_failures=["reorg"]))
    assert bad["confirmation_verified"] is False
    assert bad["reason"]=="PAY_FINALITY_REVOKED"
    overdraw=project_saga(**dict(base,disbursements=[
        {"kind":"host","state":"reserved","amount":70},
        {"kind":"refund","state":"reserved","amount":40}]))
    assert overdraw["reason"]=="ECONOMIC_OVERALLOCATION"

"""BNB-4.6 PostgreSQL-backed scoped projection and recovery tests.

CI provides BNB_DATABASE_URL and migrates all 25 canonical migrations before tests.
"""
import importlib.util
import os
from pathlib import Path
from uuid import uuid4
import psycopg
import pytest
from fastapi import HTTPException

spec=importlib.util.spec_from_file_location("bnb46_db_api",Path(__file__).resolve().parents[1]/"api.py")
api=importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)


@pytest.fixture
def reservation_fixture(monkeypatch):
    dsn=os.environ.get("BNB_DATABASE_URL")
    if not dsn:
        pytest.skip("PostgreSQL fixture available in canonical BNB runtime CI")
    prop, hold, reservation=uuid4(),uuid4(),uuid4()
    with psycopg.connect(dsn) as c:
        c.execute("""INSERT INTO bnb_property
            (id,host_subject,title,public_region,status,capacity,nightly_minor,currency)
            VALUES (%s,'fixture-host','qualification','test','draft',1,100,'CAD')""",(prop,))
        c.execute("""INSERT INTO bnb_hold
            (id,property_id,guest_subject,period,status,expires_at,quote_total_minor,policy_snapshot)
            VALUES (%s,%s,'fixture-guest',
            tstzrange(now()+interval '3 days',now()+interval '4 days','[)'),
            'held',now()+interval '10 minutes',100,'{}')""",(hold,prop))
        c.execute("""INSERT INTO bnb_reservation
            (id,hold_id,property_id,guest_subject,status)
            VALUES (%s,%s,%s,'fixture-guest','payment_pending')""",(reservation,hold,prop))
    monkeypatch.setattr(api,"DATABASE_URL",dsn)
    try:
        yield (dsn,prop,hold,reservation)
    finally:
        with psycopg.connect(dsn) as c:
            c.execute("DELETE FROM bnb_reservation WHERE id=%s",(reservation,))
            c.execute("DELETE FROM bnb_hold WHERE id=%s",(hold,))
            c.execute("DELETE FROM bnb_property WHERE id=%s",(prop,))


def test_database_scoped_orchestration_prevents_cross_tenant_idor(reservation_fixture,monkeypatch):
    _,_,_,reservation=reservation_fixture
    monkeypatch.setattr(api,"active_subject",lambda *_:"fixture-stranger")
    with pytest.raises(HTTPException) as e:
        api.read_booking_orchestration(reservation,None)
    assert e.value.status_code==404
    monkeypatch.setattr(api,"active_subject",lambda *_:"fixture-guest")
    r=api.read_booking_orchestration(reservation,None)
    assert r["state"]=="payment_pending"
    assert r["confirmation_verified"] is False
    assert r["payment_execution_available"] is False
    assert r["bnb_custody"] is False


def test_database_recovery_state_never_synthetic_confirmed(reservation_fixture,monkeypatch):
    dsn,_,_,reservation=reservation_fixture
    with psycopg.connect(dsn) as c:
        c.execute("UPDATE bnb_reservation SET status='recovery_required' WHERE id=%s",
                  (reservation,))
    monkeypatch.setattr(api,"active_subject",lambda *_:"fixture-host")
    response=api.read_booking_orchestration(reservation,None)
    assert response["state"]=="reconciliation_required"
    assert response["reason"]=="PAY_RECOVERY_REQUIRED"
    assert response["confirmation_verified"] is False

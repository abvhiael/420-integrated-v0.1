"""BNB-4.8 scoped host casework and noncustodial authority regression."""
import importlib.util
import os
from pathlib import Path
from uuid import uuid4
import psycopg
import pytest
from fastapi import HTTPException

spec=importlib.util.spec_from_file_location("bnb48_api",Path(__file__).resolve().parents[1]/"api.py")
api=importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)


@pytest.fixture
def case_fixture(monkeypatch):
    dsn=os.environ.get("BNB_DATABASE_URL")
    if not dsn:
        pytest.skip("requires PostgreSQL fixture")
    pid,hid,rid=uuid4(),uuid4(),uuid4()
    with psycopg.connect(dsn) as c:
        c.execute("""INSERT INTO bnb_property(id,host_subject,title,public_region,status,
            capacity,nightly_minor,currency) VALUES
            (%s,'m48-host','Private listing','BC','draft',1,100,'CAD')""",(pid,))
        c.execute("""INSERT INTO bnb_hold(id,property_id,guest_subject,period,status,
            expires_at,quote_total_minor,policy_snapshot) VALUES
            (%s,%s,'m48-guest',tstzrange(now()+interval '3 days',
            now()+interval '4 days','[)'),'held',now()+interval '1 hour',100,'{}')""",
            (hid,pid))
        c.execute("""INSERT INTO bnb_reservation(id,hold_id,property_id,
            guest_subject,status) VALUES (%s,%s,%s,'m48-guest','payment_pending')""",
            (rid,hid,pid))
    monkeypatch.setattr(api,"DATABASE_URL",dsn)
    try:
        yield rid
    finally:
        with psycopg.connect(dsn) as c:
            c.execute("DELETE FROM bnb_reservation WHERE id=%s",(rid,))
            c.execute("DELETE FROM bnb_hold WHERE id=%s",(hid,))
            c.execute("DELETE FROM bnb_property WHERE id=%s",(pid,))


def test_host_only_casework_excludes_guest_and_sensitive_financial_data(case_fixture,monkeypatch):
    rid=case_fixture
    for subject in ("m48-guest","other-tenant"):
        monkeypatch.setattr(api,"active_subject",lambda *_s,subject=subject:subject)
        with pytest.raises(HTTPException) as denied:
            api.host_casework_view(rid,None)
        assert denied.value.status_code==404
    monkeypatch.setattr(api,"active_subject",lambda *_:"m48-host")
    view=api.host_casework_view(rid,None)
    assert view["cases"]==[]
    assert view["reviewer_authority"] is False
    assert view["pay_authority"] is False
    assert view["refund_execution_available"] is False
    assert view["bnb_custody"] is False
    for forbidden in ("m48-guest","original_payer","receipt_hash","private_address",
                      "pay_invoice_id","payment_id","payer_wallet"):
        assert forbidden not in str(view)


def test_missing_casework_never_enumerates_reservations(monkeypatch):
    monkeypatch.setattr(api,"active_subject",lambda *_:"m48-host")
    with pytest.raises(HTTPException) as denied:
        api.host_casework_view(uuid4(),None)
    assert denied.value.status_code==404

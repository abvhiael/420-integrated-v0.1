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


def test_independent_casework_requires_external_signed_review_proof(monkeypatch):
    rid=uuid4()
    def forbid_db():
        raise AssertionError("unauthorized review accessed database")
    monkeypatch.setattr(api,"db",forbid_db)
    with pytest.raises(HTTPException) as err:
        api.independent_abuse_case_view(rid,None)
    assert err.value.status_code==401
    monkeypatch.setattr(api,"verify_authority",lambda *_:{
        "sub":"reviewer","report_id":str(rid),"casework_scope":"wrong"})
    with pytest.raises(HTTPException) as err:
        api.independent_abuse_case_view(rid,"fixture-signed-claim")
    assert err.value.status_code==403


def test_hold_rejects_self_minted_or_policy_shortening(monkeypatch):
    rid=uuid4()
    payload=api.PrivacyHoldInput(duration_days=90,reason="legal_hold")
    monkeypatch.setattr(api,"db",lambda:(_ for _ in ()).throw(AssertionError("db touched")))
    with pytest.raises(HTTPException) as err:
        api.independent_case_privacy_hold(rid,payload,None)
    assert err.value.status_code==401
    monkeypatch.setattr(api,"verify_authority",lambda *_:{
        "iss":"fixture","jti":"nonce","sub":"reviewer","report_id":str(rid),
        "hold_days":90,"reason":"legal_hold","legal_privacy_authority_verified":False})
    with pytest.raises(HTTPException) as err:
        api.independent_case_privacy_hold(rid,payload,"signed-fixture")
    assert err.value.status_code==403
    monkeypatch.setattr(api,"verify_authority",lambda *_:{
        "iss":"fixture","jti":"nonce","sub":"reviewer","report_id":str(rid),
        "hold_days":90,"reason":"legal_hold","legal_privacy_authority_verified":True,
        "current_reviewer_grant_verified":True,"reviewer_revoked":False})
    monkeypatch.setenv("BNB_REPORT_RETENTION_DAYS","180")
    with pytest.raises(HTTPException) as err:
        api.independent_case_privacy_hold(rid,payload,"signed-fixture")
    assert err.value.status_code==422


def test_revoked_reviewer_cannot_read_or_extend_privacy_hold(monkeypatch):
    rid=uuid4()
    monkeypatch.setattr(api,"db",lambda:(_ for _ in ()).throw(AssertionError("revoked DB access")))
    claims={"sub":"reviewer","report_id":str(rid),"casework_scope":"read",
            "current_reviewer_grant_verified":True,"reviewer_revoked":True}
    monkeypatch.setattr(api,"verify_authority",lambda *_:claims)
    with pytest.raises(HTTPException) as exc:
        api.independent_abuse_case_view(rid,"signed-revoked")
    assert exc.value.status_code==403
    claims.update({"hold_days":90,"reason":"legal_hold",
                   "legal_privacy_authority_verified":True})
    with pytest.raises(HTTPException) as exc:
        api.independent_case_privacy_hold(rid,api.PrivacyHoldInput(
            duration_days=90,reason="legal_hold"),"signed-revoked")
    assert exc.value.status_code==403

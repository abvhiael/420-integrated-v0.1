"""BNB-4.11 M4-B accumulated end-to-end negative integration gates.

Live external issuer/provider approvals are *never* simulated as real acceptance.
"""
from pathlib import Path
from uuid import uuid4
import importlib.util
import pytest
from fastapi import HTTPException
ROOT=Path(__file__).resolve().parents[1]

def module(name):
    spec=importlib.util.spec_from_file_location("m4b_"+name,ROOT/(name+".py"))
    obj=importlib.util.module_from_spec(spec)
    spec.loader.exec_module(obj)
    return obj

api=module("api")
outbox=module("outbox")
saga=module("booking_saga")
recovery=module("recovery_operations")

def test_m4b_identity_permission_loss_prevents_guest_host_admin_entry(monkeypatch):
    rid=uuid4()
    monkeypatch.setattr(api,"active_subject",lambda *_:"untrusted-other-user")
    class Denied:
        def execute(self,*_):
            class Row:
                def fetchone(self):return None
            return Row()
        def __enter__(self):return self
        def __exit__(self,*_):return False
    monkeypatch.setattr(api,"db",lambda:Denied())
    for func in (api.read_booking_orchestration,api.host_casework_view):
        with pytest.raises(HTTPException) as err:
            func(rid,None)
        assert err.value.status_code==404
    with pytest.raises(HTTPException) as err:
        api.independent_abuse_case_view(rid,None)
    assert err.value.status_code==401

def test_m4b_payment_dispute_reorg_conservation_and_replay_redaction():
    base=dict(reservation_state="confirmed",hold_state="confirmed",
              intent_state="finalized",payment_id="pay-m4b",
              split={"captured":100,"host":70,"platform":15,"developer":5,"retained":10},
              disbursements=[{"kind":"refund","state":"reserved","amount":45}])
    good=saga.project_saga(**base)
    assert good["remaining_amount"]=="55" and good["bnb_custody"] is False
    assert good["refund_reserved_amount"]=="45"
    bad=saga.project_saga(**dict(base,pay_failures=["finality_revoked"]))
    assert bad["confirmation_verified"] is False
    assert bad["reason"]=="PAY_FINALITY_REVOKED"
    dispute=saga.project_saga(**dict(base,pay_cases=[{
        "state":"opened","resolution":None,"payout_release_authorized":False}]))
    assert dispute["state"]=="disputed" and dispute["confirmation_verified"] is False
    over=saga.project_saga(**dict(base,disbursements=[
        {"kind":"host","state":"reserved","amount":70},
        {"kind":"refund","state":"reserved","amount":45}]))
    assert over["reason"]=="ECONOMIC_OVERALLOCATION"
    event={"id":uuid4(),"event_type":"bnb.pay.case_reconciled",
           "payload":{"reservation_id":str(uuid4()),"case_id":"m4b-case",
                      "revision":1,"state":"opened"}}
    assert "m4b-case" in outbox._event(event)
    event["payload"]["private_address"]="NEVER_RELEASE"
    with pytest.raises(outbox.DeliveryError,match="PRIVATE_PAYLOAD_FORBIDDEN"):
        outbox._event(event)

def test_m4b_recovery_gates_never_mint_live_operations():
    class Denied:
        def execute(self,*_):raise AssertionError("unauthorized database access")
    for action in ("restore","rollback","restart","replay"):
        with pytest.raises(recovery.RecoveryBlocked,
                           match="INDEPENDENT_OPERATOR_AUTHORITY_REQUIRED"):
            recovery.assess(Denied(),action=action)
        with pytest.raises(recovery.RecoveryBlocked,
                           match="LIVE_RECOVERY_APPROVAL_REQUIRED"):
            recovery.assess(Denied(),action=action,approved=True,
                            financial_execution=True)

def test_m4b_preview_travel_and_wallet_do_not_activate_financial_authority():
    html=(ROOT.parent.parent/"web"/"bnb"/"index.html").read_text()
    assert "Bookings and payments are not enabled" in html
    assert "no wallet custody" in html
    assert "payment not independently confirmed" in html.lower() or "Payment not independently confirmed" in html
    assert "aria-live" in html

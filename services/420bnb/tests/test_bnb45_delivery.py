"""BNB-4.5 messaging behavior and delivery permission boundaries."""
import importlib.util
import os
from pathlib import Path
from uuid import uuid4
import pytest
import psycopg
from fastapi import HTTPException

spec=importlib.util.spec_from_file_location("bnb45_api",Path(__file__).resolve().parents[1]/"api.py")
api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)

def test_control_character_rejected_before_database(monkeypatch):
    monkeypatch.setattr(api,"active_subject",lambda *_:"fixture-guest")
    with pytest.raises(HTTPException) as exc:
        api.send_guest_message(uuid4(),api.GuestMessageInput(body="malicious\u0000text",nonce="87654321"),"Bearer synthetic")
    assert exc.value.status_code==422

def test_delivery_limits_rejected_before_database(monkeypatch):
    monkeypatch.setattr(api,"active_subject",lambda *_:"fixture-guest")
    with pytest.raises(HTTPException) as exc:
        api.message_delivery(uuid4(),"short",50,"Bearer synthetic")
    assert exc.value.status_code==422
    with pytest.raises(HTTPException):
        api.message_delivery(uuid4(),"valid-device",101,"Bearer synthetic")

def test_delivery_cursor_schema_and_no_public_provider():
    root=Path(__file__).resolve().parents[1]
    migration=(root/"migrations/025_message_delivery.sql").read_text()
    assert "PRIMARY KEY(request_id,subject,device_id)" in migration
    assert "REFERENCES bnb_booking_request" in migration
    assert "REFERENCES bnb_account" in migration
    source=(root/"api.py").read_text()
    assert "CURSOR_REWIND" in source and "THREAD_CLOSED" in source
    assert "moderation_status='visible'" in source
    assert "BNB_ENV" in source

def test_thread_role_scope_blocks_strangers_revoked_accounts_and_closed_threads(monkeypatch):
    request_id=uuid4()
    property_id=uuid4()
    class Result:
        def __init__(self,row): self.row=row
        def fetchone(self): return self.row
    class Connection:
        account_state="active"
        state="accepted"
        def execute(self,sql,params):
            if "FROM bnb_booking_request r JOIN bnb_property" in sql:
                return Result((property_id,"guest","host",self.state,"host","published"))
            if "SELECT state FROM bnb_account" in sql:
                return Result((self.account_state,))
            if "SELECT host_subject,status FROM bnb_property" in sql:
                return Result(("host","published"))
            if "FROM bnb_property_grant g" in sql:
                return Result(None)
            raise AssertionError("unexpected query")
    c=Connection()
    assert api.message_thread_scope(c,request_id,"guest")[1]=="guest"
    assert api.message_thread_scope(c,request_id,"host")[2]=="host"
    with pytest.raises(HTTPException) as e:
        api.message_thread_scope(c,request_id,"stranger")
    assert e.value.status_code==404
    c.account_state="deleted"
    with pytest.raises(HTTPException) as e:
        api.message_thread_scope(c,request_id,"guest")
    assert e.value.status_code==404
    c.account_state="active"
    c.state="cancelled"
    with pytest.raises(HTTPException) as e:
        api.message_thread_scope(c,request_id,"host")
    assert e.value.status_code==409

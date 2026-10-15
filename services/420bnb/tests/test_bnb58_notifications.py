"""BNB-5.8 verified-TLS PostgreSQL device lifecycle and privacy regressions."""
from datetime import datetime,timedelta,timezone
from uuid import uuid4
from pathlib import Path
import pytest
from fastapi import HTTPException
from test_bnb55_discovery_feed import database
from test_bnb32_infrastructure import database as tls_database
import notification_delivery as delivery


def test_device_registration_preferences_revocation_and_cross_account(database):
    connect,_,_=database
    a,b="bnb58-a-"+uuid4().hex,"bnb58-b-"+uuid4().hex
    device="browser-"+uuid4().hex
    expiry=datetime.now(timezone.utc)+timedelta(days=1)
    with connect() as c:
        c.execute("INSERT INTO bnb_account(subject) VALUES(%s),(%s)",(a,b))
        assert delivery.register(c,a,device,expiry)["registered"]
        assert delivery.active_device(c,a,device)
        with pytest.raises(HTTPException,match="DEVICE_AUTHORITY_EXPIRED_OR_REVOKED"):
            delivery.active_device(c,b,device)
        assert delivery.preferences(c,a,device,False)["notifications_enabled"] is False
        assert delivery.pending(c,a,device)["notices"]==[]
        assert delivery.preferences(c,a,device,True)["notifications_enabled"] is True
        assert delivery.revoke(c,a,device)["revoked"]
        with pytest.raises(HTTPException,match="DEVICE_AUTHORITY_EXPIRED_OR_REVOKED"):
            delivery.active_device(c,a,device)
        with pytest.raises(HTTPException,match="DEVICE_REENROLLMENT_REQUIRES_NEW_ID"):
            delivery.register(c,a,device,expiry)
    with connect() as c:
        with pytest.raises(HTTPException,match="DEVICE_AUTHORITY_EXPIRED_OR_REVOKED"):
            delivery.pending(c,a,device)


def test_expired_device_and_delivery_bounds(database):
    connect,_,_=database
    a="bnb58-a-"+uuid4().hex
    device="browser-"+uuid4().hex
    with connect() as c:
        c.execute("INSERT INTO bnb_account(subject) VALUES(%s)",(a,))
        assert delivery.register(c,a,device,datetime.now(timezone.utc)+timedelta(days=1))
        c.execute("UPDATE bnb_message_device SET authority_expires_at=clock_timestamp()-interval '1 second' WHERE subject=%s",(a,))
        for action in (lambda:delivery.active_device(c,a,device),
                       lambda:delivery.pending(c,a,device),
                       lambda:delivery.preferences(c,a,device,False)):
            with pytest.raises(HTTPException,match="DEVICE_AUTHORITY_EXPIRED_OR_REVOKED"):
                action()
    for bad in ("short","../inject","untrusted/device","é"*10):
        with pytest.raises(HTTPException,match="DEVICE_INVALID"):
            delivery.device_id_ok(bad) and delivery.register(None,"actor",bad,
                datetime.now(timezone.utc)+timedelta(days=1))


def test_notice_is_metadata_only_and_provider_disabled():
    root=Path(__file__).resolve().parents[1]
    sql=(root/"migrations/030_message_device_lifecycle.sql").read_text()
    assert "UNIQUE(message_id,recipient_subject,device_id)" in sql
    assert "revoked_at" in sql and "authority_expires_at" in sql
    source=(root/"notification_delivery.py").read_text()
    assert "external_provider" in source
    assert "ON CONFLICT(message_id,recipient_subject,device_id) DO NOTHING" in source
    assert "body" not in sql
    assert "bnb.message.created" in (root/"api.py").read_text()

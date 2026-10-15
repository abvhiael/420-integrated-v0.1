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
        c.execute("""UPDATE bnb_message_device
            SET registered_at=clock_timestamp()-interval '2 days',
                authority_expires_at=clock_timestamp()-interval '1 second'
            WHERE subject=%s""",(a,))
        for action in (lambda:delivery.active_device(c,a,device),
                       lambda:delivery.pending(c,a,device),
                       lambda:delivery.preferences(c,a,device,False)):
            with pytest.raises(HTTPException,match="DEVICE_AUTHORITY_EXPIRED_OR_REVOKED"):
                action()
    for bad in ("short","../inject","untrusted/device","é"*10):
        assert not delivery.device_id_ok(bad)
        with pytest.raises(HTTPException,match="DEVICE_INVALID"):
            delivery.register(None,"actor",bad,
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


def test_durable_notice_fanout_ack_replay_cross_account_and_reconnect(database):
    connect,_,_=database
    guest="bnb58-guest-"+uuid4().hex
    host="bnb58-host-"+uuid4().hex
    device="browser-"+uuid4().hex
    pid,hid,rid,mid=uuid4(),uuid4(),uuid4(),uuid4()
    future=datetime.now(timezone.utc)+timedelta(days=3)
    with connect() as c:
        c.execute("INSERT INTO bnb_account(subject) VALUES(%s),(%s)",(guest,host))
        c.execute("""INSERT INTO bnb_property
          (id,host_subject,title,public_region,status,capacity,nightly_minor,currency)
          VALUES(%s,%s,'Fixture','Region','published',2,100,'CAD')""",(pid,host))
        c.execute("""INSERT INTO bnb_hold
           (id,property_id,guest_subject,period,status,expires_at,quote_total_minor,policy_snapshot)
           VALUES(%s,%s,%s,tstzrange(%s,%s,'[)'),'held',%s,100,'fixture')""",
           (hid,pid,guest,future,future+timedelta(days=1),future))
        c.execute("""INSERT INTO bnb_booking_request
           (id,hold_id,property_id,guest_subject,host_subject,request_type,state,deadline)
           VALUES(%s,%s,%s,%s,%s,'request','requested',%s)""",
           (rid,hid,pid,guest,host,future))
        assert delivery.register(c,host,device,future)["registered"]
        c.execute("""INSERT INTO bnb_guest_message
           (id,booking_request_id,sender_subject,body,client_nonce)
           VALUES(%s,%s,%s,'private-must-stay-in-db','nonce-12345678')""",
           (mid,rid,guest))
        delivery.enqueue_message(c,rid,mid,guest)
        delivery.enqueue_message(c,rid,mid,guest)
    with connect() as consumer:
        result=delivery.pending(consumer,host,device)
        assert result["external_provider"] is False
        assert len(result["notices"])==1
        assert "private-must-stay-in-db" not in repr(result)
        notice_id=result["notices"][0]["id"]
        with pytest.raises(HTTPException,match="DEVICE_AUTHORITY_EXPIRED_OR_REVOKED"):
            delivery.pending(consumer,guest,device)
        assert delivery.ack(consumer,host,device,notice_id)=={
            "acknowledged":True,"replayed":False}
        assert delivery.ack(consumer,host,device,notice_id)=={
            "acknowledged":True,"replayed":True}
        with pytest.raises(HTTPException,match="DEVICE_AUTHORITY_EXPIRED_OR_REVOKED"):
            delivery.ack(consumer,guest,device,notice_id)
    with connect() as restarted:
        assert delivery.pending(restarted,host,device)["notices"]==[]
        assert restarted.execute("""SELECT count(*) FROM bnb_message_notice
            WHERE message_id=%s AND recipient_subject=%s AND device_id=%s""",
            (mid,host,device)).fetchone()[0]==1
        assert restarted.execute("""SELECT acknowledged_at IS NOT NULL FROM bnb_message_notice
            WHERE message_id=%s""",(mid,)).fetchone()==(True,)

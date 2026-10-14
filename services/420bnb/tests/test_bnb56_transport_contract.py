"""BNB-5.6 isolated negative/contract checks; no live provider authority."""
from uuid import uuid4
import hashlib
import json
import pytest
from fastapi import HTTPException
import discovery_transport as t


def sample():
    pid=str(uuid4())
    payload={"property_id":pid,"visible":False,"property_version":2}
    item={"cursor":3,"property_id":pid,"revision":2,"payload":payload,
          "payload_digest":hashlib.sha256(json.dumps(payload,sort_keys=True,
               separators=(",",":"),ensure_ascii=True).encode()).hexdigest()}
    return item,str(uuid4())


def test_tombstone_roundtrip_and_digest_bound():
    item,epoch=sample()
    result=t.envelope("search",item,epoch)
    assert result["version"]==t.VERSION and result["epoch"]==epoch
    assert result["booking_enabled"] is False and result["nonbinding"] is True
    assert result["payload"]["visible"] is False
    assert len(result["transport_digest"])==64


@pytest.mark.parametrize("consumer",["unknown","SEARCH","",None])
def test_unknown_consumer_closed(consumer):
    item,epoch=sample()
    with pytest.raises(HTTPException):
        t.envelope(consumer,item,epoch)


@pytest.mark.parametrize("field,value",[
    ("private_address","never publish"),("guest_email","guest@example.test"),
    ("payment_status","paid"),("exact_latitude",12.3)])
def test_no_private_or_unrecognized_fields(field,value):
    item,epoch=sample()
    item["payload"][field]=value
    item["payload_digest"]=t._digest(item["payload"])
    with pytest.raises(HTTPException,match="TRANSPORT_TOMBSTONE_PRIVATE|TRANSPORT_PRIVATE_OR_BINDING"):
        t.envelope("search",item,epoch)


def test_no_forged_payload_digest_or_binding():
    item,epoch=sample()
    item["payload"]["visible"]=True
    with pytest.raises(HTTPException):
        t.envelope("travel",item,epoch)
    item,epoch=sample()
    item["payload"]["booking_enabled"]=True
    item["payload_digest"]=t._digest(item["payload"])
    with pytest.raises(HTTPException,match="TRANSPORT_PRIVATE_OR_BINDING"):
        t.envelope("travel",item,epoch)


def test_no_boolean_cursor():
    item,epoch=sample()
    item["cursor"]=True
    with pytest.raises(HTTPException,match="TRANSPORT_VERSION_INVALID"):
        t.envelope("travel",item,epoch)


def test_signed_receipt_scope_and_durable_acceptance(monkeypatch):
    item,epoch=sample()
    body=t.envelope("search",item,epoch)
    claims={"jti":"unique","receipt_version":t.RECEIPT_VERSION,"consumer":"search",
            "epoch":epoch,"cursor":3,"property_id":item["property_id"],"revision":2,
            "transport_digest":body["transport_digest"],"durable_acceptance":True,
            "consumer_revoked":False}
    monkeypatch.setattr(t,"verify_authority",lambda *a,**k:dict(claims))
    assert len(t.verify_receipt("signed-proof","search",body))==64
    for key,value in (("consumer","travel"),("revision",999),
                      ("transport_digest","tampered"),("durable_acceptance",False),
                      ("consumer_revoked",True)):
        altered=claims.copy()
        altered[key]=value
        monkeypatch.setattr(t,"verify_authority",lambda *a,**k:dict(altered))
        with pytest.raises(HTTPException):
            t.verify_receipt("signed-proof","search",body)
    with pytest.raises(HTTPException,match="CONSUMER_RECEIPT_REQUIRED"):
        t.verify_receipt("","search",body)

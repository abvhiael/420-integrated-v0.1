"""BNB-2.1 live PostgreSQL session lifecycle and scoped permission tests."""
import importlib.util
import os
import sys
from datetime import datetime,timedelta,timezone
from pathlib import Path
from uuid import uuid4
import jwt
import psycopg
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives.serialization import Encoding,PublicFormat
from fastapi.testclient import TestClient

spec=importlib.util.spec_from_file_location("bnb_api_auth",Path(__file__).resolve().parents[1]/"api.py")
api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
client=TestClient(api.app)

@pytest.fixture()
def actor(monkeypatch):
    private=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    monkeypatch.setenv("BNB_IDENTITY_PUBLIC_KEY_PEM",private.public_key().public_bytes(Encoding.PEM,PublicFormat.SubjectPublicKeyInfo).decode())
    monkeypatch.setenv("BNB_IDENTITY_ISSUER","https://identity.test.invalid")
    monkeypatch.setenv("BNB_IDENTITY_AUDIENCE","420bnb")
    subject="person-"+str(uuid4())
    now=int(datetime.now(timezone.utc).timestamp())
    proof=jwt.encode(dict(sub=subject,iss="https://identity.test.invalid",aud="420bnb",
        exp=now+300,iat=now,nbf=now,jti="verified-"+str(uuid4())),private,algorithm="RS256")
    yield subject,{"authorization":"Bearer "+proof}
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        c.execute("DELETE FROM bnb_identity_session WHERE subject=%s",(subject,))
        c.execute("DELETE FROM bnb_property_grant WHERE grantee_subject=%s",(subject,))
        c.execute("DELETE FROM bnb_account WHERE subject=%s",(subject,))

def test_session_exchange_revocation_and_scope(actor):
    subject,headers=actor
    first=client.post("/v1/bnb/account/session",headers=headers)
    assert first.status_code==201,first.text
    assert first.json()["subject"]==subject and first.json()["host_verified"] is False
    again=client.post("/v1/bnb/account/session",headers=headers)
    assert again.status_code==201 and again.json()["session_id"]==first.json()["session_id"]
    fake_property=str(uuid4())
    access=client.get(f"/v1/bnb/account/property/{fake_property}/access",
        params={"capability":"edit_calendar"},headers=headers)
    assert access.status_code==200 and access.json()["allowed"] is False
    revoked=client.post("/v1/bnb/account/sessions/"+first.json()["session_id"]+"/revoke",headers=headers)
    assert revoked.status_code==200 and revoked.json()["revoked"]
    assert client.post("/v1/bnb/account/session",headers=headers).status_code==401
    assert client.get(f"/v1/bnb/account/property/{fake_property}/access",
        params={"capability":"edit_calendar"},headers=headers).status_code==401

def test_anonymous_cannot_create_session_or_mutate(actor):
    assert client.post("/v1/bnb/account/session").status_code==401
    assert client.get("/v1/bnb/account/property/"+str(uuid4())+"/access",
        params={"capability":"edit_listing"}).status_code==401


def test_recovery_epoch_invalidates_every_active_session(actor):
    subject,headers=actor
    first=client.post("/v1/bnb/account/session",headers=headers)
    assert first.status_code==201
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        c.execute("UPDATE bnb_account SET recovery_epoch=recovery_epoch+1 WHERE subject=%s",(subject,))
    property_id=str(uuid4())
    response=client.get(f"/v1/bnb/account/property/{property_id}/access",params={"capability":"edit_listing"},headers=headers)
    assert response.status_code==401
    assert client.post("/v1/bnb/account/sessions/"+first.json()["session_id"]+"/revoke",headers=headers).status_code==401
    assert client.post("/v1/bnb/account/recover",headers=headers).status_code==503


def test_invalid_property_capability_is_rejected(actor):
    subject,headers=actor
    assert client.post("/v1/bnb/account/session",headers=headers).status_code==201
    response=client.get("/v1/bnb/account/property/"+str(uuid4())+"/access",
        params={"capability":"approve_payout"},headers=headers)
    assert response.status_code==422


def test_issuer_session_id_cannot_be_rebound_to_another_subject(actor):
    """An issuer JTI collision must not grant access to another account."""
    from identity import verify_external_token
    import time
    subject,headers=actor
    assert client.post("/v1/bnb/account/session",headers=headers).status_code==201
    token=headers["authorization"].split(" ",1)[1]
    proof=verify_external_token(token)
    foreign="different-"+str(uuid4())
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        c.execute("INSERT INTO bnb_account(subject) VALUES (%s)",(foreign,))
        c.execute("""UPDATE bnb_identity_session SET subject=%s WHERE
            issuer=%s AND issuer_session_id=%s""",
            (foreign,proof["issuer"],proof["issuer_session_id"]))
    try:
        response=client.post("/v1/bnb/account/session",headers=headers)
        assert response.status_code==401, response.text
        assert response.json()["detail"]=="SESSION_SUBJECT_MISMATCH"
    finally:
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            c.execute("DELETE FROM bnb_identity_session WHERE issuer=%s AND issuer_session_id=%s",
                (proof["issuer"],proof["issuer_session_id"]))
            c.execute("DELETE FROM bnb_account WHERE subject=%s",(foreign,))


def test_recovery_epoch_cannot_be_rebound_by_session_exchange(actor):
    subject,headers=actor
    assert client.post("/v1/bnb/account/session",headers=headers).status_code==201
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        c.execute("UPDATE bnb_account SET recovery_epoch=recovery_epoch+1 WHERE subject=%s",(subject,))
    response=client.post("/v1/bnb/account/session",headers=headers)
    assert response.status_code==401, response.text
    assert response.json()["detail"]=="SESSION_EPOCH_REVOKED"


def test_recovery_proof_single_use_revokes_session(actor,monkeypatch):
    import time
    subject,headers=actor
    session=client.post("/v1/bnb/account/session",headers=headers)
    assert session.status_code==201,session.text
    private=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    issuer="https://recovery.test.invalid"
    monkeypatch.setenv("BNB_RECOVERY_ISSUER",issuer)
    monkeypatch.setenv("BNB_RECOVERY_AUDIENCE","420bnb-recovery")
    monkeypatch.setenv("BNB_RECOVERY_PUBLIC_KEY_PEM",
        private.public_key().public_bytes(Encoding.PEM,PublicFormat.SubjectPublicKeyInfo).decode())
    now=int(time.time())
    claim=jwt.encode({"iss":issuer,"aud":"420bnb-recovery","sub":subject,
        "iat":now,"nbf":now,"exp":now+120,"jti":str(uuid4()),
        "purpose":"account-recovery"},private,algorithm="RS256")
    recovery={**headers,"x-recovery-proof":claim}
    success=client.post("/v1/bnb/account/recover",headers=recovery)
    assert success.status_code==200,success.text
    assert success.json()["sessions_revoked"] is True
    assert client.post("/v1/bnb/account/session",headers=headers).status_code==401
    replay=client.post("/v1/bnb/account/recover",headers=recovery)
    assert replay.status_code==409 and replay.json()["detail"]=="RECOVERY_PROOF_REPLAY"
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        c.execute("DELETE FROM bnb_authority_proof_used WHERE authority='recovery' AND subject=%s",(subject,))


def test_property_claim_forgery_cannot_grant_authority(actor,monkeypatch):
    import time
    subject,headers=actor
    assert client.post("/v1/bnb/account/session",headers=headers).status_code==201
    pid=uuid4()
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        c.execute("""INSERT INTO bnb_property(id,host_subject,title,public_region,capacity,
            nightly_minor,currency) VALUES (%s,%s,'Synthetic property','Canada',1,100,'CAD')""",
            (pid,subject))
    key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    issuer="https://property.test.invalid"
    monkeypatch.setenv("BNB_PROPERTY_ISSUER",issuer)
    monkeypatch.setenv("BNB_PROPERTY_AUDIENCE","420bnb-property")
    monkeypatch.setenv("BNB_PROPERTY_PUBLIC_KEY_PEM",
        key.public_key().public_bytes(Encoding.PEM,PublicFormat.SubjectPublicKeyInfo).decode())
    now=int(time.time())
    data={"iss":issuer,"aud":"420bnb-property","sub":subject,"iat":now,
          "nbf":now,"exp":now+120,"jti":str(uuid4()),"purpose":"property-control",
          "property_id":str(pid)}
    try:
        forged=jwt.encode({**data,"purpose":"software-verification"},key,algorithm="RS256")
        rejected=client.post(f"/v1/bnb/account/properties/{pid}/claims",
            headers={**headers,"x-property-proof":forged})
        assert rejected.status_code==401
        wrong=jwt.encode({**data,"property_id":str(uuid4())},key,algorithm="RS256")
        rejected=client.post(f"/v1/bnb/account/properties/{pid}/claims",
            headers={**headers,"x-property-proof":wrong})
        assert rejected.status_code==403
        claim=jwt.encode(data,key,algorithm="RS256")
        accepted=client.post(f"/v1/bnb/account/properties/{pid}/claims",
            headers={**headers,"x-property-proof":claim})
        assert accepted.status_code==202,accepted.text
        assert accepted.json()=={"status":"pending","published":False}
        replay=client.post(f"/v1/bnb/account/properties/{pid}/claims",
            headers={**headers,"x-property-proof":claim})
        assert replay.status_code==409
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            assert c.execute("SELECT status FROM bnb_property WHERE id=%s",(pid,)).fetchone()[0]=="draft"
    finally:
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            c.execute("DELETE FROM bnb_property_claim WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_authority_proof_used WHERE authority='property' AND subject=%s",(subject,))
            c.execute("DELETE FROM bnb_property WHERE id=%s",(pid,))

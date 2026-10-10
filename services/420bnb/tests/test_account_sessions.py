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
    # Missing recovery proof is rejected before any authority-provider lookup.
    response=client.post("/v1/bnb/account/recover",headers=headers)
    assert response.status_code==401 and response.json()["detail"]=="RECOVERY_PROOF_REQUIRED"


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


def test_unverified_host_and_manager_cannot_use_property_capabilities(actor):
    subject,headers=actor
    assert client.post("/v1/bnb/account/session",headers=headers).status_code==201
    pid=uuid4()
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
        c.execute("""INSERT INTO bnb_property(id,host_subject,title,public_region,capacity,
            nightly_minor,currency) VALUES (%s,%s,'Unverified property','Canada',1,100,'CAD')""",
            (pid,subject))
        c.execute("""INSERT INTO bnb_property_grant(property_id,grantee_subject,capability,
            expires_at,granted_by) VALUES (%s,%s,'edit_listing',now()+interval '1 day',%s)""",
            (pid,subject,subject))
    try:
        endpoint=f"/v1/bnb/account/property/{pid}/access"
        denied=client.get(endpoint,params={"capability":"edit_listing"},headers=headers)
        assert denied.status_code==200 and denied.json()["allowed"] is False
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            c.execute("""INSERT INTO bnb_property_claim(property_id,subject,external_issuer,
                external_claim_id,state,expires_at) VALUES (%s,%s,'synthetic-test-only',
                %s,'pending',now()+interval '1 day')""",(pid,subject,str(uuid4())))
        denied=client.get(endpoint,params={"capability":"edit_listing"},headers=headers)
        assert denied.status_code==200 and denied.json()["allowed"] is False
    finally:
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            c.execute("DELETE FROM bnb_property_grant WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_property_claim WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_property WHERE id=%s",(pid,))


def test_host_drafts_are_private_and_versioned(actor):
    subject,headers=actor
    assert client.post("/v1/bnb/account/session",headers=headers).status_code==201
    body={"title":"Private cabin","public_region":"Prairies","capacity":2,
          "nightly_minor":12000,"currency":"CAD"}
    created=client.post("/v1/bnb/properties",json=body,headers=headers)
    assert created.status_code==201,created.text
    pid=created.json()["id"]
    try:
        assert created.json()["status"]=="draft" and created.json()["published"] is False
        assert created.json()["version"]==1
        listing=client.get("/v1/bnb/account/properties",headers=headers)
        assert listing.status_code==200
        assert any(x["id"]==pid for x in listing.json())
        assert "private_address" not in listing.text
        revision={**body,"title":"Updated private cabin","expected_version":1}
        edited=client.put(f"/v1/bnb/account/properties/{pid}",headers=headers,json=revision)
        assert edited.status_code==200,edited.text
        assert edited.json()["version"]==2
        assert client.put(f"/v1/bnb/account/properties/{pid}",headers=headers,json=revision).status_code==409
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            row=c.execute("SELECT status,title,version FROM bnb_property WHERE id=%s",(pid,)).fetchone()
            assert row==("draft","Updated private cabin",2)
            c.execute("UPDATE bnb_property SET status='suspended' WHERE id=%s",(pid,))
        assert client.put(f"/v1/bnb/account/properties/{pid}",headers=headers,
                          json={**revision,"expected_version":2}).status_code==409
        assert client.put(f"/v1/bnb/account/properties/{pid}",
                          headers={"x-authenticated-subject":subject},json=revision).status_code==401
        assert client.post("/v1/bnb/payments/intents",headers=headers).status_code==503
    finally:
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            c.execute("DELETE FROM bnb_audit WHERE resource_id=%s",(pid,))
            c.execute("DELETE FROM bnb_property WHERE id=%s",(pid,))


def test_draft_property_cross_account_denied(actor,monkeypatch):
    subject,headers=actor
    assert client.post("/v1/bnb/account/session",headers=headers).status_code==201
    body={"title":"Cross account house","public_region":"Prairies","capacity":1,
          "nightly_minor":1000,"currency":"CAD"}
    created=client.post("/v1/bnb/properties",json=body,headers=headers)
    assert created.status_code==201,created.text
    pid=created.json()["id"]
    other=client.post("/v1/bnb/account/session",headers=headers)
    assert other.status_code==201
    try:
        # Valid self session does not permit mutation of other properties.
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            c.execute("UPDATE bnb_property SET host_subject=%s WHERE id=%s",("other-host",pid))
        attempt=client.put(f"/v1/bnb/account/properties/{pid}",headers=headers,
            json={**body,"expected_version":1})
        assert attempt.status_code==404
        assert not any(x["id"]==pid for x in
                       client.get("/v1/bnb/account/properties",headers=headers).json())
    finally:
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            c.execute("DELETE FROM bnb_audit WHERE resource_id=%s",(pid,))
            c.execute("DELETE FROM bnb_property WHERE id=%s",(pid,))


def test_manager_grant_denied_without_independent_property_review(actor):
    subject,headers=actor
    assert client.post("/v1/bnb/account/session",headers=headers).status_code==201
    body={"title":"No approval cabin","public_region":"Canada","capacity":1,
          "nightly_minor":100,"currency":"CAD"}
    created=client.post("/v1/bnb/properties",headers=headers,json=body)
    assert created.status_code==201,created.text
    pid=created.json()["id"]
    grantee="manager-"+str(uuid4())
    try:
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            c.execute("INSERT INTO bnb_account(subject) VALUES (%s)",(grantee,))
        response=client.post(f"/v1/bnb/account/properties/{pid}/managers",
            headers=headers,json={"subject":grantee,"capability":"edit_listing",
                 "expires_at":(datetime.now(timezone.utc)+timedelta(days=2)).isoformat()})
        assert response.status_code==403, response.text
        assert response.json()["detail"]=="PROPERTY_AUTHORITY_NOT_VERIFIED"
        revocation=client.delete(f"/v1/bnb/account/properties/{pid}/managers/{grantee}/edit_listing",
            headers=headers)
        assert revocation.status_code==403
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            assert not c.execute("SELECT 1 FROM bnb_property_grant WHERE property_id=%s",(pid,)).fetchone()
    finally:
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            c.execute("DELETE FROM bnb_audit WHERE resource_id=%s",(pid,))
            c.execute("DELETE FROM bnb_property WHERE id=%s",(pid,))
            c.execute("DELETE FROM bnb_account WHERE subject=%s",(grantee,))


def test_host_units_calendar_review_and_adversarial_boundaries(actor):
    subject,headers=actor
    assert client.post("/v1/bnb/account/session",headers=headers).status_code==201
    props={"title":"Unit inventory property","public_region":"Prairies",
           "capacity":2,"nightly_minor":12000,"currency":"CAD"}
    created=client.post("/v1/bnb/properties",headers=headers,json=props)
    assert created.status_code==201,created.text
    pid=created.json()["id"]
    unit_url=f"/v1/bnb/account/properties/{pid}/units"
    review_url=f"/v1/bnb/account/properties/{pid}/review"
    start=datetime.now(timezone.utc)+timedelta(days=10)
    start=start.replace(hour=15,minute=0,second=0,microsecond=0)
    end=start+timedelta(days=2)
    try:
        assert client.post(unit_url,json={"label":"Entire cabin","quantity":3,
                                           "expected_version":1},headers=headers).status_code==409
        first=client.post(unit_url,json={"label":"Entire cabin","quantity":2,
                                         "expected_version":1},headers=headers)
        assert first.status_code==201,first.text
        assert first.json()["version"]==2
        uid=first.json()["id"]
        assert client.post(unit_url,json={"label":"Retry","quantity":1,
                                          "expected_version":1},headers=headers).status_code==409
        assert client.get(unit_url).status_code==401
        assert len(client.get(unit_url,headers=headers).json())==1
        assert client.post(review_url,json={"expected_version":1},headers=headers).status_code==409
        calendar=f"/v1/bnb/account/properties/{pid}/calendar/blocks"
        data={"start":start.isoformat(),"end":end.isoformat(),
              "reason":"Owner maintenance","expected_version":2}
        added=client.post(calendar,params={"unit_id":uid},json=data,headers=headers)
        assert added.status_code==201,added.text
        assert added.json()["version"]==3
        assert client.post(calendar,params={"unit_id":uid},
                           json={**data,"expected_version":3},headers=headers).status_code==409
        assert len(client.get(f"/v1/bnb/account/properties/{pid}/calendar",
                              headers=headers).json())==1
        review=client.post(review_url,json={"expected_version":3},headers=headers)
        assert review.status_code==202,review.text
        assert review.json()["state"]=="pending" and not review.json()["published"]
        assert len(review.json()["snapshot_hash"])==64
        assert client.post(review_url,json={"expected_version":3},headers=headers).status_code==409
        assert client.get(f"/v1/bnb/account/properties/{pid}/reviews").status_code==401
        records=client.get(f"/v1/bnb/account/properties/{pid}/reviews",headers=headers)
        assert records.status_code==200 and records.json()[0]["state"]=="pending"
        withdrawn=client.post(f"/v1/bnb/account/properties/{pid}/reviews/{review.json()['review_id']}/withdraw",headers=headers)
        assert withdrawn.status_code==200 and withdrawn.json()["state"]=="withdrawn"
        assert client.post(f"/v1/bnb/account/properties/{pid}/reviews/{review.json()['review_id']}/withdraw",
                           headers=headers).status_code==409
        removed=client.delete(f"/v1/bnb/account/properties/{pid}/calendar/blocks/{added.json()['id']}",
                              params={"expected_version":3},headers=headers)
        assert removed.status_code==200 and removed.json()["version"]==4
        assert client.delete(f"/v1/bnb/account/properties/{pid}/calendar/blocks/{added.json()['id']}",
                             params={"expected_version":4},headers=headers).status_code==404

        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            assert c.execute("SELECT status FROM bnb_property WHERE id=%s",(pid,)).fetchone()[0]=="draft"
            assert c.execute("SELECT COUNT(*) FROM bnb_listing_review WHERE property_id=%s",
                             (pid,)).fetchone()[0]==1
    finally:
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            c.execute("DELETE FROM bnb_listing_review WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_block WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_unit WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_audit WHERE resource_id=%s",(pid,))
            c.execute("DELETE FROM bnb_property WHERE id=%s",(pid,))


def test_host_policy_and_media_rights_boundaries(actor):
    subject,headers=actor
    assert client.post("/v1/bnb/account/session",headers=headers).status_code==201
    payload={"title":"Rights review cabin","public_region":"Prairies","capacity":1,
             "nightly_minor":1000,"currency":"CAD"}
    created=client.post("/v1/bnb/properties",headers=headers,json=payload)
    assert created.status_code==201,created.text
    pid=created.json()["id"]
    base=f"/v1/bnb/account/properties/{pid}"
    try:
        bad=client.put(base+"/policy",headers=headers,json={
            "expected_version":1,"house_rules":"No smoking",
            "cancellation_policy":"Flexible","timezone_id":"Atlantis/Unknown"})
        assert bad.status_code==422
        policy=client.put(base+"/policy",headers=headers,json={
            "expected_version":1,"house_rules":"No smoking",
            "cancellation_policy":"Flexible","timezone_id":"America/Regina"})
        assert policy.status_code==200,policy.text
        assert policy.json()["version"]==2
        forged=client.post(base+"/media",headers=headers,json={
            "expected_version":2,"asset_url":"http://insecure.example.org/a.png",
            "alt_text":"Property exterior","rights_statement":"I own the photograph"})
        assert forged.status_code==422
        media=client.post(base+"/media",headers=headers,json={
            "expected_version":2,"asset_url":"https://media.example.org/a.png",
            "alt_text":"Property exterior","rights_statement":"I own the photograph"})
        assert media.status_code==201,media.text
        assert media.json()["moderation_state"]=="pending"
        assert client.post(f"/v1/bnb/internal/media/{media.json()['id']}/decision",
            headers=headers,json={"decision":"approved","reason":"Misleading host self approval"}).status_code==401
        assert client.post(f"/v1/bnb/internal/media/{media.json()['id']}/decision",
            json={"decision":"approved","reason":"No external issuer configured"},
            headers={"x-media-review-proof":"forged-token"}).status_code==503
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            assert c.execute("SELECT moderation_state FROM bnb_listing_media WHERE id=%s",
                             (media.json()["id"],)).fetchone()[0]=="pending"
        assert client.post(base+"/media",headers=headers,json={
            "expected_version":2,"asset_url":"https://media.example.org/b.png",
            "alt_text":"Property exterior","rights_statement":"I own the photograph"}).status_code==409
        # Policy timezone is authoritative for supplied non-UTC local offsets.
        unit=client.post(base+"/units",headers=headers,json={
            "label":"Suite","quantity":1,"expected_version":3})
        assert unit.status_code==201,unit.text
        dst_start=(datetime.now(timezone.utc)+timedelta(days=12)).replace(hour=15,minute=0,second=0,microsecond=0).astimezone(timezone(timedelta(hours=-5)))
        dst_end=dst_start+timedelta(days=2)
        wrong_offset=client.post(base+"/calendar/blocks",
            params={"unit_id":unit.json()["id"]},headers=headers,json={
                "start":dst_start.isoformat(),"end":dst_end.isoformat(),
                "reason":"Maintenance","expected_version":4})
        assert wrong_offset.status_code==422
        assert wrong_offset.json()["detail"]=="PROPERTY_TIMEZONE_OFFSET_MISMATCH"
        assert client.put(base+"/policy",json={"expected_version":3,
            "house_rules":"No smoking","cancellation_policy":"Flexible",
            "timezone_id":"America/Regina"}).status_code==401
    finally:
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            c.execute("DELETE FROM bnb_unit WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_listing_media WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_listing_policy WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_audit WHERE resource_id=%s",(pid,))
            c.execute("DELETE FROM bnb_property WHERE id=%s",(pid,))


def test_bnb23_quantity_closure_atomic_reschedule_and_owner_boundary(actor):
    subject,headers=actor
    assert client.post("/v1/bnb/account/session",headers=headers).status_code==201
    result=client.post("/v1/bnb/properties",headers=headers,json={
        "title":"Calendar closure property","public_region":"Prairies",
        "capacity":3,"nightly_minor":1000,"currency":"CAD"})
    assert result.status_code==201,result.text
    pid=result.json()["id"]
    url=f"/v1/bnb/account/properties/{pid}"
    start=(datetime.now(timezone.utc)+timedelta(days=12)).replace(hour=14,minute=0,second=0,microsecond=0)
    period={"start":start.isoformat(),"end":(start+timedelta(days=2)).isoformat(),
            "reason":"Maintenance"}
    try:
        unit=client.post(url+"/units",headers=headers,
            json={"label":"Suite A","quantity":3,"expected_version":1})
        assert unit.status_code==201,unit.text
        uid=unit.json()["id"]
        endpoint=url+"/calendar/blocks"
        first=client.post(endpoint,params={"unit_id":uid},headers=headers,
            json={**period,"quantity":1,"expected_version":2})
        assert first.status_code==201,first.text
        second=client.post(endpoint,params={"unit_id":uid},headers=headers,
            json={**period,"quantity":2,"expected_version":3})
        assert second.status_code==201,second.text
        full=client.post(endpoint,params={"unit_id":uid},headers=headers,
            json={**period,"quantity":1,"expected_version":4})
        assert full.status_code==409
        wrong_owner=client.put(endpoint+"/"+first.json()["id"],
            json={**period,"quantity":1,"expected_version":4})
        assert wrong_owner.status_code==401
        failed_edit=client.put(endpoint+"/"+first.json()["id"],headers=headers,
            json={**period,"quantity":2,"expected_version":4})
        assert failed_edit.status_code==409
        # Failed edit is rolled back; the prior calendar block is preserved.
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            assert c.execute("SELECT quantity FROM bnb_block WHERE id=%s",
                             (first.json()["id"],)).fetchone()[0]==1
        new_start=start+timedelta(days=4)
        shifted={**period,"start":new_start.isoformat(),
                 "end":(new_start+timedelta(days=2)).isoformat()}
        moved=client.put(endpoint+"/"+first.json()["id"],headers=headers,
            json={**shifted,"quantity":1,"expected_version":4})
        assert moved.status_code==200,moved.text
        assert moved.json()["version"]==5
        # Property-wide blocks cannot claim a partial quantity with no unit mapping.
        rejected=client.post(endpoint,headers=headers,
            json={**period,"quantity":1,"expected_version":5})
        assert rejected.status_code==422
        assert client.get(url+"/calendar").status_code==401
        from concurrent.futures import ThreadPoolExecutor
        competing={**shifted,"start":(new_start+timedelta(days=5)).isoformat(),
            "end":(new_start+timedelta(days=7)).isoformat(),"quantity":1,
            "expected_version":5}
        def concurrent_calendar(_):
            return client.post(endpoint,params={"unit_id":uid},headers=headers,json=competing)
        with ThreadPoolExecutor(max_workers=2) as pool:
            outcomes=list(pool.map(concurrent_calendar,range(2)))
        assert sorted(x.status_code for x in outcomes)==[201,409],[x.text for x in outcomes]
        # A complete property closure remains permitted and consumes all availability.
        global_block=client.post(endpoint,headers=headers,
            json={**period,"expected_version":6})
        assert global_block.status_code==201,global_block.text
        denied_manager=client.get(f"/v1/bnb/account/property/{pid}/access",
            params={"capability":"edit_calendar"},headers=headers)
        assert denied_manager.status_code==200 and denied_manager.json()["allowed"] is False
    finally:
        with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as c:
            c.execute("DELETE FROM bnb_block WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_unit WHERE property_id=%s",(pid,))
            c.execute("DELETE FROM bnb_audit WHERE resource_id=%s",(pid,))
            c.execute("DELETE FROM bnb_property WHERE id=%s",(pid,))

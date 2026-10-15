"""BNB-5.9 actual TLS/PostgreSQL operator session revocation and replay race."""
from uuid import uuid4
from datetime import datetime,timedelta,timezone
import pytest
from fastapi import HTTPException
from test_bnb55_discovery_feed import database
from test_bnb32_infrastructure import database as tls_database
import operational_controls as ops

def test_operator_current_session_revocation_is_database_authoritative(database,monkeypatch):
    connect,_,_=database
    subject="bnb59-operator-"+uuid4().hex
    session="fixture-"+uuid4().hex
    issuer="https://operator.fixture.invalid"
    claims={"sub":subject,"iss":issuer,"issuer_session_id":session,
            "capability":"health","jti":uuid4().hex}
    monkeypatch.setattr(ops,"verify_authority",lambda *_:dict(claims))
    with connect() as c:
        c.execute("INSERT INTO bnb_account(subject) VALUES(%s)",(subject,))
        c.execute("""INSERT INTO bnb_identity_session
            (id,subject,issuer,issuer_session_id,expires_at)
            VALUES(%s,%s,%s,%s,clock_timestamp()+interval '15 minutes')""",
            (uuid4(),subject,issuer,session))
    with connect() as c:
        assert ops.operator(c,"Bearer fixture","health")[0]==subject
        assert ops.counts(c)["production_execution"] is False
    with connect() as c:
        c.execute("""UPDATE bnb_identity_session SET revoked_at=clock_timestamp()
            WHERE issuer=%s AND issuer_session_id=%s""",(issuer,session))
    with connect() as c:
        with pytest.raises(HTTPException,match="OPERATOR_SESSION_REVOKED"):
            ops.operator(c,"Bearer fixture","health")


def test_replay_unrelated_dead_letter_cannot_be_forged(database):
    connect,_,_=database
    target=uuid4()
    with connect() as c:
        with pytest.raises(HTTPException,match="REPLAY_NOT_ELIGIBLE"):
            ops.manual_replay(c,"bnb59-operator",
                              {"jti":uuid4().hex,"event_id":str(target),"consumer":None},
                              target,"approved operator incident review")
    with connect() as c:
        assert c.execute("""SELECT count(*) FROM bnb_audit
            WHERE action='bnb.outbox.manual_replay' AND subject='bnb59-operator'""").fetchone()[0]==0


def test_fenced_dead_letter_replay_exact_nonce_and_audit(database):
    connect,_,_=database
    eid=uuid4()
    actor="bnb59-operator-"+uuid4().hex
    proof={"jti":uuid4().hex,"event_id":str(eid),"consumer":None}
    with connect() as c:
        c.execute("""INSERT INTO bnb_outbox
          (id,event_type,payload,dead_lettered_at,attempts)
          VALUES(%s,'bnb.message.created',%s::jsonb,clock_timestamp(),8)""",
          (eid,'{"request_id":"fixture","message_id":"fixture"}'))
    with connect() as c:
        result=ops.manual_replay(c,actor,proof,eid,"approved incident restoration")
        assert result["replayed"] is True
    with connect() as c:
        assert c.execute("""SELECT dead_lettered_at IS NULL,attempts FROM bnb_outbox
          WHERE id=%s""",(eid,)).fetchone()==(True,0)
        assert c.execute("""SELECT count(*) FROM bnb_audit
          WHERE subject=%s AND action='bnb.outbox.manual_replay'
             AND resource_id=%s""",(actor,eid)).fetchone()==(1,)
        with pytest.raises(HTTPException,match="OPERATOR_NONCE_REPLAY"):
            ops.manual_replay(c,actor,proof,eid,"approved incident restoration")


def test_genuine_rs256_proof_refuses_forgery_and_expired_authority(monkeypatch):
    import jwt,time
    from cryptography.hazmat.primitives.asymmetric import rsa
    from cryptography.hazmat.primitives.serialization import Encoding,PublicFormat
    from authority import verify_authority
    key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    rogue=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    issuer="https://operator.fixture.invalid"
    audience="bnb-ops-fixture"
    monkeypatch.setenv("BNB_OPERATIONS_ISSUER",issuer)
    monkeypatch.setenv("BNB_OPERATIONS_AUDIENCE",audience)
    monkeypatch.setenv("BNB_OPERATIONS_PUBLIC_KEY_PEM",key.public_key().public_bytes(
        Encoding.PEM,PublicFormat.SubjectPublicKeyInfo).decode())
    now=int(time.time())
    claims={"sub":"operator","iss":issuer,"aud":audience,"iat":now,
            "nbf":now,"exp":now+120,"jti":uuid4().hex,
            "purpose":"bnb-operator","capability":"health"}
    legitimate=jwt.encode(claims,key,algorithm="RS256")
    assert verify_authority(legitimate,"BNB_OPERATIONS","bnb-operator")["capability"]=="health"
    forged=jwt.encode(claims,rogue,algorithm="RS256")
    with pytest.raises(HTTPException,match="INVALID_AUTHORITY_PROOF"):
        verify_authority(forged,"BNB_OPERATIONS","bnb-operator")
    old={**claims,"iat":now-1000,"nbf":now-1000,"exp":now-500}
    with pytest.raises(HTTPException,match="INVALID_AUTHORITY_PROOF"):
        verify_authority(jwt.encode(old,key,algorithm="RS256"),
                         "BNB_OPERATIONS","bnb-operator")

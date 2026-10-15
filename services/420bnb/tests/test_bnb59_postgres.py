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

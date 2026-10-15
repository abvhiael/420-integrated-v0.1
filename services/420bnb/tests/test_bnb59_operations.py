"""BNB-5.9 operator authority failure paths and bounded operations."""
from uuid import uuid4
import pytest
from fastapi import HTTPException
import operational_controls as ops

class Cursor:
    def __init__(self,row=None):self.row=row
    def fetchone(self):return self.row

class Connection:
    def __init__(self,session=(1,)):self.session=session;self.queries=[]
    def execute(self,sql,params=None):
        self.queries.append((sql,params))
        if "FROM bnb_identity_session" in sql:return Cursor(self.session)
        return Cursor()

def test_operator_rejects_missing_or_nonbearer_without_database(monkeypatch):
    c=Connection()
    for token in (None,"", "synthetic", "Basic synthetic"):
        with pytest.raises(HTTPException) as e:ops.operator(c,token,"health")
        assert e.value.status_code==401
    assert c.queries==[]

def test_operator_rejects_forged_scopes_and_revoked_session(monkeypatch):
    base={"sub":"approved-operator","iss":"https://issuer.invalid",
          "issuer_session_id":"external-session","capability":"health","jti":"123456789"}
    monkeypatch.setattr(ops,"verify_authority",lambda *_:dict(base))
    with pytest.raises(HTTPException,match="OPERATOR_SCOPE_INVALID"):
        ops.operator(Connection(),"Bearer verified","replay")
    with pytest.raises(HTTPException,match="OPERATOR_SESSION_REVOKED"):
        ops.operator(Connection(None),"Bearer verified","health")
    actor,proof=ops.operator(Connection(),"Bearer verified","health")
    assert actor=="approved-operator"
    assert proof["capability"]=="health"

def test_operation_bounding_and_redacted_replay():
    with pytest.raises(HTTPException,match="OPERATION_BOUNDS"):
        ops.dead_letters(Connection(),limit=51)
    with pytest.raises(HTTPException,match="REPLAY_REASON_INVALID"):
        ops.manual_replay(Connection(),"actor",{"jti":"123456789"},uuid4(),"short")

def test_replay_requires_unique_nonce_and_never_uses_provider(monkeypatch):
    event=uuid4()
    class DB:
        def execute(self,sql,params=None):
            if "INSERT INTO bnb_request_dedupe" in sql:return Cursor(("key",))
            raise AssertionError("unexpected SQL")
    called=[]
    monkeypatch.setattr(ops.outbox,"replay",lambda *args,**kwargs:called.append((args,kwargs)))
    r=ops.manual_replay(DB(),"operator",{"jti":"123456789"},event,"approved operational review")
    assert r["execution"]=="queued-only" and len(called)==1
    class Duplicate(DB):
        def execute(self,sql,params=None):return Cursor(None)
    with pytest.raises(HTTPException,match="OPERATOR_NONCE_REPLAY"):
        ops.manual_replay(Duplicate(),"operator",{"jti":"123456789"},event,"approved operational review")

def test_api_routes_retain_independent_operator_authority():
    from api import app
    routes={r.path for r in app.routes}
    for suffix in ("/health","/dead-letters","/reconciliation/{action}",
                   "/dead-letters/{event_id}/replay"):
        assert "/v1/bnb/internal/operations"+suffix in routes


def test_console_refuses_non_tls_and_unsafe_requests(tmp_path):
    import operator_console as cli
    for origin in ("http://localhost:8443","https://u:p@localhost",
                   "https://localhost/?key=abc","https://localhost/path"):
        with pytest.raises(cli.ConsoleError,match="OPERATOR_ORIGIN_INVALID"):
            cli.request(origin,"/not-a-ca","/not-a-token","health")
    with pytest.raises(cli.ConsoleError,match="EVENT_INVALID"):
        cli.request("https://localhost","/not-a-ca","/not-a-token","replay",
                    "../not-an-id","legitimate incident review")
    with pytest.raises(cli.ConsoleError,match="REASON_INVALID"):
        cli.request("https://localhost","/not-a-ca","/not-a-token","replay",
                    uuid4(),"short")
    with pytest.raises(cli.ConsoleError,match="CREDENTIAL_MOUNT_INVALID"):
        cli.request("https://localhost","/not-a-ca","relative/token.jwt","health")

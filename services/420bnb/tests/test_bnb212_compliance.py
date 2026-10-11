"""BNB-2.12 independent eligibility fail-closed regression tests."""
from pathlib import Path
import importlib.util
from uuid import uuid4
from fastapi.testclient import TestClient
from test_postgres_adversarial import fixture_property
import pytest

spec=importlib.util.spec_from_file_location("bnb212_api",Path(__file__).resolve().parents[1]/"api.py")
api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
client=TestClient(api.app)

@pytest.mark.parametrize("route,purpose",[
 ("/v1/bnb/compliance/eligibility","bnb_accommodation_eligibility"),
 ("/v1/bnb/compliance/eligibility/revoke","bnb_accommodation_eligibility_revoke"),
])
def test_compliance_proof_mandatory(monkeypatch,route,purpose):
    monkeypatch.setattr(api,"db",lambda:(_ for _ in ()).throw(AssertionError("unverified database access")))
    result=client.post(route,json={"proof":"untrusted"*8})
    assert result.status_code in (401,503)

@pytest.mark.parametrize("override",[
 {"jurisdiction_id":"wrong/jurisdiction"},
 {"minimum_guest_age":True},
 {"identity_required":"yes"},
 {"revision":0},
 {"license_reference":""},
])
def test_invalid_compliance_claims_rejected_before_db(monkeypatch,override):
    data=dict(property_id=str(uuid4()),jurisdiction_id="CA_SK",
              decision="allowed",revision=1,license_reference="licence-on-file",
              minimum_guest_age=18,identity_required=True)
    data.update(override)
    monkeypatch.setattr(api,"verify_authority",lambda *_:data)
    monkeypatch.setattr(api,"db",lambda:(_ for _ in ()).throw(AssertionError("invalid claim reached DB")))
    result=client.post("/v1/bnb/compliance/eligibility",json={"proof":"signed-test-proof"*4})
    assert result.status_code==422,result.text

def test_public_authorized_query_requires_license_policy(monkeypatch):
    class Cursor:
        def execute(self,sql,params):
            assert "JOIN bnb_compliance_eligibility e" in sql
            assert "e.revoked_at IS NULL" in sql
            assert "e.decision='allowed'" in sql
            assert "e.property_version=p.version" in sql
            return self
        def fetchall(self):return []
    class Conn:
        def __enter__(self):return Cursor()
        def __exit__(self,*_):return False
    monkeypatch.setattr(api,"db",lambda:Conn())
    monkeypatch.setattr(api,"resolve_public_place",lambda _:{"region":"SK","country":"CA"})
    response=client.get("/v1/bnb/travel/authorized?place_id=approved_place")
    assert response.status_code==200
    assert response.json()["listings"]==[]

def test_live_compliance_retraction_and_jurisdiction_withdrawal(fixture_property,monkeypatch):
    import psycopg,os
    property_id,_=fixture_property
    path="/v1/bnb/listings"
    def visible():
        result=client.get(path)
        assert result.status_code==200,result.text
        return any(x["id"]==str(property_id) for x in result.json())
    # Old BNB fixture provides synthetic, test-only policy and licence rows.
    assert visible()
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as conn:
        conn.execute("UPDATE bnb_compliance_eligibility SET revoked_at=now() WHERE property_id=%s",(property_id,))
    assert not visible()
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as conn:
        conn.execute("UPDATE bnb_compliance_eligibility SET revoked_at=NULL,expires_at=now()-interval '1 minute' WHERE property_id=%s",(property_id,))
    assert not visible()
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as conn:
        conn.execute("UPDATE bnb_compliance_eligibility SET expires_at=now()+interval '1 day' WHERE property_id=%s",(property_id,))
        conn.execute("UPDATE bnb_travel_jurisdiction_policy SET decision='prohibited' WHERE jurisdiction_id='FIXTURE_ONLY'")
    assert not visible()
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as conn:
        conn.execute("UPDATE bnb_travel_jurisdiction_policy SET decision='allowed' WHERE jurisdiction_id='FIXTURE_ONLY'")
        conn.execute("UPDATE bnb_property SET version=version+1 WHERE id=%s",(property_id,))
    assert not visible()

def test_age_and_identity_verification_requires_independent_guest_claim(fixture_property,monkeypatch):
    import psycopg,os
    property_id,_=fixture_property
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as conn:
        conn.execute("UPDATE bnb_compliance_eligibility SET minimum_guest_age=21,identity_required=true WHERE property_id=%s",(property_id,))
    with psycopg.connect(os.environ["BNB_DATABASE_URL"]) as conn:
        with pytest.raises(api.HTTPException) as exc:
            api.require_guest_accommodation_eligibility(conn,property_id,"guest-fixture",None)
        assert exc.value.status_code==403
        monkeypatch.setattr(api,"verify_authority",lambda *args:{"sub":"guest-fixture",
          "property_id":str(property_id),"jurisdiction_id":"FIXTURE_ONLY",
          "identity_verified":True,"verified_minimum_age":20})
        with pytest.raises(api.HTTPException) as exc:
            api.require_guest_accommodation_eligibility(conn,property_id,"guest-fixture","synthetic-proof")
        assert exc.value.detail=="GUEST_AGE_NOT_VERIFIED"
        monkeypatch.setattr(api,"verify_authority",lambda *args:{"sub":"guest-fixture",
          "property_id":str(property_id),"jurisdiction_id":"FIXTURE_ONLY",
          "identity_verified":True,"verified_minimum_age":21})
        assert api.require_guest_accommodation_eligibility(conn,property_id,"guest-fixture","synthetic-proof") is None

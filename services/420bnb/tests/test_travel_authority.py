"""BNB-2.10 cross-service fail-closed authority boundary tests."""
import importlib.util
from pathlib import Path
from fastapi.testclient import TestClient
import pytest

spec=importlib.util.spec_from_file_location("bnb_travel_authority_api",Path(__file__).resolve().parents[1]/"api.py")
api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
client=TestClient(api.app)

@pytest.mark.parametrize("bad",["../private","not/allowed","bad%2fid","x"*129])
def test_authorized_discovery_rejects_forged_place_before_db(monkeypatch,bad):
    monkeypatch.setattr(api,"db",lambda:(_ for _ in ()).throw(AssertionError("db accessed")))
    result=client.get("/v1/bnb/travel/authorized",params={"place_id":bad})
    assert result.status_code==422

def test_authorized_discovery_missing_provider_fails_closed(monkeypatch):
    monkeypatch.setattr(api,"resolve_public_place",lambda _:(_ for _ in ()).throw(api.TravelLocationUnavailable()))
    monkeypatch.setattr(api,"db",lambda:(_ for _ in ()).throw(AssertionError("db accessed")))
    result=client.get("/v1/bnb/travel/authorized?place_id=public_1")
    assert result.status_code==503

@pytest.mark.parametrize("claim",[
    {"property_id":"00000000-0000-0000-0000-000000000001","place_id":"place_1","region":"SK","country":"CA"},
    {"property_id":"00000000-0000-0000-0000-000000000001","place_id":"place_1","region":"SK","country":"CA","jurisdiction_id":"CA/SK"},
    {"property_id":"bad","place_id":"place_1","region":"SK","country":"CA","jurisdiction_id":"CA_SK"},
])
def test_binding_requires_explicit_valid_jurisdiction_and_property(monkeypatch,claim):
    monkeypatch.setattr(api,"verify_authority",lambda *_:claim)
    monkeypatch.setattr(api,"resolve_public_place",lambda _:{"region":"SK","country":"CA"})
    monkeypatch.setattr(api,"db",lambda:(_ for _ in ()).throw(AssertionError("invalid claim touched db")))
    assert client.post("/v1/bnb/travel/place-binding",json={"proof":"x"*24}).status_code==422

def test_forged_region_rejected_before_db(monkeypatch):
    claim={"property_id":"00000000-0000-0000-0000-000000000001","place_id":"place_1","region":"Wrong","country":"CA","jurisdiction_id":"CA_SK"}
    monkeypatch.setattr(api,"verify_authority",lambda *_:claim)
    monkeypatch.setattr(api,"resolve_public_place",lambda _:{"region":"SK","country":"CA"})
    monkeypatch.setattr(api,"db",lambda:(_ for _ in ()).throw(AssertionError("mismatch touched db")))
    assert client.post("/v1/bnb/travel/place-binding",json={"proof":"x"*24}).status_code==409

@pytest.mark.parametrize("claim",[
    {"jurisdiction_id":"CA/SK","decision":"allowed","revision":1},
    {"jurisdiction_id":"CA_SK","decision":"maybe","revision":1},
    {"jurisdiction_id":"CA_SK","decision":"allowed","revision":0},
    {"jurisdiction_id":"CA_SK","decision":"allowed","revision":True},
])
def test_jurisdiction_rejects_untrusted_scope_before_db(monkeypatch,claim):
    monkeypatch.setattr(api,"verify_authority",lambda *_:claim)
    monkeypatch.setattr(api,"db",lambda:(_ for _ in ()).throw(AssertionError("invalid policy touched db")))
    assert client.post("/v1/bnb/travel/jurisdiction-policy",json={"proof":"x"*24}).status_code==422

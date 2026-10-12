"""BNB-2.10 public Travel discovery boundary regressions (no database required)."""
import importlib.util
from pathlib import Path
from uuid import uuid4
from fastapi.testclient import TestClient
import pytest

spec=importlib.util.spec_from_file_location("bnb_travel_api",Path(__file__).resolve().parents[1]/"api.py")
api=importlib.util.module_from_spec(spec)
spec.loader.exec_module(api)
client=TestClient(api.app)

def test_travel_projection_no_private_location_or_transaction(monkeypatch):
    pid=str(uuid4())
    def fake_search(**kwargs):
        assert kwargs["region"]=="Saskatchewan"
        return [{"id":pid,"title":"Public stay","public_region":"Saskatchewan",
                 "capacity":2,"nightly_minor":5000,"currency":"CAD"}]
    monkeypatch.setattr(api,"guest_search",fake_search)
    response=client.get("/v1/bnb/travel/discovery",params={"destination":"Saskatchewan"})
    assert response.status_code==200
    result=response.json()
    assert result["nonbinding"] is True and result["transaction_enabled"] is False
    assert result["jurisdiction_authority"]=="unverified"
    assert result["map_precision"]=="region_only"
    item=result["listings"][0]
    assert item["map_marker"] is None
    assert item["legal_compliance_verified"] is False
    assert item["price_preview"]["binding"] is False
    assert item["booking_handoff"]=={"method":"GET","path":"/v1/bnb/listings/"+pid,"side_effects":False}
    assert not any(k in str(result).lower() for k in ("street_address","latitude","longitude","private_address","wallet"))

@pytest.mark.parametrize("params",[
    {"destination":"X"*101},
    {"min_capacity":0},
    {"min_capacity":1001},
    {"limit":0},
    {"limit":51},
    {"offset":-1},
    {"offset":5001},
])
def test_travel_discovery_invalid_inputs_fail_closed(params,monkeypatch):
    def fail_search(**kwargs):
        raise AssertionError("Database should not be accessed on invalid input")
    monkeypatch.setattr(api,"guest_search",fail_search)
    response=client.get("/v1/bnb/travel/discovery",params=params)
    assert response.status_code==422

def test_travel_discovery_never_accepts_guest_authority(monkeypatch):
    monkeypatch.setattr(api,"guest_search",lambda **kwargs:[])
    response=client.get("/v1/bnb/travel/discovery",params={"destination":"Public region"})
    assert response.status_code==200
    assert response.json()["listings"]==[]
    assert response.json()["transaction_enabled"] is False

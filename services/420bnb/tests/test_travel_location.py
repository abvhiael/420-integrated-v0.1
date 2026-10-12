"""BNB-2.10 Travel public-ID resolution and authority isolation."""
import importlib.util
import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient
import sys

root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root))
from travel_location import resolve_public_place,TravelLocationUnavailable

def test_resolves_exact_public_id_without_coordinates():
    payload={"state":"ready","places":[{"id":"place_1","name":"Town","region":"Saskatchewan","country":"CA","approximate":True}]}
    place=resolve_public_place("place_1",base_url="https://travel.example",fetch=lambda _:json.dumps(payload).encode())
    assert place["place_id"]=="place_1" and place["region"]=="Saskatchewan"
    assert place["latitude"] is None and place["longitude"] is None

@pytest.mark.parametrize("bad",["../private","a/b","%2F","", "x"*129])
def test_rejects_invalid_place_id(bad):
    with pytest.raises(ValueError):resolve_public_place(bad,base_url="https://travel.example",fetch=lambda _:b"{}")

@pytest.mark.parametrize("base",["","http://travel.example","https://user:pw@travel.example","https://travel.example/api","https://travel.example?x=1"])
def test_rejects_untrusted_travel_endpoint(base):
    with pytest.raises(TravelLocationUnavailable):resolve_public_place("good",base_url=base,fetch=lambda _:b"{}")

@pytest.mark.parametrize("data",[
 {"state":"unavailable","places":[]},
 {"state":"ready","places":[]},
 {"state":"ready","places":[{"id":"a","name":"X","region":"SK","country":"CA","approximate":True}]*2},
 {"state":"ready","places":[{"id":"a","name":"X","region":"SK","country":"CA","approximate":"true"}]},
 {"state":"ready","places":[{"id":"a","name":"X","region":"","country":"CA","approximate":True}]},
])
def test_untrusted_or_stale_public_projection_fails_closed(data):
    with pytest.raises(TravelLocationUnavailable):
        resolve_public_place("a",base_url="https://travel.example",fetch=lambda _:json.dumps(data).encode())

def test_public_place_filter_still_has_no_map_marker(monkeypatch):
    spec=importlib.util.spec_from_file_location("bnb_travel_test_api",root/"api.py")
    api=importlib.util.module_from_spec(spec);spec.loader.exec_module(api)
    monkeypatch.setattr(api,"resolve_public_place",lambda _:{"region":"Saskatchewan"})
    monkeypatch.setattr(api,"guest_search",lambda **kw: [] if kw["region"]=="Saskatchewan" else (_ for _ in ()).throw(AssertionError()))
    response=TestClient(api.app).get("/v1/bnb/travel/discovery?place_id=place_1")
    assert response.status_code==200
    assert response.json()["destination_place_id"]=="place_1"
    assert response.json()["transaction_enabled"] is False

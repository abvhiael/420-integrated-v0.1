"""BNB-5.6 independent consumer processes and supervisor wiring safety tests."""
import ssl
from uuid import uuid4
import pytest
from fastapi.testclient import TestClient
from fastapi import HTTPException
import discovery_consumer_service as service
import discovery_transport as transport
import worker
from test_bnb55_discovery_feed import database
from test_bnb32_infrastructure import database as tls_database


@pytest.mark.parametrize("consumer",["search","travel"])
def test_independent_consumer_ingress_refuses_missing_and_wrong_scope(monkeypatch,consumer):
    app=service.create_consumer_app(consumer,lambda:None)
    client=TestClient(app)
    body={"consumer":consumer,"transport_digest":"a"*64,"epoch":str(uuid4()),
          "cursor":1,"property_id":str(uuid4()),"revision":1}
    assert client.post("/v1/discovery/accept",json=body).status_code==401
    monkeypatch.setattr(service,"verify_authority",lambda *args,**kw:{
        "consumer":"travel" if consumer=="search" else "search",
        "current_consumer_grant_verified":True,"consumer_revoked":False,
        **{k:body[k] for k in ("transport_digest","epoch","cursor","property_id","revision")}})
    assert client.post("/v1/discovery/accept",json=body,
        headers={"x-discovery-proof":"fixture"}).status_code==403


def test_independent_consumer_commits_before_http_acceptance(database,monkeypatch):
    import discovery_sync,discovery_feed
    from test_bnb55_discovery_feed import property_row
    connect,_,_=database
    with connect() as c:
        pid=property_row(c)
        discovery_sync.synchronize(c,pid)
    with connect() as c:
        page=discovery_feed.page(c,"search")
        body=transport.envelope("search",page["items"][0],page["epoch"])
    monkeypatch.setattr(service,"verify_authority",lambda *args,**kw:{
        "consumer":"search","current_consumer_grant_verified":True,
        "consumer_revoked":False,
        **{k:body[k] for k in ("transport_digest","epoch","cursor","property_id","revision")}})
    app=service.create_consumer_app("search",connect,receipt_signer=lambda *_:"fixture-receipt")
    client=TestClient(app)
    path="/v1/discovery/accept"
    headers={"x-discovery-proof":"fixture"}
    first=client.post(path,json=body,headers=headers)
    assert first.status_code==201,first.text
    assert first.json()["external_acceptance"] is False
    with connect() as c:
        saved=c.execute("SELECT revision,payload FROM bnb_discovery_consumer WHERE property_id=%s AND consumer='search'",(pid,)).fetchone()
        assert saved[0]==1 and saved[1]["visible"] is False
    assert client.post(path,json=body,headers=headers).status_code==409


def test_worker_construction_refuses_missing_tls_and_unauthorized_consumer():
    with pytest.raises(ValueError):
        worker.isolated_discovery_worker(lambda:None,"unknown",
            "https://localhost:8765/v1/discovery/accept",lambda *_:"fixture",
            ssl_context=ssl.create_default_context())
    with pytest.raises(ValueError):
        worker.isolated_discovery_worker(lambda:None,"search",
            "https://localhost:8765/v1/discovery/accept",lambda *_:"fixture",
            ssl_context=ssl._create_unverified_context())

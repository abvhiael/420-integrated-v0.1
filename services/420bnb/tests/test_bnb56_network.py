"""BNB-5.6 isolated network adapter refusal tests; no provider activation."""
import json
import ssl
from uuid import uuid4
import pytest
import discovery_network as network


def context():
    c=ssl.create_default_context()
    assert c.check_hostname and c.verify_mode==ssl.CERT_REQUIRED
    return c


@pytest.mark.parametrize("endpoint",[
    "http://localhost:8443/v1/discovery/accept",
    "https://localhost:8443/other",
    "https://user:pass@localhost:8443/v1/discovery/accept",
    "https://localhost:8443/v1/discovery/accept?token=secret",
    "https://localhost/v1/discovery/accept",
])
def test_network_endpoint_fails_closed(endpoint):
    with pytest.raises(ValueError):
        network.NetworkDiscoveryDelivery(lambda:None,"search",endpoint,
            lambda *_:"signed",ssl_context=context())


def test_network_transport_requires_verified_tls_and_independent_token():
    insecure=ssl._create_unverified_context()
    with pytest.raises(ValueError,match="CONSUMER_TLS_REQUIRED"):
        network.NetworkDiscoveryDelivery(lambda:None,"search",
            "https://localhost:8443/v1/discovery/accept",lambda *_:"proof",
            ssl_context=insecure)
    with pytest.raises(ValueError,match="CONSUMER_TRANSPORT_CONFIG_INVALID"):
        network.NetworkDiscoveryDelivery(lambda:None,"search",
            "https://localhost:8443/v1/discovery/accept",None,
            ssl_context=context())


def test_wrong_event_never_attempts_network(monkeypatch):
    def forbidden(*_):
        raise AssertionError("network must not be called")
    monkeypatch.setattr(network.urllib.request,"build_opener",forbidden)
    adapter=network.NetworkDiscoveryDelivery(lambda:None,"travel",
        "https://localhost:8443/v1/discovery/accept",lambda *_:"proof",
        ssl_context=context())
    event_id=str(uuid4())
    with pytest.raises(network.TransportUnavailable):
        adapter.accept(event_id,json.dumps({"id":event_id,
            "type":"bnb.pay.finalized","payload":{}}))


def test_missing_consumer_proof_refuses_transport(monkeypatch):
    def forbidden(*_):
        raise AssertionError("network must not be called")
    monkeypatch.setattr(network.urllib.request,"build_opener",forbidden)
    adapter=network.NetworkDiscoveryDelivery(lambda:None,"search",
        "https://localhost:8443/v1/discovery/accept",lambda *_:"",
        ssl_context=context())
    with pytest.raises(network.TransportUnavailable):
        adapter.accept(str(uuid4()),"not-json")

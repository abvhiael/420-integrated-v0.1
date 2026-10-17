"""BNB-6.3 topology and adversarial configuration checks."""
import copy
import importlib.util
import json
from pathlib import Path
import pytest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("bnb63_topology", ROOT/"validate_deployment.py")
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

@pytest.fixture
def topology():
    return json.loads((ROOT/"deployment-topology.v1.json").read_text())

@pytest.fixture
def compose():
    return (ROOT/"compose.production.yml").read_text()

def test_release_topology_and_immutable_images(topology,compose):
    assert module.validate(topology,compose,images={
        name:f"example/{name}@sha256:"+("a"*64) for name in ("api","web","ingress")})
    with pytest.raises(module.TopologyError,match="IMAGE_PROVENANCE_INVALID"):
        module.validate(topology,compose,images={"api":"example/api:latest","web":"a","ingress":"b"})

@pytest.mark.parametrize("property,value,code",[
    ("booking_enabled",True,"RELEASE_POLICY_INVALID"),
    ("travel_bnb_booking",True,"RELEASE_POLICY_INVALID"),
    ("financial_execution",True,"RELEASE_POLICY_INVALID"),
    ("operator_approval_verified",True,"RELEASE_POLICY_INVALID"),
])
def test_activation_denials(topology,compose,property,value,code):
    topology["release_policy"][property]=value
    with pytest.raises(module.TopologyError,match=code):
        module.validate(topology,compose)

@pytest.mark.parametrize("consumer",["search","travel"])
def test_consumer_authority_denials(topology,compose,consumer):
    topology["consumers"][consumer]["approved"]=True
    with pytest.raises(module.TopologyError,match="CONSUMER_AUTHORITY_INVALID"):
        module.validate(topology,compose)

def test_production_db_cannot_become_local_or_unverified(topology,compose):
    topology["postgresql"]["sslmode"]="disable"
    with pytest.raises(module.TopologyError,match="DATABASE_POLICY_INVALID"):
        module.validate(topology,compose)
    topology["postgresql"]["sslmode"]="verify-full"
    with pytest.raises(module.TopologyError,match="PRODUCTION_DATABASE_EXPOSURE"):
        module.validate(topology,compose+"\n  postgres:\n    ports: ['5432:5432']")

def test_resource_and_identity_denials(topology,compose):
    topology["limits"]["api"]["pids"]=0
    with pytest.raises(module.TopologyError,match="RESOURCE_LIMIT_INVALID"):
        module.validate(topology,compose)
    topology["limits"]["api"]["pids"]=128
    with pytest.raises(module.TopologyError,match="COMPOSE_CONTRACT_INVALID"):
        module.validate(topology,compose.replace("BNB_SERVICE_ID: bnb-worker","BNB_SERVICE_ID: bnb-api"))

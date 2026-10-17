"""BNB-6.11 M6-B: cross-step fail-closed deployment/recovery/operator/privacy/provider regression."""
import copy
import json
import sys
from pathlib import Path
import pytest
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import incident_signals as signals
import provider_adapters as providers
import release_controls as release
import recovery_operations as recovery
import recovery_rehearsal as rehearsal
import validate_deployment as deployment

@pytest.fixture
def contracts():
    topology=json.loads((ROOT/"deployment-topology.v1.json").read_text())
    providers_config=json.loads((ROOT/"providers.template.v1.json").read_text())
    compose=(ROOT/"compose.production.yml").read_text()
    release_config={"schema":"420.bnb.release.v1","release_sha":"a"*40,
        "images":{name:"registry.example/"+name+"@sha256:"+"b"*64 for name in ("api","web","ingress","worker")},
        "migration_version":30,"flags":{"booking_enabled":False,"financial_execution":False,"travel_bnb_booking":False},
        "rollback_policy":{"automatic_database_down_migration":False,
            "restore_requires_verified_backup":True,"previous_binary_requires_compatibility_proof":True},
        "approval":{"independent_operator_verified":False,"live_accepted":False}}
    return topology,providers_config,compose,release_config

def test_full_m6b_boundary_never_mints_production_acceptance(contracts):
    topology,configuration,compose,manifest=contracts
    assert deployment.validate(topology,compose)
    assert providers.validate(configuration)
    result=release.evaluate(manifest,approved=True,ledger_verified=True,backup_restored=True,
        compatibility_verified=True,runtime_ready=True,independent_receipts=True)
    assert not result["ready_to_promote"] and not result["automatic_database_rollback"]
    with pytest.raises(providers.ProviderBlocked):
        providers.validate(configuration,production=True)
    observation=signals.summarize(schema_ready=True,db_available=True,discovery_ready=False,
        provider_approved=False,pending=101,dead_letters=1,audit_ready=True,
        stale_after_seconds=300,last_ack_age_seconds=None)
    assert not observation["ready"]
    assert {"DISCOVERY_STALE","PROVIDER_NOT_APPROVED","DELIVERY_BACKLOG",
        "DELIVERY_DEAD_LETTERS"}.issubset(observation["alerts"])
    assert observation["observation_only"] and not observation["production_execution"]

@pytest.mark.parametrize("fault",["issuer_activation","unsafe_database","fake_approval",
    "rollback","unauthorized_restore","unavailable_monitor"])
def test_faults_cannot_cross_integrated_gate(contracts,fault):
    topology,configuration,compose,manifest=copy.deepcopy(contracts)
    if fault=="issuer_activation":
        configuration["providers"]["identity"]["live_enabled"]=True
        with pytest.raises(providers.ProviderBlocked):providers.validate(configuration)
    elif fault=="unsafe_database":
        topology["postgresql"]["sslmode"]="disable"
        with pytest.raises(deployment.TopologyError):deployment.validate(topology,compose)
    elif fault=="fake_approval":
        manifest["approval"]["live_accepted"]=True
        with pytest.raises(release.ReleaseBlocked):release.evaluate(manifest)
    elif fault=="rollback":
        decision=release.rollback(manifest,previous_image=manifest["images"]["api"],
            backup_verified=True,schema_compatibility_verified=True,independent_approval=True)
        assert not decision["executable"] and not decision["database_down_migration"]
    elif fault=="unauthorized_restore":
        with pytest.raises(recovery.RecoveryBlocked,match="INDEPENDENT_OPERATOR_AUTHORITY_REQUIRED"):
            recovery.assess(object(),action="restore")
    else:
        monitor=signals.summarize(schema_ready=False,db_available=False,
            discovery_ready=False,provider_approved=False,pending=0,dead_letters=0,
            audit_ready=False,stale_after_seconds=300)
        assert not monitor["ready"] and "DATABASE_UNAVAILABLE" in monitor["alerts"]

def test_recovery_objectives_and_privacy_do_not_override_authority():
    result=rehearsal.evaluate(rehearsal.Observation("consumer_recovery",10,0,0,2,2,30,True))
    assert result["rehearsal_pass"] and not result["live_accepted"]
    assert not result["production_recovery_authorized"]
    incident=signals.sanitized_event(category="incident",request_id="a"*32,
        code="denied",elapsed_ms=500)
    assert set(incident)=={"event","category","code","request_id","elapsed_ms"}
    for secret in ("Bearer secret-token","postgres://admin:password@db"):
        with pytest.raises(signals.SignalRejected):
            signals.sanitized_event(category="incident",request_id="a"*32,code=secret,elapsed_ms=5)

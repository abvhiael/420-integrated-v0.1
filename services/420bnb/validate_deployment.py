"""BNB-6.3 fail-closed declarative deployment release verifier."""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SHA_IMAGE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9./_-]*@sha256:[0-9a-f]{64}$")

class TopologyError(ValueError):
    pass

def validate(topology, compose_text, *, images=None):
    def demand(value, code):
        if not value:
            raise TopologyError(code)
    demand(isinstance(topology, dict) and topology.get("schema")=="420.bnb.deployment.topology.v1", "SCHEMA_INVALID")
    policy=topology.get("release_policy",{})
    demand(isinstance(policy,dict) and policy.get("immutable_registry_digests") is True and
           all(policy.get(x) is False for x in ("booking_enabled","travel_bnb_booking",
           "financial_execution","operator_approval_verified","live_accepted")), "RELEASE_POLICY_INVALID")
    pg=topology.get("postgresql",{})
    demand(pg.get("mode")=="operator-managed-external" and pg.get("min_major")==16 and
           pg.get("sslmode")=="verify-full" and pg.get("channel_binding")=="require" and
           pg.get("local_production_database") is False and
           pg.get("credentials")=="separate-mounted-runtime-and-migrator", "DATABASE_POLICY_INVALID")
    for consumer in ("search","travel"):
        spec=topology.get("consumers",{}).get(consumer,{})
        demand(spec.get("mode")=="external-independent-deployment" and
               spec.get("approved") is False and spec.get("receipt")=="independent-signed-proof" and
               spec.get("endpoint")=="operator-supplied", "CONSUMER_AUTHORITY_INVALID")
    demand(topology.get("api",{}).get("replicas")==["api-a","api-b"] and
           topology["api"].get("health")=="/health/ready" and
           topology["api"].get("private_network") is True, "API_REPLICAS_INVALID")
    demand(topology.get("worker",{}).get("sink")=="local-validation" and
           topology["worker"].get("external_transport_approved") is False, "WORKER_POLICY_INVALID")
    demand(topology.get("migration",{}).get("separate_credential_mount") is True, "MIGRATOR_ISOLATION_INVALID")
    demand(topology.get("ingress",{}).get("public_ports")==[443] and
           topology["ingress"].get("tls")=="mounted-operator-approved" and
           topology["ingress"].get("admin_api") is False, "INGRESS_POLICY_INVALID")
    limits=topology.get("limits",{})
    for service in ("api","worker","migrator","web","ingress"):
        value=limits.get(service,{})
        demand(isinstance(value,dict) and 0 < value.get("memory_mb",0) <= 2048 and
               0 < value.get("pids",0) <= 256 and
               isinstance(value.get("cpu"),str) and float(value["cpu"]) > 0, "RESOURCE_LIMIT_INVALID")
    for token in ("BNB_ENV_SCHEMA: 420.bnb.environment.v1",
                  "BNB_SERVICE_ID: bnb-worker","BNB_SERVICE_ID: bnb-migrator",
                  "BNB_DATABASE_URL_FILE: /run/secrets/migrator.dsn",
                  "BNB_WORKER_SINK: local-validation",
                  "pids_limit:","mem_limit:","cpus:","no-new-privileges:true",
                  "cap_drop: [ALL]","read_only: true","BNB_TLS_DIRECTORY:",
                  "443:8443", "/health/ready"):
        demand(token in compose_text,"COMPOSE_CONTRACT_INVALID")
    demand("postgres:" not in compose_text and "5432:" not in compose_text, "PRODUCTION_DATABASE_EXPOSURE")
    if images is not None:
        demand(isinstance(images,dict) and set(images)=={"api","web","ingress"} and
               all(isinstance(v,str) and SHA_IMAGE.fullmatch(v) for v in images.values()),
               "IMAGE_PROVENANCE_INVALID")
    return True

def main():
    topology=json.loads((ROOT/"deployment-topology.v1.json").read_text())
    compose=(ROOT/"compose.production.yml").read_text()
    validate(topology,compose)
    print("BNB-6.3_TOPOLOGY_PASS: isolated repository configuration; no external approval")

if __name__=="__main__":
    main()

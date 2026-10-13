#!/usr/bin/env python3
"""R01.8 retained architecture integration boundary and fail-closed contract checks."""
import json, pathlib, sys
import yaml
root=pathlib.Path(__file__).resolve().parents[1]
def read(p): return (root/p).read_text()
def check(ok,msg):
    if not ok: raise SystemExit("FAIL: "+msg)
    print("PASS:",msg)
road=read("docs/doobr/DOOBR-R01-R06-ROADMAP.md")
lock=read("docs/doobr/DOOBR-R01-8-ARCHITECTURE-LOCK-LEVEL2.md")
contract=read("docs/doobr/DOOBR-R01-4-BC-VANCOUVER-COMPLIANCE-CONTRACT.md")
pr=read("docs/doobr/DOOBR-R01-5-PROTOCOL-AND-PRESENCE-BOUNDARIES.md")
roles=read("docs/doobr/DOOBR-R01-3-ROLES-JOURNEYS-THREATS.md")
threats=read("docs/doobr/DOOBR-R01-6-SECURITY-PRIVACY-THREAT-MODEL.md")
spec=yaml.safe_load(read("docs/doobr/openapi-v1.yaml"))
events=json.loads(read("docs/doobr/events-v1.json"))
cat=json.loads(read("config/genesis-applications.json"))
svc=json.loads(read("config/genesis-consumer-services.json"))
check("R01.8 Architecture decision lock and Level 2 milestone qualification." in road, "canonical R01.8 unrenumbered")
check("C01.4 cross-roadmap authority amendment" in road, "parallel Compliance C01.4 authority integrated")
for i in range(1,13):
    check(f"ADR-{i:02d}" in lock,f"ADR-{i:02d} locked")
check("DOOBR" not in {app["name"] for app in cat["apps"]},"Genesis app not promoted")
check(any(v["key"]=="travel.doobr_transactions" and v["genesis_default"] is False for v in svc["feature_flags"]),"Travel transaction flag disabled")
check("420Compliance exclusively owns" in road and "420Compliance" in lock,"DOOBR cannot self-issue policy")
check("DevelopmentCompensationVault420" in lock and "eligible net protocol revenue" in lock,"canonical source fee basis")
check(all(c in contract for c in ("LICENSEE_EMPLOYEE","DELIVERY_PERSON","COMMON_CARRIER")),"three carrier classes kept separate")
check(all(f"SEC-{i:02d}" in threats for i in range(1,21)),"twenty security objectives retained")
check(all(x in roles for x in ("CONSUMER","COURIER","RETAILER","OPERATOR")),"all application actor roles")
check(all(x in pr for x in ("ComplianceDecision/v1","doobr-presence/v1","fail closed")),"Compliance decision and public projection boundaries")
check(spec.get("openapi")=="3.1.0","OpenAPI parse and version")
public=spec["components"]["schemas"]["PublicRegionPresence"]
allow={"schema_version","region_id","status","observed_at","expires_at","jurisdiction_policy_ref","handoff_url"}
check(public["additionalProperties"] is False and set(public["properties"])==allow,"public response no private fields")
check(set(public["properties"]["status"]["enum"])=={"AVAILABLE","LIMITED","UNAVAILABLE","UNKNOWN"},"four distinct public presence states")
check(spec["paths"]["/v1/orders"]["post"]["security"] != [], "order mutation requires authentication")
check(events["transport"]=="at_least_once_outbox_with_idempotent_consumers","durable outbox and idempotent delivery defined")
check(events["public_projection"]["allow_event"]=="region.presence_updated.v1","only sanitized region event public")
check("DOOBR-AUDIT-9/10" in lock and "R05.10" in lock,"testnet / Level 3 deferrals retained")
check("R02.1 Postgres/PostGIS schema, migrations, tenant isolation, encryption/retention." in lock,"canonical next step")
print("R01.8 architecture Level 2 assertions PASS")

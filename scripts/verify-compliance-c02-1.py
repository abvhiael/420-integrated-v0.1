#!/usr/bin/env python3
import json, pathlib,sys,subprocess,urllib.parse
root=pathlib.Path(__file__).resolve().parents[1]
d=json.loads((root/"docs/compliance/C02.1-OFFICIAL-SOURCES.json").read_text())
assert d["step"]=="C02.1" and not d["release_enabled"]
assert len(d["sources"])>=10 and d["source_count"]==len(d["sources"])
assert len({x["id"] for x in d["sources"]})==len(d["sources"])
assert {"federal","british-columbia","vancouver"}=={x["jurisdiction"] for x in d["sources"]}
assert {"STATUTE","REGULATION","LICENCE_CONDITION","OFFICIAL_GUIDANCE","MUNICIPAL_BYLAW"}.issubset({x["type"] for x in d["sources"]})
for x in d["sources"]:
 u=urllib.parse.urlsplit(x["url"])
 assert u.scheme=="https" and u.hostname==x["approved_host"] and not u.username and not u.password
 assert x["owner_role"] and not x["owner_assigned_to_person"]
 assert x["refresh_policy"]["max_age_hours"]<=48
 assert x["refresh_policy"]["on_timeout"]=="STALE_BLOCKS_REGULATED_ALLOW"
 assert x["refresh_policy"]["on_change"]=="QUARANTINE_AND_REQUIRE_REVIEW"
 assert x["legal_review"]=="PENDING" and not x["production_authority"]
assert "UNKNOWN_REVIEW_REQUIRED_NO_TRANSACTION_ALLOW"==d["global_failure_mode"]
if len(sys.argv)>1:assert subprocess.check_output(["git","rev-parse","HEAD"],cwd=root,text=True).strip()==sys.argv[1]
print("C02.1 10 official-source ownership freshness fail-closed validations PASS")

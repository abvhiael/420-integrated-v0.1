#!/usr/bin/env python3
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
errors=[]

def need(cond,msg):
    if not cond: errors.append(msg)

cfg=json.loads((ROOT/"contracts/config/420search-genesis.json").read_text())
need(cfg.get("name")=="420Search","canonical name drift")
need(cfg.get("serviceId")=="420/service/search/v1","service id drift")
need(cfg.get("contractsRequired") is False,"Search must remain contract-free")
need(cfg.get("canonicalStateAuthority") is False,"Search cannot own canonical state")
need(len(cfg.get("invariants",[]))==12,"expected SRCH-INV-001..012")
for i in range(1,13):
    need(any(f"SRCH-INV-{i:03d}" in x for x in cfg.get("invariants",[])),f"missing SRCH-INV-{i:03d}")

road=(ROOT/"docs/420SEARCH-ROADMAP.md").read_text()
for phase in ["SEARCH-0","SEARCH-1","SEARCH-2","SEARCH-3.1","SEARCH-3.2","SEARCH-3.3","SEARCH-3.4","SEARCH-3.5","SEARCH-4.1","SEARCH-4.2","SEARCH-4.3","SEARCH-4.4","SEARCH-5","SEARCH-6.1","SEARCH-6.2","SEARCH-6.3","SEARCH-7.1","SEARCH-7.2","SEARCH-7.3","SEARCH-8","SEARCH-9","SEARCH-10"]:
    need(phase in road,f"roadmap missing {phase}")

required=[
"search/architecture/profile.go","search/indexerclient/client.go","search/result/model.go",
"search/query/parser.go","search/ranking/ranker.go","search/sponsorship/sponsorship.go",
"search/pagination/snapshot.go","search/privacy/admission.go","search/httpapi/handler.go",
"search/runtime/service.go","search/cmd/search420/main.go","search/cmd/searchsmoke/main.go",
"search/cmd/searchlivevalidate/main.go","search/deploy/Dockerfile","search/deploy/README.md",
"search/web/static/index.html","search/web/static/app.js","search/web/static/app.css",
"search/closeout/closeout.go","testnet/public-services/search/readiness.json"
]
for p in required: need((ROOT/p).is_file(),f"missing required file {p}")

sources="\n".join(p.read_text(errors="replace") for p in (ROOT/"search").rglob("*.go"))
need("SEARCH_RPC_URL" not in sources,"direct RPC configuration introduced")
need(re.search(r"\\beth_(?:chainid|getblock|gettransaction|gettransactionreceipt|getlogs|call|sendrawtransaction)\\b", sources.lower()) is None,"direct JSON-RPC method introduced")
need("delegatecall" not in sources.lower(),"unexpected delegatecall surface")
need("private Messenger" in (ROOT/"docs/420SEARCH.md").read_text(),"privacy boundary undocumented")

docker=(ROOT/"search/deploy/Dockerfile").read_text()
for binary in ["search420","searchsmoke","searchlivevalidate"]:
    need(binary in docker,f"Dockerfile missing {binary}")

readiness=json.loads((ROOT/"testnet/public-services/search/readiness.json").read_text())
need(readiness.get("schema")=="420-testnet-search-readiness-v1","Search readiness schema drift")
need(readiness.get("live_testnet",{}).get("qualified") is False,"live testnet must not be overpromoted")
need(readiness.get("repository",{}).get("implementation_status")=="QUALIFICATION_CANDIDATE","repository readiness status drift")

if errors:
    print("\n".join("FAIL: "+e for e in errors))
    sys.exit(1)
print("420Search audit repository verifier: PASS")

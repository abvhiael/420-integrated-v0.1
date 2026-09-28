#!/usr/bin/env python3
import json, subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
REC=ROOT/"docs/audit/EXP-1.4-indexer-runtime.json"
READY=ROOT/"testnet/public-services/indexer/readiness.json"
MAIN=ROOT/"indexer/cmd/indexer420/main.go"
TEST=ROOT/"indexer/cmd/indexer420/main_test.go"
DOCKER=ROOT/"docker/Dockerfile.420indexer"
COMPOSE=ROOT/"deployments/indexer/docker-compose.yml"
ENV=ROOT/"deployments/indexer/indexer.env.example"
INFRA=ROOT/"testnet/infrastructure/inventory.json"
ENDPOINTS=ROOT/"testnet/services/endpoints.json"
EVIDENCE=ROOT/"exp-1-4-evidence"

def git(*a): return subprocess.check_output(["git",*a],cwd=ROOT,text=True).strip()

def main():
  errors=[]
  for p in [REC,READY,MAIN,TEST,DOCKER,COMPOSE,ENV,INFRA,ENDPOINTS]:
    if not p.exists(): errors.append(f"missing {p.relative_to(ROOT)}")
  if errors: print(json.dumps({"pass":False,"errors":errors},indent=2)); raise SystemExit(1)
  rec=json.loads(REC.read_text()); ready=json.loads(READY.read_text()); infra=json.loads(INFRA.read_text()); endpoints=json.loads(ENDPOINTS.read_text())
  if rec.get("schema")!="420explorer-exp-1.4-indexer-runtime-v1": errors.append("schema drift")
  if rec.get("predecessor",{}).get("qualified_head")!="5d5067b5ac842a48a9f49b75e642dfb35a68d287": errors.append("EXP-1.3 predecessor drift")
  main_src=MAIN.read_text(); compose=COMPOSE.read_text(); docker=DOCKER.read_text()
  for token in ["ListenAndServe","NewStoreBackend","CatchUp(ctx)","NewTicker","Shutdown","INDEXER_HTTP_ADDR","INDEXER_POLL_INTERVAL"]:
    if token not in main_src: errors.append(f"runtime token missing: {token}")
  for token in ["docker/Dockerfile.420indexer","healthcheck","/v1/health","restart: unless-stopped","indexer420-data"]:
    if token not in compose: errors.append(f"deployment token missing: {token}")
  for token in ["ENTRYPOINT","EXPOSE 8420","VOLUME","USER indexer"]:
    if token not in docker: errors.append(f"container token missing: {token}")
  if ready.get("backend",{}).get("deployment_status")!="DEPLOYABLE_RUNTIME_QUALIFIED_LIVE_TESTNET_PENDING": errors.append("readiness deployment status drift")
  live=ready.get("backend",{}).get("live_deployment",{})
  if live.get("qualified") is not False: errors.append("premature live deployment promotion")
  if infra.get("status")!="PLANNED": errors.append("infrastructure state unexpectedly changed")
  rpc=endpoints.get("rpc",[])
  if not rpc or any(x.get("status")!="PLACEHOLDER" for x in rpc): errors.append("RPC placeholder expectation drift")
  if rec.get("acceptance",{}).get("deployable_runtime_complete") is not True: errors.append("deployable runtime acceptance missing")
  if rec.get("acceptance",{}).get("live_deployment_complete") is not False: errors.append("live deployment overpromotion")
  EVIDENCE.mkdir(exist_ok=True)
  out={"schema":"420explorer-exp-1.4-evidence-v1","milestone":"EXP-1.4","head_sha":git("rev-parse","HEAD"),
       "deployable_runtime_qualified":True,"live_testnet_deployed":False,"infrastructure_status":infra.get("status"),
       "rpc_statuses":[x.get("status") for x in rpc],"errors":errors,"pass":not errors}
  (EVIDENCE/"summary.json").write_text(json.dumps(out,indent=2)+"\n")
  print(json.dumps(out,indent=2))
  if errors: raise SystemExit(1)
if __name__=="__main__": main()

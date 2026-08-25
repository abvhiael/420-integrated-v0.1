#!/usr/bin/env python3
import hashlib, json, pathlib, sys

root=pathlib.Path(__file__).resolve().parents[1]
chainp=root/"testnet/public/metadata/chain.json"
walletp=root/"testnet/public/metadata/wallet-network.json"
chain=json.loads(chainp.read_text())
wallet=json.loads(walletp.read_text())

# Require globally configured endpoints.
svc=json.loads((root/"testnet/services/endpoints.json").read_text())
rpcs=[r["url"] for r in svc["rpc"] if r.get("status")=="READY"]
wss=[w["url"] for w in svc["websocket"] if w.get("status")=="READY"]
if len(rpcs)<3: raise SystemExit("at least 3 READY RPC endpoints required")
if len(wss)<1: raise SystemExit("at least 1 READY WS endpoint required")
if svc["explorer"].get("status")!="READY": raise SystemExit("explorer not READY")
if svc["faucet"].get("status")!="READY": raise SystemExit("faucet not READY")

boot=json.loads((root/"testnet/bootnodes/bootnodes.json").read_text())
boots=[b["multiaddr"] for b in boot["bootnodes"] if b.get("status")=="READY"]
if len(boots)<3: raise SystemExit("at least 3 READY bootnodes required")

# Frozen hashes.
freeze=root/"testnet/ceremony/freeze/freeze-record.json"
if not freeze.exists(): raise SystemExit("genesis freeze record missing")
fr=json.loads(freeze.read_text())
hashes={f["path"]:f["sha256"] for f in fr["files"]}

chain["rpc_urls"]=rpcs
chain["ws_urls"]=wss
chain["explorer_url"]=svc["explorer"]["url"]
chain["faucet_url"]=svc["faucet"]["url"]
chain["bootnodes"]=boots
chain["genesis"]["execution_sha256"]=hashes.get("testnet/genesis/execution-genesis.json","")
chain["genesis"]["consensus_sha256"]=hashes.get("testnet/genesis/consensus-genesis.json","")
chain["genesis"]["validator_registry_sha256"]=hashes.get("testnet/validators/registry60.json","")
chain["chain_id_status"]="FROZEN_FOR_PUBLIC_TESTNET"

wallet["rpcUrls"]=rpcs
wallet["blockExplorerUrls"]=[svc["explorer"]["url"]]
wallet["status"]="READY"

chainp.write_text(json.dumps(chain,indent=2)+"\n")
walletp.write_text(json.dumps(wallet,indent=2)+"\n")

req={"method":"wallet_addEthereumChain","params":[wallet]}
(root/"testnet/public/metadata/wallet-add-chain-request.json").write_text(json.dumps(req,indent=2)+"\n")
print(chainp)

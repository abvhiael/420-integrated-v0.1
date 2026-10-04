#!/usr/bin/env python3
from pathlib import Path
import json,re,sys
root=Path(__file__).resolve().parents[1]
errors=[]
required=[
"docs/420-ORACLE-V1-MODEL.md",
"docs/architecture/infrastructure/oracle-external-provider-infrastructure.md",
"docs/architecture/protocols/randomness-oracle-interface.md",
"contracts/src/oracle/OracleIds420.sol",
"contracts/src/oracle/OracleProviderRegistry420.sol",
"contracts/src/oracle/OracleFeedRegistry420.sol",
"contracts/src/oracle/OracleRiskPolicy420.sol",
"contracts/src/oracle/OracleRouter420.sol",
"contracts/src/oracle/TWAPOracleSourceAdapter420.sol",
"contracts/src/interfaces/IOracle420.sol",
"contracts/src/interfaces/IOracleSourceAdapter420.sol",
"contracts/src/interfaces/IRandomnessRouter420.sol",
"contracts/test/Oracle420.t.sol",
"contracts/test/Oracle420Epoch.t.sol",
"contracts/test/Oracle420Risk.t.sol",
"contracts/test/Oracle420Hardening.t.sol",
"contracts/test/Oracle420DeploymentBinding.t.sol",
"contracts/config/420oracle-genesis.json",
"contracts/config/genesis-dapp-contract-map.json",
"contracts/config/genesis-address-namespace.json",
"contracts/config/genesis-canonical-addresses.json",
"contracts/src/libraries/ServiceIds420.sol"]
for rel in required:
    if not (root/rel).exists(): errors.append("missing required Oracle artifact: "+rel)
model=(root/"docs/420-ORACLE-V1-MODEL.md").read_text()
for i in range(1,19):
    token=f"ORACLE-INV-{i:03d}"
    if token not in model: errors.append("missing frozen invariant "+token)
service=(root/"contracts/src/libraries/ServiceIds420.sol").read_text()
if 'ORACLE = keccak256("420/service/oracle/v1")' not in service: errors.append("canonical Oracle service ID missing or changed")
cfg=json.loads((root/"contracts/config/420oracle-genesis.json").read_text())
if cfg.get("serviceId")!="420/service/oracle/v1": errors.append("Oracle deployment config service ID mismatch")
if cfg.get("serviceDiscovery",{}).get("fixedAddress") is not None: errors.append("Oracle must remain registry-resolved without a fixed Genesis address")
if cfg.get("serviceDiscovery",{}).get("publishedImplementation")!="OracleRouter420.sol": errors.append("OracleRouter420 must be canonical published service")
ns=json.loads((root/"contracts/config/genesis-address-namespace.json").read_text())
hits=[x for x in ns.get("registryResolved",[]) if x.get("id")=="oracle-router" and x.get("contract")=="OracleRouter420.sol"]
if len(hits)!=1: errors.append("oracle-router registry-resolved authority missing or duplicated")
dapp=json.dumps(json.loads((root/"contracts/config/genesis-dapp-contract-map.json").read_text()))
for name in ["OracleProviderRegistry420.sol","OracleFeedRegistry420.sol","OracleRiskPolicy420.sol","OracleRouter420.sol","TWAPOracleSourceAdapter420.sol"]:
    if name not in dapp: errors.append("Genesis dApp contract map missing "+name)
runtime=(root/"contracts/src/interfaces/IOracle420.sol").read_text()
legacy=(root/"contracts/src/interfaces/genesis/IOracle420.sol").read_text()
if "readNumeric" not in runtime or "readResult" not in runtime: errors.append("runtime IOracle420 canonical read surface missing")
if "function price(" not in legacy or "function isFresh(" not in legacy: errors.append("frozen Genesis IOracle420 compatibility surface unexpectedly changed")
router=(root/"contracts/src/oracle/OracleRouter420.sol").read_text()
if '../interfaces/genesis/IOracle420.sol' in router: errors.append("OracleRouter420 imports incompatible frozen Genesis legacy interface")
if '../interfaces/IOracle420.sol' not in router: errors.append("OracleRouter420 canonical runtime interface import missing")
for rel in ["contracts/src/oracle/OracleProviderRegistry420.sol","contracts/src/oracle/OracleFeedRegistry420.sol","contracts/src/oracle/OracleRiskPolicy420.sol","contracts/src/oracle/OracleRouter420.sol","contracts/src/oracle/TWAPOracleSourceAdapter420.sol"]:
    body=(root/rel).read_text()
    for forbidden in [r"\btx\.origin\b",r"\bselfdestruct\s*\(",r"\.delegatecall\s*\("]:
        if re.search(forbidden,body): errors.append(f"forbidden primitive in {rel}: {forbidden}")
print(json.dumps({"pass":not errors,"errors":errors,"required_artifacts":len(required),"frozen_invariants":18,"runtime_interface":"contracts/src/interfaces/IOracle420.sol","legacy_frozen_interface":"contracts/src/interfaces/genesis/IOracle420.sol","service_id":"420/service/oracle/v1","fixed_genesis_address":None},indent=2))
sys.exit(0 if not errors else 2)

#!/usr/bin/env python3
import json, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
errors = []
def need(ok, msg):
    if not ok: errors.append(msg)
def load(path):
    return json.loads((ROOT / path).read_text())
def text(path):
    return (ROOT / path).read_text()

cfg = load("contracts/config/420token-genesis.json")
ready = load("testnet/public-services/token/readiness.json")
mat = load("contracts/config/token/token-audit-4-release-materialization.json")
apps = load("config/genesis-applications.json")
canon = load("contracts/config/genesis-canonical-addresses.json")
namespace = load("contracts/config/genesis-address-namespace.json")
factory = text("contracts/src/token/TokenFactory420.sol")
templates = text("contracts/src/token/TokenTemplateRegistry420.sol")
erc20 = text("contracts/src/token/ERC20Template420.sol")
ids = text("contracts/src/token/TokenIds420.sol")
services = text("contracts/src/libraries/ServiceIds420.sol")
registry = text("contracts/src/apps/ProtocolRegistry.sol")
wallet = text("wallet/web/core/token-runtime.js")
handoff = text("wallet/web/core/token-handoff.js")

need(cfg.get("serviceId") == "420/service/token/v1", "Token service id drift")
need(cfg.get("creationFeeNative420") == "42", "Token fee drift")
need(cfg.get("communityTreasuryVaultId") == "420/treasury/vault/token-creation-community-revenue/v1", "Token Vault id drift")
need(len(cfg.get("templates", [])) == 8, "Token template count drift")
need(len(cfg.get("invariants", [])) == 11, "Token invariant count drift")
need('TOKEN = keccak256("420/service/token/v1")' in services, "ServiceIds420 Token id missing")
need('COMPONENT_TOKEN = keccak256("420/component/token/v1")' in ids, "Token component id missing")
need("CREATION_FEE = 42 ether" in factory and "msg.value!=CREATION_FEE" in factory, "exact fee enforcement missing")
need("COMMUNITY_TOKEN_REVENUE_VAULT" in factory and "depositNative{value:CREATION_FEE}" in factory, "Vault routing missing")
need("new ERC20Template420" in factory and "new ERC721Template420" in factory and "new ERC1155Template420" in factory, "frozen deployment paths missing")
need("setEnabled(bytes32 id, bool enabled_) external onlyGovernance" in templates, "governance-only disable missing")
need("SECP256K1N_HALF" in erc20 and "(v!=27&&v!=28)" in erc20, "canonical permit signature enforcement missing")
need("block.chainid,address(this)" in erc20, "permit domain separation missing")

app = next((x for x in apps.get("apps", []) if x.get("name") == "420 Token"), None)
need(app is not None and app.get("class") == "GENESIS_PROTOCOL_AND_USER_APP" and app.get("contracts_required") is True, "Genesis Token app definition drift")
resolved = next((x for x in canon.get("registry_resolved", []) if x.get("id") == "token-factory"), None)
need(resolved is not None and resolved.get("contract") == "TokenFactory420.sol", "canonical token-factory resolution missing")
ns = next((x for x in namespace.get("registryResolved", []) if x.get("id") == "token-factory"), None)
need(ns is not None and ns.get("status") == "REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS", "Token address model drift")
need("historical 0x0455 candidate as active authority" in mat.get("forbidden", []), "retired Token address guard missing")
need(mat.get("service", {}).get("addressModel") == "REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS", "release address model drift")
need(mat.get("fixedAuthorities", {}).get("governanceTimelock") == "0x0000000000000000000000000000000000000429", "timelock authority drift")
need(mat.get("fixedAuthorities", {}).get("protocolRegistry") == "0x0000000000000000000000000000000000000434", "ProtocolRegistry authority drift")
need("function registerComponent(" in registry and "function publishRegisteredService(" in registry, "ProtocolRegistry publication API missing")
need("TOKEN_SERVICE_ID_420 = '420/service/token/v1'" in wallet, "Wallet Token runtime service id missing")
need("TOKEN_CREATION_FEE_WEI_420 = 42n * 10n ** 18n" in wallet, "Wallet exact fee constant missing")
need("prepareSmartAccountExecution" in handoff and "exactly 42 native 420" in handoff, "Wallet SmartAccount exact-fee handoff missing")
for forbidden in ("eth_sendTransaction", "privateKey", "signTransaction", "new Wallet("):
    need(forbidden not in handoff, f"Token handoff acquired independent signing authority: {forbidden}")

required = [
    "contracts/test/TokenGenesis420.t.sol",
    "contracts/test/TokenAudit420.t.sol",
    "contracts/test/TokenVaultIntegration420.t.sol",
    "contracts/test/TokenDeploymentBinding420.t.sol",
    "wallet/web/test/token-runtime.test.js",
    "docs/audit/420TOKEN-AUDIT-REMEDIATION-ROADMAP.md",
]
for path in required:
    need((ROOT / path).exists(), f"missing Token audit artifact: {path}")

need(ready.get("serviceId") == "420/service/token/v1", "readiness Token service mismatch")
if errors:
    for e in errors: print("ERROR:", e)
    sys.exit(1)
print("420Token repository audit contract: PASS")

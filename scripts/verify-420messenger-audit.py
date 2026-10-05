#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
errors = []

def require(path):
    p = ROOT / path
    if not p.is_file():
        errors.append(f"missing required file: {path}")
    return p

cfg_path = require("contracts/config/420messenger-genesis.json")
deploy_path = require("contracts/config/420messenger-deployment-v1.json")
map_path = require("contracts/config/genesis-dapp-contract-map.json")
namespace_path = require("contracts/config/genesis-address-namespace.json")
service_ids_path = require("contracts/src/libraries/ServiceIds420.sol")
readiness_path = require("testnet/public-services/messenger/readiness.json")
require("docs/420MESSENGER.md")
require("docs/420MESSENGER-ROADMAP.md")
require("docs/architecture/protocols/messenger-notifications-attention.md")
require("contracts/test/MessengerGenesis420.t.sol")
require("contracts/test/MessengerAudit420.t.sol")

contracts = [
    "MessengerIds420.sol",
    "MessengerAuthorization420.sol",
    "MessengerEndpointRegistry420.sol",
    "MessengerBlockRegistry420.sol",
    "MessengerConversationRegistry420.sol",
    "MessengerEnvelopeRegistry420.sol",
    "MessengerReceiptRegistry420.sol",
    "MessengerRouter420.sol",
]
for name in contracts:
    require("contracts/src/messenger/" + name)

if cfg_path.is_file():
    cfg = json.loads(cfg_path.read_text())
    if cfg.get("schema") != "420-messenger-genesis-v1" or cfg.get("version") != 1:
        errors.append("Messenger Genesis schema/version drifted")
    inv = cfg.get("invariants", [])
    if len(inv) != 12:
        errors.append(f"expected 12 MSG invariants, got {len(inv)}")
    for n in range(1, 13):
        token = f"MSG-INV-{n:03d}"
        if not any(str(x).startswith(token) for x in inv):
            errors.append("missing " + token)
    privacy = cfg.get("privacy_boundary", "")
    for token in ("Plaintext", "ciphertext", "attachments", "private keys", "decryption keys"):
        if token not in privacy:
            errors.append("privacy boundary missing " + token)

if map_path.is_file():
    mapping = json.loads(map_path.read_text())
    entry = next((x for x in mapping.get("apps", []) if x.get("dapp") == "420 Messenger"), None)
    if not entry:
        errors.append("420 Messenger missing from Genesis contract map")
    elif entry.get("contracts") != contracts:
        errors.append("420 Messenger contract map/order drifted")

if namespace_path.is_file():
    namespace = json.loads(namespace_path.read_text())
    entry = next((x for x in namespace.get("registryResolved", []) if x.get("id") == "messenger-router"), None)
    if not entry:
        # tolerate repositories that name the array differently; scan all list values
        entry = next((x for v in namespace.values() if isinstance(v, list) for x in v if isinstance(x, dict) and x.get("id") == "messenger-router"), None)
    if not entry:
        errors.append("messenger-router missing from Genesis address namespace")
    else:
        if entry.get("contract") != "MessengerRouter420.sol":
            errors.append("messenger-router contract drifted")
        if entry.get("status") != "REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS":
            errors.append("messenger-router address policy drifted")

if service_ids_path.is_file():
    service_ids = service_ids_path.read_text()
    if 'MESSENGER = keccak256("420/service/messenger/v1")' not in service_ids:
        errors.append("canonical Messenger service ID missing")

if deploy_path.is_file():
    deploy = json.loads(deploy_path.read_text())
    if deploy.get("serviceId") != "420/service/messenger/v1":
        errors.append("deployment service ID drifted")
    if deploy.get("addressPolicy") != "REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS":
        errors.append("deployment address policy drifted")
    names = [x.get("name") for x in deploy.get("contracts", [])]
    expected = [x.removesuffix(".sol") for x in contracts if x != "MessengerIds420.sol"]
    if names != expected:
        errors.append("deployment constructor graph inventory drifted")
    if deploy.get("registryPublication", {}).get("implementation") != "MessengerRouter420":
        errors.append("Registry publication target drifted")

if readiness_path.is_file():
    readiness = json.loads(readiness_path.read_text())
    if readiness.get("serviceId") != "420/service/messenger/v1":
        errors.append("readiness service ID drifted")
    if readiness.get("liveTestnetEvidence") is not False:
        errors.append("repository audit must not claim live testnet evidence")
    if readiness.get("genesisCloseout") is not False:
        errors.append("repository audit must not claim Genesis closeout")
    if readiness.get("productionReady") is not False:
        errors.append("repository audit must not claim production readiness")

auth = (ROOT / "contracts/src/messenger/MessengerAuthorization420.sol").read_text()
for token in ("COMPONENT_MESSENGER", "scopeForAccount(account)", "capabilityRegistry.isAuthorized"):
    if token not in auth:
        errors.append("authorization invariant missing: " + token)

conversation = (ROOT / "contracts/src/messenger/MessengerConversationRegistry420.sol").read_text()
for token in ("State { NONE, REQUESTED, ACTIVE, CLOSED }", "endpoints.isActive(initiator)", "endpoints.isActive(peer)", "PeerBlocked", "ConversationExists", "ConversationAccepted", "ConversationClosed"):
    if token not in conversation:
        errors.append("conversation invariant missing: " + token)

envelope = (ROOT / "contracts/src/messenger/MessengerEnvelopeRegistry420.sol").read_text()
for token in ("ACTION_SEND_MESSAGE", "lastSequence[conversationId][sender] + 1", "420/MESSENGER/ENVELOPE/V1", "blocks.blocked(sender, peer)", "blocks.blocked(peer, sender)"):
    if token not in envelope:
        errors.append("envelope invariant missing: " + token)

receipt = (ROOT / "contracts/src/messenger/MessengerReceiptRegistry420.sol").read_text()
for token in ("ACTION_ACK_MESSAGE", "recipient != expected", "r.deliveredAt == 0", "markRead && r.readAt == 0"):
    if token not in receipt:
        errors.append("receipt invariant missing: " + token)

router = (ROOT / "contracts/src/messenger/MessengerRouter420.sol").read_text()
for token in ("canRequest", "canSend", "!blocks.blocked(a,b)", "!blocks.blocked(b,a)"):
    if token not in router:
        errors.append("router invariant missing: " + token)

if errors:
    print("420Messenger audit qualification FAILED")
    for error in errors:
        print("- " + error)
    raise SystemExit(1)

print("420Messenger audit qualification PASS")
print("Canonical contract inventory: 8 files / 7 deployed contracts")
print("Address policy: REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS")
print("Live testnet evidence: false")

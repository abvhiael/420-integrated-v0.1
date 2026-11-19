#!/usr/bin/env python3
"""420Token V3 release materialization, read-only deployment planning, and local rehearsal."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[2]
C = ROOT / "contracts"
ZERO = "0x" + "00" * 32
TIMELOCK = "0x" + "00" * 18 + "0429"
REGISTRY = "0x" + "00" * 18 + "0434"
BOOTSTRAP = "0x" + "00" * 18 + "0437"
GENESIS = "0x94321abcd7016ec0494a2c616fdf55bf4e8815dcc0f92d03933b335630e25d6d"
NS = "REGISTRY_RESOLVED_NO_FIXED_GENESIS_ADDRESS"
SOURCES = {
    **{n: "src/token/" + n + ".sol" for n in (
        "TokenFactory420", "TokenTemplateRegistry420", "ERC20Template420",
        "ERC721Template420", "ERC1155Template420", "TokenIds420")},
    **{n: "src/vault/" + n + ".sol" for n in (
        "AssetVault420", "VaultRegistry420", "VaultAccounting420",
        "VaultAuthorization420", "VaultPolicyRegistry420")},
    "CapabilityRegistry420": "src/system/CapabilityRegistry420.sol",
    "GovernanceTimelock": "src/governance/GovernanceTimelock.sol",
    "ProtocolRegistry": "src/apps/ProtocolRegistry.sol",
}
ARGS = {
    "TokenFactory420": ["address", "address"],
    "TokenTemplateRegistry420": ["address"],
    "ERC20Template420": ["string", "string", "address", "uint256", "uint256", "bool", "bool", "bool", "bool", "bytes32"],
    "ERC721Template420": ["string", "string", "string", "address", "bytes32"],
    "ERC1155Template420": ["string", "address", "bytes32"],
    "TokenIds420": [],
    "AssetVault420": ["bytes32", "address", "address", "address", "address"],
    "VaultRegistry420": ["address", "address"],
    "VaultAccounting420": ["address"],
    "VaultAuthorization420": ["address"],
    "VaultPolicyRegistry420": ["address"],
    "CapabilityRegistry420": [],
    "GovernanceTimelock": ["address"],
    "ProtocolRegistry": ["address"],
}
VAULT_GRAPH = ["AssetVault420", "VaultRegistry420", "VaultAccounting420", "VaultAuthorization420",
               "VaultPolicyRegistry420", "CapabilityRegistry420"]
ORDER = ["GovernanceTimelock", "ProtocolRegistry", *VAULT_GRAPH,
         "TokenTemplateRegistry420", "TokenFactory420"]
IMPORT = re.compile(r"""(?:\bfrom\s+|\bimport\s+)["']([^"']+)["']""")


def require(ok, message):
    if not ok:
        raise RuntimeError(message)


def read(path):
    return json.loads(Path(path).read_text())


def write(path, value):
    Path(path).write_text(json.dumps(value, sort_keys=True, indent=2) + "\n")


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def cmd(*args, cwd=ROOT):
    return subprocess.check_output(list(map(str, args)), cwd=cwd, text=True).strip()


def hexbytes(value):
    require(isinstance(value, str) and re.fullmatch(r"0x(?:[a-fA-F0-9]{2})*", value), "invalid hex")
    return bytes.fromhex(value[2:])


def keccak(value):
    return subprocess.check_output(["cast", "keccak"], input="0x" + value.hex() + "\n",
                                   text=True, cwd=ROOT).strip().lower()


def digest(value):
    return keccak(canonical(value))


def ident(value):
    return keccak(value.encode())


def sha(value):
    return hashlib.sha256(value).hexdigest()


def blob(path):
    data = Path(path).read_bytes()
    return hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()


def address(value):
    require(isinstance(value, str) and re.fullmatch(r"0x[0-9a-fA-F]{40}", value)
            and int(value, 16) != 0, "invalid address")
    return value.lower()


def hash32(value):
    require(isinstance(value, str) and re.fullmatch(r"0x[0-9a-fA-F]{64}", value)
            and int(value, 16) != 0, "invalid commitment")
    return value.lower()


def unreserved(value):
    a = address(value)
    require(not 0x420 <= int(a, 16) <= 0x4ff, "reserved or retired Genesis address: " + a)
    return a


def cast_args(args):
    return [str(v).lower() if isinstance(v, bool) else str(v) for v in args]


def calldata(signature, *args):
    return cmd("cast", "calldata", signature, *cast_args(args))


def encode(types, *args):
    return cmd("cast", "abi-encode", "f(" + ",".join(types) + ")", *cast_args(args))


def words(data):
    b = hexbytes(data)
    require(len(b) % 32 == 0, "non-word ABI output")
    return ["0x" + b[i:i+32].hex() for i in range(0, len(b), 32)]


def word_address(w):
    return address("0x" + w[-40:])


def word_int(w):
    return int(w, 16)


def authority():
    commitment = read(C / "config/genesis-config-commitment.json")
    payload = commitment["commitmentPayload"]
    require(commitment["status"] == "FROZEN_V3" and commitment["genesisConfigHash"] == GENESIS
            and digest(payload) == GENESIS, "V3 configuration commitment drift")
    for item in payload["authorityInputs"]:
        require(blob(ROOT / item["path"]) == item["gitBlobSha1"], "frozen authority blob drift: " + item["path"])
    require(payload["governanceTimelock"] == TIMELOCK and payload["protocolRegistry"] == REGISTRY, "anchor drift")
    ns = read(C / "config/genesis-address-namespace.json")
    fixed = {i["name"]: i["address"] for i in ns["fixedAssignments"]}
    require(fixed["GovernanceTimelock"] == TIMELOCK and fixed["ProtocolRegistry"] == REGISTRY, "fixed namespace drift")
    require(not any(n in fixed for n in SOURCES if n.startswith("Token") or n.startswith("ERC")), "Token predeploy invented")
    require(any(x["id"] == "token-factory" and x["status"] == NS for x in ns["registryResolved"]), "Token namespace drift")
    residents = read(C / "artifacts/genesis-residents/v3/manifest.json")
    require(residents["genesis_config_hash"] == GENESIS, "resident manifest V3 drift")
    require(not any(n in residents["residents"] for n in ("TokenFactory420", "TokenTemplateRegistry420"))
            and not any(x.get("materialized") for n, x in residents["constructor_inventory"].items()
                    if n in ("TokenFactory420", "TokenTemplateRegistry420")), "Token resident invented")
    token = read(C / "config/420token-genesis.json")
    release = read(C / "config/token/token-audit-4-release-materialization.json")
    require(token["creationFeeNative420"] == "42" and token["communityTreasuryVaultId"] ==
            "420/treasury/vault/token-creation-community-revenue/v1", "economic authority drift")
    require(len(token["templates"]) == 8 and token["deployment"]["addressModel"] == NS
            and token["deployment"]["componentId"] == release["service"]["componentIdPreimage"]
            and token["serviceId"] == release["service"]["serviceId"], "catalog/service authority drift")
    require(release["service"]["addressModel"] == NS and release["service"]["implementation"] == "TokenFactory420"
            and release["fixedAuthorities"] == {"governanceTimelock": TIMELOCK, "protocolRegistry": REGISTRY},
            "release materialization drift")
    require(release["status"] == "REPOSITORY_CANDIDATE_NOT_LIVE_DEPLOYMENT", "unexpected live claims")
    return commitment, token, release


def stage(dest):
    hashes = {}
    pending = [C / p for p in SOURCES.values()]
    while pending:
        source = pending.pop().resolve()
        require(source.is_relative_to(C) and source.is_file(), "unresolved source " + str(source))
        rel = source.relative_to(C).as_posix()
        if rel in hashes:
            continue
        data = source.read_bytes()
        hashes[rel] = sha(data)
        target = dest / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        for imp in IMPORT.findall(data.decode()):
            require(imp.startswith("."), "nonrelative import " + imp)
            pending.append(source.parent / imp)
    shutil.copyfile(C / "foundry.toml", dest / "foundry.toml")
    hashes["foundry.toml"] = sha((C / "foundry.toml").read_bytes())
    return hashes


def refs_valid(runtime, refs):
    occupied = set()
    for group in refs.values():
        require(bool(group), "empty immutable group")
        for ref in group:
            start, length = ref["start"], ref["length"]
            require(isinstance(start, int) and length == 32 and 0 <= start <= len(runtime)-length,
                    "invalid immutable reference")
            new = set(range(start, start+length))
            require(not occupied.intersection(new), "overlapping immutable references")
            occupied.update(new)


def artifact(dest, name):
    a = read(dest / "out" / (name + ".sol") / (name + ".json"))
    creation, runtime = a["bytecode"]["object"], a["deployedBytecode"]["object"]
    require(bool(hexbytes(creation)) and bool(hexbytes(runtime)), "empty bytecode " + name)
    require(not a["bytecode"].get("linkReferences") and not a["deployedBytecode"].get("linkReferences"),
            "unresolved libraries " + name)
    refs = a["deployedBytecode"].get("immutableReferences", {})
    refs_valid(hexbytes(runtime), refs)
    layout = a["storageLayout"]
    require(isinstance(layout["storage"], list) and "types" in layout, "missing storage layout " + name)
    meta = a["metadata"]
    if isinstance(meta, str):
        meta = json.loads(meta)
    settings = meta["settings"]
    require(meta["compiler"]["version"].startswith("0.8.24+") and settings["evmVersion"] == "cancun"
            and settings["optimizer"]["enabled"] is True and settings["optimizer"]["runs"] == 200
            and settings["viaIR"] is True,
            "compiler/profile drift " + name)
    constructors = [x for x in a["abi"] if x["type"] == "constructor"]
    types = [x["type"] for x in constructors[0]["inputs"]] if constructors else []
    require(types == ARGS[name], "constructor ABI mismatch " + name)
    return {"name": name, "source": SOURCES[name], "abi": a["abi"], "creation": creation,
            "runtime": runtime, "immutableReferences": refs, "storageLayout": layout,
            "constructorTypes": types, "compiler": meta["compiler"]["version"],
            "settings": settings, "abiHash": digest(a["abi"]), "creationHash": keccak(hexbytes(creation)),
            "runtimeTemplateHash": keccak(hexbytes(runtime)), "storageLayoutHash": digest(layout),
            "immutableReferencesHash": digest(refs)}


def masked(code, refs, template):
    b, t = bytearray(hexbytes(code)), hexbytes(template)
    require(len(b) == len(t), "runtime length mismatch")
    refs_valid(t, refs)
    for group in refs.values():
        for r in group:
            start, length = r["start"], r["length"]
            b[start:start+length] = t[start:start+length]
    return bytes(b)


def runtime_match(a, code):
    require(masked(code, a["immutableReferences"], a["runtime"]) == hexbytes(a["runtime"]),
            "runtime template mismatch " + a["name"])


def normalized_layout(layout):
    types = layout.get("types") or {}
    def describe(key):
        t = types[key]
        out = {k: t[k] for k in ("encoding", "label", "numberOfBytes") if k in t}
        for k in ("base", "key", "value"):
            if k in t:
                out[k] = describe(t[k])
        if "members" in t:
            out["members"] = [entry(m) for m in t["members"]]
        return out
    def entry(v):
        return {"label": v["label"], "slot": v["slot"], "offset": v["offset"], "type": describe(v["type"])}
    return [entry(v) for v in layout["storage"]]


def executable_bytes(code):
    raw = hexbytes(code)
    length = int.from_bytes(raw[-2:], "big")
    require(0 < length + 2 < len(raw), "invalid compiler metadata suffix")
    return raw[:-length-2]


def materialize(dest):
    commitment, token, release = authority()
    hashes = stage(dest)
    subprocess.run(["forge", "build", "--root", str(dest), "--extra-output", "storageLayout"],
                   cwd=dest, env=dict(os.environ, FOUNDRY_PROFILE="ci", NO_COLOR="1"), check=True)
    artifacts = {n: artifact(dest, n) for n in SOURCES}
    anchors = {}
    for name, addr in [("GovernanceTimelock", TIMELOCK), ("ProtocolRegistry", REGISTRY)]:
        art = read(C / "artifacts" / (name + ".json"))
        state = read(C / "config/predeploy" / (name + "-predeploy-state.json"))
        code = art["deployedBytecode"]
        require(state["address"] == addr and state["runtimeCodeHash"] == art["runtimeCodeHash"]
                == keccak(hexbytes(code)), "retained anchor runtime/state mismatch")
        require(art["sourceBlobSha1"] == blob(C / SOURCES[name]), "retained anchor source mismatch")
        fresh = artifacts[name]
        require(sorted(map(canonical, art["abi"])) == sorted(map(canonical, fresh["abi"])), "anchor ABI mismatch")
        require(normalized_layout(art["storageLayout"]) == normalized_layout(fresh["storageLayout"]),
                "anchor storage layout mismatch")
        # Compare executable code independently of compiler metadata and AST-numbered immutable keys.
        # Historical Genesis artifacts use materialized constructor words, not placeholder words.
        old = bytearray(executable_bytes(code))
        new = bytearray(executable_bytes(fresh["runtime"]))
        old_locations = sorted((r["start"], r["length"]) for g in art["immutableReferences"].values() for r in g)
        new_locations = sorted((r["start"], r["length"]) for g in fresh["immutableReferences"].values() for r in g)
        require(old_locations == new_locations, "anchor immutable positions changed")
        for start, length in new_locations:
            old[start:start+length] = new[start:start+length]
        require(old == new, "anchor executable drift " + name)
        anchors[name] = {"address": addr, "runtime": code, "runtimeCodeHash": art["runtimeCodeHash"],
                         "storage": state["storage"], "abi": art["abi"], "storageLayout": art["storageLayout"],
                         "immutableReferences": art["immutableReferences"], "sourceBlobSha1": art["sourceBlobSha1"],
                         "artifactHash": digest(art), "predeployStateHash": digest(state)}
    factory_abi = artifacts["TokenFactory420"]["abi"]
    fn = {x["name"]: [i["type"] for i in x["inputs"]] for x in factory_abi if x["type"] == "function"}
    require(fn["createERC20"] == ["bytes32", "string", "string", "uint256", "uint256", "bytes32"]
            and fn["createERC721"] == ["string", "string", "string", "bytes32"]
            and fn["createERC1155"] == ["string", "bytes32"], "factory ABI drift")
    require(any(x.get("name") == "uri" and [i["type"] for i in x["inputs"]] == ["uint256"]
                for x in artifacts["ERC1155Template420"]["abi"]), "ERC1155 metadata ABI drift")
    require(len(hexbytes(artifacts["TokenFactory420"]["runtime"])) <= 24576
            and len(hexbytes(artifacts["TokenFactory420"]["creation"])) + 64 <= 49152, "factory bytecode size limit")
    for path, h in hashes.items():
        require(sha((dest / path).read_bytes()) == h and sha((C / path).read_bytes()) == h, "source drift " + path)
    metadata = {"serviceId": ident(token["serviceId"]), "componentId": ident(token["deployment"]["componentId"]),
                "version": 1, "name": token["name"], "genesisConfigHash": GENESIS,
                "vaultId": ident(token["communityTreasuryVaultId"]), "creationFee": str(42 * 10**18),
                "addressModel": NS, "templates": token["templates"]}
    payload = {"schema": "420-token-v3-release-v1", "metadata": metadata,
               "authorityInputs": commitment["commitmentPayload"]["authorityInputs"], "sourceClosure": hashes,
               "anchors": anchors, "artifacts": artifacts, "deploymentOrder": release["deploymentOrder"],
               "dependencyRootOrder": ORDER, "liveQualified": False}
    return {**payload, "manifestHash": digest(payload), "metadataHash": digest(metadata),
            "interfaceHash": artifacts["TokenFactory420"]["abiHash"]}


def validate(bundle):
    payload = {k: v for k, v in bundle.items() if k not in ("manifestHash", "metadataHash", "interfaceHash")}
    require(bundle["schema"] == "420-token-v3-release-v1" and bundle["liveQualified"] is False
            and digest(payload) == bundle["manifestHash"] and digest(bundle["metadata"]) == bundle["metadataHash"]
            and bundle["interfaceHash"] == bundle["artifacts"]["TokenFactory420"]["abiHash"], "bundle commitment mismatch")
    commitment, token, _ = authority()
    require(bundle["authorityInputs"] == commitment["commitmentPayload"]["authorityInputs"]
            and bundle["metadata"]["genesisConfigHash"] == GENESIS
            and bundle["metadata"]["serviceId"] == ident(token["serviceId"])
            and bundle["metadata"]["componentId"] == ident(token["deployment"]["componentId"])
            and bundle["metadata"]["vaultId"] == ident(token["communityTreasuryVaultId"])
            and bundle["metadata"]["creationFee"] == str(42 * 10**18)
            and bundle["dependencyRootOrder"] == ORDER, "bundle authority mismatch")
    for p, h in bundle["sourceClosure"].items():
        require(sha((C / p).read_bytes()) == h, "bundle source drift " + p)
    for n in SOURCES:
        a = bundle["artifacts"][n]
        require(a["name"] == n and a["source"] == SOURCES[n] and a["constructorTypes"] == ARGS[n]
                and digest(a["abi"]) == a["abiHash"] and digest(a["storageLayout"]) == a["storageLayoutHash"]
                and digest(a["immutableReferences"]) == a["immutableReferencesHash"]
                and keccak(hexbytes(a["creation"])) == a["creationHash"]
                and keccak(hexbytes(a["runtime"])) == a["runtimeTemplateHash"], "artifact commitment mismatch " + n)
        refs_valid(hexbytes(a["runtime"]), a["immutableReferences"])
    for n, addr in [("GovernanceTimelock", TIMELOCK), ("ProtocolRegistry", REGISTRY)]:
        a = bundle["anchors"][n]
        retained = read(C / "artifacts" / (n + ".json"))
        state = read(C / "config/predeploy" / (n + "-predeploy-state.json"))
        require(a["address"] == addr and a["runtime"] == retained["deployedBytecode"]
                and a["runtimeCodeHash"] == state["runtimeCodeHash"] == keccak(hexbytes(a["runtime"]))
                and a["storage"] == state["storage"], "anchor commitment drift")
    return bundle


def initdata(bundle, name, args):
    a = bundle["artifacts"][name]
    return a["creation"] + (encode(a["constructorTypes"], *args)[2:] if args else "")


class RPC:
    def __init__(self, url):
        self.url = url
        self.seq = 0

    def call(self, method, *params):
        self.seq += 1
        body = json.dumps({"jsonrpc": "2.0", "id": self.seq, "method": method, "params": list(params)}).encode()
        req = urllib.request.Request(self.url, body, {"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=30) as response:
            obj = json.load(response)
        if "error" in obj:
            raise RuntimeError(method + ": " + str(obj["error"]))
        return obj["result"]

    def code(self, addr):
        return self.call("eth_getCode", addr, "latest")

    def view(self, addr, signature, *args):
        return words(self.call("eth_call", {"to": addr, "data": calldata(signature, *args)}, "latest"))

    def balance(self, addr):
        return int(self.call("eth_getBalance", addr, "latest"), 16)

    def nonce(self, addr):
        return int(self.call("eth_getTransactionCount", addr, "latest"), 16)

    def send(self, sender, data, to=None, value=0):
        tx = {"from": sender, "data": data, "gas": hex(15_000_000), "value": hex(value)}
        if to:
            tx["to"] = to
        tx_hash = self.call("eth_sendTransaction", tx)
        receipt = self.call("eth_getTransactionReceipt", tx_hash)
        if not receipt or int(receipt["status"], 16) != 1:
            print(json.dumps({"failed_transaction": tx_hash, "sender": sender, "to": to,
                              "dataHash": keccak(hexbytes(data)), "initcodeBytes": len(hexbytes(data)),
                              "value": value, "receipt": receipt}), flush=True)
            try:
                trace = self.call("debug_traceTransaction", tx_hash, {"disableMemory": True, "disableStorage": True})
                ops = trace.get("structLogs", [])
                tail = [{**{k: entry.get(k) for k in ("pc", "op", "gas", "gasCost", "depth", "error")},
                         "lastStack": entry.get("stack", [])[-6:]} for entry in ops[-20:]]
                print(json.dumps({"transactionTrace": {k: v for k, v in trace.items() if k != "structLogs"},
                                  "lastInstructions": tail}), flush=True)
            except Exception as error:
                print("Trace unavailable: " + str(error), flush=True)
            raise RuntimeError("transaction failed " + tx_hash)
        return receipt

    def reject(self, sender, to, data, value=0):
        try:
            self.call("eth_call", {"from": sender, "to": to, "data": data, "value": hex(value)}, "latest")
        except RuntimeError as error:
            require("revert" in str(error).lower(), "unexpected RPC error " + str(error))
            return
        raise RuntimeError("expected revert")


def create_address(sender, nonce):
    def rlp(b):
        return b if len(b) == 1 and b[0] < 128 else bytes([128 + len(b)]) + b
    nb = nonce.to_bytes((nonce.bit_length() + 7)//8, "big")
    data = rlp(hexbytes(sender)) + rlp(nb)
    return "0x" + keccak(bytes([192 + len(data)]) + data)[-40:]


def verify_runtime(rpc, bundle, name, addr, args, sender):
    actual = rpc.code(addr)
    runtime_match(bundle["artifacts"][name], actual)
    # Constructor execution returns the actual materialized runtime, including
    # the optimizer's transformed immutable words. Masking alone is not sufficient.
    expected = rpc.call("eth_call", {"from": sender, "data": initdata(bundle, name, args),
                                    "gas": hex(15_000_000)}, "latest")
    require(actual.lower() == expected.lower(), "constructor runtime mismatch " + name)
    return keccak(hexbytes(actual))


def deploy(rpc, bundle, name, sender, args):
    nonce = rpc.nonce(sender)
    predicted = unreserved(create_address(sender, nonce))
    data = initdata(bundle, name, args)
    expected_runtime = rpc.call("eth_call", {"from": sender, "data": data, "gas": hex(15_000_000)}, "latest")
    print(json.dumps({"deploying": name, "predicted": predicted, "nonce": nonce,
                      "creationBytes": len(hexbytes(data)), "runtimeBytes": len(hexbytes(expected_runtime))}),
          flush=True)
    receipt = rpc.send(sender, data)
    actual = address(receipt["contractAddress"])
    require(actual == predicted, "CREATE address mismatch " + name)
    tx = rpc.call("eth_getTransactionByHash", receipt["transactionHash"])
    require(tx["input"].lower() == data.lower() and tx["to"] is None and int(tx["nonce"], 16) == nonce
            and address(tx["from"]) == sender, "deployment transaction mismatch")
    code = rpc.code(actual)
    runtime_match(bundle["artifacts"][name], code)
    require(code.lower() == expected_runtime.lower(), "materialized constructor mismatch " + name)
    return {"address": actual, "runtimeCodeHash": keccak(hexbytes(code)), "constructorArgs": args,
            "creationInputHash": keccak(hexbytes(data)), "nonce": nonce,
            "transactionHash": receipt["transactionHash"], "blockHash": receipt["blockHash"],
            "blockNumber": receipt["blockNumber"]}


def check_getter(rpc, addr, signature, expected):
    out = rpc.view(addr, signature)
    require(len(out) == 1 and word_address(out[0]) == expected, "immutable getter mismatch " + signature)


def anchor_check(rpc, bundle):
    for name, a in bundle["anchors"].items():
        require(rpc.code(a["address"]).lower() == a["runtime"].lower(), "anchor runtime mismatch " + name)
    check_getter(rpc, REGISTRY, "governanceTimelock()", TIMELOCK)
    require(word_int(rpc.view(REGISTRY, "protocolVersion()")[0]) == 4, "Registry version drift")


def verify_vault(rpc, bundle, binding):
    require(str(binding["chainId"]) in ("420", "31337")
            and str(int(rpc.call("eth_chainId"), 16)) == str(binding["chainId"])
            and rpc.call("eth_getBlockByNumber", "0x0", False)["hash"].lower() == hash32(binding["genesisHash"]),
            "wrong chain or genesis")
    anchor_check(rpc, bundle)
    graph = binding["vaultGraph"]
    require(set(graph) == set(VAULT_GRAPH), "incomplete vault graph")
    addresses = {n: unreserved(graph[n]["address"]) for n in VAULT_GRAPH}
    require(len(set(addresses.values())) == len(addresses), "aliased vault dependency")
    for name in VAULT_GRAPH:
        a = graph[name]
        code = rpc.code(addresses[name])
        runtime_match(bundle["artifacts"][name], code)
        require(keccak(hexbytes(code)) == hash32(a["runtimeCodeHash"]), "untrusted dependency runtime " + name)
    v, r, l, a, p, c = [addresses[n] for n in VAULT_GRAPH]
    metadata = bundle["metadata"]
    for addr, getter, expected in [(v, "registry()", r), (v, "accounting()", l),
            (v, "authorization()", a), (r, "authorization()", a), (r, "policies()", p),
            (l, "registry()", r), (a, "capabilityRegistry()", c), (p, "governanceTimelock()", TIMELOCK)]:
        check_getter(rpc, addr, getter, expected)
    creator = address(binding["registrationCreator"])
    check_getter(rpc, v, "registrationCreator()", creator)
    require(rpc.view(v, "vaultId()")[0] == metadata["vaultId"], "wrong vault id")
    require(rpc.view(r, "vaultIdForAddress(address)", v)[0] == metadata["vaultId"], "wrong reverse registration")
    record = rpc.view(r, "getVault(bytes32)", metadata["vaultId"])
    require(len(record) == 14 and word_address(record[0]) == v and word_address(record[1]) == creator
            and record[2] == ident("420/VAULT/TYPE/COMMUNITY/V1") and record[3:7] == binding["policyIds"]
            and record[7] == binding["beneficiarySetId"] and record[8] == hash32(binding["vaultMetadataHash"])
            and record[9] == hash32(binding["vaultManifestHash"]) and word_int(record[12]) == 1
            and word_int(record[13]) == 1, "incorrect registered community vault")
    for i, label in enumerate(("AUTHORIZATION", "ASSET", "RELEASE", "ACCOUNTING")):
        require(word_int(rpc.view(p, "isActiveOfType(bytes32,bytes32)", binding["policyIds"][i],
                                  ident("420/VAULT/POLICY/" + label + "/V1"))[0]) == 1, "inactive/wrong vault policy")
    return addresses


def make_plan(rpc, bundle, binding):
    graph = verify_vault(rpc, bundle, binding)
    sender = unreserved(binding["deployer"])
    nonce = rpc.nonce(sender)
    t = unreserved(create_address(sender, nonce))
    f = unreserved(create_address(sender, nonce + 1))
    require(len(set([t, f, sender, *graph.values()])) == 3 + len(graph), "deployment address alias")
    require(rpc.code(t) == rpc.code(f) == "0x", "deployment address occupied")
    require(rpc.view(REGISTRY, "currentVersion(bytes32)", bundle["metadata"]["serviceId"])[0] == ZERO
            and rpc.view(REGISTRY, "currentComponentRevision(bytes32)", bundle["metadata"]["componentId"])[0] == ZERO,
            "existing service/component: V1 initial release plan must not replace it")
    deployments = [{"name": "TokenTemplateRegistry420", "address": t, "nonce": nonce, "args": [TIMELOCK]},
                   {"name": "TokenFactory420", "address": f, "nonce": nonce + 1, "args": [t, graph["AssetVault420"]]}]
    for dep in deployments:
        dep["data"] = initdata(bundle, dep["name"], dep["args"])
    plan = {"schema": "420-token-v3-unsigned-create-plan-v1", "manifestHash": bundle["manifestHash"],
            "binding": binding, "deployments": deployments}
    return {**plan, "planHash": digest(plan)}


def publication(rpc, bundle, plan, receipts):
    require(digest({k: v for k, v in plan.items() if k != "planHash"}) == plan["planHash"]
            and plan["manifestHash"] == bundle["manifestHash"], "plan commitment mismatch")
    graph = verify_vault(rpc, bundle, plan["binding"])
    sender = address(plan["binding"]["deployer"])
    deps = plan["deployments"]
    require([d["name"] for d in deps] == ["TokenTemplateRegistry420", "TokenFactory420"]
            and len(receipts) == 2 and deps[1]["nonce"] == deps[0]["nonce"] + 1, "deployment order mismatch")
    t, f = [unreserved(d["address"]) for d in deps]
    require(deps[0]["args"] == [TIMELOCK] and deps[1]["args"] == [t, graph["AssetVault420"]],
            "constructor binding drift")
    require(len(set([t, f, sender, *graph.values()])) == 3 + len(graph), "deployment alias")
    hashes = {n: bundle["anchors"][n]["runtimeCodeHash"] for n in ("GovernanceTimelock", "ProtocolRegistry")}
    addresses = {"GovernanceTimelock": TIMELOCK, "ProtocolRegistry": REGISTRY, **graph}
    hashes.update({n: plan["binding"]["vaultGraph"][n]["runtimeCodeHash"] for n in VAULT_GRAPH})
    previous_order = None
    for d, tx_hash in zip(deps, receipts):
        name, addr, args = d["name"], d["address"], d["args"]
        tx_hash = hash32(tx_hash)
        tx = rpc.call("eth_getTransactionByHash", tx_hash)
        rec = rpc.call("eth_getTransactionReceipt", tx_hash)
        require(tx and rec and int(rec["status"], 16) == 1 and rec["transactionHash"] == tx_hash
                and tx["hash"] == tx_hash and address(tx["from"]) == sender and address(rec["from"]) == sender
                and tx["to"] is None and rec["to"] is None and int(tx["value"], 16) == 0
                and int(tx["nonce"], 16) == d["nonce"] and address(rec["contractAddress"]) == addr
                and create_address(sender, d["nonce"]) == addr and tx["input"].lower() == d["data"].lower()
                == initdata(bundle, name, args).lower() and tx["blockHash"] == rec["blockHash"],
                "wrong or failed deployment receipt " + name)
        block = rpc.call("eth_getBlockByNumber", rec["blockNumber"], False)
        require(block["hash"] == rec["blockHash"] and block["transactions"][int(rec["transactionIndex"], 16)] == tx_hash,
                "orphan deployment receipt")
        order = (int(rec["blockNumber"], 16), int(rec["transactionIndex"], 16))
        require(previous_order is None or previous_order < order, "wrong deployment execution order")
        previous_order = order
        addresses[name] = addr
        hashes[name] = verify_runtime(rpc, bundle, name, addr, args, sender)
    check_getter(rpc, t, "governanceTimelock()", TIMELOCK)
    check_getter(rpc, f, "templates()", t)
    check_getter(rpc, f, "communityTreasuryVault()", graph["AssetVault420"])
    require(word_int(rpc.view(f, "CREATION_FEE()")[0]) == 42 * 10**18, "fee drift")
    m = bundle["metadata"]
    require(rpc.view(REGISTRY, "currentVersion(bytes32)", m["serviceId"])[0] == ZERO
            and rpc.view(REGISTRY, "currentComponentRevision(bytes32)", m["componentId"])[0] == ZERO, "existing publication")
    root = keccak(hexbytes(encode(["bytes32", "bytes32"] + ["address", "bytes32"] * len(ORDER)
                                  + ["bytes32", "bytes32"],
                                  ident("420/TOKEN/RELEASE/DEPENDENCIES/V1"), GENESIS,
                                  *[v for n in ORDER for v in (addresses[n], hashes[n])],
                                  m["vaultId"], plan["binding"]["vaultManifestHash"])))
    register = calldata("registerComponent(bytes32,address,(uint16,uint16,uint16),uint8)", m["componentId"], f, "(1,0,0)", 2)
    publish = calldata("publishRegisteredService(bytes32,address,bytes32,uint32,bool,uint8,bytes32,bytes32,bytes32)",
                       m["serviceId"], f, bundle["metadataHash"], 1, True, 3, bundle["manifestHash"], root, bundle["interfaceHash"])
    return {"schema": "420-token-v3-governance-actions-v1", "governanceTimelock": TIMELOCK,
            "registry": REGISTRY, "factory": f, "addresses": addresses, "runtimeCodeHashes": hashes,
            "manifestHash": bundle["manifestHash"], "metadataHash": bundle["metadataHash"],
            "interfaceHash": bundle["interfaceHash"], "dependencyRoot": root,
            "actions": [{"target": REGISTRY, "value": 0, "data": register},
                        {"target": REGISTRY, "value": 0, "data": publish}]}


def check_publication(rpc, bundle, pub):
    m = bundle["metadata"]
    service = rpc.view(REGISTRY, "getService(bytes32)", m["serviceId"])
    require(len(service) == 6 and word_address(service[0]) == pub["factory"]
            and service[1] == pub["runtimeCodeHashes"]["TokenFactory420"]
            and service[2] == bundle["metadataHash"] and word_int(service[3]) == 1
            and word_int(service[5]) == 1, "service publication mismatch")
    profile = rpc.view(REGISTRY, "getRegistrationProfile(bytes32,uint32)", m["serviceId"], 1)
    require(profile == ["0x" + format(3, "064x"), bundle["manifestHash"], pub["dependencyRoot"], bundle["interfaceHash"]],
            "registration profile mismatch")
    component = rpc.view(REGISTRY, "component(bytes32)", m["componentId"])
    require(len(component) == 7 and component[0] == m["componentId"] and word_address(component[1]) == pub["factory"]
            and component[2] == service[1] and list(map(word_int, component[3:])) == [1, 0, 0, 2],
            "component registration mismatch")
    check_getter(rpc, REGISTRY, "governanceTimelock()", TIMELOCK)
    require(word_address(rpc.view(REGISTRY, "resolve(bytes32)", m["componentId"])[0]) == pub["factory"],
            "component resolution mismatch")
    active = rpc.view(REGISTRY, "resolveActive(bytes32)", m["serviceId"])
    require(word_address(active[0]) == pub["factory"] and word_int(active[1]) == 1, "service resolution mismatch")


def governed(rpc, sender, actions, prefix):
    # These are LOCAL bootstrap scheduling operations, not live approvals or decisions about governance class.
    ids = []
    txs = []
    for i, action in enumerate(actions):
        op = ident(prefix + "/" + str(i))
        ids.append(op)
        data = calldata("schedule(bytes32,address,uint256,bytes,uint8)", op, action["target"], action["value"], action["data"], 0)
        rpc.reject(sender, TIMELOCK, data)
        txs.append(rpc.send(BOOTSTRAP, data, TIMELOCK)["transactionHash"])
    rpc.reject(sender, TIMELOCK, calldata("execute(bytes32)", ids[0]))
    rpc.call("evm_increaseTime", 7 * 86400 + 10)
    rpc.call("evm_mine")
    for op in ids:
        txs.append(rpc.send(sender, calldata("execute(bytes32)", op), TIMELOCK)["transactionHash"])
        rpc.reject(sender, TIMELOCK, calldata("execute(bytes32)", op))
    return txs


def setup_rehearsal(rpc, bundle):
    sender, user = [address(x) for x in rpc.call("eth_accounts")[:2]]
    for a in bundle["anchors"].values():
        rpc.call("anvil_setCode", a["address"], a["runtime"])
        for slot, value in a["storage"].items():
            rpc.call("anvil_setStorageAt", a["address"], slot, value)
            require(rpc.call("eth_getStorageAt", a["address"], slot, "latest").lower() == value, "predeploy storage mismatch")
    anchor_check(rpc, bundle)
    check_getter(rpc, TIMELOCK, "bootstrapGovernor()", BOOTSTRAP)
    check_getter(rpc, TIMELOCK, "scheduler()", BOOTSTRAP)
    require(word_int(rpc.view(TIMELOCK, "civicAuthorityActivated()")[0]) == 0, "unexpected governance activation")
    rpc.call("anvil_setBalance", BOOTSTRAP, hex(1000 * 10**18))
    rpc.call("anvil_impersonateAccount", BOOTSTRAP)
    graph = {}
    def add(n, args):
        entry = deploy(rpc, bundle, n, sender, args)
        graph[n] = entry
        return entry["address"]
    caps = add("CapabilityRegistry420", [])
    auth = add("VaultAuthorization420", [caps])
    policy = add("VaultPolicyRegistry420", [TIMELOCK])
    registry = add("VaultRegistry420", [auth, policy])
    ledger = add("VaultAccounting420", [registry])
    vault = add("AssetVault420", [bundle["metadata"]["vaultId"], registry, auth, ledger, sender])
    policies = []
    actions = []
    for label in ("AUTHORIZATION", "ASSET", "RELEASE", "ACCOUNTING"):
        pid = ident("420/token/local/" + label)
        policies.append(pid)
        data = calldata("setPolicy(bytes32,bytes32,bytes32,bytes32,bool)", pid, ident("420/VAULT/POLICY/" + label + "/V1"),
                        ident("local-semantics/" + label), ZERO, True)
        actions.append({"target": policy, "value": 0, "data": data})
    policy_txs = governed(rpc, sender, actions, "local/token/policies")
    metadata_hash = ident("local/token/vault/metadata")
    manifest_hash = ident("local/token/vault/manifest")
    reg_data = calldata("registerVault(bytes32,address,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32)",
                        bundle["metadata"]["vaultId"], vault, ident("420/VAULT/TYPE/COMMUNITY/V1"),
                        *policies, ZERO, metadata_hash, manifest_hash)
    registered = rpc.send(sender, reg_data, registry)
    binding = {"chainId": "31337", "genesisHash": rpc.call("eth_getBlockByNumber", "0x0", False)["hash"],
               "deployer": sender, "registrationCreator": sender,
               "vaultGraph": {n: {"address": e["address"], "runtimeCodeHash": e["runtimeCodeHash"]} for n, e in graph.items()},
               "policyIds": policies, "beneficiarySetId": ZERO, "vaultMetadataHash": metadata_hash, "vaultManifestHash": manifest_hash}
    return sender, user, graph, binding, policy_txs, registered["transactionHash"]


def exercise_templates(rpc, bundle, pub, user):
    f = pub["factory"]
    vault = pub["addresses"]["AssetVault420"]
    ledger = pub["addresses"]["VaultAccounting420"]
    token_ids = ("erc20-fixed", "erc20-mintable", "erc20-capped", "erc20-burnable", "erc20-permit",
                 "erc20-votes", "erc721-collection", "erc1155-multi")
    results = []
    for i, label in enumerate(token_ids):
        tid = ident("420/token/template/" + label + "/v1")
        salt = ident("local/token/salt/" + label)
        if i < 6:
            cap = 200 if i == 2 else 0
            data = calldata("createERC20(bytes32,string,string,uint256,uint256,bytes32)", tid, "Rehearsal", "RHR", 100, cap, salt)
            name = "ERC20Template420"
            args = ["Rehearsal", "RHR", user, 100, cap, i in (1, 2), i == 3, i in (4, 5), i == 5, tid]
        elif i == 6:
            data = calldata("createERC721(string,string,string,bytes32)", "Rehearsal", "RHR", "ipfs://nft", salt)
            name, args = "ERC721Template420", ["Rehearsal", "RHR", "ipfs://nft", user, tid]
        else:
            data = calldata("createERC1155(string,bytes32)", "ipfs://{id}", salt)
            name, args = "ERC1155Template420", ["ipfs://{id}", user, tid]
        rpc.reject(user, f, data, 42 * 10**18 - 1)
        before = rpc.balance(vault)
        receipt = rpc.send(user, data, f, 42 * 10**18)
        event = [e for e in receipt["logs"] if e["address"].lower() == f and e["topics"][0] ==
                 ident("TokenDeployed(address,address,bytes32,uint32,bytes32,uint256)")]
        require(len(event) == 1 and event[0]["topics"][3] == tid and word_address(event[0]["topics"][2]) == user,
                "template deployment event mismatch")
        addr = word_address(event[0]["topics"][1])
        salt_effective = keccak(hexbytes(encode(["address", "bytes32", "bytes32", "uint256"], user, salt, tid, i)))
        predicted = "0x" + keccak(b"\xff" + hexbytes(f) + hexbytes(salt_effective) +
                                 hexbytes(keccak(hexbytes(initdata(bundle, name, args)))))[-40:]
        require(predicted == addr, "template CREATE2 address mismatch")
        h = verify_runtime(rpc, bundle, name, addr, args, user)
        check_getter(rpc, addr, "owner()", user)
        require(rpc.view(addr, "templateId()")[0] == tid and word_int(rpc.view(f, "isFactoryDeployment(address)", addr)[0]) == 1,
                "template provenance mismatch")
        require(rpc.balance(vault) - before == 42 * 10**18 and rpc.balance(f) == 0, "fee mismatch")
        accounting = rpc.view(ledger, "getAccounting(bytes32,address)", bundle["metadata"]["vaultId"], "0x" + "00"*20)
        require(list(map(word_int, accounting)) == [(i+1)*42*10**18, 0, 0, 0], "accounting mismatch")
        require(word_int(rpc.view(f, "creatorNonce(address)", user)[0]) == i+1
                and word_int(rpc.view(f, "deploymentCount()")[0]) == i+1, "deployment count mismatch")
        results.append({"template": label, "address": addr, "runtimeCodeHash": h, "transactionHash": receipt["transactionHash"]})
    return results


def rehearsal(bundle, port):
    with tempfile.TemporaryDirectory(prefix="token-anvil-") as folder:
        log = Path(folder) / "anvil.log"
        with log.open("w") as stream:
            proc = subprocess.Popen(["anvil", "--host", "127.0.0.1", "--port", str(port), "--chain-id", "31337",
                                     "--timestamp", "1700000000", "--hardfork", "cancun",
                                     "--accounts", "3", "--balance", "10000", "--silent"],
                                    stdout=stream, stderr=subprocess.STDOUT)
            try:
                rpc = RPC("http://127.0.0.1:" + str(port))
                for _ in range(100):
                    try:
                        require(int(rpc.call("eth_chainId"), 16) == 31337, "unexpected rehearsal chain")
                        break
                    except (OSError, RuntimeError):
                        require(proc.poll() is None, "anvil terminated")
                        time.sleep(0.1)
                else:
                    raise RuntimeError("anvil did not start")
                sender, user, graph, binding, policy_txs, registration_tx = setup_rehearsal(rpc, bundle)
                plan = make_plan(rpc, bundle, binding)
                # An independently selected wrong binding fails admission before construction.
                invalid = json.loads(json.dumps(binding))
                invalid["vaultGraph"]["AssetVault420"]["runtimeCodeHash"] = ident("wrong runtime")
                try:
                    make_plan(rpc, bundle, invalid)
                except RuntimeError as error:
                    require("untrusted dependency runtime" in str(error), "wrong rejection reason")
                else:
                    raise RuntimeError("spoofed runtime admitted")
                deps = []
                for d in plan["deployments"]:
                    e = deploy(rpc, bundle, d["name"], sender, d["args"])
                    require(e["address"] == d["address"] and e["nonce"] == d["nonce"]
                            and e["creationInputHash"] == keccak(hexbytes(d["data"])), "plan execution mismatch")
                    deps.append(e)
                receipts = [e["transactionHash"] for e in deps]
                pub = publication(rpc, bundle, plan, receipts)
                for action in pub["actions"]:
                    rpc.reject(user, action["target"], action["data"])
                txs = governed(rpc, sender, pub["actions"], "local/token/publication")
                check_publication(rpc, bundle, pub)
                tokens = exercise_templates(rpc, bundle, pub, user)
                return {"chainId": 31337, "localOnly": True, "binding": binding, "vaultDeployments": graph,
                        "plan": plan, "deployments": deps, "publication": pub,
                        "policyGovernanceTransactions": policy_txs, "vaultRegistrationTransaction": registration_tx,
                        "publicationGovernanceTransactions": txs, "tokens": tokens,
                        "recordedCreationFees": str(336 * 10**18)}
            finally:
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    proc.wait()


def deterministic_view(run):
    return {"addresses": run["publication"]["addresses"], "runtimeCodeHashes": run["publication"]["runtimeCodeHashes"],
            "dependencyRoot": run["publication"]["dependencyRoot"], "actions": run["publication"]["actions"],
            "creationInputs": [e["creationInputHash"] for e in run["deployments"]],
            "tokens": [{k: v for k, v in x.items() if k != "transactionHash"} for x in run["tokens"]],
            "recordedCreationFees": run["recordedCreationFees"]}


def qualify(output):
    expected = os.environ.get("EXPECTED_SHA")
    head = cmd("git", "rev-parse", "HEAD")
    require(not expected or head == expected, "qualification checkout mismatch")
    output.mkdir(parents=True, exist_ok=False)
    with tempfile.TemporaryDirectory(prefix="token-build-a-") as a, tempfile.TemporaryDirectory(prefix="token-build-b-") as b:
        first = materialize(Path(a))
        second = materialize(Path(b))
        require(first == second, "independent build materialization not reproducible")
    write(output / "release-bundle.json", first)
    run1 = rehearsal(first, 18545)
    run2 = rehearsal(second, 18546)
    require(deterministic_view(run1) == deterministic_view(run2), "independent local deployment drift")
    write(output / "local-rehearsal-a.json", run1)
    write(output / "local-rehearsal-b.json", run2)
    for name, a in first["artifacts"].items():
        require(a["creationHash"] == second["artifacts"][name]["creationHash"], "creation hash drift")
    evidence = {"head": head, "status": "PASS", "genesisConfigHash": GENESIS,
                "manifestHash": first["manifestHash"], "metadataHash": first["metadataHash"],
                "interfaceHash": first["interfaceHash"], "sourceClosure": first["sourceClosure"],
                "artifactCommitments": {n: {k: a[k] for k in ("abiHash", "creationHash", "runtimeTemplateHash",
                                      "storageLayoutHash", "immutableReferencesHash")} for n, a in first["artifacts"].items()},
                "anchorRuntimeHashes": {n: a["runtimeCodeHash"] for n, a in first["anchors"].items()},
                "reproducibleBuilds": 2, "reproducibleLocalEVMs": 2, "verifiedTemplatesPerRun": 8,
                "localResult": deterministic_view(run1), "liveQualified": False}
    write(output / "qualification.json", evidence)
    print(json.dumps(evidence, sort_keys=True), flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    q = sub.add_parser("qualify")
    q.add_argument("output", type=Path)
    m = sub.add_parser("materialize")
    m.add_argument("output", type=Path)
    p = sub.add_parser("plan")
    p.add_argument("bundle", type=Path)
    p.add_argument("binding", type=Path)
    p.add_argument("output", type=Path)
    p.add_argument("--rpc", required=True)
    r = sub.add_parser("publication")
    r.add_argument("bundle", type=Path)
    r.add_argument("plan", type=Path)
    r.add_argument("output", type=Path)
    r.add_argument("--rpc", required=True)
    r.add_argument("--receipts", nargs=2, required=True)
    args = parser.parse_args()
    if args.command == "qualify":
        qualify(args.output)
    elif args.command == "materialize":
        with tempfile.TemporaryDirectory(prefix="token-build-") as dest:
            write(args.output, materialize(Path(dest)))
    elif args.command == "plan":
        write(args.output, make_plan(RPC(args.rpc), validate(read(args.bundle)), read(args.binding)))
    else:
        write(args.output, publication(RPC(args.rpc), validate(read(args.bundle)), read(args.plan), args.receipts))


if __name__ == "__main__":
    main()

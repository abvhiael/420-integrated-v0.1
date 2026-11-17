#!/usr/bin/env python3
"""Read-only STAKE-AUDIT-8 evidence verifier; never signs or submits transactions."""
import argparse
import hashlib
import json
import pathlib
import re
import subprocess
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
HEX32 = re.compile(r"0x[0-9a-fA-F]{64}\Z")
ADDR = re.compile(r"0x[0-9a-fA-F]{40}\Z")
STAGES = ("registration", "activation", "reward", "slash", "exit", "withdrawal")
EVENTS = {
    "registration": "ValidatorRegistered(bytes32,address,address,uint256,uint256)",
    "activation": "ConsensusStateApplied(bytes32,uint8,uint8,uint64,uint64,uint64,uint64)",
    "reward": "RewardApplied(uint64,address,uint256,uint256,uint256,uint256)",
    "slash": "SlashApplied(bytes32,uint8,uint8,uint256,uint256,bytes32,uint8)",
    "exit": "ExitNoticeApplied(bytes32,uint64,uint64)",
    "withdrawal": "ValidatorBondWithdrawn(bytes32,address,uint256,uint256)",
}
ACTIONS = {"activation": "VALIDATOR_STATE", "reward": "REWARD",
           "slash": "VALIDATOR_SLASH", "exit": "VALIDATOR_EXIT_NOTICE"}

def require(ok, message):
    if not ok:
        raise ValueError(message)

def load(path):
    return json.loads(pathlib.Path(path).read_text())

def cast(*args):
    return subprocess.check_output(["cast", *args], text=True).strip().lower()

def keccak(value):
    return cast("keccak", value)

def topic_int(n):
    return "0x" + format(n, "064x")

def words(data, n):
    require(isinstance(data, str) and re.fullmatch(r"0x[0-9a-fA-F]*", data)
            and len(data) == 2 + 64*n, "invalid ABI event data")
    return [int(data[i:i+64], 16) for i in range(2, len(data), 64)]

def validate_draft(e):
    require(e.get("phase") == "STAKE-AUDIT-8", "invalid phase")
    require(re.fullmatch(r"[0-9a-f]{40}", e.get("repositorySha", "")), "invalid release SHA")
    require(HEX32.fullmatch(e.get("genesisHash", "")), "missing approved Genesis block hash")
    require(HEX32.fullmatch(e.get("validatorId", "")), "invalid validator ID")
    require(ADDR.fullmatch(e.get("operator", "")), "invalid operator")
    require(ADDR.fullmatch(e.get("withdrawalAddress", "")), "invalid withdrawal address")
    require(set(e.get("stages", {})) == set(STAGES), "missing or unexpected stage")
    prev = 0
    for name in STAGES:
        s = e["stages"][name]
        b = s.get("block")
        require(type(b) is int and b > prev, "stage blocks must be strictly increasing")
        require(HEX32.fullmatch(s.get("blockHash", "")), "invalid stage block hash")
        if name in ("registration", "withdrawal"):
            require(HEX32.fullmatch(s.get("txHash", "")), "missing user transaction")
        else:
            require(type(s.get("sequence")) is int and s["sequence"] > 0, "invalid native sequence")
        prev = b

def rpc_factory(url):
    def rpc(method, params):
        req = urllib.request.Request(url, data=json.dumps({
            "jsonrpc": "2.0", "id": 1, "method": method, "params": params
        }).encode(), headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.load(resp)
        require(result.get("id") == 1 and "error" not in result and
                result.get("result") is not None, "RPC failed: " + method)
        return result["result"]
    return rpc

def one_log(logs, address, topics, block_hash):
    found = [l for l in logs if l.get("address", "").lower() == address.lower()
             and l.get("blockHash", "").lower() == block_hash.lower()
             and not l.get("removed", False)
             and [t.lower() for t in l.get("topics", [])][:len(topics)] ==
                 [t.lower() for t in topics]]
    require(len(found) == 1, "expected exactly one canonical event: " + topics[0])
    return found[0]

def live(args):
    protocol = load(ROOT / "config/protocol.json")
    require(protocol["step5"]["substep_5_4"]["public_testnet_live"] is True,
            "BLOCKED_PUBLIC_TESTNET_NOT_LIVE")
    manifest = load(ROOT / "testnet/public/metadata/chain.json")
    require(manifest["chain_id"] == 420 and manifest["chain_id_status"] !=
            "CANDIDATE_UNTIL_FINAL_PREFLIGHT_FREEZE", "unfrozen chain")
    urls = manifest["rpc_urls"]
    require(urls and all(u.startswith("https://") and "REPLACE_" not in u for u in urls),
            "unapproved RPC")
    digest = manifest["genesis"]["execution_sha256"].removeprefix("0x")
    genesis_bytes = pathlib.Path(args.genesis).read_bytes()
    require(hashlib.sha256(genesis_bytes).hexdigest() == digest.lower(),
            "execution Genesis digest mismatch")
    genesis = json.loads(genesis_bytes)
    e = load(args.evidence)
    validate_draft(e)
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
    require(head == e["repositorySha"], "release SHA mismatch")
    require(not subprocess.check_output(["git", "status", "--porcelain", "--untracked-files=no"],
                                        cwd=ROOT, text=True).strip(), "dirty tracked tree")
    rpc = rpc_factory(urls[0])
    require(int(rpc("eth_chainId", []), 16) == 420, "wrong chain")
    require(rpc("eth_getBlockByNumber", ["0x0", False])["hash"].lower()
            == e["genesisHash"].lower(), "wrong Genesis block")
    finalized = int(rpc("eth_getBlockByNumber", ["finalized", False])["number"], 16)
    last = e["stages"]["withdrawal"]["block"]
    require(last <= finalized, "unfinalized evidence")
    package = load(ROOT / "contracts/config/predeploy/Stake420-materialization.json")
    cfg = load(ROOT / "contracts/config/predeploy/stake-genesis-config-v1.json")["addresses"]
    alloc = {k.lower().removeprefix("0x"): v for k, v in genesis["alloc"].items()}
    deployments = {}
    for name, entry in package["contracts"].items():
        address = entry["address"]
        for tag in ("0x0", hex(last)):
            code = rpc("eth_getCode", [address, tag])
            require(code != "0x" and keccak(code) == entry["runtimeCodeHash"].lower(),
                    name + " runtime mismatch")
        proof = rpc("eth_getProof", [address, [], "0x0"])
        require(proof["storageHash"].lower() == entry["storageRoot"].lower(),
                name + " Genesis storage root mismatch")
        require(int(proof["balance"], 16) == int(entry["genesisBalanceWei"]),
                name + " Genesis balance mismatch")
        deployments[name] = entry["runtimeCodeHash"]
    for key in ("consensusSystemCall420", "protocolRegistry", "governanceTimelock"):
        a = cfg[key]
        code = alloc[a[2:].lower()]["code"]
        require(code.startswith("0x") and len(code) > 2, key + " missing approved Genesis code")
        for tag in ("0x0", hex(last)):
            require(rpc("eth_getCode", [a, tag]).lower() == code.lower(),
                    key + " runtime mismatch")
        deployments[key] = keccak(code)
    def call_word(address, signature, args_hex="", block=last):
        data = cast("sig", signature) + args_hex.removeprefix("0x")
        return words(rpc("eth_call", [{"to": address, "data": data}, hex(block)]), 1)[0]
    reg, reward, reserve, facade, gateway = [cfg[k] for k in
        ("validatorRegistry", "rewardController", "communityValidatorReserve",
         "stake420", "consensusSystemCall420")]
    for address, signature, expected in (
        (reg, "consensusSystemCaller()", gateway),
        (reward, "consensusSystemCaller()", gateway),
        (reg, "communityValidatorReserve()", reserve),
        (reserve, "validatorRegistry()", reg),
        (facade, "validatorRegistry()", reg),
        (facade, "rewardController()", reward),
        (reg, "stakeProtocolRegistry()", cfg["protocolRegistry"]),
        (gateway, "governanceTimelock()", cfg["governanceTimelock"]),
        (reg, "governanceTimelock()", cfg["governanceTimelock"]),
        (reward, "governanceTimelock()", cfg["governanceTimelock"]),
        (reserve, "governanceTimelock()", cfg["governanceTimelock"]),
        (gateway, "NATIVE_SYSTEM_ORIGIN()", "0xfffffffffffffffffffffffffffffffffffffffe"),
    ):
        require(call_word(address, signature) == int(expected, 16), "binding mismatch: "+signature)
    for address, signature in ((reg, "consensusSystemCallerBound()"),
        (reward, "consensusSystemCallerBound()"), (reg, "communityValidatorReserveBound()"),
        (reserve, "validatorRegistryBound()"), (reg, "custodyInvariant()"),
        (reserve, "reserveInvariant()")):
        require(call_word(address, signature) == 1, "invariant/binding failed: " + signature)
    for signature in ("delegationEnabled()", "stakeWeightedVotingEnabled()"):
        require(call_word(facade, signature) == 0, "unexpected Genesis policy")
    vid = e["validatorId"].lower()
    operator_topic = topic_int(int(e["operator"], 16))
    withdrawal_topic = topic_int(int(e["withdrawalAddress"], 16))
    stages = {}
    previous_sequence = 0
    for name in STAGES:
        s = e["stages"][name]
        b, h = s["block"], s["blockHash"].lower()
        require(rpc("eth_getBlockByNumber", [hex(b), False])["hash"].lower() == h,
                "noncanonical stage block")
        address = reward if name == "reward" else reg
        topics = [keccak("0x" + EVENTS[name].encode().hex())]
        topics += [topic_int(b), operator_topic] if name == "reward" else [vid]
        if name == "registration":
            topics += [operator_topic, withdrawal_topic]
        if name == "withdrawal":
            topics += [withdrawal_topic]
        if name in ("registration", "withdrawal"):
            receipt = rpc("eth_getTransactionReceipt", [s["txHash"]])
            require(receipt["status"] == "0x1" and receipt["blockHash"].lower() == h and
                    receipt["transactionHash"].lower() == s["txHash"].lower(),
                    "unsuccessful or noncanonical user receipt")
            logs = receipt["logs"]
        else:
            logs = rpc("eth_getLogs", [{"blockHash": h, "address": address, "topics": topics}])
            seq = s["sequence"]
            require(seq > previous_sequence, "native sequence out of order")
            previous_sequence = seq
            action = keccak("0x" + ("420/SYSCALL/"+ACTIONS[name]+"/V1").encode().hex())
            gt = [keccak("0x" + b"ConsensusSystemCallApplied(uint64,uint64,bytes32,address,bytes32,bytes32)".hex()),
                  topic_int(seq), topic_int(b), action]
            gl = one_log(rpc("eth_getLogs", [{"blockHash": h, "address": gateway, "topics": gt}]),
                         gateway, gt, h)
            require(words(gl["data"], 3)[0] == int(address, 16), "native target mismatch")
        event = one_log(logs, address, topics, h)
        if name == "registration":
            owned, credit = words(event["data"], 2)
            require(owned >= 21000*10**18 and credit <= 21000*10**18 and
                    owned+credit == 42000*10**18, "bond composition mismatch")
        if name == "activation":
            require(words(event["data"], 6)[1] == 4, "not ACTIVE")
            require(b-e["stages"]["registration"]["block"] >= 17640, "early activation")
        if name == "reward":
            p, participants, attention, development = words(event["data"], 4)
            require(p > 0, "zero proposer reward")
            for signature, expected in (("grossSecurityIssued()", p+participants),
                    ("grossAttentionIssued()", attention), ("grossDevelopmentIssued()", development)):
                require(call_word(reward, signature, block=b)-call_word(reward, signature, block=b-1)
                        == expected, "reward accounting mismatch")
            require(call_word(reward, "rewardApplied(uint64)", topic_int(b), b) == 1,
                    "reward replay record missing")
        if name == "slash":
            offense, tier, owned, credit, evidence, status = words(event["data"], 6)
            require(offense > 0 and owned+credit > 0 and evidence != 0, "invalid slash evidence")
            require(call_word(reg, "slashEvidenceApplied(bytes32)", topic_int(evidence), b) == 1,
                    "slash replay record missing")
        if name == "exit":
            notice, eligible = words(event["data"], 2)
            require(eligible >= notice+1, "exit notice too short")
        if name == "withdrawal":
            owned, recycled = words(event["data"], 2)
            require(owned > 0 and call_word(facade, "validatorStatus(bytes32)", vid, b) == 7,
                    "withdrawal not completed")
        stages[name] = {"block": b, "blockHash": h, "event": event}
    # Native logs may require a node that exposes system-call events. Missing evidence fails closed.
    # This verifies a single representative journey, not all distributed/operational acceptance.
    return {"schema": "420-stake-audit-8-evidence-v1", "repositorySha": head,
            "genesisHash": e["genesisHash"], "chainId": 420, "deployments": deployments,
            "stages": stages, "status": "REPRESENTATIVE_LIVE_EVIDENCE_VERIFIED",
            "liveQualificationComplete": False}

def self_test():
    import copy
    h = "0x" + "12"*32
    addr = "0x" + "34"*20
    e = {"phase":"STAKE-AUDIT-8", "repositorySha":"a"*40, "genesisHash":h,
         "validatorId":h, "operator":addr, "withdrawalAddress":addr, "stages":{}}
    for i, name in enumerate(STAGES, 1):
        e["stages"][name] = {"block":i, "blockHash":h, "txHash":h, "sequence":i}
    validate_draft(e)
    for mutate in (lambda x:x["stages"].pop("slash"),
                   lambda x:x["stages"]["activation"].update(block=1),
                   lambda x:x["stages"]["reward"].update(sequence=0),
                   lambda x:x["stages"]["registration"].update(txHash="0x"),
                   lambda x:x.update(repositorySha="main")):
        invalid = copy.deepcopy(e)
        mutate(invalid)
        try:
            validate_draft(invalid)
        except ValueError:
            continue
        raise AssertionError("invalid evidence accepted")
    l = {"address":addr, "blockHash":h, "topics":[h], "data":topic_int(42)}
    assert one_log([l], addr, [h], h) == l
    assert words(l["data"], 1) == [42]
    for logs in ([l,l], [], [dict(l, removed=True)]):
        try:
            one_log(logs, addr, [h], h)
        except ValueError:
            continue
        raise AssertionError("invalid log set accepted")
    print("STAKE-AUDIT-8 offline evidence validation: PASS")

def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--self-test", action="store_true")
    p.add_argument("--genesis", help="Approved execution Genesis JSON")
    p.add_argument("--evidence", help="Reviewed evidence JSON; stage block/hash, txHash or native sequence")
    p.add_argument("--output")
    a = p.parse_args()
    if a.self_test:
        self_test()
        return
    require(a.genesis and a.evidence and a.output, "live evidence arguments required")
    out = pathlib.Path(a.output)
    require(not out.exists(), "refusing to overwrite existing evidence")
    out.write_text(json.dumps(live(a), indent=2)+"\n")

if __name__ == "__main__":
    main()

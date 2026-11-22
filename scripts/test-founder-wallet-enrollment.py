#!/usr/bin/env python3
"""GOV-PRE-02 ephemeral identity, signed V4, EIP-1271 and claims adversarial qualification.

All test-only keys are generated in memory and NEVER committed as founder addresses
or credentials; the real repository's slots remain null/unclaimed.
"""
from __future__ import annotations

import copy
import importlib.util
import json
import shutil
import tempfile
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

from eth_account import Account
from eth_account.messages import encode_defunct
from eth_utils import keccak

ROOT = Path(__file__).resolve().parents[1]


def module(path, name):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    obj = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(obj)
    return obj


v = module("scripts/verify-founder-wallet-reservations.py", "test_founder_v")
e = module("scripts/enroll-founder-wallets.py", "test_founder_e")

REQUIRED = (e.RESERVATIONS, e.SYSTEM, e.MIRROR, e.LEDGER, e.COMMIT,
            e.INIT, e.INTEGRATION, e.POLICY,
            "contracts/config/genesis-address-namespace.json",
            "contracts/config/interfaces/genesis-interface-layer.json",
            "config/genesis-applications.json", "config/ai-genesis.json")
GENESIS = "0x" + "ab" * 32


def fixture():
    ctx = tempfile.TemporaryDirectory(prefix="gov-pre-02-")
    root = Path(ctx.name)
    for path in REQUIRED:
        target = root / path
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / path, target)
    accounts = [Account.create() for _ in v.ROLES]  # synthetic in memory only
    plan = {
        "target_network": "testnet", "chain_id": 420,
        "founders": [{"role": role, "wallet_address": a.address}
                     for role, a in zip(v.ROLES, accounts)],
    }
    return ctx, root, accounts, plan


def check_rejected(label, operation, needle=None):
    try:
        operation()
    except (ValueError, AssertionError, KeyError, TypeError) as exc:
        if needle:
            assert needle.lower() in str(exc).lower(), (label, str(exc))
        return
    raise AssertionError(label + " was unexpectedly accepted")


def approve_fixture_v4(root):
    config = v.load(root, e.COMMIT)
    config["status"] = "FROZEN_V4"
    config["commitmentPayload"]["domain"] = "420/GENESIS/CONFIG/V4"
    for record in config["commitmentPayload"]["authorityInputs"]:
        record["gitBlobSha1"] = v.sha1_blob((root / record["path"]).read_bytes())
    data = json.dumps(config["commitmentPayload"], sort_keys=True,
                      separators=(",", ":"), ensure_ascii=False)
    config["genesisConfigHash"] = "0x" + keccak(text=data).hex()
    (root / e.COMMIT).write_text(json.dumps(config, indent=2) + "\n")
    return config["genesisConfigHash"]


def make_proofs(root, accounts, plan_hash):
    m = v.load(root, e.RESERVATIONS)
    m["planned_genesis_hash"] = plan_hash
    out = []
    for role, acct in zip(v.ROLES, accounts):
        record = next(f for f in m["founders"] if f["role"] == role)
        signed = Account.sign_message(encode_defunct(text=v.challenge(m, record)),
                                      private_key=acct.key)
        out.append({"role": role, "wallet_address": acct.address,
                    "method": "EIP191_PERSONAL_SIGN",
                    "signature": "0x" + bytes(signed.signature).hex()})
    return {"target_network": "testnet", "chain_id": 420,
            "genesis_plan_commitment": plan_hash, "founders": out}


def signed_fixture():
    ctx, root, accounts, plan = fixture()
    e.apply_files(root, e.stage(root, plan))
    assert v.validate(root=root) == 3, "staged structure must not confer proof"
    check_rejected("unverified staged addresses", lambda: v.validate(strict=True, root=root),
                   "approved")
    h = approve_fixture_v4(root)
    proof = make_proofs(root, accounts, h)
    return ctx, root, accounts, plan, proof


def test_own_signatures():
    ctx, root, accounts, plan, proofs = signed_fixture()
    try:
        e.apply_files(root, e.attest(root, proofs))
        assert v.validate(strict=True, root=root) == 3
        m = v.load(root, e.RESERVATIONS)
        assert all(p["ownership_status"] == "PREGENESIS_SIGNATURE_VERIFIED"
                   for p in m["founders"])
        assert not m["claim_contract"]["address"]
        assert all(f["status"] == "UNCLAIMED"
                   for f in v.load(root, e.SYSTEM)["founder_wallet_slots"])
        assert all(f["status"] == "UNCLAIMED"
                   for f in v.load(root, e.MIRROR)["founder_wallet_slots"])
        assert v.load(root, e.INTEGRATION)["founderWallets"]["allThreeOnChainClaimsVerified"] is False
        print("GOV-PRE-02: EOA +3 independently signed roles, V4-bound and unfunded/UNCLAIMED")
    finally:
        ctx.cleanup()


def test_adversarial():
    ctx, root, accounts, plan, proofs = signed_fixture()
    try:
        wrong = copy.deepcopy(proofs)
        wrong["founders"][0]["signature"] = proofs["founders"][1]["signature"]
        check_rejected("wrong EOA signer", lambda: e.attest(root, wrong), "signer")
        wrong = copy.deepcopy(proofs)
        wrong["chain_id"] += 1
        check_rejected("wrong chain", lambda: e.attest(root, wrong), "network/chain")
        wrong = copy.deepcopy(proofs)
        wrong["target_network"] = "mainnet"
        check_rejected("wrong network", lambda: e.attest(root, wrong), "network/chain")
        wrong = copy.deepcopy(proofs)
        wrong["genesis_plan_commitment"] = "0x" + "ff"*32
        check_rejected("wrong plan hash", lambda: e.attest(root, wrong), "network/chain")
        wrong = copy.deepcopy(proofs)
        wrong["founders"][0]["role"] = "JANET"
        check_rejected("wrong role", lambda: e.attest(root, wrong), "role")
        wrong = copy.deepcopy(proofs)
        wrong["founders"][2]["signature"] = None
        check_rejected("missing signed proof", lambda: e.attest(root, wrong), "missing")
        wrong = copy.deepcopy(proofs)
        wrong["founders"][1]["method"] = "EIP1271_CODEBOUND"
        wrong["founders"][1]["expected_runtime_code_hash"] = "0x" + "12"*32
        check_rejected("contract signature faked with EOA", lambda: e.attest(root, wrong),
                       "RPC")
        for bad in (accounts[0].address, "0x0000000000000000000000000000000000000425"):
            duplicate = copy.deepcopy(plan)
            duplicate["founders"][1]["wallet_address"] = bad
            check_rejected("duplicate/reserved predeploy", lambda: e.stage(root, duplicate),
                           "address")
        check_rejected("changes to frozen authority files after V4",
                       lambda: e.stage(root, plan), "approved V4")
        assert v.validate(strict=False, root=root) == 3
        e.apply_files(root, e.attest(root, proofs))
        # Replacing an approved address or beneficiary after signing must fail.
        original_mirror_bytes = (root / e.SYSTEM).read_bytes()
        s = v.load(root, e.SYSTEM)
        s["founder_wallet_slots"][1]["address"] = accounts[2].address
        (root / e.SYSTEM).write_text(json.dumps(s, indent=2)+"\\n")
        check_rejected("mirror tampering", lambda: v.validate(strict=True, root=root), "mirror")
        # A formatting-only change still invalidates a frozen authority-input blob.
        (root / e.SYSTEM).write_text(json.dumps(s, separators=(",", ":"))+"\\n")
        check_rejected("V4 source byte drift", lambda: v.validate(strict=True, root=root),
                       "bytes changed")
        (root / e.SYSTEM).write_bytes(original_mirror_bytes)
        m = v.load(root, e.RESERVATIONS)
        m["founders"][0]["pre_genesis_proof"]["signature"] = proofs["founders"][1]["signature"]
        (root / e.RESERVATIONS).write_text(json.dumps(m,indent=2)+"\n")
        check_rejected("tampered owner signature", lambda: v.validate(strict=True,root=root))
        print("GOV-PRE-02: wrong signer, chain, plan, role, missing proof, namespace, freeze, forgery rejected")
    finally:
        ctx.cleanup()


class ChainSimulator(BaseHTTPRequestHandler):
    """Functional RPC boundary fixture, not a claim of real on-chain ownership."""
    state = {}
    def log_message(self, *args):
        pass
    def do_POST(self):
        raw = self.rfile.read(int(self.headers.get("content-length", 0)))
        request = json.loads(raw)
        method, params = request["method"], request.get("params", [])
        s = type(self).state
        result = None
        if method == "eth_chainId":
            result = s.get("chain_id", "0x1a4")
        elif method == "eth_getBlockByNumber":
            if params[0] == "0x0":
                result = {"hash": s["genesis"], "number": "0x0"}
            elif params[0] == "finalized":
                result = {"hash": "0x" + "cd"*32, "number": "0x10"}
            else:
                result = {"hash": s["claim_block"], "number": params[0]}
        elif method == "eth_getCode":
            result = s["code"]
        elif method == "eth_getTransactionReceipt":
            result = s["receipts"].get(params[0])
        elif method == "eth_call":
            target = params[0]["to"].lower()
            data = params[0]["data"].lower()
            if target in s.get("smart", []):
                result = s.get("magic", "0x1626ba7e") + "0"*56
            else:
                sigs = {
                    keccak(text=z)[:4].hex(): name for name,z in [
                    ("plan","genesisPlanCommitment()"),("chain","deploymentChainId()"),
                    ("admin","administrator()"),("andrew","andrew()"),("janet","janet()"),
                    ("count","claimedCount()"),("all","allFoundersClaimed()"),
                    ("claimed","claimed(address)")]
                }
                field = sigs[data[2:10]]
                if field == "claimed":
                    n = int(data[10:], 16)
                    value = int(n in s["wallet_ints"])
                elif field == "chain":
                    value = 420
                elif field == "plan":
                    value = int(s["plan"],16)
                elif field == "count":
                    value = 3
                elif field == "all":
                    value = 1
                else:
                    value = s["wallet_ints"][("admin","andrew","janet").index(field)]
                result = "0x" + value.to_bytes(32,"big").hex()
        body = json.dumps({"jsonrpc":"2.0","id":1,"result":result}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def server(state):
    ChainSimulator.state = state
    http = HTTPServer(("127.0.0.1", 0), ChainSimulator)
    thread = threading.Thread(target=http.serve_forever, daemon=True)
    thread.start()
    return http, "http://127.0.0.1:" + str(http.server_port)


def test_codebound_1271():
    ctx, root, accounts, plan, proofs = signed_fixture()
    try:
        bytecode = "0x6000600055"
        code_hash = "0x" + keccak(bytes.fromhex(bytecode[2:])).hex()
        m = v.load(root, e.RESERVATIONS)
        m["planned_genesis_hash"] = proofs["genesis_plan_commitment"]
        member = m["founders"][2]
        member["pre_genesis_proof"]["method"] = "EIP1271_CODEBOUND"
        member["pre_genesis_proof"]["expected_runtime_code_hash"] = code_hash
        proofs["founders"][2]["method"] = "EIP1271_CODEBOUND"
        proofs["founders"][2]["expected_runtime_code_hash"] = code_hash
        proofs["founders"][2]["signature"] = "0x012345"
        proofs["network_genesis_block_hash"] = GENESIS
        state = {"genesis": GENESIS, "claim_block": "0x" + "ef"*32,
                 "code": bytecode, "plan": proofs["genesis_plan_commitment"],
                 "wallet_ints": [int(a.address,16) for a in accounts],
                 "receipts":{}, "smart":[accounts[2].address.lower()]}
        http,url = server(state)
        try:
            e.apply_files(root,e.attest(root, proofs, rpc_url=url))
            assert v.validate(strict=True,root=root,rpc_url=url) == 3
            state["magic"]="0xffffffff"
            check_rejected("contract rejected signature",
                           lambda: v.validate(strict=True,root=root,rpc_url=url),
                           "EIP-1271 contract rejected")
            state["magic"]="0x1626ba7e"
            state["code"]="0x6060"
            check_rejected("contract code hash changed",
                           lambda: v.validate(strict=True,root=root,rpc_url=url),
                           "runtime differs")
            state["code"]=bytecode
            state["chain_id"]="0x1"
            check_rejected("contract proof on foreign chain",
                           lambda: v.validate(strict=True,root=root,rpc_url=url),
                           "chain ID")
            print("GOV-PRE-02: EIP-1271 mock RPC codehash/magic/chain validations PASS")
        finally:
            http.shutdown()
            http.server_close()
    finally:
        ctx.cleanup()


def test_finalized_claim_records():
    ctx, root, accounts, plan, proofs = signed_fixture()
    try:
        e.apply_files(root,e.attest(root,proofs))
        bytecode = "0x6002600055"
        address = "0x" + "77"*20
        block_hash = "0x"+"ef"*32
        contract = {"address":address,
                    "runtime_code_hash":"0x"+keccak(bytes.fromhex(bytecode[2:])).hex()}
        topic="0x"+keccak(text="FounderWalletClaimed(uint8,address,bytes32)").hex()
        receipts={}
        rows=[]
        for i,account in enumerate(accounts):
            tx="0x"+format(i+1,"064x")
            receipts[tx] = {
                "status":"0x1", "blockNumber":"0x5", "blockHash":block_hash,
                "logs":[{"address":address,"topics":[topic,
                    "0x"+format(i+1,"064x"),"0x"+format(int(account.address,16),"064x"),
                    proofs["genesis_plan_commitment"]]}],
            }
            rows.append({"role":v.ROLES[i],"wallet_address":account.address,
                         "claim_tx":tx,"claim_block_hash":block_hash})
        body={"target_network":"testnet","chain_id":420,
              "genesis_plan_commitment":proofs["genesis_plan_commitment"],
              "network_genesis_block_hash":GENESIS,
              "claim_contract":contract,"founders":rows}
        state={"genesis":GENESIS,"claim_block":block_hash,"code":bytecode,
               "plan":proofs["genesis_plan_commitment"],
               "wallet_ints":[int(a.address,16) for a in accounts],
               "receipts":receipts,"smart":[]}
        http,url=server(state)
        try:
            result=e.record_claims(root,body,url)
            e.apply_files(root,result)
            assert v.validate(strict=True,root=root,rpc_url=url,require_claims=True)==3
            state["receipts"][rows[0]["claim_tx"]]["blockHash"]="0x"+"99"*32
            check_rejected("reorged on-chain claim",
                           lambda: v.validate(strict=True,root=root,rpc_url=url,
                                              require_claims=True),"reorged")
            state["receipts"][rows[0]["claim_tx"]]["blockHash"]=block_hash
            state["receipts"][rows[1]["claim_tx"]]["logs"]=[]
            check_rejected("missing canonical founder event",
                           lambda: v.validate(strict=True,root=root,rpc_url=url,
                                              require_claims=True),"event")
            print("GOV-PRE-02: three finalized claim receipts/state + reorg/event negatives PASS")
        finally:
            http.shutdown()
            http.server_close()
    finally:
        ctx.cleanup()


def main():
    assert v.validate(strict=False) == 0, "real founder reservation files must stay unclaimed"
    check_rejected("real unsigned founders cannot be enrolled",
                   lambda: v.validate(strict=True),"approved V4")
    test_own_signatures()
    test_adversarial()
    test_codebound_1271()
    test_finalized_claim_records()
    assert v.validate(strict=False) == 0, "synthetic test wallets leaked into source repo"
    print("GOV-PRE-02: ephemeral EOA / EIP1271 / finalized-claims qualification passed")


if __name__ == "__main__":
    main()

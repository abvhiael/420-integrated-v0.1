"""TN-FAN-01 deployment preparation and read-only attestation. Never broadcasts."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
from urllib.parse import urlparse

from web3 import Web3

ROOT = Path(__file__).resolve().parents[3]
APP = Path(__file__).resolve().parent
MODULES = (
    "CapabilityRegistry420", "BetAuthorization420", "Identity420", "Wrapped420",
    "OracleProviderRegistry420", "OracleFeedRegistry420", "OracleRiskPolicy420", "OracleRouter420",
    "DevelopmentCompensationVault420", "FantasyDisputeController420", "FantasySlateBook420",
    "FantasyNHLScoring420", "FantasyContestEngine420", "FantasyAdmission420",
    "FantasyRankingBook420", "FantasyPayoutPolicy420",
)
STEPS = {
    "FantasyDisputeController420": ["BetAuthorization420", "Identity420", "OracleRouter420", "$resolverType", "Wrapped420", "$community"],
    "FantasySlateBook420": ["BetAuthorization420", "OracleRouter420"],
    "FantasyNHLScoring420": [],
    "FantasyContestEngine420": ["FantasyDisputeController420", "FantasySlateBook420", "FantasyNHLScoring420", "DevelopmentCompensationVault420", "$issuer", "$userType"],
}
COMPONENT = "0x" + Web3.keccak(text="420.BET.CORE").hex().removeprefix("0x")
MAX_LEASE = 7 * 86400


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":")).encode()


def digest(value):
    return hashlib.sha256(canonical(value)).hexdigest()


def hx(value):
    return "0x" + bytes(value).hex()


def address(value):
    if not isinstance(value, str) or not Web3.is_address(value) or int(value, 16) == 0:
        raise ValueError("nonzero address required")
    return Web3.to_checksum_address(value)


def word(value):
    if not isinstance(value, str) or len(value) != 66 or not value.startswith("0x") or int(value, 16) == 0:
        raise ValueError("nonzero bytes32 required")
    return bytes.fromhex(value[2:])


def artifact(build, name):
    return json.loads((Path(build) / (name + ".sol") / (name + ".json")).read_text(encoding="utf-8"))


def bundle(build):
    """Freeze compiler/source identities without inventing official addresses."""
    modules = {}
    sources = {}
    for name in MODULES:
        item = artifact(build, name)
        meta = item["metadata"]
        if isinstance(meta, str):
            meta = json.loads(meta)
        if meta["compiler"]["version"] != "0.8.30+commit.73712a01":
            raise ValueError("unqualified compiler")
        settings = meta["settings"]
        if settings.get("optimizer") != {"enabled": True, "runs": 200} or not settings.get("viaIR") or settings.get("evmVersion") != "cancun":
            raise ValueError("compiler settings differ from qualified canonical build")
        for source, source_meta in meta["sources"].items():
            path = Path(source)
            if not path.is_absolute():
                path = (ROOT / "contracts" / path).resolve()
            if not path.is_relative_to(ROOT):
                raise ValueError("external source")
            content = path.read_bytes().replace(b"\r\n", b"\n")
            if hx(Web3.keccak(content)) != source_meta["keccak256"]:
                raise ValueError("compiled artifact is stale for source: " + source)
            sources[path.relative_to(ROOT).as_posix()] = hashlib.sha256(content).hexdigest()
        modules[name] = {
            "creationKeccak": hx(Web3.keccak(hexstr=item["bytecode"]["object"])),
            "runtimeTemplateKeccak": hx(Web3.keccak(hexstr=item["deployedBytecode"]["object"])),
            "abiSHA256": digest(item["abi"]), "compiler": meta["compiler"]["version"],
            "optimizer": settings["optimizer"], "viaIR": True, "evmVersion": "cancun",
        }
    for name in ["clients/420bet-fantasy/nhl.py", "clients/420bet-fantasy/sportradar.py",
                 "clients/420bet-fantasy/sportradar_scoring.py", "docs/bet/BET-FANTASY-CONTEST-ENGINE-V1.md"]:
        sources[name] = hashlib.sha256((ROOT / name).read_bytes().replace(b"\r\n", b"\n")).hexdigest()
    value = {"schema": "420.fantasy.deployment-bundle.v1", "sourceNormalization": "UTF-8 text with LF line endings (Foundry input)", "modules": modules,
             "sources": sources, "constructorSteps": STEPS, "productionAuthorized": False}
    value["digest"] = digest(value)
    return value


def check_bundle(build, expected):
    if bundle(build) != expected:
        raise ValueError("compiled/source bundle differs from frozen intent")


def creation_transaction(build, name, bindings, parameters, sender):
    """Resolve one reviewed DAG step into a wallet-signable contract creation."""
    if name not in STEPS:
        raise ValueError("only fantasy modules may be deployed; canonical core and asset must be reused")
    if type(parameters.get("chainID")) is not int or not 0 < parameters["chainID"] < 2**256:
        raise ValueError("explicit target chain ID required")
    args = []
    for ref in STEPS[name]:
        args.append(word(parameters[ref[1:]]) if ref in ("$issuer", "$userType", "$resolverType")
                    else address(parameters[ref[1:]]) if ref.startswith("$") else address(bindings[ref]))
    item = artifact(build, name)
    factory = Web3().eth.contract(abi=item["abi"], bytecode=item["bytecode"]["object"])
    return {"from": address(sender), "chainId": parameters["chainID"], "data": factory.constructor(*args).data_in_transaction, "value": "0x0"}


def contract(w3, build, name, where):
    return w3.eth.contract(address=address(where), abi=artifact(build, name)["abi"])


def runtime_matches(build, name, deployed):
    item = artifact(build, name)["deployedBytecode"]
    expected = bytearray.fromhex(item["object"].removeprefix("0x"))
    actual = bytearray(deployed)
    if len(actual) != len(expected) or not 0 < len(actual) <= 24576 or item.get("linkReferences"):
        raise ValueError("runtime size or linkage mismatch: " + name)
    # Compiler-declared immutable slots are checked independently via getters below.
    for refs in item.get("immutableReferences", {}).values():
        for ref in refs:
            start, length = ref["start"], ref["length"]
            expected[start:start+length] = actual[start:start+length] = bytes(length)
    if actual != expected:
        raise ValueError("runtime differs from compiled canonical module: " + name)


def oracle_authority_plan(w3, build, modules, roles, providers, feeds, governance):
    """Unsigned, revision-checked oracle registry/feed/risk provisioning."""
    if len(providers) != 2 or {p["upstream"] for p in providers} != {"sportradar"}:
        raise ValueError("initial oracle policy is two operators sharing Sportradar")
    if address(roles["reporterA"]) == address(roles["reporterB"]):
        raise ValueError("distinct reporter keys required")
    registry = contract(w3, build, "OracleProviderRegistry420", modules["OracleProviderRegistry420"])
    book = contract(w3, build, "OracleFeedRegistry420", modules["OracleFeedRegistry420"])
    risk = contract(w3, build, "OracleRiskPolicy420", modules["OracleRiskPolicy420"])
    if any(c.functions.governanceTimelock().call() != address(governance) for c in (registry, book, risk)):
        raise ValueError("oracle plan sender is not the configured governance authority")
    transactions = []
    def add(fn):
        transactions.append({"from": address(governance), "chainId": w3.eth.chain_id, "to": fn.address,
                             "data": fn._encode_transaction_data(), "value": "0x0"})
    for i, p in enumerate(providers):
        record = registry.functions.providers(word(p["id"])).call()
        if record[5] != p["expectedEpoch"]:
            raise ValueError("provider epoch changed before provisioning")
        add(registry.functions.setProvider(word(p["id"]), address(roles["reporterA" if i == 0 else "reporterB"]), word(p["metadata"]), bytes(32), True))
    for f in feeds:
        fid = word(f["id"])
        if book.functions.feedRevision(fid).call() != f["expectedRevision"] or not 0 < f["heartbeat"] <= 30*86400:
            raise ValueError("feed revision changed or heartbeat invalid")
        add(book.functions.setFeed(fid, Web3.keccak(text="420/ORACLE/FEED/OUTCOME/V1"), Web3.keccak(text="420/ORACLE/AGGREGATION/QUORUM_EQUAL/V1"), f["heartbeat"], 0, 2, word(f["metadata"]), True))
        for i in range(book.functions.sourceCount(fid).call()):
            old = book.functions.sourceAt(fid, i).call()
            if hx(old) not in {p["id"] for p in providers} and book.functions.sourceActive(fid, old).call():
                add(book.functions.setSource(fid, old, False))
        for p in providers:
            add(book.functions.setSource(fid, word(p["id"]), True))
        add(risk.functions.setPolicy(fid, 10000, 0, False))
    return transactions


def revocation_transaction(w3, build, modules, grant_id, authority):
    cap = contract(w3, build, "CapabilityRegistry420", modules["CapabilityRegistry420"])
    grant = cap.functions.grant(word(grant_id)).call()
    if grant[1] != word(COMPONENT) or cap.functions.componentAuthority(grant[1]).call() != address(authority):
        raise ValueError("revocation requires the actual BET component authority")
    return {"from": address(authority), "chainId": w3.eth.chain_id, "to": cap.address,
            "data": cap.functions.revokeGrant(word(grant_id))._encode_transaction_data(), "value": "0x0"}


def role_plan(w3, build, modules, roles, slate, pool, claim, start, end):
    if not 0 < end - start <= MAX_LEASE:
        raise ValueError("authority must have a bounded lease of at most seven days")
    keys = ["administrator", "validator", "publisher", "resolver", "reporterA", "reporterB"]
    actors = [address(roles[k]) for k in keys]
    if len(set(actors)) != len(actors):
        raise ValueError("administrator, custodian, publisher, reporters and resolver require distinct keys")
    auth = contract(w3, build, "BetAuthorization420", modules["BetAuthorization420"])
    book = contract(w3, build, "FantasySlateBook420", modules["FantasySlateBook420"])
    engine = contract(w3, build, "FantasyContestEngine420", modules["FantasyContestEngine420"])
    disputes = contract(w3, build, "FantasyDisputeController420", modules["FantasyDisputeController420"])
    cap = contract(w3, build, "CapabilityRegistry420", modules["CapabilityRegistry420"])
    ss = auth.functions.scopeForContest(word(slate)).call()
    pools = [pool] if isinstance(pool, str) else list(pool)
    if not 0 < len(pools) <= 32 or len(set(pools)) != len(pools):
        raise ValueError("authority batch must name distinct pool IDs")
    specs = [
        ("create", roles["administrator"], engine.functions.CREATE().call(), auth.functions.scopeGlobal().call()),
        ("publish", roles["administrator"], book.functions.PUBLISH().call(), ss),
        ("validate", roles["validator"], book.functions.VALIDATE_LINEUP().call(), ss),
    ]
    for pid in pools:
        ps = auth.functions.scopeForContest(word(pid)).call()
        specs.extend([("register", engine.address, disputes.functions.REGISTER().call(), ps),
                      ("invite", roles["administrator"], engine.functions.INVITE().call(), ps),
                      ("conflict", roles["administrator"], engine.functions.CONFLICT().call(), ps)])
    if claim is not None:
        c = disputes.functions.claimOf(word(claim)).call()
        if c[0] not in [word(pid) for pid in pools] or not c[6] or c[7] != 0 or c[2] == address(roles["resolver"]):
            raise ValueError("resolver grants require an actual independent pending claim")
        if end > disputes.functions.poolOf(c[0]).call()[3]:
            raise ValueError("resolver authority cannot outlive the dispute deadline")
        specs.append(("resolve", roles["resolver"], disputes.functions.RESOLVE().call(), disputes.functions.claimScope(word(claim)).call()))
    result = []
    for label, principal, action, scope in specs:
        gid = Web3.keccak(canonical([label, w3.eth.chain_id, engine.address, principal, hx(scope), start, end]))
        # All these actions use amount=0; a one-unit ceiling is not withdrawal authority.
        fn = cap.functions.createGrant(gid, address(principal), word(COMPONENT), action, scope, 1, 0, 0, start, end)
        result.append({"role": label, "id": hx(gid), "principal": address(principal), "action": hx(action),
                       "scope": hx(scope), "validFrom": start, "validUntil": end,
                       "transaction": {"from": address(roles["administrator"]), "chainId": w3.eth.chain_id, "to": cap.address,
                                       "data": fn._encode_transaction_data(), "value": "0x0"}})
    # Publisher is permissionless/gas-only. Reporter authority lives in the oracle registry,
    # not broad BET capabilities. Future claim grants must be made only for actual claims.
    return result


def snapshot_manifest(w3, build, modules, parameters, roles, feeds, providers, grants, receipts, local):
    tag = "latest" if local else "finalized"
    block = w3.eth.get_block(tag)
    bound = {name: {"address": address(modules[name]),
                    "runtimeKeccak": hx(Web3.keccak(w3.eth.get_code(address(modules[name]), block.number)))}
             for name in MODULES}
    manifest = {"schema": "420.fantasy.deployment-manifest.v1", "localQualification": bool(local),
                "productionAuthorized": False, "chainID": w3.eth.chain_id,
                "genesisHash": hx(w3.eth.get_block(0).hash), "blockNumber": block.number,
                "blockHash": hx(block.hash), "bundle": bundle(build), "modules": bound,
                "parameters": parameters, "roles": roles, "feeds": feeds, "providers": providers,
                "grants": grants, "receipts": receipts}
    manifest["intentDigest"] = digest(manifest)
    return manifest


def verify(w3, build, manifest, official=False):
    """Fail closed on identity, source, wiring, authority, epochs, receipt or reorg drift."""
    m = manifest
    unsigned = {k: v for k, v in m.items() if k != "intentDigest"}
    if m.get("schema") != "420.fantasy.deployment-manifest.v1" or digest(unsigned) != m.get("intentDigest"):
        raise ValueError("manifest digest mismatch")
    if m["productionAuthorized"] is not False:
        raise ValueError("production activation is outside TN-FAN-01")
    if m["localQualification"] and (m["chainID"] != 31337 or urlparse(w3.provider.endpoint_uri).hostname not in ("127.0.0.1", "localhost")):
        raise ValueError("local qualification requires isolated loopback chain 31337")
    if not m["localQualification"] and m["chainID"] == 31337:
        raise ValueError("local chain cannot be relabelled as an official network")
    if official and (m["localQualification"] or m["chainID"] == 31337):
        raise ValueError("local evidence cannot attest official testnet deployment")
    if w3.eth.chain_id != m["chainID"] or hx(w3.eth.get_block(0).hash) != m["genesisHash"]:
        raise ValueError("network/genesis mismatch")
    block = w3.eth.get_block("latest" if m["localQualification"] else "finalized")
    if block.number < m["blockNumber"] or hx(w3.eth.get_block(m["blockNumber"]).hash) != m["blockHash"]:
        raise ValueError("deployment snapshot reorg or incomplete finality")
    check_bundle(build, m["bundle"])
    if set(m["modules"]) != set(MODULES):
        raise ValueError("incomplete canonical module inventory")
    cs = {}
    for name, value in m["modules"].items():
        code = w3.eth.get_code(address(value["address"]), block.number)
        if hx(Web3.keccak(code)) != value["runtimeKeccak"]:
            raise ValueError("runtime code identity drift: " + name)
        runtime_matches(build, name, code)
        cs[name] = contract(w3, build, name, value["address"])
    p = m["parameters"]
    if p.get("assetKind") != "wrapped-native":raise ValueError("official deployment requires the canonical Wrapped420 profile")
    if p["chainID"] != m["chainID"]:
        raise ValueError("constructor target chain differs from manifest network")
    links = {
        "BetAuthorization420": {"capabilityRegistry": cs["CapabilityRegistry420"].address},
        "OracleFeedRegistry420": {"providerRegistry": cs["OracleProviderRegistry420"].address},
        "OracleRouter420": {"providerRegistry": cs["OracleProviderRegistry420"].address, "feedRegistry": cs["OracleFeedRegistry420"].address, "riskPolicy": cs["OracleRiskPolicy420"].address},
        "DevelopmentCompensationVault420": {"capabilityRegistry": cs["CapabilityRegistry420"].address, "beneficiary": address(p["developmentBeneficiary"])},
        "FantasyDisputeController420": {"authorization": cs["BetAuthorization420"].address, "identities": cs["Identity420"].address, "oracle": cs["OracleRouter420"].address, "asset": cs["Wrapped420"].address, "communityFund": address(p["community"]), "resolverCredentialType": word(p["resolverType"])},
        "FantasySlateBook420": {"authorization": cs["BetAuthorization420"].address, "oracle": cs["OracleRouter420"].address},
        "FantasyContestEngine420": {"authorization": cs["BetAuthorization420"].address, "disputes": cs["FantasyDisputeController420"].address, "slateBook": cs["FantasySlateBook420"].address, "scoring": cs["FantasyNHLScoring420"].address, "rankings": cs["FantasyRankingBook420"].address, "admission": cs["FantasyAdmission420"].address, "payoutPolicy": cs["FantasyPayoutPolicy420"].address, "asset": cs["Wrapped420"].address, "devFund": address(p["developmentBeneficiary"])},
        "FantasyAdmission420": {"slates": cs["FantasySlateBook420"].address, "identities": cs["Identity420"].address, "issuer": word(p["issuer"]), "credentialType": word(p["userType"])},
        "FantasyRankingBook420": {"engine": cs["FantasyContestEngine420"].address},
        "FantasyPayoutPolicy420": {"engine": cs["FantasyContestEngine420"].address},
    }
    for name, getters in links.items():
        for getter, expected in getters.items():
            if getattr(cs[name].functions, getter)().call(block_identifier=block.number) != expected:
                raise ValueError("immutable dependency mismatch: " + name + "." + getter)
    for name in ("Identity420", "OracleRouter420", "OracleProviderRegistry420", "OracleFeedRegistry420", "OracleRiskPolicy420"):
        if cs[name].functions.governanceTimelock().call(block_identifier=block.number) != address(p["governance"]):
            raise ValueError("governance binding mismatch")
    if cs["Wrapped420"].functions.decimals().call(block_identifier=block.number) != p["assetDecimals"]:
        raise ValueError("canonical asset precision mismatch")
    if w3.eth.get_balance(cs["Wrapped420"].address, block.number) < cs["Wrapped420"].functions.totalSupply().call(block_identifier=block.number):
        raise ValueError("canonical wrapper is not fully backed by native 420")
    roles = m["roles"]
    if len({address(roles[k]) for k in ("administrator", "validator", "publisher", "resolver", "reporterA", "reporterB")}) != 6:
        raise ValueError("conflicting operator keys")
    if cs["CapabilityRegistry420"].functions.componentAuthority(word(COMPONENT)).call(block_identifier=block.number) != address(roles["administrator"]):
        raise ValueError("wrong capability authority")
    for role in ("validator", "resolver"):
        subject, credential = word(roles[role+"Subject"]), word(roles[role+"Credential"])
        if cs["FantasyAdmission420"].functions.controllerOf(subject).call(block_identifier=block.number) != address(roles[role]):
            raise ValueError("operator controller mismatch")
        if not cs["Identity420"].functions.credentialMeetsTrust(credential, 2).call(block_identifier=block.number):
            raise ValueError("unverified operator credential")
        cred = cs["Identity420"].functions.credential(credential).call(block_identifier=block.number)
        if cred[0] != subject or cred[1] != word(p["resolverType"] if role == "resolver" else p["userType"]) or cred[2] != word(p["issuer"]):
            raise ValueError("operator credential binding mismatch")
        user_credential = word(roles[role+"UserCredential"])
        key = cs["FantasyAdmission420"].functions.credentialKey(subject, user_credential).call(block_identifier=block.number)
        if cs["FantasyAdmission420"].functions.currentUserKey(subject).call(block_identifier=block.number) != key:
            raise ValueError("operator canonical identity not registered")
        if any(cs["FantasyContestEngine420"].functions.isInterested(word(pid), subject).call(block_identifier=block.number) for pid in p.get("pools", [p["pool"]])):
            raise ValueError("custodian/resolver has a pool conflict")
    if p.get("slateManifest"):
        s = cs["FantasySlateBook420"].functions.slateOf(word(p["slate"])).call(block_identifier=block.number)
        custodian = cs["FantasyAdmission420"].functions.currentUserKey(word(roles["validatorSubject"])).call(block_identifier=block.number)
        if s[0] != word(p["slateManifest"]) or s[2] != word(p["custodianKeyHash"]) or s[3] != custodian or s[4] != address(roles["validator"]):
            raise ValueError("sealed slate custody binding mismatch")
    if int(p["publisherMinimumGasWei"]) <= 0 or w3.eth.get_balance(address(roles["publisher"]), block.number) < int(p["publisherMinimumGasWei"]):
        raise ValueError("publisher lacks required gas reserve")
    if len(m["providers"]) != 2 or {v["upstream"] for v in m["providers"]} != {"sportradar"}:
        raise ValueError("two Sportradar operators are one upstream")
    for i, expected in enumerate(m["providers"]):
        record = cs["OracleProviderRegistry420"].functions.providers(word(expected["id"])).call(block_identifier=block.number)
        if not record[6] or record[0] != address(roles["reporterA" if i == 0 else "reporterB"]) or record[5] != expected["epoch"] or record[1] != word(expected["metadata"]):
            raise ValueError("provider epoch/operator drift")
    if not m["feeds"]:
        raise ValueError("feed inventory missing")
    for f in m["feeds"]:
        fid = word(f["id"])
        record = cs["OracleFeedRegistry420"].functions.feeds(fid).call(block_identifier=block.number)
        if list(record) != [word(f["type"]), word(f["aggregation"]), word(f["metadata"]), f["heartbeat"], f["revision"], f["decimals"], f["quorum"], True] or f["quorum"] != 2:
            raise ValueError("feed policy/revision drift")
        if f["type"] != hx(Web3.keccak(text="420/ORACLE/FEED/OUTCOME/V1")) or f["aggregation"] != hx(Web3.keccak(text="420/ORACLE/AGGREGATION/QUORUM_EQUAL/V1")) or not 0 < f["heartbeat"] <= 30*86400:
            raise ValueError("unsupported fantasy feed policy")
        count = cs["OracleFeedRegistry420"].functions.sourceCount(fid).call(block_identifier=block.number)
        if count > 16:
            raise ValueError("oracle source inventory exceeds canonical bound")
        source_ids = [cs["OracleFeedRegistry420"].functions.sourceAt(fid, i).call(block_identifier=block.number) for i in range(count)]
        actual_sources = {hx(pid) for pid in source_ids if cs["OracleFeedRegistry420"].functions.sourceActive(fid, pid).call(block_identifier=block.number)}
        if actual_sources != {v["id"] for v in m["providers"]}:
            raise ValueError("unexpected oracle source inventory")
        for provider in m["providers"]:
            if not cs["OracleFeedRegistry420"].functions.sourceActive(fid, word(provider["id"])).call(block_identifier=block.number) or cs["OracleFeedRegistry420"].functions.sourceEpoch(fid, word(provider["id"])).call(block_identifier=block.number) != f["sourceEpochs"][provider["id"]]:
                raise ValueError("feed source epoch drift")
        risk = list(cs["OracleRiskPolicy420"].functions.policy(fid).call(block_identifier=block.number))
        if risk != f["risk"] or risk[2] or not risk[3] or risk[0] != 10000:
            raise ValueError("oracle risk/circuit-breaker drift")
    if not m["grants"]:
        raise ValueError("authority inventory missing")
    planned = role_plan(w3, build, {n: c.address for n, c in cs.items()}, roles, p["slate"], p.get("pools", [p["pool"]]), p["claim"], m["grants"][0]["validFrom"], m["grants"][0]["validUntil"])
    if planned != m["grants"]:
        raise ValueError("authority plan differs from bounded role policy")
    for g in m["grants"]:
        actual = list(cs["CapabilityRegistry420"].functions.grant(word(g["id"])).call(block_identifier=block.number))
        expected = [address(g["principal"]), word(COMPONENT), word(g["action"]), word(g["scope"]), 1, 0, 0, g["validFrom"], g["validUntil"], False]
        if actual != expected or not g["validFrom"] <= block.timestamp < g["validUntil"] or not 0 < g["validUntil"]-g["validFrom"] <= MAX_LEASE:
            raise ValueError("grant revoked, expired or outside approved bounds")
        if hx(cs["CapabilityRegistry420"].functions.activeGrantId(actual[0], actual[1], actual[2], actual[3]).call(block_identifier=block.number)) != g["id"]:
            raise ValueError("grant superseded")
    operational = {address(roles[k]) for k in ("validator", "publisher", "resolver", "reporterA", "reporterB")}
    operational.add(cs["FantasyContestEngine420"].address)
    if address(p["governance"]) in operational:
        raise ValueError("operational keys cannot also control governance")
    allowed = {g["id"] for g in m["grants"]}
    for start in range(0, block.number+1, 5000):
        events = cs["CapabilityRegistry420"].events.CapabilityGranted().get_logs(from_block=start, to_block=min(start+4999, block.number))
        for event in events:
            args = event["args"]
            if args["principal"] not in operational or args["componentId"] != word(COMPONENT):
                continue
            g = cs["CapabilityRegistry420"].functions.grant(args["grantId"]).call(block_identifier=block.number)
            if not g[9] and (g[8] == 0 or block.timestamp < g[8]) and hx(args["grantId"]) not in allowed:
                raise ValueError("unapproved BET authority held by an operational key")
    if set(m["receipts"]) != set(STEPS):
        raise ValueError("deployment receipt inventory incomplete")
    for name, tx in m["receipts"].items():
        receipt = w3.eth.get_transaction_receipt(tx)
        if receipt.status != 1 or receipt.blockNumber > block.number or receipt.contractAddress != cs[name].address or receipt.blockHash != w3.eth.get_block(receipt.blockNumber).hash:
            raise ValueError("invalid, unfinalized or reorged deployment receipt")
        transaction = w3.eth.get_transaction(tx)
        args = {n: c.address for n, c in cs.items()}
        expected = creation_transaction(build, name, args, p, transaction["from"])
        if transaction["to"] is not None or hx(transaction["input"]) != expected["data"]:
            raise ValueError("deployment constructor/source mismatch")
    if hx(w3.eth.get_block(block.number).hash) != hx(block.hash):
        raise ValueError("snapshot changed during attestation")
    return {"status": "LOCAL_DEPLOYMENT_VERIFIED" if m["localQualification"] else "TESTNET_TECHNICAL_BINDINGS_VERIFIED",
            "manifestDigest": m["intentDigest"], "block": block.number, "blockHash": hx(block.hash),
            "productionAuthorized": False, "officialDesignationApproved": False}


def export_application(w3, build, manifest, metadata, official=False):
    verify(w3, build, manifest, official)
    modules = manifest["modules"]
    params = manifest["parameters"]
    pools = params.get("pools", [params["pool"]])
    if metadata["plannedPools"] != pools or set(metadata["slates"]) != {params["slate"]}:
        raise ValueError("application discovery must match the provisioned pool/slate")
    if any(metadata["candidateFeeds"].get(pid) not in {f["id"] for f in manifest["feeds"]} for pid in pools) or metadata["candidateFeed"] != metadata["candidateFeeds"][params["pool"]]:
        raise ValueError("application candidate feed is not pinned")
    if metadata["rpc"] != w3.provider.endpoint_uri:
        raise ValueError("application RPC differs from attested provider")
    value = {key: metadata[key] for key in ("rpc", "deploymentBlock", "profiles", "slates", "plannedPools", "candidateFeed", "candidateFeeds")}
    value.update(assetKind="wrapped-native", chainID=manifest["chainID"], engine=modules["FantasyContestEngine420"]["address"],
                 asset=modules["Wrapped420"]["address"], localQualification=manifest["localQualification"],
                 codeHashes={v["address"]: v["runtimeKeccak"] for v in modules.values()},
                 deploymentManifestDigest=manifest["intentDigest"], genesisHash=manifest["genesisHash"])
    # Exercise the actual application's chain adapter and canonical roster reads.
    from chain import Chain
    client = Chain(value)
    slate = client.book.functions.slateOf(word(params["slate"])).call()
    if not slate[0] or hx(slate[1]) != value["slates"][params["slate"]]["feed"]:
        raise ValueError("application requires its actual sealed slate")
    client.roster(params["slate"], client.snapshot()["number"])
    return value


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("command", choices=("bundle", "transaction", "authority-plan", "oracle-plan", "revoke", "bind", "verify", "export-app"))
    p.add_argument("--build", required=True); p.add_argument("--output", required=True)
    p.add_argument("--manifest"); p.add_argument("--bindings"); p.add_argument("--step", choices=tuple(STEPS))
    p.add_argument("--parameters"); p.add_argument("--sender"); p.add_argument("--metadata"); p.add_argument("--rpc")
    p.add_argument("--roles"); p.add_argument("--valid-from", type=int); p.add_argument("--valid-until", type=int)
    p.add_argument("--intent"); p.add_argument("--local-qualification", action="store_true")
    p.add_argument("--grant-id")
    p.add_argument("--official", action="store_true"); a = p.parse_args()
    if a.command == "bundle":
        value = bundle(a.build)
    elif a.command == "transaction":
        value = creation_transaction(a.build, a.step, json.loads(Path(a.bindings).read_text()), json.loads(Path(a.parameters).read_text()), a.sender)
    else:
        url = urlparse(a.rpc)
        if url.scheme != "https" and not (url.scheme == "http" and url.hostname in ("127.0.0.1", "localhost")):
            raise ValueError("RPC must be HTTPS or loopback")
        w3 = Web3(Web3.HTTPProvider(a.rpc, request_kwargs={"timeout": 15}))
        if a.command == "revoke":
            value = revocation_transaction(w3, a.build, json.loads(Path(a.bindings).read_text()), a.grant_id, a.sender)
        elif a.command == "oracle-plan":
            intent = json.loads(Path(a.intent).read_text())
            value = oracle_authority_plan(w3, a.build, intent["modules"], intent["roles"], intent["providers"], intent["feeds"], a.sender)
        elif a.command == "authority-plan":
            params = json.loads(Path(a.parameters).read_text())
            value = role_plan(w3, a.build, json.loads(Path(a.bindings).read_text()), json.loads(Path(a.roles).read_text()), params["slate"], params.get("pools", [params["pool"]]), params.get("claim"), a.valid_from, a.valid_until)
        elif a.command == "bind":
            intent = json.loads(Path(a.intent).read_text())
            network = intent["network"]
            if network["chainID"] != w3.eth.chain_id or network["genesisHash"] != hx(w3.eth.get_block(0).hash) or network["rpc"] != a.rpc:
                raise ValueError("official input network differs from connected chain")
            value = snapshot_manifest(w3, a.build, intent["modules"], intent["parameters"], intent["roles"], intent["feeds"], intent["providers"], intent["grants"], intent["receipts"], a.local_qualification)
            verify(w3, a.build, value, a.official)
        else:
            m = json.loads(Path(a.manifest).read_text())
            value = verify(w3, a.build, m, a.official) if a.command == "verify" else export_application(w3, a.build, m, json.loads(Path(a.metadata).read_text()), a.official)
    target = Path(a.output)
    with target.open("x", encoding="utf-8") as f:
        f.write(json.dumps(value, indent=2) + "\n")


if __name__ == "__main__":
    main()

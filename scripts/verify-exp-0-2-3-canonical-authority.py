#!/usr/bin/env python3
import csv
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
MATRIX=ROOT/"docs/audit/EXP-0.2.3-canonical-authority-matrix.json"
PROFILE=ROOT/"contracts/config/420explorer-genesis.json"
ADDR_A=ROOT/"config/system-addresses.json"
ADDR_B=ROOT/"contracts/config/system-addresses.json"
EVIDENCE=ROOT/"exp-0-2-3-evidence"

EXPECTED_DOMAINS=[
"chain inclusion and execution truth",
"head safe finalized status",
"fixed Genesis system addresses",
"Registry-resolved application implementations",
"Indexer database and checkpoints",
"contract runtime identity and decoding",
"Names and Identity labels",
"transaction settlement and payment meaning",
"staking, validator and reward authority",
"governance authority",
"wallet, custody and execution authority",
"privacy-sensitive off-chain data",
"service health and wrong-network/staleness detection",
]

def load(p):
    return json.loads(p.read_text(encoding="utf-8"))

def main():
    errors=[]
    matrix=load(MATRIX)
    profile=load(PROFILE)
    addr_a=load(ADDR_A)
    addr_b=load(ADDR_B)

    if matrix.get("schema")!="420explorer-exp-0.2.3-canonical-authority-v1":
        errors.append("unexpected matrix schema")
    if matrix.get("milestone")!="EXP-0.2.3":
        errors.append("unexpected milestone")

    auth=matrix.get("authorities",[])
    domains=[x.get("domain") for x in auth]
    ids=[x.get("id") for x in auth]
    if domains!=EXPECTED_DOMAINS:
        errors.append(f"authority domain list/order mismatch: {domains}")
    if len(ids)!=len(set(ids)):
        errors.append("duplicate authority id")
    if len(domains)!=len(set(domains)):
        errors.append("duplicate authority domain")

    for x in auth:
        name=x.get("domain","<unnamed>")
        for field in ("canonical_authority","explorer_role","indexer_role","conflict_resolution"):
            if not isinstance(x.get(field),str) or not x.get(field).strip():
                errors.append(f"{name}: missing {field}")
        for field in ("requirements","evidence"):
            if not isinstance(x.get(field),list) or not x.get(field):
                errors.append(f"{name}: {field} must be non-empty list")
        for rel in x.get("evidence",[]):
            if not (ROOT/rel).exists():
                errors.append(f"{name}: evidence path missing: {rel}")

    if profile.get("canonicalStateAuthority") is not False:
        errors.append("Explorer unexpectedly claims canonical state authority")
    consumer=profile.get("indexerConsumer",{})
    for key in ("independentChainIngestion","independentCheckpointStore","independentReorgEngine","independentProtocolDecoderRegistry"):
        if consumer.get(key) is not False:
            errors.append(f"Explorer independent authority unexpectedly enabled: {key}")
    if consumer.get("failClosedOnCanonicalAuthorityClaim") is not True:
        errors.append("canonical authority claim fail-closed rule missing")
    if consumer.get("requiredChainId")!=420:
        errors.append("required chain id changed from 420")

    indexing=profile.get("indexing",{})
    if indexing.get("databaseIsNonCanonical") is not True:
        errors.append("Indexer database no longer explicitly non-canonical")
    if indexing.get("rebuildableFromChain") is not True:
        errors.append("Indexer no longer explicitly rebuildable from chain")
    if indexing.get("tracksHeadSafeFinalizedSeparately") is not True:
        errors.append("head/safe/finalized separation disabled")
    if indexing.get("finalizedHistoryImmutable") is not True:
        errors.append("finalized history immutability disabled")

    if addr_a != addr_b:
        errors.append("frozen system-address maps diverge")
    assignments=addr_a.get("assignments",[])
    by_name={x.get("name"):x.get("address") for x in assignments}
    if by_name.get("ProtocolRegistry")!="0x0000000000000000000000000000000000000434":
        errors.append("ProtocolRegistry frozen address changed")
    if any("explorer" in str(x.get("name","")).lower() for x in assignments):
        errors.append("Explorer unexpectedly owns a frozen system address")

    cv=profile.get("contractVerification",{})
    if cv.get("sourceVerificationCannotOverrideRuntimeBytecode") is not True:
        errors.append("source verification may override runtime bytecode")
    if cv.get("verifiedSourceIsPresentationMetadata") is not True:
        errors.append("verified source no longer classified as presentation metadata")

    inv=profile.get("invariants",[])
    inv_ids={s.split(":",1)[0].strip() for s in inv if isinstance(s,str)}
    expected_inv={f"EXP-INV-{i:03d}" for i in range(1,14)}
    if inv_ids!=expected_inv:
        errors.append(f"Explorer invariant set mismatch: {sorted(inv_ids)}")

    global_rules=" ".join(matrix.get("global_invariants",[])).lower()
    for phrase in [
        "explorer is never canonical protocol authority",
        "indexer is never canonical protocol authority",
        "fixed genesis predeploy identity",
        "registry-resolved application identity",
        "cannot override runtime execution truth",
    ]:
        if phrase not in global_rules:
            errors.append(f"global invariant missing: {phrase}")

    by_domain={x.get("domain"):x for x in auth}
    names=by_domain.get("Names and Identity labels",{})
    if "optional display enrichment" not in " ".join(names.get("requirements",[])).lower() and "display" not in names.get("explorer_role","").lower():
        errors.append("Names/Identity display-only boundary missing")

    for domain in [
        "transaction settlement and payment meaning",
        "staking, validator and reward authority",
        "governance authority",
        "wallet, custody and execution authority",
        "privacy-sensitive off-chain data",
    ]:
        item=by_domain.get(domain,{})
        text_blob=(" ".join(item.get("requirements",[]))+" "+item.get("explorer_role","")+" "+item.get("conflict_resolution","")).lower()
        if "authority" not in text_blob and "must not" not in text_blob and "cannot" not in text_blob and "only" not in text_blob:
            errors.append(f"{domain}: insufficient authority boundary language")

    EVIDENCE.mkdir(exist_ok=True)
    summary={
        "schema":"exp-0.2.3-evidence-v1",
        "milestone":"EXP-0.2.3",
        "authority_domains":len(auth),
        "profile_invariants":len(inv_ids),
        "system_address_maps_match":addr_a==addr_b,
        "protocol_registry_address":by_name.get("ProtocolRegistry"),
        "required_chain_id":consumer.get("requiredChainId"),
        "canonical_state_authority":profile.get("canonicalStateAuthority"),
        "errors":errors,
        "pass":not errors,
    }
    (EVIDENCE/"summary.json").write_text(json.dumps(summary,indent=2)+"\n",encoding="utf-8")
    with (EVIDENCE/"authorities.tsv").open("w",encoding="utf-8",newline="") as fh:
        w=csv.writer(fh,delimiter="\t")
        w.writerow(["id","domain","canonical_authority","explorer_role","indexer_role"])
        for x in auth:
            w.writerow([x.get("id",""),x.get("domain",""),x.get("canonical_authority",""),x.get("explorer_role",""),x.get("indexer_role","")])
    print(json.dumps(summary,indent=2))
    if errors:
        raise SystemExit(1)

if __name__=="__main__":
    main()

#!/usr/bin/env python3
import csv
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
MATRIX=ROOT/"docs/audit/EXP-0.3.2-mandatory-capability-paths.json"
REQS=ROOT/"docs/audit/EXP-0.3.1-authoritative-genesis-requirements.json"
CAPS=ROOT/"docs/audit/EXP-0.2.1-genesis-capability-matrix.json"
PROFILE=ROOT/"contracts/config/420explorer-genesis.json"
ACMAP=ROOT/"docs/audit/EXP-0.2.6-genesis-acceptance-criteria.json"
EVIDENCE=ROOT/"exp-0-3-2-evidence"

def load(p): return json.loads(p.read_text(encoding="utf-8"))
def text(p): return p.read_text(encoding="utf-8")

def ensure_tokens(errors, label, path, tokens):
    p=ROOT/path
    if not p.exists():
        errors.append(f"{label}: missing path {path}")
        return
    content=text(p)
    for token in tokens:
        if token not in content:
            errors.append(f"{label}: token not found in {path}: {token}")

def main():
    errors=[]
    m=load(MATRIX); req=load(REQS); caps=load(CAPS); profile=load(PROFILE); acmap=load(ACMAP)
    paths=m.get("paths",[])
    if m.get("schema")!="420explorer-exp-0.3.2-mandatory-capability-paths-v1": errors.append("unexpected schema")
    if m.get("milestone")!="EXP-0.3.2": errors.append("unexpected milestone")
    if m.get("baseline",{}).get("main_commit")!="c7cb5f4dac07eb9416cac4a11eeee31b6efb10f0": errors.append("baseline main drift")
    if len(paths)!=10: errors.append(f"expected 10 paths, found {len(paths)}")

    expected_views=profile.get("requiredViews",[])
    names=[p.get("name") for p in paths]
    if names!=expected_views: errors.append(f"required view path order mismatch: {names}")

    req_by_id={r["id"]:r for r in req.get("requirements",[])}
    cap_by_id={c["id"]:c for c in caps.get("capabilities",[])}
    valid_ac={c["id"] for c in acmap.get("criteria",[])}

    ids=[p.get("id") for p in paths]
    if len(ids)!=len(set(ids)): errors.append("duplicate path id")

    for p in paths:
        pid=p.get("id","<missing>")
        rid=p.get("requirement_id"); cid=p.get("capability_id")
        r=req_by_id.get(rid); c=cap_by_id.get(cid)
        if not r: errors.append(f"{pid}: missing requirement {rid}")
        else:
            if r.get("classification")!="mandatory_genesis" or r.get("category")!="required_view":
                errors.append(f"{pid}: requirement is not mandatory required_view")
            if r.get("name")!=p.get("name"): errors.append(f"{pid}: requirement/name mismatch")
            if r.get("current_status")!=p.get("capability_status"):
                errors.append(f"{pid}: capability status drift from EXP-0.3.1")
        if not c: errors.append(f"{pid}: missing capability {cid}")
        else:
            if c.get("classification")!="mandatory_genesis": errors.append(f"{pid}: capability is not mandatory")
            if c.get("name")!=p.get("name"): errors.append(f"{pid}: EXP-0.2 capability/name mismatch")

        if p.get("source_path_status")!="complete_source_path":
            errors.append(f"{pid}: path is not complete_source_path")

        for layer in ("frontend","explorer_api","explorer_service","indexer_client","indexer_api","indexer_projection"):
            if not isinstance(p.get(layer),dict): errors.append(f"{pid}: missing layer {layer}")

        f=p.get("frontend",{})
        ensure_tokens(errors,pid,f.get("path",""),[f"function {fn}(" for fn in f.get("functions",[])])

        ea=p.get("explorer_api",{})
        ensure_tokens(errors,pid,ea.get("path",""),ea.get("handlers",[]))
        api_content=text(ROOT/ea["path"]) if ea.get("path") and (ROOT/ea["path"]).exists() else ""
        for route in ea.get("routes",[]):
            method,path=route.split(" ",1)
            literal=f'{method} {path}'
            if literal not in api_content:
                errors.append(f"{pid}: Explorer API route missing: {literal}")

        es=p.get("explorer_service",{})
        ensure_tokens(errors,pid,es.get("path",""),[op+"(" for op in es.get("operations",[])])
        if es.get("additional_path"):
            ensure_tokens(errors,pid,es["additional_path"],[op+"(" for op in es.get("additional_operations",[])])

        ic=p.get("indexer_client",{})
        ensure_tokens(errors,pid,ic.get("path",""),[op+"(" for op in ic.get("operations",[])])
        if ic.get("additional_path"):
            ensure_tokens(errors,pid,ic["additional_path"],[op+"(" for op in ic.get("additional_operations",[])])
        for rel in [ic.get("path"),ic.get("additional_path")]:
            if rel and not (ROOT/rel).exists(): errors.append(f"{pid}: missing Indexer client path {rel}")

        ia=p.get("indexer_api",{})
        if not ia.get("path") or not (ROOT/ia["path"]).exists(): errors.append(f"{pid}: missing Indexer API path")
        else:
            content=text(ROOT/ia["path"])
            for route in ia.get("routes",[]):
                method,path=route.split(" ",1)
                # Query examples in the matrix are normalized to their registered route.
                registered=path.split("?",1)[0]
                literal=f'{method} {registered}'
                if literal not in content:
                    errors.append(f"{pid}: Indexer API route missing: {literal}")
        if ia.get("additional_path") and not (ROOT/ia["additional_path"]).exists():
            errors.append(f"{pid}: missing additional Indexer API path {ia['additional_path']}")

        ip=p.get("indexer_projection",{})
        for rel in ip.get("paths",[]):
            if not (ROOT/rel).exists(): errors.append(f"{pid}: missing projection path {rel}")
        if not ip.get("models"): errors.append(f"{pid}: projection model list missing")

        if not isinstance(p.get("canonical_authority"),str) or not p["canonical_authority"].strip():
            errors.append(f"{pid}: canonical authority missing")
        for rel in p.get("authority_evidence",[]):
            if not (ROOT/rel).exists(): errors.append(f"{pid}: authority evidence missing {rel}")
        if not p.get("known_gaps"): errors.append(f"{pid}: known_gaps must be explicit")
        if not p.get("later_owners"): errors.append(f"{pid}: later owners missing")
        if not p.get("acceptance_criteria"): errors.append(f"{pid}: acceptance criteria missing")
        for ac in p.get("acceptance_criteria",[]):
            if ac not in valid_ac: errors.append(f"{pid}: invalid acceptance criterion {ac}")

    by={p["name"]:p for p in paths}
    required_gap_tokens={
      "transaction":["fee"],
      "receipt/logs":["topic","data"],
      "validator":["historical","provider"],
      "epoch/rotation":["provider"],
      "protocol service/version":["protocolregistry","abi"],
    }
    for name,tokens in required_gap_tokens.items():
        blob=" ".join(by[name].get("known_gaps",[])).lower()
        for token in tokens:
            if token not in blob: errors.append(f"{name}: known gap token missing: {token}")

    summary=m.get("summary",{})
    computed_impl=sum(p.get("capability_status")=="implemented_source" for p in paths)
    computed_partial=sum(p.get("capability_status")=="partial_source" for p in paths)
    computed_complete=sum(p.get("source_path_status")=="complete_source_path" for p in paths)
    if summary.get("mandatory_required_views")!=10: errors.append("summary required-view count drift")
    if summary.get("complete_source_paths")!=computed_complete or computed_complete!=10: errors.append("complete path count drift")
    if summary.get("implemented_source")!=computed_impl or computed_impl!=6: errors.append("implemented_source count drift")
    if summary.get("partial_source")!=computed_partial or computed_partial!=4: errors.append("partial_source count drift")
    if summary.get("orphaned_paths")!=0: errors.append("orphaned path count must remain zero")

    meaning=m.get("qualification_meaning","").lower()
    for token in ("does not mean","deployed","live-qualified","genesis-qualified"):
        if token not in meaning: errors.append(f"qualification boundary missing token: {token}")

    EVIDENCE.mkdir(exist_ok=True)
    out={
      "schema":"exp-0.3.2-evidence-v1",
      "milestone":"EXP-0.3.2",
      "paths":len(paths),
      "complete_source_paths":computed_complete,
      "implemented_source":computed_impl,
      "partial_source":computed_partial,
      "orphaned_paths":10-computed_complete,
      "errors":errors,
      "pass":not errors
    }
    (EVIDENCE/"summary.json").write_text(json.dumps(out,indent=2)+"\n",encoding="utf-8")
    with (EVIDENCE/"capability-paths.tsv").open("w",encoding="utf-8",newline="") as fh:
        w=csv.writer(fh,delimiter="\t")
        w.writerow(["id","requirement_id","capability_id","name","path_status","capability_status","explorer_routes","indexer_routes","owners","acceptance_criteria"])
        for p in paths:
            w.writerow([p["id"],p["requirement_id"],p["capability_id"],p["name"],p["source_path_status"],p["capability_status"],",".join(p["explorer_api"]["routes"]),",".join(p["indexer_api"]["routes"]),",".join(p["later_owners"]),",".join(p["acceptance_criteria"])])
    print(json.dumps(out,indent=2))
    if errors: raise SystemExit(1)

if __name__=="__main__": main()

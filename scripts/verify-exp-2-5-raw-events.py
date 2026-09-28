#!/usr/bin/env python3
import json, pathlib, subprocess, sys

ROOT=pathlib.Path(__file__).resolve().parents[1]
errors=[]

def require(path,token,label):
    text=(ROOT/path).read_text(encoding="utf-8")
    if token not in text:
        errors.append(f"{label}: missing {token!r} in {path}")

def main():
    audit=json.loads((ROOT/"docs/audit/EXP-2.5-raw-call-events.json").read_text(encoding="utf-8"))
    if audit.get("milestone")!="EXP-2.5":
        errors.append("audit milestone mismatch")
    if audit.get("baseline",{}).get("exp_2_4_qualified_head")!="4009d9ab687a61f689fbf6a9d4faf3a818a2a21b":
        errors.append("EXP-2.4 baseline mismatch")

    checks=[
      ("explorer/service/transactionviews.go",'ValueWei    string `json:"valueWei,omitempty"`',"transaction value presentation"),
      ("explorer/service/transactionviews.go",'Input       string `json:"input,omitempty"`',"transaction input presentation"),
      ("explorer/service/eventviews.go","type RawLogView struct","raw log DTO"),
      ("explorer/service/eventviews.go","validateRawHexBytes","raw payload validation"),
      ("explorer/service/eventviews.go","Topics           []string","complete topic presentation"),
      ("explorer/service/eventviews.go","Data             string","raw data presentation"),
      ("explorer/service/exp_2_5_raw_events_test.go","TestEXP25TransactionPreservesRawCallAndEventPayload","raw transaction/event vector"),
      ("explorer/service/exp_2_5_raw_events_test.go","TestEXP25RejectsMalformedRawPayloads","malformed raw payload negatives"),
      ("explorer/service/exp_2_5_raw_events_test.go","TestEXP25BlockDetailUsesValidatedRawEventView","block event vector"),
      ("explorer/api/exp_2_5_raw_events_test.go","TestEXP25TransactionAndBlockAPISerializeRawEventPayloads","HTTP serialization vector"),
    ]
    for p,t,l in checks: require(p,t,l)

    scope=audit.get("scope_boundary",{})
    for key in ["deployed_ui_qualified","live_target_network_qualified","abi_decoding_qualified","revert_reason_decoding_qualified","verified_source_qualified","canonical_authority","genesis_ready_claim"]:
        if scope.get(key) is not False:
            errors.append(f"scope boundary must keep {key}=false")

    head=subprocess.check_output(["git","rev-parse","HEAD"],cwd=ROOT,text=True).strip()
    out=ROOT/"exp-2-5-evidence"; out.mkdir(exist_ok=True)
    summary={
      "schema":"420explorer-exp-2.5-evidence-v1",
      "milestone":"EXP-2.5",
      "head":head,
      "status":"qualified_repository_scope" if not errors else "failed",
      "errors":errors,
      "scope_boundary":scope,
    }
    (out/"summary.json").write_text(json.dumps(summary,indent=2)+"\n",encoding="utf-8")
    if errors:
        for e in errors: print("ERROR:",e,file=sys.stderr)
        return 1
    print(json.dumps(summary,indent=2))
    return 0

if __name__=="__main__":
    raise SystemExit(main())

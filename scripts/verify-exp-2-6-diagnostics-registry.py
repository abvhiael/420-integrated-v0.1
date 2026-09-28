#!/usr/bin/env python3
import json, pathlib, subprocess, sys

ROOT=pathlib.Path(__file__).resolve().parents[1]
errors=[]

def require(path,token,label):
    text=(ROOT/path).read_text(encoding="utf-8")
    if token not in text:
        errors.append(f"{label}: missing {token!r} in {path}")

def main():
    audit=json.loads((ROOT/"docs/audit/EXP-2.6-diagnostics-registry.json").read_text(encoding="utf-8"))
    if audit.get("milestone")!="EXP-2.6":
        errors.append("audit milestone mismatch")
    if audit.get("baseline",{}).get("exp_2_5_qualified_head")!="78ca89dd5302b1655a7a0592bf79473783db2f59":
        errors.append("EXP-2.5 baseline mismatch")

    checks=[
      ("explorer/service/service.go",'RuntimeIssue     string',"runtime issue status field"),
      ("explorer/service/service.go",'RuntimeIssueAt   *time.Time',"runtime issue timestamp"),
      ("explorer/service/service.go","service version inconsistent with request","service-version identity validation"),
      ("explorer/service/service.go","service version without activation provenance","activation provenance validation"),
      ("explorer/service/service.go","invalid deprecation provenance","deprecation validation"),
      ("explorer/service/registryviews.go","active registry version is not active in history","active-version history validation"),
      ("explorer/service/registryviews.go","active registry implementation does not match history","implementation history validation"),
      ("explorer/service/exp_2_6_diagnostics_registry_test.go","TestEXP26NetworkStatusPreservesRuntimeDiagnosticDetail","diagnostic propagation test"),
      ("explorer/service/exp_2_6_diagnostics_registry_test.go","TestEXP26ServiceVersionRejectsIdentityAndProvenanceDrift","service-version negatives"),
      ("explorer/api/exp_2_6_diagnostics_registry_test.go","TestEXP26CapabilitiesAdvertiseTroubleshootingAndRegistryContracts","capabilities contract test"),
      ("explorer/indexerclient/exp_2_6_registry_client_test.go","TestEXP26ServiceVersionClientRejectsAuthorityClaim","client authority test"),
    ]
    for p,t,l in checks: require(p,t,l)

    scope=audit.get("scope_boundary",{})
    for key in ["deployed_ui_qualified","live_target_network_qualified","live_registry_publication_qualified","production_recovery_qualified","canonical_authority","genesis_ready_claim"]:
        if scope.get(key) is not False:
            errors.append(f"scope boundary must keep {key}=false")

    head=subprocess.check_output(["git","rev-parse","HEAD"],cwd=ROOT,text=True).strip()
    out=ROOT/"exp-2-6-evidence"; out.mkdir(exist_ok=True)
    summary={
      "schema":"420explorer-exp-2.6-evidence-v1",
      "milestone":"EXP-2.6",
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

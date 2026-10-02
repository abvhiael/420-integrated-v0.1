#!/usr/bin/env python3
import json, pathlib, sys

ROOT=pathlib.Path(__file__).resolve().parents[1]

def read(path):
    return (ROOT/path).read_text(encoding="utf-8")

def load(path):
    return json.loads(read(path))

def need(cond,msg,errors):
    if not cond:
        errors.append(msg)

def main():
    errors=[]
    required_docs=[
        "docs/apps/governance/index.md",
        "docs/apps/governance/getting-started.md",
        "docs/apps/governance/user-guide.md",
        "docs/apps/governance/concepts.md",
        "docs/apps/governance/architecture.md",
        "docs/apps/governance/permissions.md",
        "docs/apps/governance/fees.md",
        "docs/apps/governance/security.md",
        "docs/apps/governance/operator-guide.md",
        "docs/apps/governance/troubleshooting.md",
        "docs/apps/governance/integration.md",
        "docs/apps/governance/faq.md",
        "docs/apps/governance/qualification.md",
        "docs/apps/governance/developer/index.md",
        "docs/apps/governance/developer/contracts.md",
        "docs/apps/governance/developer/api.md",
        "docs/apps/governance/developer/events.md",
        "docs/apps/governance/developer/errors.md",
        "docs/apps/governance/developer/examples.md",
    ]
    for p in required_docs:
        need((ROOT/p).exists(),f"missing Governance closeout doc: {p}",errors)

    deploy=load("contracts/config/governance-deployment-v1.json")
    need(deploy.get("status")=="READY_FOR_REPRODUCIBLE_DEPLOYMENT","deployment spec not repository-ready",errors)
    need(deploy.get("compiler",{}).get("solidity")=="0.8.24","solidity pin drift",errors)
    need(deploy.get("compiler",{}).get("evmVersion")=="cancun","EVM pin drift",errors)
    need(deploy.get("registry",{}).get("address","").lower()=="0x0000000000000000000000000000000000000434","registry address drift",errors)
    need(deploy.get("registry",{}).get("serviceId",{}).get("preimage")=="420/service/governance/v1","governance service id drift",errors)
    fixed={x["name"]:x["address"].lower() for x in deploy.get("fixedPredeploys",[])}
    need(fixed.get("GovernanceTimelock")=="0x0000000000000000000000000000000000000429","Timelock address drift",errors)
    need(fixed.get("Governance420")=="0x0000000000000000000000000000000000000437","Governance420 address drift",errors)
    order="\n".join(deploy.get("initializationOrder",[]))
    need("five core Civic component IDs plus two electorate-source component IDs" in order,"deployment inventory still describes only five Registry components",errors)

    index=read("docs/apps/governance/index.md")
    operator=read("docs/apps/governance/operator-guide.md")
    security=read("docs/apps/governance/security.md")
    permissions=read("docs/apps/governance/permissions.md")
    architecture=read("docs/apps/governance/architecture.md")
    events=read("docs/apps/governance/developer/events.md")
    qualification=read("docs/apps/governance/qualification.md")
    mkdocs=read("mkdocs.yml")
    roadmap=read("docs/audit/420GOVERNANCE-AUDIT-REMEDIATION-ROADMAP.md")

    for token in [
        "0x0000000000000000000000000000000000000429",
        "0x0000000000000000000000000000000000000437",
        "420/service/governance/v1",
        "Live production-equivalent testnet deployment",
    ]:
        need(token in index,f"overview missing canonical token: {token}",errors)

    for token in [
        "Configuration and environment",
        "Build and verification",
        "Compiler/runtime pins",
        "Initialization order",
        "Bootstrap recovery",
        "Upgrade and migration policy",
        "Incident response",
    ]:
        need(token in operator,f"operator guide missing section: {token}",errors)

    for token in [
        "Security objectives",
        "Trust boundaries",
        "Threat: malicious or stale frontend",
        "Threat: Registry substitution",
        "Threat: electorate or stake manipulation",
        "Threat: action substitution",
        "Threat: premature or replayed execution",
        "Threat: reentrancy through governed targets",
        "Threat: cancellation or emergency override backdoor",
        "Threat: bootstrap capture",
        "Threat: derived-service authority creep",
        "Accepted limitations",
    ]:
        need(token in security,f"threat model missing section: {token}",errors)

    need("permissionless" in permissions and "GovernanceTimelock only" in permissions,"permissions model incomplete",errors)
    need("Proposal state machine" in architecture and "Component map" in architecture,"architecture map/state machine missing",errors)
    for token in ["CivicProposalCreated","CivicVoteCast","CivicProposalFinalized","CivicProposalQueued","CivicProposalExecuted"]:
        need(token in events,f"event reference missing: {token}",errors)

    for n in range(1,8):
        need(f"GOV-AUDIT-{n} | COMPLETE" in qualification,f"qualification ledger missing completed GOV-AUDIT-{n}",errors)
    need(("GOV-AUDIT-8 | phase closeout in qualification" in qualification) or ("GOV-AUDIT-8 | COMPLETE" in qualification),"qualification ledger missing GOV-AUDIT-8 closeout state",errors)

    for token in [
        "Operator Guide: apps/governance/operator-guide.md",
        "Integration Boundaries: apps/governance/integration.md",
        "Qualification Ledger: apps/governance/qualification.md",
    ]:
        need(token in mkdocs,f"mkdocs Governance nav missing: {token}",errors)

    for n in range(1,8):
        heading=f"## GOV-AUDIT-{n}"
        start=roadmap.find(heading)
        need(start>=0,f"roadmap missing GOV-AUDIT-{n}",errors)
        if start>=0:
            nxt=roadmap.find("\n## GOV-AUDIT-",start+1)
            section=roadmap[start:nxt if nxt>=0 else len(roadmap)]
            need("Status: COMPLETE" in section,f"roadmap GOV-AUDIT-{n} not COMPLETE before phase closeout",errors)

    out={
        "step":"GOV-AUDIT-8",
        "pass":not errors,
        "errors":errors,
        "requiredDocs":len(required_docs),
        "fixedAuthority":{"ProtocolRegistry":"0x0434","GovernanceTimelock":"0x0429","Governance420":"0x0437"},
        "level3Required":True,
    }
    print(json.dumps(out,indent=2))
    return 0 if not errors else 2

if __name__=="__main__":
    raise SystemExit(main())

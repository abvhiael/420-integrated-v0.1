#!/usr/bin/env python3
"""C08.1: ensure every canonical C01-C07 entry has retained evidence, with Level 2 owner boundaries."""
from pathlib import Path
import re,json
root=Path(__file__).resolve().parents[1]
roadmap=(root/"docs/compliance/420COMPLIANCE-ROADMAP.md").read_text()
evidence=root/"docs/compliance"
steps=re.findall(r"^\| (C0[1-7]\.\d+) \|",roadmap,re.M)
assert len(steps)==len(set(steps)) and len(steps)>=70,("unexpected roadmap inventory",len(steps))
milestones={"C01.8","C02.10","C03.11","C04.11","C05.12","C06.9","C07.10"}
missing=[]
for step in steps:
    historical=evidence/"qualification"/(step+("-level2.json" if step in milestones else "-level1.json"))
    later=sorted((evidence/"evidence").glob(step+"-LEVEL*-EXACT-SHA-*.md"))
    if not historical.is_file() and not later:missing.append(step)
assert set(missing)=={"C06.5","C06.6","C06.7","C06.8","C07.6"},("unreconciled evidence gaps",missing)
for p in ["C07.7","C07.8","C07.9","C07.10"]:
    matches=list((evidence/"evidence").glob(p+"-LEVEL*-EXACT-SHA-*.md"))
    assert len(matches)==1,(p,matches)
    contents=matches[0].read_text()
    assert "implementation" in contents.lower() and "github.com/abvhiael/420-integrated-v0.1/actions/runs/" in contents,p
m=json.loads((evidence/"C07.9-SECURITY-REVIEW-INTAKE.json").read_text())
assert m["independent_review_status"]=="NOT_PERFORMED"
assert len(m["threats"])==16
record=(evidence/"C08.1-RECONCILIATION.md").read_text()
for term in ("C06.5–C06.8","C07.6","597","1597","c5a4f220d1fbda01f707d359aa9bb32921a138b1","C08.5","NOT APPROVED","TESTNET"):
    assert term in record,term
print(f"C08.1 evidence inventory: {len(steps)} canonical C01-C07 steps; recorded exceptions: {missing}; T01-T16; main divergence explicitly OPEN")

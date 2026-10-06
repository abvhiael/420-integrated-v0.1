#!/usr/bin/env python3
from pathlib import Path
import shutil, subprocess, tempfile
ROOT = Path(__file__).resolve().parents[1]
VERIFY = ROOT / "scripts/verify-puffbuddies-pb0.py"

def fixture():
    root = Path(tempfile.mkdtemp(prefix="pb0-invariants-"))
    (root/"docs").mkdir(); shutil.copytree(ROOT/"docs/puffbuddies", root/"docs/puffbuddies")
    (root/"scripts").mkdir(); shutil.copy2(VERIFY, root/"scripts/verify-puffbuddies-pb0.py")
    return root

def run(root):
    return subprocess.run(["python3", str(root/"scripts/verify-puffbuddies-pb0.py")], cwd=root, text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT)

def mutate(root, rel, old, new):
    p=root/rel; s=p.read_text(encoding="utf-8")
    if s.count(old)!=1: raise AssertionError(f"{rel}: mutation anchor count {s.count(old)} for {old!r}")
    p.write_text(s.replace(old,new,1),encoding="utf-8")

root=fixture()
try:
    r=run(root)
    if r.returncode: raise AssertionError("clean fixture failed:\n"+r.stdout)
finally: shutil.rmtree(root)

cases=[
("identity id","docs/puffbuddies/PUFFBUDDIES.md","### PB-ID-008","### PB-ID-099"),
("adult floor","docs/puffbuddies/PB-0.6-ADULT-ELIGIBILITY-POLICY.md","18 years of age or older","16 years of age or older"),
("mutual messaging","docs/puffbuddies/PB-0.5-CONSENT-INVARIANTS.md","ordinary private dating/social communication requires reciprocal authorized interest","ordinary private dating/social communication may precede reciprocal authorized interest"),
("block supremacy","docs/puffbuddies/PB-0.5-CONSENT-INVARIANTS.md","blocking overrides prior relationship or payment state","payment state may override blocking"),
("fixed address","docs/puffbuddies/PB-0.18-DOCUMENTATION-INVARIANT-TESTS.md","## PB-0.18 completion boundary","0x1111111111111111111111111111111111111111\n\n## PB-0.18 completion boundary"),
("service id","docs/puffbuddies/PB-0.18-DOCUMENTATION-INVARIANT-TESTS.md","## PB-0.18 completion boundary","420/service/puffbuddies\n\n## PB-0.18 completion boundary"),
("structure id","docs/puffbuddies/PB-0.17-REPOSITORY-STRUCTURE.md","### PB-STRUCT-020","### PB-STRUCT-099"),
("roadmap complete","docs/puffbuddies/PUFFBUDDIES-ROADMAP.md","### PB-0.17 — Repository structure — COMPLETE","### PB-0.17 — Repository structure"),
]
for name,rel,old,new in cases:
    root=fixture()
    try:
        mutate(root,rel,old,new); r=run(root)
        if r.returncode==0: raise AssertionError("mutation unexpectedly passed: "+name)
    finally: shutil.rmtree(root)
print(f"PASS: clean fixture plus {len(cases)} adversarial PB-0 mutations")

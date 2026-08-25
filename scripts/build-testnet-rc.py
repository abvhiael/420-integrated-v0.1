#!/usr/bin/env python3
import hashlib, json, pathlib, shutil, subprocess, sys, zipfile, datetime

root=pathlib.Path(__file__).resolve().parents[1]
manifest=json.loads((root/"release/rc/manifest.json").read_text())
version=manifest["version"]

# Run default tests; RC packaging is not allowed from a broken source tree.
cp=subprocess.run(["go","test","./..."],cwd=root)
if cp.returncode!=0:
    raise SystemExit("go test failed")

stage=root/"release"/"rc"/version
if stage.exists():shutil.rmtree(stage)
stage.mkdir(parents=True)

include=[
 "config","consensus","execution","genesis","contracts","devnet","integration",
 "simulations","testvectors","scripts","docker","docs","release/rc/manifest.json",
 "go.mod","Makefile","README-STEP4.md","VERSION"
]
for rel in include:
    src=root/rel
    if not src.exists():continue
    dst=stage/rel
    if src.is_dir():
        shutil.copytree(src,dst,dirs_exist_ok=True,
                        ignore=shutil.ignore_patterns("devnet-data","bin","*.log"))
    else:
        dst.parent.mkdir(parents=True,exist_ok=True)
        shutil.copy2(src,dst)

# Build deterministic-ish source checksums.
hashes=[]
for p in sorted(stage.rglob("*")):
    if p.is_file():
        hashes.append(f"{hashlib.sha256(p.read_bytes()).hexdigest()}  {p.relative_to(stage)}")
(stage/"SHA256SUMS.txt").write_text("\n".join(hashes)+"\n")

metadata={
 "schema":"420-integrated-testnet-rc-build-v1",
 "version":version,
 "release_channel":"TESTNET_RC",
 "built_utc":datetime.datetime.now(datetime.timezone.utc).isoformat(),
 "public_testnet_ready":False,
 "note":"RC packaging is not public-launch authorization. Check release/evidence-status.json."
}
(stage/"BUILD-METADATA.json").write_text(json.dumps(metadata,indent=2)+"\n")

out=root/"release"/"rc"/f"420-integrated-{version}.zip"
if out.exists():out.unlink()
with zipfile.ZipFile(out,"w",zipfile.ZIP_DEFLATED) as z:
    for p in sorted(stage.rglob("*")):
        if p.is_file():
            z.write(p,pathlib.Path(f"420-integrated-{version}")/p.relative_to(stage))
sha=hashlib.sha256(out.read_bytes()).hexdigest()
(root/"release"/"rc"/f"420-integrated-{version}.zip.sha256").write_text(f"{sha}  {out.name}\n")
print(out)
print(sha)

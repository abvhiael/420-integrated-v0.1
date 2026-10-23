#!/usr/bin/env python3
"""Sativa Steve Phase F Level 2 scoped PNG and manifest qualification."""
import hashlib, json, re, sys, struct
from pathlib import Path
from PIL import Image

ROOT=Path("assets/arcade/mad-buds/sativa-steve/animations")
NAMES=["jittery_idle","sunglasses_adjustment","rapid_foot_shuffle","cannon_loading","flight","overdrive_activation","extreme_speed_stretch","wall_splat","spinning_recovery","victory_pacing","dizzy_failure"]
results=[]
for i,name in enumerate(NAMES,1):
    key=f"ss_anim_{i:02}_{name}"
    stem=f"sativa_steve_anim_{i:02}_{name}"
    folder=ROOT/key
    errors=[]; warnings=[]
    expected=[f"{stem}_frame_{n:02}.png" for n in range(1,11)]
    if not folder.is_dir():
        errors.append("missing canonical directory")
        results.append(dict(id=key, errors=errors, warnings=warnings, result="FAIL"))
        continue
    actual=sorted(p.name for p in folder.glob("*_frame_*.png"))
    if actual!=expected:errors.append("frame filename inventory mismatch; expected 10 ordered PNGs")
    mp=folder/(stem+".json")
    if not mp.exists():
        errors.append("missing JSON manifest")
        m={}
    else:
        try:m=json.loads(mp.read_text(encoding="utf-8"))
        except Exception as e:errors.append(f"invalid JSON: {e}");m={}
    f=m.get("frames",[])
    if len(f)!=10:errors.append(f"manifest entry count {len(f)} not 10")
    if m.get("fps")!=10:errors.append("FPS != 10")
    declared=m.get("frameCount",m.get("frame_count"))
    if declared!=10:errors.append("frame count field not 10")
    actualid=m.get("animationId",m.get("animation_id"))
    if actualid is not None and actualid not in (key,f"ss_anim_{i:02}"):
        errors.append(f"unexpected animation id: {actualid}")
    dest=m.get("repositoryDestination",m.get("repository_destination",m.get("export_folder_suggestion")))
    if dest!=str(folder)+"/":errors.append(f"repository path mismatch: {dest}")
    legacy=m.get("export_folder_suggestion")
    if legacy and legacy!=str(folder)+"/":errors.append("stale suggested export folder")
    shape=m.get("dimensions",m.get("canvas",{}))
    if (m.get("frameWidth",shape.get("width")),m.get("frameHeight",shape.get("height")))!=(1024,1024):
        errors.append("manifest dimensions mismatch")
    byname={entry.get("filename",entry.get("file")):entry for entry in f}
    for n,fn in enumerate(expected,1):
        if n<=len(f) and f[n-1].get("filename",f[n-1].get("file"))!=fn:errors.append(f"frame {n:02} order mismatch")
        p=folder/fn
        if not p.is_file():errors.append("missing "+fn);continue
        ent=byname.get(fn)
        if ent is None:errors.append("manifest missing "+fn)
        else:
            if ent.get("index")!=n:errors.append("wrong index "+fn)
            duration=ent.get("durationMs",ent.get("duration_ms"))
            if duration is not None and duration!=100:errors.append("bad frame timing "+fn)
            if hashlib.sha256(p.read_bytes()).hexdigest()!=ent.get("sha256"):
                errors.append("SHA256 mismatch "+fn+" actual="+hashlib.sha256(p.read_bytes()).hexdigest())
        try:
            with Image.open(p) as im:
                im.load()
                if im.size!=(1024,1024) or im.mode!="RGBA":errors.append("wrong PNG dimensions/mode "+fn)
                else:
                    lo,hi=im.getchannel("A").getextrema()
                    if lo!=0 or hi!=255:errors.append("invalid mixed transparency "+fn+f" extrema={lo},{hi}")
                    alpha=im.getchannel("A")
                    if any(alpha.getpixel(pt)!=0 for pt in ((0,0),(1023,0),(0,1023),(1023,1023))):
                        warnings.append("art touches canvas corner "+fn)
        except Exception as e:errors.append("invalid PNG "+fn+": "+str(e))
    results.append(dict(id=key,result="PASS" if not errors else "FAIL",errors=errors,warnings=warnings,frames=len(actual)))
report={"scope":"Sativa Steve SS-ANIM-01..11 Level 2 asset milestone","limitations":["Visual motion approval is separate from pixel and structural checks."],"summary":{"sets":11,"passed":sum(x["result"]=="PASS" for x in results),"failed":sum(x["result"]=="FAIL" for x in results)},"sets":results}
Path("sativa-steve-level2-qualification.json").write_text(json.dumps(report,indent=2)+"\n")
for row in results:
    print(row["id"],row["result"],"errors",len(row["errors"]),"warnings",len(row["warnings"]))
    for error in row["errors"]:print(" ERROR:",error)
print("SUMMARY",report["summary"])
sys.exit(1 if report["summary"]["failed"] else 0)

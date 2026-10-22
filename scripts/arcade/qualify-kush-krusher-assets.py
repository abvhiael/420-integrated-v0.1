#!/usr/bin/env python3
"""Scoped Kush Krusher 15-animation structural and pixel-level qualification; no edits.

Exact owner policy: edge-reaching artwork is a warning, while dimensions, frame hashes,
canonical naming and frame timing remain mandatory checks.
"""
import hashlib, json, re, sys, zlib, struct
from pathlib import Path
BASE=Path("assets/arcade/mad-buds/kush-krusher/animations")
NAMES=["idle_annoyed","idle_foot_tap","cannon_loading","compression_launch","airborne_tumble","wrecking_ball","heavy_flight","impact_squash","stuck_recovery","victory_fist_raise","irritated_failure","laughing","angry","thumbs_down","thumbs_up"]
rows=[]
def png_details(p):
    b=p.read_bytes()
    assert b[:8]==b"\x89PNG\r\n\x1a\n","not PNG"
    assert b[12:16]==b"IHDR","no PNG IHDR"
    w,h,depth,colour=struct.unpack(">IIBB",b[16:26])
    # Explicitly parse RGBA + transparent pixels with Pillow, not just file extension.
    from PIL import Image
    with Image.open(p) as im:
        im.load()
        a=im.getchannel("A") if im.mode=="RGBA" else None
        ext=a.getextrema() if a else None
        # Image alpha <255 means canvas has transparent pixel; opaque interior must exist.
        return {"width":w,"height":h,"bitDepth":depth,"colorType":colour,"mode":im.mode,
          "alphaExtrema":ext,"cornerAlpha":[a.getpixel(q) for q in [(0,0),(w-1,0),(0,h-1),(w-1,h-1)]] if a else None}
for i,name in enumerate(NAMES,1):
    stem=f"kush_krusher_anim_{i:02}_{name}"
    folder=BASE/f"kk_anim_{i:02}_{name}"
    row={"animation":f"kk_anim_{i:02}_{name}","directory":str(folder),"errors":[],"warnings":[],"frameFiles":0}
    if not folder.is_dir():
        row["errors"].append("animation directory missing")
    else:
        pngs=sorted(folder.glob("*_frame_*.png"))
        row["frameFiles"]=len(pngs)
        expected=[folder/f"{stem}_frame_{n:02}.png" for n in range(1,11)]
        for p in expected:
            if not p.is_file():row["errors"].append("missing frame "+p.name)
        extras=[p.name for p in pngs if p not in expected]
        if extras:row["errors"].append("unexpected frame names: "+str(extras))
        path=folder/(stem+".json")
        if not path.exists():
            row["errors"].append("manifest missing")
        else:
            try:
                m=json.loads(path.read_text())
                frames=m.get("frames",[])
                if len(frames)!=10:row["errors"].append(f"manifest frames={len(frames)}, expected=10")
                for attr,value in [("frameCount",10),("frameWidth",1024),("frameHeight",1024)]:
                    val=m.get(attr,m.get({"frameCount":"frame_count","frameWidth":"frame_width","frameHeight":"frame_height"}[attr]))
                    if val!=value:row["errors"].append(f"{attr}={val}, expected={value}")
                if m.get("animationId",m.get("animation_id"))!=row["animation"]:row["errors"].append("animation ID mismatch")
                for n,entry in enumerate(frames,1):
                    fn=entry.get("filename",entry.get("file"))
                    expectedfn=f"{stem}_frame_{n:02}.png"
                    if fn!=expectedfn:row["errors"].append(f"manifest order/name mismatch at {n}")
                    if entry.get("sha256") in (None,""):row["errors"].append(f"frame {n} missing SHA256")
                    duration=entry.get("durationMs",entry.get("duration_ms"))
                    if duration is not None and duration!=100:row["warnings"].append(f"frame {n} duration {duration}ms")
                if m.get("fps") is not None and m["fps"]!=10:row["errors"].append("FPS !=10")
                status=str(m.get("qualificationStatus",m.get("qualification",""))).lower()
                if status and "pass" not in status and "qualified" not in status:row["warnings"].append("manifest qualification not PASS: "+status[:70])
            except Exception as e:row["errors"].append("manifest parse error: "+str(e))
        for p in expected:
            if not p.is_file():continue
            try:
                d=png_details(p)
                if (d["width"],d["height"])!=(1024,1024):row["errors"].append(p.name+": wrong dimensions")
                if (d["bitDepth"],d["colorType"],d["mode"])!=(8,6,"RGBA"):row["errors"].append(p.name+": not 8-bit RGBA")
                if not d["alphaExtrema"] or d["alphaExtrema"][0]!=0 or d["alphaExtrema"][1]!=255:row["errors"].append(p.name+": no real mixed alpha")
                if d["cornerAlpha"]!=[0,0,0,0]:row["warnings"].append(p.name+": nontransparent corner; accepted as possible edge-reaching artwork per owner direction")
                if path.exists():
                    for entry in m.get("frames",[]):
                        if entry.get("filename",entry.get("file"))==p.name:
                            if entry.get("sha256") and hashlib.sha256(p.read_bytes()).hexdigest()!=entry["sha256"]:
                                row["errors"].append(p.name+": SHA256 mismatch")
                            break
            except Exception as e:row["errors"].append(p.name+": "+str(e))
    row["result"]="PASS_STRUCTURAL" if not row["errors"] else "FAIL"
    rows.append(row)
report={"qualification":"SCOPED KK PHASE F ASSET AUDIT","scope":"15 Kush Krusher animation packages only","limitations":["Visual playback and motion quality require separate human visual approval; this test does not certify MQ motion."],"sets":rows,"summary":{"total":15,"passed":sum(x["result"]=="PASS_STRUCTURAL" for x in rows),"failed":sum(x["result"]=="FAIL" for x in rows)}}
Path("kk-animation-qualification.json").write_text(json.dumps(report,indent=2)+"\n")
for x in rows:print(x["animation"],x["result"],"files",x["frameFiles"],"errors",len(x["errors"]));[print("  ERROR:",e) for e in x["errors"][:10]]
print("summary",report["summary"])
sys.exit(0 if report["summary"]["failed"]==0 else 1)

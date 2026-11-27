"""Verify the production artwork, snap each physical peg to its detected centre.
The committed ordinal atlas supplies the route order, never the pixel centre.
Fail closed on missing, duplicate, ambiguous or extra physical holes.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import cv2
import numpy as np

ROOT = Path(__file__).resolve().parents[3]
ART = ROOT / "bong-goggles/web/assets/games/cribbage/board-cannabis-leaf.png"
BOARD = ROOT / "bong-goggles/web/core/cribbage-board.js"
PIN = "4c358c6cc77b2a6f6dd33865dbf7654de2b60cc0"
parser = argparse.ArgumentParser()
parser.add_argument("--output", type=Path, required=True)
parser.add_argument("--write", action="store_true", help="Regenerate committed coordinates from the pinned PNG")
args = parser.parse_args()
args.output.mkdir(parents=True, exist_ok=True)
raw = ART.read_bytes()
blob = hashlib.sha1(b"blob " + str(len(raw)).encode() + b"\0" + raw).hexdigest()
assert blob == PIN and len(raw) == 2698098, "Canonical artwork changed"
im = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_COLOR)
assert im.shape == (1086,1448,3), "Unexpected artwork dimensions"
gray = cv2.cvtColor(im, cv2.COLOR_BGR2GRAY)
_, _, stats, centers = cv2.connectedComponentsWithStats((gray < 55).astype(np.uint8))
holes = []
for (x,y,w,h,area),(cx,cy) in zip(stats[1:], centers[1:]):
    if 13 <= w <= 25 and 13 <= h <= 25 and .8 < w/h < 1.25 and area/(w*h) > .65 and 90 < cx < 1360 and 95 < cy < 935:
        holes.append((float(cx), float(cy)))
source = BOARD.read_text()
patterns = {lane: rf"{lane}:measured\((\[\[.*?\]\])\)" for lane in ("green","ivory")}
parks = {lane: rf"{lane}:Object.freeze\(\[\{{x:(\d+),y:(\d+)\}},\{{x:(\d+),y:(\d+)\}}\]\)" for lane in ("green","ivory")}
finish = r"CRIBBAGE_FINISH=Object.freeze\(\{x:(\d+),y:(\d+),number:121\}\)"
seeds = {}
for lane, pattern in patterns.items():
    seeds[lane] = json.loads(re.search(pattern,source).group(1))
    assert len(seeds[lane]) == 120
for lane,pattern in parks.items():
    a,b,c,d = map(int,re.search(pattern,source).groups())
    seeds[lane+"-park"] = [[a,b],[c,d]]
seeds["finish"] = [list(map(int,re.search(finish,source).groups()))]
report = {"artwork_git_blob":blob,"artwork_sha256":hashlib.sha256(raw).hexdigest(),"dimensions":[1448,1086],"source_commit":subprocess.check_output(["git","rev-parse","HEAD"],cwd=ROOT,text=True).strip(),"detected_holes":len(holes),"expected_holes":245,"tracks":{},"errors":[]}
used = set()
annotated = im.copy()
updated = source
if len(holes) != 245:
    report["errors"].append(f"Expected 245 distinct physical holes; detected {len(holes)}")
for lane, points in seeds.items():
    verified = []
    for i, (x,y) in enumerate(points):
        distances = sorted((math.hypot(x-cx,y-cy),j) for j,(cx,cy) in enumerate(holes))
        if not distances or distances[0][0] > 8 or (len(distances)>1 and distances[1][0]-distances[0][0]<4):
            report["errors"].append(f"{lane} {i+1}: no unambiguous physical hole within 8px")
            continue
        distance,j = distances[0]
        if j in used:
            report["errors"].append(f"{lane} {i+1}: duplicate physical hole")
            continue
        used.add(j)
        cx,cy = holes[j]
        point = [round(cx),round(cy)]
        verified.append({"ordinal":121 if lane=="finish" else i+1,"centre":point,"detected_centre":[round(cx,3),round(cy,3)],"previous":[x,y],"offset_px":round(distance,3)})
        color = (255,255,0) if lane.startswith("green") else (255,0,255)
        cv2.circle(annotated,tuple(point),9,color,1,cv2.LINE_AA)
        label = str(121 if lane=="finish" else i+1) if "park" not in lane else "P"+str(i+1)
        cv2.putText(annotated,label,(point[0]-8,point[1]+3),cv2.FONT_HERSHEY_SIMPLEX,.32,color,1,cv2.LINE_AA)
    report["tracks"][lane]=verified
    if len(verified)!=len(points):
        continue
    coordinates=[v["centre"] for v in verified]
    if lane in patterns:
        updated=re.sub(patterns[lane],lambda m:lane+":measured("+json.dumps(coordinates,separators=(",",":"))+")",updated)
    elif lane.endswith("-park"):
        name=lane.split("-")[0]
        (a,b),(c,d)=coordinates
        updated=re.sub(parks[name],lambda m:f"{name}:Object.freeze([{{x:{a},y:{b}}},{{x:{c},y:{d}}}])",updated)
    else:
        a,b=coordinates[0]
        updated=re.sub(finish,lambda m:f"CRIBBAGE_FINISH=Object.freeze({{x:{a},y:{b},number:121}})",updated)
if len(used)!=len(holes):
    report["errors"].append(f"{len(holes)-len(used)} detected holes are unmapped")
report["atlas_changed"]=updated!=source
report["geometry_pass"]=not report["errors"]
report["qualification_pass"]=report["geometry_pass"] and not report["atlas_changed"]
(args.output/"qualification.json").write_text(json.dumps(report,indent=2)+"\n")
(args.output/"verified-atlas.json").write_text(json.dumps({k:[v["centre"] for v in vs] for k,vs in report["tracks"].items()},indent=2)+"\n")
cv2.imwrite(str(args.output/"annotated-board.png"),annotated)
if report["errors"]:
    raise SystemExit("\n".join(report["errors"]))
if updated!=source:
    (args.output/"regenerated-cribbage-board.js").write_text(updated)
    if args.write:
        BOARD.write_text(updated)
    else:
        raise SystemExit("Atlas differs from measured centres. Review regenerated source and commit it before qualification.")
print("All 245 physical holes uniquely matched to pinned artwork.")

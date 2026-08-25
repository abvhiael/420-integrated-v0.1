#!/usr/bin/env python3
import json, pathlib, subprocess, sys, time, argparse

ap=argparse.ArgumentParser()
ap.add_argument("--slots",type=int,default=120)
ap.add_argument("--slot-ms",type=int,default=35)
args=ap.parse_args()

root=pathlib.Path(__file__).resolve().parents[1]
started=time.time()
cp=subprocess.run(["python3","scripts/run-devnet15.py","--nodes","15","--slots",str(args.slots),
                   "--slot-ms",str(args.slot_ms)],cwd=root,stdout=subprocess.PIPE,stderr=subprocess.PIPE,
                  text=True,timeout=max(60,args.slots*args.slot_ms/1000+30))
line=next((ln for ln in reversed(cp.stdout.splitlines()) if ln.startswith("DEVNET_SUMMARY ")),None)
summary=json.loads(line.split(" ",1)[1]) if line else {}
max_finalized=int(summary.get("max_finalized",0))
# Because asynchronous process startup can miss a few earliest slots, require finality over 80% of run.
threshold=max(1,int(args.slots*0.80))
passed=cp.returncode==0 and max_finalized>=threshold
out={"pass":passed,"returncode":cp.returncode,"slots":args.slots,"slot_ms":args.slot_ms,
     "required_finalized":threshold,"summary":summary,"seconds":round(time.time()-started,3),
     "stderr":cp.stderr[-1500:]}
(root/"qualification/soak.json").write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps(out,indent=2))
sys.exit(0 if passed else 2)

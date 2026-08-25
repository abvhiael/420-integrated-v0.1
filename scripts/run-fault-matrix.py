#!/usr/bin/env python3
import json, pathlib, subprocess, sys, time

root=pathlib.Path(__file__).resolve().parents[1]
cases=[
 ("normal15",["--nodes","15","--slots","8","--slot-ms","80"]),
 ("quorum11",["--nodes","11","--slots","8","--slot-ms","80"]),
 ("quorum10",["--nodes","10","--slots","8","--slot-ms","80"]),
 ("fallback1",["--nodes","15","--slots","8","--slot-ms","80","--primary-down"]),
 ("fallback2",["--nodes","15","--slots","8","--slot-ms","80","--primary-down","--fb1-down"]),
 ("partition8_7",["--nodes","15","--slots","8","--slot-ms","80","--partition","8-7"]),
 ("partition11_4",["--nodes","15","--slots","8","--slot-ms","80","--partition","11-4"]),
 ("restart",["--nodes","15","--slots","5","--slot-ms","80","--restart-test"]),
]
results=[]
for name,args in cases:
    started=time.time()
    cp=subprocess.run(["python3","scripts/run-devnet15.py",*args],cwd=root,
                      stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True,timeout=45)
    summary_line=next((ln for ln in reversed(cp.stdout.splitlines()) if ln.startswith("DEVNET_SUMMARY ")),None)
    parsed=json.loads(summary_line.split(" ",1)[1]) if summary_line else {}
    results.append({"name":name,"returncode":cp.returncode,"seconds":round(time.time()-started,3),
                    "summary":parsed,"stderr":cp.stderr[-1000:]})
out={"all_pass":all(r["returncode"]==0 for r in results),"cases":results}
(root/"qualification/fault-matrix.json").write_text(json.dumps(out,indent=2)+"\n")
print(json.dumps(out,indent=2))
sys.exit(0 if out["all_pass"] else 2)

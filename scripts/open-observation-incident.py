#!/usr/bin/env python3
import argparse, datetime, json, pathlib, uuid
ap=argparse.ArgumentParser()
ap.add_argument("--severity",choices=["INFO","WARN","MAJOR","CRITICAL"],required=True)
ap.add_argument("--category",required=True)
ap.add_argument("--summary",required=True)
args=ap.parse_args()
root=pathlib.Path(__file__).resolve().parents[1]
iid="OBS-"+uuid.uuid4().hex[:12]
rec={"schema":"420-observation-incident-v1","incident_id":iid,
     "opened_at_utc":datetime.datetime.now(datetime.timezone.utc).isoformat(),
     "severity":args.severity,"category":args.category,"summary":args.summary,
     "state":"OPEN","resolution":"","closed_at_utc":None}
p=root/"testnet/observation/incidents"/f"{iid}.json"
p.write_text(json.dumps(rec,indent=2)+"\n")
print(p)

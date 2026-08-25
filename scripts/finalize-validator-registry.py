#!/usr/bin/env python3
import json, pathlib, re, sys, hashlib

root=pathlib.Path(__file__).resolve().parents[1]
ceremony=root/"testnet/ceremony/validators"
records=[]
errors=[]
seen_ids=set();seen_pks=set();seen_owner=set();seen_withdrawal=set()

for i in range(60):
    p=ceremony/f"validator-{i:02d}.json"
    if not p.exists():
        errors.append(f"missing {p.name}");continue
    r=json.loads(p.read_text())
    if r.get("status")!="READY":
        errors.append(f"{p.name}: status is not READY");continue

    vid=str(r.get("validator_id",""))
    pk=str(r.get("consensus_bls_pubkey","")).removeprefix("0x")
    pop=str(r.get("bls_proof_of_possession","")).removeprefix("0x")
    owner=str(r.get("owner_address","")).lower()
    withdrawal=str(r.get("withdrawal_address","")).lower()

    if not vid or vid=="REPLACE": errors.append(f"{p.name}: validator_id missing")
    if not re.fullmatch(r"[0-9a-fA-F]{96}",pk): errors.append(f"{p.name}: BLS pubkey must be 48 bytes")
    if not re.fullmatch(r"[0-9a-fA-F]{192}",pop): errors.append(f"{p.name}: PoP must be 96 bytes")
    if not re.fullmatch(r"0x[0-9a-f]{40}",owner): errors.append(f"{p.name}: owner address invalid")
    if not re.fullmatch(r"0x[0-9a-f]{40}",withdrawal): errors.append(f"{p.name}: withdrawal address invalid")

    for val,seen,label in [(vid,seen_ids,"validator ID"),(pk,seen_pks,"BLS pubkey"),
                           (owner,seen_owner,"owner"),(withdrawal,seen_withdrawal,"withdrawal")]:
        if val in seen: errors.append(f"{p.name}: duplicate {label}")
        seen.add(val)

    records.append(r)

if errors:
    print("\n".join(errors),file=sys.stderr)
    sys.exit(2)

# NOTE: actual cryptographic PoP verification is done by the production blst ceremony verifier.
validators=[]
for i,r in enumerate(records):
    validators.append({
      "validator_index":i,
      "validator_id":r["validator_id"],
      "consensus_bls_pubkey":r["consensus_bls_pubkey"],
      "bls_proof_of_possession":r["bls_proof_of_possession"],
      "owner_address":r["owner_address"],
      "withdrawal_address":r["withdrawal_address"],
      "role":"ACTIVE" if i<15 else "ELIGIBLE_STANDBY",
      "seat_id":i if i<15 else None,
      "bond_kief":"42000000000000000000000",
      "readiness_required":True,
      "identity_material_status":"READY"
    })

out={
 "schema":"420-integrated-testnet-validator-registry-v1",
 "count":60,"active_count":15,"standby_count":45,
 "validators":validators,
 "ceremony_root":hashlib.sha256(
     b"".join(json.dumps(r,sort_keys=True,separators=(",",":")).encode() for r in records)
 ).hexdigest()
}
path=root/"testnet/validators/registry60.json"
path.write_text(json.dumps(out,indent=2)+"\n")
print(path)

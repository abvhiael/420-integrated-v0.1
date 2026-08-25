#!/usr/bin/env python3
import argparse, hashlib, json, pathlib, sys

root=pathlib.Path(__file__).resolve().parents[1]
ceremony=root/"testnet/ceremony/genesis-seed"
contributors=[]
errors=[]

for p in sorted(ceremony.glob("contributor-*.json")):
    rec=json.loads(p.read_text())
    cid=rec["contributor_id"]
    commitment=rec.get("commitment","")
    reveal=rec.get("reveal","")
    if commitment.startswith("REPLACE") or not commitment:
        errors.append(f"{cid}: commitment missing")
        continue
    try:
        cbytes=bytes.fromhex(commitment.removeprefix("0x"))
    except Exception:
        errors.append(f"{cid}: commitment invalid hex")
        continue
    if len(cbytes)!=32:
        errors.append(f"{cid}: commitment must be 32 bytes")
        continue

    if reveal.startswith("REPLACE") or not reveal:
        contrib=hashlib.sha256(b"missing"+cbytes).digest()
        status="MISSING_REVEAL"
    else:
        try:
            rbytes=bytes.fromhex(reveal.removeprefix("0x"))
        except Exception:
            errors.append(f"{cid}: reveal invalid hex")
            continue
        if len(rbytes)!=32:
            errors.append(f"{cid}: reveal must be 32 bytes")
            continue
        want=hashlib.sha256(cid.encode()+rbytes).digest()
        if want!=cbytes:
            errors.append(f"{cid}: reveal does not match commitment")
            continue
        contrib=rbytes
        status="REVEALED"
    contributors.append((cid,contrib,status))

if errors:
    print("\n".join(errors),file=sys.stderr)
    sys.exit(2)
if len(contributors)<7:
    print("minimum 7 valid contributors required",file=sys.stderr)
    sys.exit(3)

# Canonical contributor ceremony root.
h=hashlib.sha256()
h.update(b"420/GENESIS_CONTRIBUTORS")
for cid,contrib,status in sorted(contributors):
    h.update(cid.encode())
    h.update(contrib)
contributor_root=h.digest()

alloc=(root/"testnet/genesis/genesis-allocations.json").read_bytes()
consensus=(root/"testnet/genesis/consensus-genesis.json").read_bytes()
allocation_root=hashlib.sha256(alloc).digest()
consensus_root=hashlib.sha256(consensus).digest()

# The final testnet checkpoint and external randomness are ceremony inputs and must be set explicitly.
manifest=json.loads((ceremony/"ceremony.json").read_text())
ftc=manifest.get("final_testnet_checkpoint_root","REPLACE")
ext=manifest.get("external_public_randomness","REPLACE")
if str(ftc).startswith("REPLACE") or str(ext).startswith("REPLACE"):
    print("ceremony.json must include final_testnet_checkpoint_root and external_public_randomness",file=sys.stderr)
    sys.exit(4)

try:
    ftc_bytes=bytes.fromhex(str(ftc).removeprefix("0x"))
    ext_bytes=bytes.fromhex(str(ext).removeprefix("0x"))
except Exception:
    print("checkpoint/randomness must be hex",file=sys.stderr);sys.exit(4)
if len(ftc_bytes)!=32 or len(ext_bytes)!=32:
    print("checkpoint/randomness must be 32 bytes",file=sys.stderr);sys.exit(4)

chain_id=(420).to_bytes(8,"little")
g=hashlib.sha256()
g.update(b"420/GENESIS_SEED")
g.update(chain_id)
g.update(allocation_root)
g.update(consensus_root)
g.update(ftc_bytes)
g.update(ext_bytes)
g.update(contributor_root)
seed=g.digest()

result={
 "schema":"420-genesis-seed-result-v1",
 "chain_id":420,
 "allocation_root":allocation_root.hex(),
 "consensus_config_root":consensus_root.hex(),
 "final_testnet_checkpoint_root":ftc_bytes.hex(),
 "external_public_randomness":ext_bytes.hex(),
 "contributor_ceremony_root":contributor_root.hex(),
 "genesis_seed":seed.hex(),
 "contributors":[{"id":cid,"status":status} for cid,_,status in sorted(contributors)]
}
out=ceremony/"result.json"
out.write_text(json.dumps(result,indent=2)+"\n")
print(json.dumps(result,indent=2))

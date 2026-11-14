"""Bitcoin mainnet historical header fixtures. Run with Python 3, no dependencies."""
import argparse
import hashlib
import json
import pathlib
import struct
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent
COUNT = 32257
PERIOD = 2016
SPAN = 1209600
GENESIS = "000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f"
SOURCES = [
    "https://raw.githubusercontent.com/nip-333/btc-archive/gh-pages/btc.archive.bin",
    "https://nip-333.github.io/btc-archive/btc.archive.bin",
]
def require(condition, message):
    if not condition:
        raise ValueError(message)

def target(bits):
    exponent, mantissa = bits >> 24, bits & 0x7fffff
    require(not bits & 0x800000 and mantissa != 0, "invalid compact target")
    value = mantissa >> (8*(3-exponent)) if exponent <= 3 else mantissa << (8*(exponent-3))
    require(0 < value < 2**256, "target overflow")
    return value

LIMIT = target(0x1d00ffff)

def compact(value):
    size = (value.bit_length()+7)//8
    word = value << (8*(3-size)) if size <= 3 else value >> (8*(size-3))
    if word & 0x800000:
        word >>= 8
        size += 1
    return size << 24 | word

def digest(data):
    return hashlib.sha256(data).hexdigest()

def verify(data):
    require(len(data) == COUNT*80, "wrong fixture length")
    rows, changes, times = [], [], []
    previous = bytes(32)
    chainwork = 0
    for height in range(COUNT):
        h = data[height*80:(height+1)*80]
        hashed = hashlib.sha256(hashlib.sha256(h).digest()).digest()
        timestamp, bits = struct.unpack_from("<II", h, 68)
        t = target(bits)
        require(h[4:36] == previous, f"parent mismatch {height}")
        require(t <= LIMIT and int.from_bytes(hashed,"little") <= t, f"invalid PoW {height}")
        if height == 0:
            require(hashed[::-1].hex() == GENESIS and bits == 0x1d00ffff, "wrong genesis")
        else:
            median = sorted(times[-11:])[len(times[-11:])//2]
            require(timestamp > median, f"MTP violation {height}")
            expected = rows[-1]["bits"]
            if height % PERIOD == 0:
                elapsed = times[-1]-times[height-PERIOD]
                expected = compact(min(LIMIT, target(expected)*max(SPAN//4,min(SPAN*4,elapsed))//SPAN))
                if expected != rows[-1]["bits"]:
                    changes.append({"height":height,"previous":hex(rows[-1]["bits"]),"result":hex(expected),"elapsed":elapsed})
            require(bits == expected, f"retarget mismatch {height}")
        work = 2**256//(t+1)
        chainwork += work
        times.append(timestamp)
        rows.append(dict(height=height,hash=hashed[::-1].hex(),timestamp=timestamp,bits=bits,target=hex(t),work=hex(work),chainwork=hex(chainwork),mtp=sorted(times[-11:])[len(times[-11:])//2]))
        previous = hashed
    require(changes and changes[0]["height"] == 32256, "first historical transition missing")
    return rows,changes

def acquire():
    if (ROOT/"headers.bin").exists():
        return
    for source in SOURCES:
        try:
            req = urllib.request.Request(source,headers={"Range":f"bytes=0-{COUNT*80-1}","User-Agent":"420Bridge-fixture-verifier"})
            with urllib.request.urlopen(req,timeout=60) as res:
                data = res.read(COUNT*80)
            rows,changes = verify(data)
            expected = "".join(json.dumps(row,sort_keys=True)+"\n" for row in rows).encode()
            manifest = dict(source=source,count=COUNT,start=0,end=COUNT-1,sha256=digest(data),expected_sha256=digest(expected),transitions=changes,genesis=GENESIS,tip=rows[-1]["hash"],chainwork=rows[-1]["chainwork"])
            (ROOT/"headers.bin").write_bytes(data)
            (ROOT/"expected.jsonl").write_bytes(expected)
            (ROOT/"manifest.json").write_text(json.dumps(manifest,indent=2)+"\n")
            return
        except Exception as exc:
            print(source, repr(exc), flush=True)
    raise RuntimeError("All archive sources failed")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--acquire",action="store_true")
    args = parser.parse_args()
    if args.acquire:
        acquire()
    data=(ROOT/"headers.bin").read_bytes()
    manifest=json.loads((ROOT/"manifest.json").read_text())
    require(manifest["count"]==COUNT and manifest["start"]==0 and manifest["end"]==COUNT-1,"manifest range")
    require(digest(data)==manifest["sha256"],"header checksum mismatch")
    rows,changes=verify(data)
    expected="".join(json.dumps(row,sort_keys=True)+"\n" for row in rows).encode()
    require(expected==(ROOT/"expected.jsonl").read_bytes() and digest(expected)==manifest["expected_sha256"],"expected records mismatch")
    require(changes==manifest["transitions"] and rows[-1]["hash"]==manifest["tip"] and rows[-1]["chainwork"]==manifest["chainwork"],"manifest consensus mismatch")
    for bad in (data[:-1], bytes([data[0]^1])+data[1:]):
        try:
            verify(bad)
        except ValueError:
            continue
        raise ValueError("corrupt fixture accepted")
    print(json.dumps(manifest,indent=2))
    print(f"PASS: {COUNT} historical headers, linkage, PoW, work, MTP, difficulty, checksums and corruption rejection")

if __name__=="__main__":
    main()

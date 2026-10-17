#!/usr/bin/env python3
"""Scoped Budtender 3.17 PNG resize and registry update. Never touch other phases."""
import hashlib
import io
import json
import math
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[3]
base = root / "assets/budtender/phase-3.17"
registry_file = base / "registry.json"
registry = json.loads(registry_file.read_text())
assert registry["phase"] == "3.17" and registry["expected_count"] == 48
assert len(registry["assets"]) == 48
seen = set()
resized = []
for entry in registry["assets"]:
    name = entry["name"]
    assert name.startswith("budtender_store_") and name.endswith(".png")
    assert name not in seen
    seen.add(name)
    assert entry["source"] == f"assets/budtender/phase-3.17/{name}"
    path = base / name
    raw = path.read_bytes()
    assert len(raw) == entry["bytes"]
    assert hashlib.sha1(f"blob {len(raw)}\\0".encode() + raw).hexdigest() == entry["git_blob_sha"]
    with Image.open(io.BytesIO(raw)) as image:
        image.load()
        assert image.format == "PNG" and image.mode == "RGBA", name
        if image.height < 256:
            ratio = 256 / image.height
            new_size = (math.ceil(image.width * ratio), 256)
            out = image.resize(new_size, Image.Resampling.LANCZOS)
            assert out.mode == "RGBA"
            out.save(path, format="PNG", optimize=True)
            resized.append((name, image.size, new_size))
    new_raw = path.read_bytes()
    with Image.open(io.BytesIO(new_raw)) as check:
        check.verify()
    entry["bytes"] = len(new_raw)
    entry["git_blob_sha"] = hashlib.sha1(f"blob {len(new_raw)}\\0".encode() + new_raw).hexdigest()
    with Image.open(path) as check:
        assert check.mode == "RGBA" and check.height >= 256, name
registry_file.write_text(json.dumps(registry, indent=2) + "\\n")
print("Phase 3.17 resized", len(resized), "of 48 images")
for row in resized:
    print(*row)

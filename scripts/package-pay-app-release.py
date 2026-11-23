#!/usr/bin/env python3
"""Assemble deterministic, offline Pay application release archives."""
import argparse
import hashlib
import io
import json
from pathlib import Path
import subprocess
import tarfile
from zipfile import ZIP_STORED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
SOURCES = (
    "pay", "packages/420-pay-sdk", "docs/apps/pay", "contracts/src/pay",
    "contracts/config/pay", "contracts/artifacts/genesis-residents/v3",
    "contracts/config/commerce/market-pay-adapter.json",
    "420-indexer/src/pay-accounting-export.ts", "wallet/extension/vendor/qrcode.mjs",
    "scripts/package-pay-app-release.py",
)
WEB_FILES = (
    "app.js", "checkout-embed.html", "checkout-embed.js", "deployment.json",
    "icons/pay-192.png", "icons/pay-512.png", "icons/pay-brand.webp", "icons/pay-favicon.png",
    "index.html", "manifest.webmanifest",
    "service-worker.js", "style.css",
)


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def source_files(revision):
    with tarfile.open(fileobj=io.BytesIO(git("archive", revision, "--", *SOURCES))) as archive:
        files = {}
        for item in archive:
            if item.isdir():
                continue
            if not item.isfile():
                raise ValueError(f"Unsupported source entry: {item.name}")
            with archive.extractfile(item) as source:
                files[item.name] = source.read()
        return files


def write_package(output, name, revision, files):
    hashes = {path: sha(files[path]) for path in sorted(files)}
    manifest = json.dumps({"revision": revision, "files": hashes}, indent=2, sort_keys=True)
    with ZipFile(output / name, "w", compression=ZIP_STORED) as package:
        for path, data in sorted({**files, "PAY-RELEASE.json": (manifest + "\n").encode()}.items()):
            entry = ZipInfo(path, (1980, 1, 1, 0, 0, 0))
            entry.create_system = 3
            entry.external_attr = 0o100644 << 16
            package.writestr(entry, data)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--revision", default="HEAD")
    parser.add_argument("--web-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    revision = git("rev-parse", "--verify", "--end-of-options", f"{args.revision}^{{commit}}").decode().strip()
    web = {path: (args.web_dir / path).read_bytes() for path in WEB_FILES}
    if json.loads(web["deployment.json"]) is not None:
        raise ValueError("Local release package must leave live deployment unbound")
    args.output.mkdir(parents=True, exist_ok=True)
    names = ("420pay-source.zip", "420pay-web.zip")
    write_package(args.output, names[0], revision, source_files(revision))
    write_package(args.output, names[1], revision, web)
    (args.output / "SHA256SUMS").write_text(
        "".join(f"{sha((args.output / name).read_bytes())}  {name}\n" for name in names), encoding="utf-8",
    )


if __name__ == "__main__":
    main()

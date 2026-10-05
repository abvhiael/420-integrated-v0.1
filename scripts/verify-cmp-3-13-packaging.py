#!/usr/bin/env python3
import argparse
import datetime
import hashlib
import io
import json
import pathlib
import stat
import struct
import subprocess
import sys
import tarfile
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
EXPECTED_TARGETS = (
    ("linux", "amd64"),
    ("linux", "arm64"),
    ("windows", "amd64"),
    ("windows", "arm64"),
    ("darwin", "amd64"),
    ("darwin", "arm64"),
)
EXPECTED_PLATFORM_FILES = {
    "linux": {"node420-compute", "README.txt", "worker.args.example", "BUILD-METADATA.json", "run-node420-compute.sh", "node420-compute.service"},
    "darwin": {"node420-compute", "README.txt", "worker.args.example", "BUILD-METADATA.json", "run-node420-compute.sh", "org.420integrated.node420-compute.plist"},
    "windows": {"node420-compute.exe", "README.txt", "worker.args.example", "BUILD-METADATA.json", "run-node420-compute.ps1", "register-startup-task.ps1"},
}
STATE_DIRS = {
    "linux": "/var/lib/420integrated/node420-compute",
    "darwin": "/Library/Application Support/420Integrated/node420-compute",
    "windows": r"C:\ProgramData\420Integrated\node420-compute",
}


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def sha256_file(path):
    return sha256_bytes(path.read_bytes())


def git_head():
    return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()


def git_epoch():
    return int(subprocess.check_output(["git", "show", "-s", "--format=%ct", "HEAD"], cwd=ROOT, text=True).strip())


def validate_static(errors):
    required = [
        ROOT / "scripts/build-cmp-3-13-packages.py",
        ROOT / "execution/cmd/node420-compute/main.go",
        ROOT / "packaging/node420-compute/common/worker.args.example",
        ROOT / "packaging/node420-compute/common/README.txt",
        ROOT / "packaging/node420-compute/linux/run-node420-compute.sh",
        ROOT / "packaging/node420-compute/linux/node420-compute.service",
        ROOT / "packaging/node420-compute/darwin/run-node420-compute.sh",
        ROOT / "packaging/node420-compute/darwin/org.420integrated.node420-compute.plist",
        ROOT / "packaging/node420-compute/windows/run-node420-compute.ps1",
        ROOT / "packaging/node420-compute/windows/register-startup-task.ps1",
        ROOT / ".github/workflows/compute-worker-fast.yml",
        ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md",
        ROOT / "docs/compute-market/CMP-3.13-WINDOWS-LINUX-MACOS-PACKAGING.md",
    ]
    for path in required:
        if not path.is_file():
            errors.append(f"missing {path.relative_to(ROOT)}")
    if errors:
        return

    builder = (ROOT / "scripts/build-cmp-3-13-packages.py").read_text()
    main = (ROOT / "execution/cmd/node420-compute/main.go").read_text()
    linux_service = (ROOT / "packaging/node420-compute/linux/node420-compute.service").read_text()
    darwin_plist = (ROOT / "packaging/node420-compute/darwin/org.420integrated.node420-compute.plist").read_text()
    windows_task = (ROOT / "packaging/node420-compute/windows/register-startup-task.ps1").read_text()
    args_template = (ROOT / "packaging/node420-compute/common/worker.args.example").read_text()
    workflow = (ROOT / ".github/workflows/compute-worker-fast.yml").read_text()
    roadmap = (ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md").read_text()
    doc = (ROOT / "docs/compute-market/CMP-3.13-WINDOWS-LINUX-MACOS-PACKAGING.md").read_text()

    for token in [
        '("linux", "amd64")', '("linux", "arm64")',
        '("windows", "amd64")', '("windows", "arm64")',
        '("darwin", "amd64")', '("darwin", "arm64")',
        '"CGO_ENABLED": "0"', '"GOOS": goos', '"GOARCH": goarch',
        '"-trimpath"', '"-buildvcs=false"', '"-X main.version=', '"-X main.commit=',
        '"420-compute-worker-package-manifest-v1"',
        '"420-compute-worker-package-build-v1"',
        '"platform_runtime_qualified": False',
        '"level3_merge_candidate": False',
        'gzip.GzipFile', 'mtime=epoch', 'zipfile.ZipInfo',
        'SHA256SUMS.txt',
    ]:
        if token not in builder:
            errors.append(f"package builder missing token: {token}")

    for token in ['version = "dev"', 'commit  = "unknown"', '"version"', 'runtime.GOOS', 'runtime.GOARCH']:
        if token not in main:
            errors.append(f"node420-compute version identity missing: {token}")

    for token in ["User=node420compute", "NoNewPrivileges=true", "ProtectSystem=strict", "ProtectHome=true", "ReadWritePaths=/var/lib/420integrated/node420-compute"]:
        if token not in linux_service:
            errors.append(f"Linux service hardening/config missing: {token}")
    if "User=root" in linux_service:
        errors.append("Linux service must not run as root")

    for token in ["<key>UserName</key>", "<string>node420compute</string>", "<key>RunAtLoad</key>", "<key>WorkingDirectory</key>"]:
        if token not in darwin_plist:
            errors.append(f"macOS launchd template missing: {token}")
    if "<string>root</string>" in darwin_plist:
        errors.append("macOS launchd template must not run as root")

    for token in ['[Parameter(Mandatory = $true)]', "New-ScheduledTaskTrigger -AtStartup", "-LogonType S4U", "-RunLevel Limited"]:
        if token not in windows_task:
            errors.append(f"Windows startup task template missing: {token}")
    if "-RunLevel Highest" in windows_task or "-UserId SYSTEM" in windows_task:
        errors.append("Windows startup task must not silently elevate to SYSTEM/highest")

    if "@STATE_DIR@" not in args_template:
        errors.append("common worker args template lost platform state-directory placeholder")
    for forbidden in ["private-key", "password", "mnemonic", "seed-phrase"]:
        if forbidden in args_template.lower():
            errors.append(f"worker args template must not solicit secret material: {forbidden}")

    if "Build CMP-3.13 platform packages" not in workflow:
        errors.append("fast workflow does not build CMP-3.13 packages")
    if "verify-cmp-3-13-packaging.py" not in workflow:
        errors.append("fast workflow does not run CMP-3.13 package verifier")

    if "## CMP-3.13 — Windows/Linux/macOS packaging" not in roadmap:
        errors.append("canonical CMP-3.13 roadmap step missing")
    if (
        "IMPLEMENTED / Level 1 qualification pending" not in roadmap
        and "COMPLETE — Level 1 exact-head qualified" not in roadmap
    ):
        errors.append("CMP-3.13 roadmap status missing or stale")

    if (
        "Status: **IMPLEMENTED / LEVEL 1 QUALIFICATION PENDING**" not in doc
        and "Status: **COMPLETE — Level 1 exact-head qualified" not in doc
    ):
        errors.append("CMP-3.13 documentation status missing or stale")
    if "Next canonical step: **CMP-3.14 — Phase closeout**." not in doc:
        errors.append("CMP-3.13 next-step boundary drift")


def parse_checksums(path):
    records = {}
    for line in path.read_text().splitlines():
        if not line.strip():
            continue
        digest, name = line.split("  ", 1)
        records[name] = digest
    return records


def read_archive(path, root_name, epoch, errors):
    records = {}
    modes = {}
    times = {}
    if path.suffix == ".zip":
        with zipfile.ZipFile(path) as archive:
            for info in archive.infolist():
                name = info.filename
                if name.startswith("/") or ".." in pathlib.PurePosixPath(name).parts:
                    errors.append(f"unsafe ZIP member path: {name}")
                    continue
                prefix = root_name + "/"
                if not name.startswith(prefix):
                    errors.append(f"ZIP member outside package root: {name}")
                    continue
                rel = name[len(prefix):]
                records[rel] = archive.read(info)
                modes[rel] = (info.external_attr >> 16) & 0o7777
                times[rel] = datetime.datetime(*info.date_time, tzinfo=datetime.timezone.utc).timestamp()
    else:
        with tarfile.open(path, mode="r:gz") as archive:
            for info in archive.getmembers():
                name = info.name
                if name.startswith("/") or ".." in pathlib.PurePosixPath(name).parts:
                    errors.append(f"unsafe tar member path: {name}")
                    continue
                if not info.isfile():
                    errors.append(f"non-regular tar member is not allowed: {name}")
                    continue
                prefix = root_name + "/"
                if not name.startswith(prefix):
                    errors.append(f"tar member outside package root: {name}")
                    continue
                rel = name[len(prefix):]
                extracted = archive.extractfile(info)
                records[rel] = extracted.read() if extracted else b""
                modes[rel] = info.mode
                times[rel] = info.mtime
                if info.uid != 0 or info.gid != 0:
                    errors.append(f"tar ownership not normalized for {name}")
    for rel, timestamp in times.items():
        if path.suffix == ".zip":
            if abs(timestamp - max(epoch, 315532800)) > 2:
                errors.append(f"ZIP timestamp not source-derived for {path.name}:{rel}")
        elif timestamp != epoch:
            errors.append(f"tar timestamp not source-derived for {path.name}:{rel}")
    return records, modes


def binary_target(data, goos, goarch):
    if goos == "linux":
        if data[:4] != b"\x7fELF" or len(data) < 20:
            return False
        machine = struct.unpack("<H", data[18:20])[0]
        return machine == {"amd64": 62, "arm64": 183}[goarch]
    if goos == "windows":
        if data[:2] != b"MZ" or len(data) < 0x40:
            return False
        pe_offset = struct.unpack("<I", data[0x3C:0x40])[0]
        if pe_offset + 6 > len(data) or data[pe_offset:pe_offset+4] != b"PE\x00\x00":
            return False
        machine = struct.unpack("<H", data[pe_offset+4:pe_offset+6])[0]
        return machine == {"amd64": 0x8664, "arm64": 0xAA64}[goarch]
    if goos == "darwin":
        if len(data) < 8 or data[:4] != b"\xcf\xfa\xed\xfe":
            return False
        cpu = struct.unpack("<I", data[4:8])[0]
        return cpu == {"amd64": 0x01000007, "arm64": 0x0100000C}[goarch]
    return False


def validate_dist(dist, errors):
    manifest_path = dist / "node420-compute-package-manifest.json"
    checksums_path = dist / "SHA256SUMS.txt"
    if not manifest_path.is_file() or not checksums_path.is_file():
        errors.append("package output missing manifest or SHA256SUMS.txt")
        return

    manifest = json.loads(manifest_path.read_text())
    version = (ROOT / "VERSION").read_text().strip()
    head = git_head()
    epoch = git_epoch()

    if manifest.get("schema") != "420-compute-worker-package-manifest-v1":
        errors.append("wrong package manifest schema")
    if manifest.get("version") != version or manifest.get("commit") != head:
        errors.append("package manifest source identity mismatch")
    if manifest.get("source_date_epoch") != epoch:
        errors.append("package manifest source timestamp mismatch")
    if manifest.get("platform_runtime_qualified") is not False:
        errors.append("packaging must not claim platform runtime qualification")
    if manifest.get("level3_merge_candidate") is not False:
        errors.append("packaging must not claim Level 3 merge-candidate status")

    expected_target_strings = [f"{goos}/{goarch}" for goos, goarch in EXPECTED_TARGETS]
    if manifest.get("targets") != expected_target_strings:
        errors.append("package manifest target list drift")

    checksums = parse_checksums(checksums_path)
    expected_checksum_names = {"node420-compute-package-manifest.json"}
    packages = manifest.get("packages", [])
    if len(packages) != len(EXPECTED_TARGETS):
        errors.append(f"expected {len(EXPECTED_TARGETS)} packages, got {len(packages)}")
        return

    package_map = {(p.get("goos"), p.get("goarch")): p for p in packages}
    for goos, goarch in EXPECTED_TARGETS:
        package = package_map.get((goos, goarch))
        if not package:
            errors.append(f"missing package for {goos}/{goarch}")
            continue
        archive_name = package.get("archive", "")
        archive_path = dist / archive_name
        expected_checksum_names.add(archive_name)
        if not archive_path.is_file():
            errors.append(f"missing archive {archive_name}")
            continue
        archive_sha = sha256_file(archive_path)
        if archive_sha != package.get("archive_sha256"):
            errors.append(f"archive SHA mismatch for {archive_name}")
        if checksums.get(archive_name) != archive_sha:
            errors.append(f"SHA256SUMS mismatch for {archive_name}")

        root_name = f"node420-compute-{version}-{goos}-{goarch}"
        records, modes = read_archive(archive_path, root_name, epoch, errors)
        if set(records) != EXPECTED_PLATFORM_FILES[goos]:
            errors.append(f"archive content drift for {goos}/{goarch}: {sorted(records)}")
            continue

        binary_name = "node420-compute.exe" if goos == "windows" else "node420-compute"
        binary = records[binary_name]
        binary_sha = sha256_bytes(binary)
        if binary_sha != package.get("binary_sha256"):
            errors.append(f"binary SHA mismatch for {goos}/{goarch}")
        if not binary_target(binary, goos, goarch):
            errors.append(f"binary header/architecture mismatch for {goos}/{goarch}")
        if version.encode() not in binary or head.encode() not in binary:
            errors.append(f"binary missing embedded version/commit for {goos}/{goarch}")
        if modes.get(binary_name, 0) & 0o111 == 0:
            errors.append(f"binary not marked executable in archive for {goos}/{goarch}")

        metadata = json.loads(records["BUILD-METADATA.json"].decode())
        expected_meta = {
            "schema": "420-compute-worker-package-build-v1",
            "version": version,
            "commit": head,
            "source_date_epoch": epoch,
            "goos": goos,
            "goarch": goarch,
            "cgo_enabled": False,
            "binary": binary_name,
            "binary_sha256": binary_sha,
            "state_directory_example": STATE_DIRS[goos],
            "package_authoritative": False,
            "platform_runtime_qualified": False,
        }
        for key, value in expected_meta.items():
            if metadata.get(key) != value:
                errors.append(f"metadata {key} mismatch for {goos}/{goarch}")

        args_text = records["worker.args.example"].decode()
        if "@STATE_DIR@" in args_text or STATE_DIRS[goos] not in args_text:
            errors.append(f"state directory template not materialized for {goos}/{goarch}")
        if modes.get("worker.args.example") != 0o600:
            errors.append(f"worker.args.example mode must be 0600 for {goos}/{goarch}")

    expected_checksum_names.add("node420-compute-package-manifest.json")
    if set(checksums) != expected_checksum_names:
        errors.append(f"SHA256SUMS file inventory drift: {sorted(checksums)}")
    for name, expected in checksums.items():
        path = dist / name
        if not path.is_file() or sha256_file(path) != expected:
            errors.append(f"top-level checksum invalid for {name}")

    linux_pkg = package_map.get(("linux", "amd64"))
    if linux_pkg:
        archive_path = dist / linux_pkg["archive"]
        root_name = f"node420-compute-{version}-linux-amd64"
        records, _ = read_archive(archive_path, root_name, epoch, errors)
        if "node420-compute" in records:
            temp = dist / ".verify-node420-compute-linux-amd64"
            temp.write_bytes(records["node420-compute"])
            temp.chmod(0o755)
            try:
                out = subprocess.check_output([str(temp), "--version"], text=True).strip()
                expected = f"node420-compute {version} commit={head} target=linux/amd64"
                if out != expected:
                    errors.append(f"Linux amd64 --version mismatch: {out!r}")
            finally:
                temp.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description="Verify CMP-3.13 node420-compute platform packaging")
    parser.add_argument("--dist", help="generated package directory to validate")
    args = parser.parse_args()

    errors = []
    validate_static(errors)
    if args.dist:
        dist = pathlib.Path(args.dist)
        if not dist.is_absolute():
            dist = ROOT / dist
        if not dist.is_dir():
            errors.append(f"package directory not found: {dist}")
        else:
            validate_dist(dist, errors)

    if errors:
        print("CMP-3.13 Windows/Linux/macOS packaging verification FAILED")
        for error in errors:
            print("-", error)
        sys.exit(1)

    print("CMP-3.13 Windows/Linux/macOS packaging: mechanically consistent")


if __name__ == "__main__":
    main()

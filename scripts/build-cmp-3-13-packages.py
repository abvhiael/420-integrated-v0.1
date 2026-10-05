#!/usr/bin/env python3
import argparse
import datetime
import gzip
import hashlib
import json
import os
import pathlib
import shutil
import stat
import subprocess
import tarfile
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCHEMA = "420-compute-worker-package-manifest-v1"
BUILD_SCHEMA = "420-compute-worker-package-build-v1"
TARGETS = (
    ("linux", "amd64"),
    ("linux", "arm64"),
    ("windows", "amd64"),
    ("windows", "arm64"),
    ("darwin", "amd64"),
    ("darwin", "arm64"),
)
STATE_DIRS = {
    "linux": "/var/lib/420integrated/node420-compute",
    "darwin": "/Library/Application Support/420Integrated/node420-compute",
    "windows": r"C:\ProgramData\420Integrated\node420-compute",
}
PLATFORM_FILES = {
    "linux": (
        "run-node420-compute.sh",
        "node420-compute.service",
    ),
    "darwin": (
        "run-node420-compute.sh",
        "org.420integrated.node420-compute.plist",
    ),
    "windows": (
        "run-node420-compute.ps1",
        "register-startup-task.ps1",
    ),
}


def run(*args, env=None):
    cp = subprocess.run(args, cwd=ROOT, env=env, check=True, text=True, capture_output=True)
    return cp.stdout.strip()


def sha256_file(path):
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def source_identity():
    commit = run("git", "rev-parse", "HEAD")
    epoch = int(run("git", "show", "-s", "--format=%ct", "HEAD"))
    version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
    if not version:
        raise SystemExit("VERSION is empty")
    return version, commit, epoch


def write_text(path, text, mode=0o644):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8", newline="\n")
    os.chmod(path, mode)


def copy_file(src, dst, mode):
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dst)
    os.chmod(dst, mode)


def package_root_name(version, goos, goarch):
    return f"node420-compute-{version}-{goos}-{goarch}"


def zip_timestamp(epoch):
    minimum = 315532800  # 1980-01-01, the minimum ZIP timestamp.
    dt = datetime.datetime.fromtimestamp(max(epoch, minimum), datetime.timezone.utc)
    return (dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second)


def iter_stage_files(stage):
    return sorted((p for p in stage.rglob("*") if p.is_file()), key=lambda p: p.relative_to(stage).as_posix())


def create_zip(stage, output, root_name, epoch):
    ts = zip_timestamp(epoch)
    with zipfile.ZipFile(output, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for path in iter_stage_files(stage):
            rel = pathlib.PurePosixPath(root_name) / pathlib.PurePosixPath(path.relative_to(stage).as_posix())
            info = zipfile.ZipInfo(rel.as_posix(), date_time=ts)
            info.create_system = 3
            info.compress_type = zipfile.ZIP_DEFLATED
            info.external_attr = (stat.S_IMODE(path.stat().st_mode) & 0xFFFF) << 16
            archive.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)


def create_tar_gz(stage, output, root_name, epoch):
    with output.open("wb") as raw:
        with gzip.GzipFile(filename="", mode="wb", fileobj=raw, compresslevel=9, mtime=epoch) as gz:
            with tarfile.open(fileobj=gz, mode="w", format=tarfile.GNU_FORMAT) as archive:
                for path in iter_stage_files(stage):
                    rel = pathlib.PurePosixPath(root_name) / pathlib.PurePosixPath(path.relative_to(stage).as_posix())
                    data = path.read_bytes()
                    info = tarfile.TarInfo(rel.as_posix())
                    info.size = len(data)
                    info.mode = stat.S_IMODE(path.stat().st_mode)
                    info.uid = 0
                    info.gid = 0
                    info.uname = "root"
                    info.gname = "root"
                    info.mtime = epoch
                    archive.addfile(info, fileobj=__import__("io").BytesIO(data))


def build_target(version, commit, epoch, goos, goarch, stage, output_dir):
    binary_name = "node420-compute.exe" if goos == "windows" else "node420-compute"
    binary = stage / binary_name
    env = os.environ.copy()
    env.update({"CGO_ENABLED": "0", "GOOS": goos, "GOARCH": goarch})
    ldflags = (
        f"-s -w "
        f"-X main.version={version} "
        f"-X main.commit={commit}"
    )
    subprocess.run(
        [
            "go", "build",
            "-trimpath",
            "-buildvcs=false",
            "-ldflags", ldflags,
            "-o", str(binary),
            "./execution/cmd/node420-compute",
        ],
        cwd=ROOT,
        env=env,
        check=True,
    )
    os.chmod(binary, 0o755)

    common = ROOT / "packaging" / "node420-compute" / "common"
    platform = ROOT / "packaging" / "node420-compute" / goos
    copy_file(common / "README.txt", stage / "README.txt", 0o644)
    args_text = (common / "worker.args.example").read_text(encoding="utf-8").replace(
        "@STATE_DIR@", STATE_DIRS[goos]
    )
    write_text(stage / "worker.args.example", args_text, 0o600)
    for name in PLATFORM_FILES[goos]:
        mode = 0o755 if name.endswith((".sh", ".ps1")) else 0o644
        copy_file(platform / name, stage / name, mode)

    binary_sha = sha256_file(binary)
    metadata = {
        "schema": BUILD_SCHEMA,
        "version": version,
        "commit": commit,
        "source_date_epoch": epoch,
        "source_date_utc": datetime.datetime.fromtimestamp(epoch, datetime.timezone.utc).isoformat(),
        "goos": goos,
        "goarch": goarch,
        "cgo_enabled": False,
        "binary": binary_name,
        "binary_sha256": binary_sha,
        "state_directory_example": STATE_DIRS[goos],
        "package_authoritative": False,
        "platform_runtime_qualified": False,
        "note": (
            "CMP-3.13 packaging proves deterministic cross-build/package structure only. "
            "It is not live-network authorization or native runtime certification."
        ),
    }
    write_text(stage / "BUILD-METADATA.json", json.dumps(metadata, indent=2, sort_keys=True) + "\n", 0o644)

    root_name = package_root_name(version, goos, goarch)
    suffix = ".zip" if goos == "windows" else ".tar.gz"
    archive_path = output_dir / f"{root_name}{suffix}"
    if goos == "windows":
        create_zip(stage, archive_path, root_name, epoch)
    else:
        create_tar_gz(stage, archive_path, root_name, epoch)

    return {
        "goos": goos,
        "goarch": goarch,
        "archive": archive_path.name,
        "archive_sha256": sha256_file(archive_path),
        "binary": binary_name,
        "binary_sha256": binary_sha,
        "state_directory_example": STATE_DIRS[goos],
    }


def main():
    parser = argparse.ArgumentParser(description="Build deterministic CMP-3.13 node420-compute packages")
    parser.add_argument("--output", default="dist/node420-compute", help="package output directory")
    args = parser.parse_args()

    version, commit, epoch = source_identity()
    output_dir = (ROOT / args.output).resolve() if not pathlib.Path(args.output).is_absolute() else pathlib.Path(args.output)
    if output_dir.exists():
        shutil.rmtree(output_dir)
    output_dir.mkdir(parents=True)

    staging_root = output_dir / ".staging"
    packages = []
    try:
        for goos, goarch in TARGETS:
            stage = staging_root / f"{goos}-{goarch}"
            stage.mkdir(parents=True, exist_ok=True)
            packages.append(build_target(version, commit, epoch, goos, goarch, stage, output_dir))
    finally:
        shutil.rmtree(staging_root, ignore_errors=True)

    manifest = {
        "schema": SCHEMA,
        "version": version,
        "commit": commit,
        "source_date_epoch": epoch,
        "targets": [f"{goos}/{goarch}" for goos, goarch in TARGETS],
        "packages": packages,
        "platform_runtime_qualified": False,
        "level3_merge_candidate": False,
    }
    manifest_path = output_dir / "node420-compute-package-manifest.json"
    write_text(manifest_path, json.dumps(manifest, indent=2, sort_keys=True) + "\n")

    checksum_lines = []
    for path in sorted(p for p in output_dir.iterdir() if p.is_file() and p.name != "SHA256SUMS.txt"):
        checksum_lines.append(f"{sha256_file(path)}  {path.name}")
    write_text(output_dir / "SHA256SUMS.txt", "\n".join(checksum_lines) + "\n")

    print(manifest_path)
    for package in packages:
        print(f"{package['archive_sha256']}  {package['archive']}")


if __name__ == "__main__":
    main()

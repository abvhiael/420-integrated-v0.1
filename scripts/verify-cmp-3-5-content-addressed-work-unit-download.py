#!/usr/bin/env python3
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
impl = ROOT / "compute/worker/download.go"
tests = ROOT / "compute/worker/download_test.go"
doc = ROOT / "docs/compute-market/CMP-3.5-CONTENT-ADDRESSED-WORK-UNIT-DOWNLOAD.md"
roadmap = ROOT / "docs/compute-market/COMPUTE-MARKET-POST-CMP1-ROADMAP.md"
workflow = ROOT / ".github/workflows/compute-worker-fast.yml"

errors = []
for path in [impl, tests, doc, roadmap, workflow]:
    if not path.is_file():
        errors.append(f"missing {path.relative_to(ROOT)}")
if errors:
    print("\n".join(errors))
    sys.exit(1)

s = impl.read_text()
t = tests.read_text()
d = doc.read_text()
r = roadmap.read_text()
w = workflow.read_text()

for token in [
    "WorkUnitDownloadSchemaV1",
    "type WorkUnitSource struct",
    "type WorkUnitArtifact struct",
    "type RequestAuthorizer interface",
    "type WorkUnitDownloader struct",
    "NewWorkUnitDownloader",
    "ValidateWorkUnitSource",
    "func (d *WorkUnitDownloader) Fetch",
    'parsed.Scheme != "https"',
    "parsed.User != nil",
    'parsed.Fragment != ""',
    "sha256HexPattern",
    "io.LimitReader(",
    "int64(source.SizeBytes)+1",
    "io.MultiWriter(tmp, hasher)",
    "hex.EncodeToString(hasher.Sum(nil))",
    "os.Rename(tmpName, finalPath)",
    "dir.Sync()",
    "os.Lstat(path)",
    "info.Mode().IsRegular()",
    "os.ModeSymlink",
]:
    if token not in s:
        errors.append(f"missing CMP-3.5 implementation token: {token}")

if (
    "io.LimitReader(response.Body, int64(source.SizeBytes)+1)" not in s
    and not (
        "body = d.bandwidth.WrapReader(ctx, body)" in s
        and "io.LimitReader(body, int64(source.SizeBytes)+1)" in s
    )
):
    errors.append("CMP-3.5 size bound no longer applies to the response body path")

for token in [
    "http.ErrUseLastResponse",
    'request.Header.Set("X-420-Artifact-SHA256"',
    "d.authorizer.Authorize",
    "response.ContentLength",
    "ErrDigestMismatch",
    "ErrSizeMismatch",
]:
    if token not in s:
        errors.append(f"missing transport/integrity boundary: {token}")

for forbidden in [
    "exec.Command(",
    "exec.CommandContext(",
    "os.Chmod(finalPath, 0o777",
    "http://",
]:
    if forbidden in s:
        errors.append(f"downloader crosses execution/plaintext boundary: {forbidden}")

for token in [
    "TestValidateWorkUnitSourceFailsClosed",
    "TestWorkUnitDownloadVerifiesDigestAndAtomicallyStoresPrivateFile",
    "TestWorkUnitDownloadRejectsDigestMismatchAndLeavesNoArtifact",
    "TestWorkUnitDownloadRejectsOversizeAndTruncatedBodies",
    "TestWorkUnitDownloadRejectsRedirectsAndMediaTypeMismatch",
    "TestWorkUnitDownloadRejectsCorruptCacheAndRefetches",
    "TestWorkUnitDownloadRejectsSymlinkCache",
    "TestWorkUnitDownloadAuthorizationFailureMakesNoRequest",
]:
    if token not in t:
        errors.append(f"missing CMP-3.5 test: {token}")

for token in [
    "go test ./compute/worker",
    "go vet ./compute/worker ./execution/cmd/node420-compute",
    "go build ./execution/cmd/node420-compute",
    "verify-cmp-3-1-worker-daemon.py",
    "verify-cmp-3-2-hardware-software-discovery.py",
    "verify-cmp-3-3-benchmarking-capability-evidence.py",
    "verify-cmp-3-4-secure-workload-sandbox.py",
    "verify-cmp-3-5-content-addressed-work-unit-download.py",
]:
    if token not in w:
        errors.append(f"Compute Worker fast workflow missing CMP-3.5 coverage: {token}")

if (
    "Status: **IMPLEMENTED / LEVEL 1 QUALIFICATION PENDING**" not in d
    and "Status: **COMPLETE — Level 1 exact-head qualified" not in d
):
    errors.append("CMP-3.5 documentation status drift")
if "Next canonical step: **CMP-3.6 — Execution lifecycle**." not in d:
    errors.append("CMP-3.5 next canonical step drift")
if "## CMP-3.5 — Content-addressed work-unit download" not in r:
    errors.append("canonical CMP-3.5 roadmap step missing")
if (
    "IMPLEMENTED / Level 1 qualification pending" not in r
    and "COMPLETE — Level 1 exact-head qualified" not in r
):
    errors.append("CMP-3.5 roadmap status missing or stale")

if errors:
    print("CMP-3.5 content-addressed work-unit download verification FAILED")
    for error in errors:
        print("-", error)
    sys.exit(1)

print("CMP-3.5 content-addressed work-unit download: mechanically consistent")

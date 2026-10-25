"""Execute bounded TN-FAN-01 local readiness qualification on actual Anvil contracts."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import socket
import subprocess
import sys
import time
import urllib.request
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / "clients/420bet-fantasy/daily"
SCOPE = ["clients/420bet-fantasy", "contracts/src", "contracts/script/fantasy",
         "scripts/fantasy/qualify-deployment-readiness.py", ".github/workflows/420bet-deployment-readiness-level2.yml"]


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True).strip()


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--forge", default="forge"); p.add_argument("--anvil", default="anvil")
    p.add_argument("--solc", default="0.8.30"); p.add_argument("--output", required=True)
    p.add_argument("--diagnostic-build"); a = p.parse_args()
    out = Path(a.output).resolve(); out.mkdir(parents=True, exist_ok=True)
    certificate = out / "qualification.json"; certificate.unlink(missing_ok=True)
    sha = git("rev-parse", "HEAD")
    dirty = git("status", "--porcelain", "--untracked-files=normal", "--", *SCOPE)
    if dirty and not a.diagnostic_build:
        raise RuntimeError("commit scoped source before exact-SHA qualification")
    build = Path(a.diagnostic_build).resolve() if a.diagnostic_build else out / "build"
    if not a.diagnostic_build:
        env = dict(os.environ, FOUNDRY_PROFILE="pr", FOUNDRY_SRC="script/fantasy", FOUNDRY_SCRIPT="script/fantasy",
                   FOUNDRY_TEST="test/__readiness_empty__", FOUNDRY_OUT=str(build), FOUNDRY_CACHE_PATH=str(out/"cache"))
        r = subprocess.run([a.forge, "test", "--no-dynamic-test-linking", "--no-match-test", ".*", "--root", str(ROOT/"contracts"), "--use", a.solc], cwd=ROOT, env=env, capture_output=True, timeout=300)
        (out/"compile.stdout.log").write_bytes(r.stdout); (out/"compile.stderr.log").write_bytes(r.stderr)
        if r.returncode: raise RuntimeError("actual canonical compilation failed")
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0)); port = s.getsockname()[1]
    rpc = "http://127.0.0.1:"+str(port)
    private = out/"private"/str(uuid4()); private.mkdir(parents=True)
    kwargs = {"creationflags": subprocess.CREATE_NO_WINDOW} if os.name == "nt" else {}
    with (out/"anvil.log").open("w") as log:
        node = subprocess.Popen([a.anvil, "--host", "127.0.0.1", "--port", str(port), "--chain-id", "31337", "--silent"], stdout=log, stderr=log, **kwargs)
        try:
            for _ in range(100):
                try:
                    urllib.request.urlopen(urllib.request.Request(rpc, data=b'{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}', headers={"Content-Type":"application/json"}), timeout=1)
                    break
                except Exception: time.sleep(.1)
            env = dict(os.environ, FANTASY_READINESS_RPC=rpc, FANTASY_READINESS_BUILD=str(build),
                       FANTASY_READINESS_PRIVATE=str(private), FANTASY_READINESS_OUTPUT=str(out))
            r = subprocess.run([sys.executable, str(APP/"test_deployment.py")], cwd=APP, env=env, capture_output=True, timeout=600)
            (out/"tests.stdout.log").write_bytes(r.stdout); (out/"tests.stderr.log").write_bytes(r.stderr)
            if r.returncode: raise RuntimeError("actual deployment/readiness integration failed; inspect test logs")
        finally:
            node.terminate(); node.wait(timeout=15)
    text = r.stderr.decode("utf-8").replace("\r\n", "\n")
    count = int(re.search(r"Ran (\d+) tests", text)[1])
    inventory = len(re.findall(r"^    def test_", (APP/"test_deployment.py").read_text(), re.M))
    if count != inventory or count != 32 or "\nOK\n" not in text or "skipped=" in text:
        raise RuntimeError("incomplete actual readiness execution")
    if git("rev-parse", "HEAD") != sha or git("status", "--porcelain", "--untracked-files=normal", "--", *SCOPE) != dirty:
        raise RuntimeError("source changed during qualification")
    public = ["tests.stdout.log", "tests.stderr.log", "offline-bundle.json", "local-deployment-manifest.json",
              "unsigned-authority-plan.json", "local-attestation.json", "application-config.json",
              "constructor-transactions.json", "receipt-evidence.json"]
    if not a.diagnostic_build: public += ["compile.stdout.log", "compile.stderr.log"]
    report = {"schema":"420.fantasy.tn-fan-01.local-qualification.v1", "qualifiedSHA":sha,
              "level":2, "actualTestsPassed":count, "diagnosticOnly":bool(a.diagnostic_build),
              "officialTestnetDeployed":False, "productionAuthorized":False,
              "sourceSHA256":{path:hashlib.sha256((ROOT/path).read_bytes()).hexdigest() for path in git("ls-files", "clients/420bet-fantasy/daily", "scripts/fantasy/qualify-deployment-readiness.py", ".github/workflows/420bet-deployment-readiness-level2.yml").splitlines()},
              "evidenceSHA256":{name:hashlib.sha256((out/name).read_bytes()).hexdigest() for name in public}}
    target = out/"diagnostic.json" if a.diagnostic_build else certificate
    target.write_text(json.dumps(report, indent=2)+"\n", encoding="utf-8")
    print(json.dumps({"sha":sha, "actualTestsPassed":count, "diagnosticOnly":bool(a.diagnostic_build)}))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Build the complete import closure of the retained Commerce upstream integration suite."""
import pathlib, re, shutil, subprocess, tempfile
root = pathlib.Path(__file__).resolve().parents[2]
contracts = root / 'contracts'
tests = ['MarketPaySettlementAdapter420.t.sol', 'Market420.t.sol', 'PayAudit3Lifecycle420.t.sol',
         'PayAudit4SettlementAndAccounting420.t.sol', 'PaymentAtomicSettlement420.t.sol',
         'PayFocusedHardening420.t.sol', 'RefundManager420Fuzz.t.sol',
         'RefundManager420Funded.t.sol']
files = set()
def include(path):
    path = path.resolve()
    path.relative_to(contracts)
    if path in files: return
    files.add(path)
    source = path.read_text()
    for imported in re.findall(r'import\s+(?:[^;]*?from\s+)?["\']([^"\']+)["\']\s*;', source):
        include(path.parent / imported)
for test in tests: include(contracts / 'test' / test)
with tempfile.TemporaryDirectory(prefix='commerce-foundry-') as tmp:
    target = pathlib.Path(tmp)
    shutil.copy2(contracts / 'foundry.toml', target / 'foundry.toml')
    for path in sorted(files):
        dest = target / path.relative_to(contracts)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, dest)
    print(f'Commerce qualification: {len(tests)} test units; complete {len(files)}-file import closure', flush=True)
    subprocess.run(['forge', 'test', '-vv'], cwd=target, check=True)
    subprocess.run(['forge', 'build', '--sizes', 'src/market/MarketPaySettlementAdapter420.sol'], cwd=target, check=True)

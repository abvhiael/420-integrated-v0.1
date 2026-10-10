#!/usr/bin/env python3
"""Qualify retained Market/Pay, governed refund and Arbitration protocol boundary tests.
Keep the two independent compilation closures isolated to diagnose via-IR failures
without skipping either inventory or running the repository-wide Foundry suite.
"""
import pathlib, re, shutil, subprocess, tempfile
root = pathlib.Path(__file__).resolve().parents[2]
contracts = root / 'contracts'
groups = {
    'market-pay': ['MarketPaySettlementAdapter420.t.sol', 'Market420.t.sol',
        'PayAudit3Lifecycle420.t.sol', 'PayAudit4SettlementAndAccounting420.t.sol',
        'PaymentAtomicSettlement420.t.sol', 'PayFocusedHardening420.t.sol'],
    'funded-refunds': ['RefundManager420Fuzz.t.sol', 'RefundManager420Funded.t.sol'],
    'arbitration': ['ArbitrationGenesis420.t.sol', 'ArbitrationDeploymentBinding420.t.sol'],
}
def closure(tests):
    files = set()
    def include(path):
        path = path.resolve()
        path.relative_to(contracts)
        if path in files: return
        files.add(path)
        for imported in re.findall(r'import\s+(?:[^;]*?from\s+)?["\']([^"\']+)["\']\s*;', path.read_text()):
            include(path.parent / imported)
    for test in tests: include(contracts / 'test' / test)
    return files
for group, tests in groups.items():
    files=closure(tests)
    with tempfile.TemporaryDirectory(prefix=f'commerce-{group}-') as tmp:
        target=pathlib.Path(tmp)
        shutil.copy2(contracts / 'foundry.toml', target / 'foundry.toml')
        for path in sorted(files):
            dest=target / path.relative_to(contracts)
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(path,dest)
        print(f'Commerce {group}: {len(tests)} units, {len(files)}-file import closure',flush=True)
        subprocess.run(['forge','test','-vv'],cwd=target,check=True)
        if group=='market-pay':
            subprocess.run(['forge','build','--sizes','src/market/MarketPaySettlementAdapter420.sol'],cwd=target,check=True)

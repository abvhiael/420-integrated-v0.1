#!/usr/bin/env python3
"""COM-3: compile only directly consumed ABI import closure, then service/SDK gates.

No repository Foundry tests or full inventory. Contract compile artifacts are
retained during this invocation for the interface compatibility tests.
"""
import os, pathlib, re, shutil, subprocess, tempfile
root = pathlib.Path(__file__).resolve().parents[2]
contracts = root / 'contracts'
names = {'market': ['ListingRegistry420', 'InventoryReservation420', 'MarketPolicyRegistry420', 'OrderRegistry420', 'MarketPaySettlementAdapter420'], 'pay': ['MerchantRegistry420', 'PaymentRegistry420', 'InvoiceRegistry420']}
files = set()
def include(path):
    path = path.resolve()
    path.relative_to(contracts)
    if path in files: return
    files.add(path)
    for imported in re.findall(r'import\s+(?:[^;]*?from\s+)?["\']([^"\']+)["\']\s*;', path.read_text()):
        include(path.parent / imported)
for folder, units in names.items():
    for name in units: include(contracts / 'src' / folder / (name + '.sol'))
def run(command, cwd, env=None):
    subprocess.run(command, cwd=cwd, env=env, check=True)
with tempfile.TemporaryDirectory(prefix='commerce-service-abi-') as tmp:
    target = pathlib.Path(tmp)
    shutil.copy2(contracts / 'foundry.toml', target / 'foundry.toml')
    for source in sorted(files):
        dest = target / source.relative_to(contracts)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source, dest)
    print(f'COM-3 directly consumed ABI compile: 8 contracts / {len(files)}-file import closure; no full inventory', flush=True)
    run(['forge', 'build', '--sizes'], target)
    env = dict(os.environ, COMMERCE_ARTIFACT_DIR=str(target / 'out'))
    run(['npm', 'run', 'build'], root / '420-indexer')
    run(['node', '--test', 'dist/test/abi-manifest.test.js', 'dist/test/protocol-projections.test.js', 'dist/test/protocol-dto.test.js', 'dist/test/event-stream.test.js', 'dist/test/event-canonicality.test.js', 'dist/test/event-delivery.test.js', 'dist/test/lifecycle-reducer.test.js', 'dist/test/api-surface.test.js', 'dist/test/http-transport.test.js', 'dist/test/query-layer.test.js', 'dist/test/protocol-object-service.test.js', 'dist/test/commerce.test.js'], root / '420-indexer')
    run(['npm', 'test'], root / 'packages' / '420-sdk')
    run(['npm', 'test'], root / 'commerce', env)

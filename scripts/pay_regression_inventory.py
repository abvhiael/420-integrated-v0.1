"""Independent, exact-Git-tree inventory of Pay and shared-boundary Solidity tests."""
import hashlib
import json
import posixpath
import re
import subprocess
import tomllib
import zipfile
from pathlib import Path

# Same package roots as scripts/qualify-cadc.py (relative to contracts/).
REMAPS = {
    'forge-std/': 'forge-std/',
    '@layerzerolabs/': 'test/fixtures/cadc/upstream/@layerzerolabs/',
    '@openzeppelin/': 'test/fixtures/cadc/upstream/@openzeppelin/',
    'solidity-bytes-utils/': 'test/fixtures/cadc/upstream/solidity-bytes-utils/',
}
CORE = {
    'contracts/src/interfaces/IPaymentRegistry420.sol',
    'contracts/src/market/MarketPaySettlementAdapter420.sol',
    'contracts/src/media/MediaPayComputeAdapter420.sol',
}
BOUNDARY = {'contracts/src/accounts/' + name + '.sol' for name in (
    'IPaymaster420', 'Paymaster420', 'PaymasterData420',
    'SponsorshipDigest420', 'SponsorshipPolicy420',
)} | {'contracts/src/system/ReplayProtectionConsumer420.sol',
     'contracts/src/interfaces/genesis/IReplayConsumer420.sol'}
SUPPORT = {'contracts/src/swap/CanonicalSwapExecutor420.sol',
           'contracts/src/interfaces/ICanonicalSettlement420.sol'}
SHARED_INTERFACE = {'contracts/src/interfaces/genesis/IReplayProtection420.sol'}
TOKEN = re.compile(r'//[^\r\n]*|/\*[\s\S]*?\*/|"(?:\\[\s\S]|[^"\\])*"|\'(?:\\[\s\S]|[^\'\\])*\'|[A-Za-z_$][A-Za-z0-9_$]*|[^\s]')


def tokens(text):
    return [m.group() for m in TOKEN.finditer(text)
            if not m.group().startswith(('//', '/*'))]


def imports(lexed):
    """All Solidity import forms, excluding comments and strings outside imports."""
    result = []
    i = 0
    while i < len(lexed):
        if lexed[i] != 'import':
            i += 1
            continue
        i += 1
        pieces = []
        while i < len(lexed) and lexed[i] != ';':
            pieces.append(lexed[i]); i += 1
        strings = [p[1:-1] for p in pieces if p.startswith(('"', "'"))]
        if i == len(lexed) or len(strings) != 1 or '\\' in strings[0]:
            raise ValueError('unsupported or malformed Solidity import: ' + ' '.join(pieces))
        result.append(strings[0]); i += 1
    return result


def test_source(path):
    parts = path.split('/')
    return len(parts) > 2 and parts[0] == 'contracts' and (
        parts[1] == 'test' or parts[1].startswith('test-')) and path.endswith('.sol')


def declared_test(lexed):
    return any(a == 'function' and b.startswith(('test', 'invariant_'))
               for a, b in zip(lexed, lexed[1:]))


class Inventory:
    def __init__(self, root):
        self.root = Path(root).resolve()
        self.head = self.git('rev-parse', 'HEAD').decode().strip()
        self.tree = self.git('rev-parse', 'HEAD^{tree}').decode().strip()
        self.tracked = {}
        for entry in self.git('ls-tree', '-r', '-z', self.head).split(b'\0'):
            if entry:
                meta, path = entry.split(b'\t', 1)
                mode, kind, oid = meta.decode().split()
                self.tracked[path.decode()] = (mode, kind, oid)
        self.raw = {}; self.lexed = {}; self.edges = {}; self.problems = {}; self.dynamic_cache = {}
        self.core = CORE | {p for p in self.tracked if p.startswith('contracts/src/pay/') and p.endswith('.sol')}
        self.pay_names = {Path(p).name for p in self.core}
        for p in sorted(self.core | BOUNDARY | SUPPORT | SHARED_INTERFACE):
            if p not in self.tracked:
                raise RuntimeError('canonical Pay scope root missing: ' + p)

    def git(self, *args):
        return subprocess.check_output(['git', *args], cwd=self.root)

    def read(self, path):
        """Read checkout bytes only after proving identity against the committed blob."""
        if path not in self.raw:
            mode, kind, oid = self.tracked[path]
            if kind != 'blob' or mode not in ('100644', '100755'):
                raise ValueError('non-regular tracked source: ' + path)
            file = self.root / path
            if file.is_symlink():
                raise ValueError('checkout source is a symlink: ' + path)
            raw = file.read_bytes()
            blob = b'blob ' + str(len(raw)).encode() + b'\0' + raw
            actual = (hashlib.sha1(blob) if len(oid) == 40 else hashlib.sha256(blob)).hexdigest()
            if actual != oid:
                raise ValueError('checkout bytes differ from exact HEAD: ' + path)
            self.raw[path] = raw
        return self.raw[path]

    def lex(self, path):
        if path not in self.lexed:
            self.lexed[path] = tokens(self.read(path).decode('utf-8-sig'))
        return self.lexed[path]

    def resolve(self, importer, spec):
        if spec.startswith(('./', '../')):
            candidate = posixpath.join(posixpath.dirname(importer), spec)
        else:
            prefix = next((p for p in sorted(REMAPS, key=len, reverse=True) if spec.startswith(p)), None)
            if prefix:
                candidate = 'contracts/' + REMAPS[prefix] + spec[len(prefix):]
            else:
                candidate = spec if spec.startswith('contracts/') else 'contracts/' + spec
        candidate = posixpath.normpath(candidate)
        if candidate.startswith(('../', '/')) or candidate not in self.tracked:
            raise ValueError('unresolved tracked import ' + spec + ' -> ' + candidate)
        if self.tracked[candidate][1] != 'blob' or self.tracked[candidate][0] not in ('100644', '100755'):
            raise ValueError('import is not a regular tracked blob: ' + candidate)
        return candidate

    def outgoing(self, path):
        if path not in self.edges:
            self.edges[path] = []; self.problems[path] = []
            try:
                specs = imports(self.lex(path))
            except (ValueError, OSError) as exc:
                self.problems[path].append(str(exc)); specs = []
            for spec in specs:
                try:
                    self.edges[path].append(self.resolve(path, spec))
                except ValueError as exc:
                    self.problems[path].append(str(exc))
        return self.edges[path]

    def closure(self, owner):
        pending = [owner]; visited = set()
        while pending:
            path = pending.pop()
            if path not in visited:
                visited.add(path); pending.extend(self.outgoing(path))
        errors = {p: self.problems[p] for p in sorted(visited) if self.problems[p]}
        return visited, errors

    def dynamic_refs(self, path):
        # Registry-selected contracts or artifact loads can avoid static imports.
        # Limit this signal to test/fixture code, not common service-ID definitions.
        if path in self.dynamic_cache:
            return self.dynamic_cache[path]
        lexed = self.lex(path); out = set()
        for i, t in enumerate(lexed):
            if lexed[i:i+3] == ['ServiceIds420', '.', 'PAY']:
                out.add('ServiceIds420.PAY')
            if t.startswith(('"', "'")):
                literal = t[1:-1]
                if literal == '420/service/pay/v1' or literal.startswith(('420/PAY/', '420/APP/420PAY/')):
                    out.add(literal)
                if any(name + ':' in literal or literal == name for name in self.pay_names):
                    out.add(literal)
        self.dynamic_cache[path] = sorted(out)
        return self.dynamic_cache[path]

    def discover(self):
        # Enumerate tracked owners before applying any relevance filter. Also
        # consider non-.t.sol files which declare Foundry test entry points.
        candidates = []
        for path in sorted(p for p in self.tracked if test_source(p)):
            if path.endswith('.t.sol') or declared_test(self.lex(path)):
                candidates.append(path)
        owners = {}
        for path in candidates:
            closure, errors = self.closure(path)
            core = sorted(closure & self.core); boundary = sorted(closure & BOUNDARY)
            support = sorted(closure & SUPPORT); interfaces = sorted(closure & SHARED_INTERFACE)
            dynamic = {p: refs for p in sorted(closure) if test_source(p)
                       and p not in errors and (refs := self.dynamic_refs(p))}
            if errors:
                kind = 'unresolved'
            elif core or dynamic:
                kind = 'pay'
            elif boundary:
                kind = 'shared-boundary'
            elif support:
                kind = 'supporting'
            elif interfaces:
                kind = 'shared-interface-only'
            else:
                kind = 'unrelated'
            owners[path] = {'classification': kind, 'pay_roots': core,
                            'boundary_roots': boundary, 'support_roots': support,
                            'shared_interfaces': interfaces, 'dynamic_refs': dynamic,
                            'closure': sorted(closure), 'unresolved_imports': errors}
        # A separately runnable suite imported by a Pay owner can also supply
        # fixtures. Record it as supporting, not as dedicated Pay functionality.
        for path, item in list(owners.items()):
            if item['classification'] in ('pay', 'shared-boundary'):
                for dep in item['closure']:
                    if dep != path and dep in owners:
                        if owners[dep]['classification'] in ('unrelated', 'shared-interface-only'):
                            owners[dep]['classification'] = 'supporting'
                        if owners[dep]['classification'] == 'supporting':
                            owners[dep].setdefault('imported_by', []).append(path)
        selected = sorted(p for p, row in owners.items()
                          if row['classification'] in ('pay', 'shared-boundary', 'supporting'))
        return {'schema': '420pay-test-inventory-v1', 'head': self.head, 'tree': self.tree,
                'remappings': REMAPS, 'tracked_test_owners': len(candidates),
                'owners': owners, 'selected': selected,
                'direct_imports': {p: sorted(set(ds)) for p, ds in sorted(self.edges.items())},
                'source_sha256': {p: hashlib.sha256(raw).hexdigest() for p, raw in sorted(self.raw.items())},
                'unresolved_owners': sorted(p for p, r in owners.items() if r['unresolved_imports'])}

    def compare_baseline(self, report, baseline):
        """Independently rehash every retained identity, not just selected files."""
        if baseline.get('pass') is not True or baseline.get('profile') != 'ci':
            raise ValueError('baseline is not a passing CI-profile record')
        if not re.fullmatch(r'[0-9a-f]{40}|[0-9a-f]{64}', baseline['head']):
            raise ValueError('invalid baseline SHA')
        if self.git('merge-base', baseline['head'], self.head).decode().strip() != baseline['head']:
            raise ValueError('baseline is not in current HEAD ancestry')
        hashes = baseline['source_sha256']; executed = {posixpath.normpath('contracts/' + p) for p in baseline['tests']}
        if not hashes or not executed or any(posixpath.relpath(p, 'contracts') not in hashes for p in executed):
            raise ValueError('incomplete baseline identities')
        checked = {}; mismatches = []
        for rel, digest in sorted(hashes.items()):
            if not isinstance(digest, str) or not re.fullmatch(r'[0-9a-f]{64}', digest):
                raise ValueError('invalid retained SHA-256: ' + rel)
            p = posixpath.normpath('contracts/' + rel)
            if posixpath.relpath(p, 'contracts') != rel or p not in self.tracked:
                mismatches.append(rel); continue
            actual = hashlib.sha256(self.read(p)).hexdigest(); checked[rel] = actual
            if actual != digest:
                mismatches.append(rel)
        missing = []; reusable = []
        for p in report['selected']:
            closure = report['owners'][p]['closure']
            if p in executed and all(posixpath.relpath(d, 'contracts') in hashes and
                    posixpath.relpath(d, 'contracts') not in mismatches for d in closure):
                reusable.append(p)
            else:
                missing.append(p)
        return {'baseline_head': baseline['head'], 'expected_hashes': len(hashes),
                'recomputed_hashes': checked, 'mismatched': mismatches,
                'previously_executed': sorted(executed), 'reusable': reusable, 'missing': missing,
                'previously_executed_outside_scope': sorted(executed - set(report['selected']))}


def passed_log(log, owner):
    """Require a real run of this owner and a successful all-suite summary."""
    if not re.search(r'^Ran \d+ tests? for ' + re.escape(owner) + r':', log, re.M):
        raise ValueError('no executed owner in log: ' + owner)
    summaries = re.findall(r'(\d+) tests? passed, (\d+) failed, (\d+) skipped', log)
    if not summaries:
        raise ValueError('no final result in log: ' + owner)
    passed, failed, skipped = map(int, summaries[-1])
    if passed == 0 or failed or skipped:
        raise ValueError('failed, skipped, or zero tests: ' + owner)
    return passed


def load_archive(path, expected_sha256):
    raw = Path(path).read_bytes()
    if hashlib.sha256(raw).hexdigest() != expected_sha256:
        raise ValueError('retained archive SHA-256 mismatch')
    with zipfile.ZipFile(path) as archive:
        pre = 'pay-regression-evidence/'
        baseline = json.loads(archive.read(pre + 'results.json'))
        inputs = json.loads(archive.read(pre + 'inputs.json'))
        if baseline.get('pass') is not True or baseline.get('profile') != 'ci':
            raise ValueError('not a passed full CI-profile archive')
        if inputs != {k: v for k, v in baseline.items() if k != 'pass'}:
            raise ValueError('archive inputs/results differ')
        owners = baseline['tests']
        if not owners or len(owners) != len(set(owners)):
            raise ValueError('empty or duplicate baseline owners')
        for owner in owners:
            passed_log(archive.read(pre + owner.replace('/', '_') + '.log').decode(), owner)
    return baseline


def verify_profile(baseline, config):
    profile = tomllib.loads(config)['profile']['ci']
    for key in ('fuzz', 'invariant'):
        for field, expected in profile[key].items():
            actual = baseline['effective_' + key][field]
            if field == 'seed':
                if int(actual, 16) != int(expected, 16):
                    raise ValueError('retained fuzz seed drift')
            elif actual != expected:
                raise ValueError('retained CI profile drift: ' + key + '.' + field)


def write_inventory(inventory, output, baseline=None):
    report = inventory.discover()
    output = Path(output); output.mkdir(parents=True, exist_ok=True)
    try:
        if baseline is not None:
            report['baseline'] = inventory.compare_baseline(report, baseline)
    finally:
        (output / 'inventory.json').write_text(json.dumps(report, indent=2) + '\n')
    if report['unresolved_owners']:
        raise RuntimeError('unresolved imports for ' + ', '.join(report['unresolved_owners']))
    return report

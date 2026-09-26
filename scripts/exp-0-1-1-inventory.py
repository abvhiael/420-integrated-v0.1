#!/usr/bin/env python3
"""EXP-0.1.1: enumerate *every* tracked blob at a pinned Git commit.

No GitHub search, working-tree glob, or truncated REST response participates in
completeness. The full-tree manifest is the enumeration authority. Classification
is intentionally separate from completeness: evidence and ambiguous matches are
preserved for review, never silently thrown away.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import subprocess
from collections import Counter
from pathlib import Path

PINNED = '95a83a961286701b6e8c064de1deccad10f41fd7'
TOKEN = re.compile(rb'explorer', re.IGNORECASE)
DIRECT = re.compile(rb'(?:explorer/|420explorer|explorer[-_.]|CTX-EXPLORER|EXPLORER_|/explorer/)', re.IGNORECASE)
OWNED_PREFIXES = ('explorer/', 'docs/apps/explorer/', 'testnet/public-services/explorer/')
OWNED_EXACT = {
    'contracts/config/420explorer-genesis.json',
    'docs/420EXPLORER.md',
    'docs/publication/explorer-integration.md',
    'scripts/verify-explorer-indexer-consumer.py',
    'scripts/validate-doc-explorer-integration.py',
    '.github/workflows/explorer-live-testnet.yml',
}
SHARED_EXACT = {
    '.github/workflows/420indexer.yml',
    'config/420indexer-v1.json',
    'testnet/public-services/indexer/readiness.json',
    'docs/contextual/genesis-dapp-context-map.json',
    'docs/publication/production-target.json',
    'scripts/verify-420indexer.py',
}
SHARED_PREFIXES = ('indexer/', '420-indexer/')


def git(*args: str, check: bool = True) -> bytes:
    result = subprocess.run(['git', *args], capture_output=True, check=False)
    if check and result.returncode:
        raise RuntimeError(f"git {' '.join(args)}: {result.stderr.decode(errors='replace')}")
    return result.stdout


def entries(commit: str) -> list[tuple[str, str, str, str]]:
    result = []
    for entry in git('ls-tree', '-r', '-z', '--full-tree', commit).split(b'\0'):
        if not entry:
            continue
        metadata, path = entry.split(b'\t', 1)
        mode, kind, sha = metadata.decode('ascii').split(' ')
        result.append((path.decode('utf-8', 'surrogateescape'), sha, mode, kind))
    paths = [item[0] for item in result]
    if len(paths) != len(set(paths)):
        raise RuntimeError('Git tree contains duplicate paths')
    return sorted(result)


def matching_paths(commit: str) -> set[str]:
    # The -I flag excludes binary content. Binary filenames are still checked
    # independently and all binary blobs remain in the complete tree manifest.
    run = subprocess.run(['git', 'grep', '-I', '-i', '-l', '-z', '-e', 'explorer', commit, '--'],
                         capture_output=True, check=False)
    if run.returncode not in (0, 1):
        raise RuntimeError('git grep failed: ' + run.stderr.decode(errors='replace'))
    prefix = (commit + ':').encode()
    paths = set()
    for item in run.stdout.split(b'\0'):
        if item:
            if not item.startswith(prefix):
                raise RuntimeError('Unexpected git grep output')
            paths.add(item[len(prefix):].decode('utf-8', 'surrogateescape'))
    return paths


def classify(path: str, data: bytes, text_match: bool) -> tuple[str, str, str]:
    lower = path.lower()
    if lower.startswith(OWNED_PREFIXES) or path in OWNED_EXACT:
        return 'Explorer-owned', 'Explorer source, specific document, readiness, or validator', 'direct'
    if path in SHARED_EXACT:
        return 'shared', 'Shared specification/configuration/CI or Indexer readiness/verification', 'direct'
    if lower.startswith(SHARED_PREFIXES) and text_match:
        return 'shared', 'Shared Indexer implementation mentions Explorer', 'review-dependency'
    if lower.startswith(('scripts/', '.github/workflows/')) and text_match and DIRECT.search(data):
        return 'shared', 'Cross-component script or workflow directly names Explorer assets', 'review-dependency'
    if lower.startswith(('docs/', 'contracts/', 'config/', 'testnet/')) and text_match and DIRECT.search(data):
        return 'referenced', 'Specification, fixture, or contextual mention requiring boundary review', 'review-context'
    if 'explorer' in lower and lower.startswith(('scripts/', '.github/workflows/')):
        return 'Explorer-owned', 'Explorer-named tool or workflow', 'review-owner'
    if 'explorer' in lower:
        return 'referenced', 'Explorer-named artifact outside owned roots', 'review-context'
    return 'incidental', 'Textual Explorer mention without an established integration edge', 'review-context'


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--commit', default=PINNED)
    parser.add_argument('--output', default='exp-0-1-1-evidence')
    opts = parser.parse_args()
    if not re.fullmatch('[0-9a-f]{40}', opts.commit):
        parser.error('--commit must be a complete immutable commit SHA')
    if git('rev-parse', opts.commit).decode().strip() != opts.commit:
        raise RuntimeError('Pinned commit was not found locally')
    out = Path(opts.output)
    out.mkdir(parents=True, exist_ok=True)
    tree = entries(opts.commit)
    matches = matching_paths(opts.commit)
    by_path = {path: (sha, mode, kind) for path, sha, mode, kind in tree}
    if matches - set(by_path):
        raise RuntimeError('Content match absent from Git tree')
    rows = []
    all_rows = []
    uninspected = []
    for path, sha, mode, kind in tree:
        candidate = path in matches or 'explorer' in path.lower() or path in SHARED_EXACT
        classification = 'out-of-scope'
        why = 'No Explorer path or content match; checked against full tracked tree'
        confidence = 'tree-verified'
        evidence = ''
        if candidate:
            data = git('cat-file', 'blob', sha) if kind == 'blob' else b''
            classification, why, confidence = classify(path, data, path in matches)
            excerpt = []
            if path in matches:
                for line_number, line in enumerate(data.splitlines(), 1):
                    if TOKEN.search(line):
                        excerpt.append(f"{line_number}:{line[:160].decode('utf-8', 'replace')}")
                        if len(excerpt) == 3:
                            break
            evidence = ' | '.join(excerpt)
            if path in matches and not excerpt:
                uninspected.append(path)
            rows.append((path, sha, mode, kind, classification, confidence, why, evidence))
        all_rows.append((path, sha, mode, kind, classification))
    if len(all_rows) != len(tree) or len(set(row[0] for row in all_rows)) != len(tree):
        raise RuntimeError('Complete tracked-tree accounting failed')
    if any(path not in by_path for path, *_ in rows):
        raise RuntimeError('A classified candidate is absent from the tree')
    with (out / 'full-tree.tsv').open('w', newline='', encoding='utf-8') as handle:
        writer = csv.writer(handle, delimiter='\t'); writer.writerow(('path', 'blob_sha', 'mode', 'git_type', 'classification')); writer.writerows(all_rows)
    with (out / 'explorer-candidates.tsv').open('w', newline='', encoding='utf-8') as handle:
        writer = csv.writer(handle, delimiter='\t'); writer.writerow(('path', 'blob_sha', 'mode', 'git_type', 'classification', 'review_status', 'reason', 'evidence')); writer.writerows(rows)
    summary = {'milestone': 'EXP-0.1.1', 'audited_commit': opts.commit,
               'tree_entries': len(tree), 'content_matches': len(matches),
               'candidate_entries': len(rows), 'classifications': dict(Counter(row[4] for row in rows)),
               'manual_review_required': sum(row[5].startswith('review-') for row in rows),
               'uninspected_matches': uninspected,
               'accounting_pass': True,
               'qualification': 'PENDING_MANUAL_CLASSIFICATION_RECONCILIATION'}
    (out / 'summary.json').write_text(json.dumps(summary, indent=2, sort_keys=True) + '\n')
    print(json.dumps(summary, indent=2, sort_keys=True))
    if uninspected:
        raise RuntimeError('Text matching paths could not produce evidence excerpts')


if __name__ == '__main__':
    main()

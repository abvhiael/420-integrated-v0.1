#!/usr/bin/env python3
"""HC-SEED-03 opaque canonical reference genomes. Does not send transactions."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
from Crypto.Hash import keccak

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'deployments/highcountry'

def stable(value):
    def inspect(v):
        if isinstance(v, float):
            raise ValueError('floating point values forbidden')
        if isinstance(v, dict):
            if not all(isinstance(k, str) for k in v):
                raise ValueError('object keys must be strings')
            for item in v.values(): inspect(item)
        elif isinstance(v, list):
            for item in v: inspect(item)
    inspect(value)
    return json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True).encode('utf-8')

def k(raw):
    h = keccak.new(digest_bits=256)
    h.update(raw)
    return '0x' + h.hexdigest()

def commit(value):
    return k(stable(value))

def load(name):
    return json.loads((DATA / name).read_text())

def generate(catalog, research, policy, version=1):
    if type(version) is not int or not 1 <= version <= 2**32-1:
        raise ValueError('reference version')
    if policy.get('schema') != 'HC.SEED.COMMON_TRANSLATION.V1' or policy.get('locusCount') != 28:
        raise ValueError('translation policy')
    if policy.get('version') != 1 or policy.get('domains') != {
        'line': 'HC.COMMON.LINE.V1', 'locus': 'HC.COMMON.LOCUS.V1', 'genome': 'HC.COMMON.GENOME.V1'
    }:
        raise ValueError('translation domains')
    if policy.get('registration') != {
        'method': 'registerGenome(bytes32,bytes32,bytes32,bytes32[28])',
        'founding': False, 'genesisFinalizedRequired': True,
        'authorizationModule': 'ModuleIds.GENOME_REGISTRY',
        'authorizationAction': 'ActionIds.GENOME_REGISTER', 'scope': 'exact genomeId', 'amount': 0,
        'executionStage': 'HC-SEED-04; no live registration performed by generation'
    }:
        raise ValueError('registration policy')
    expected = {c['id']: c for c in catalog['cultivars'] if c['tier'] == 'common'}
    if len(expected) != 23 or len(research['cultivars']) != 23:
        raise ValueError('common coverage')
    seen = set()
    entries = []
    policy_hash = commit(policy)
    for r in sorted(research['cultivars'], key=lambda x: x['cultivarId']):
        cid = r['cultivarId']
        c = expected.get(cid)
        if c is None or cid in seen or c['name'] != r['canonicalName'] or c['region'] != r['canonicalRegion']:
            raise ValueError('catalog identity mismatch')
        if r.get('genomeAdmission') != 'not-authorized-by-research' or r['ancestry'].get('biologicallyVerified') is not False:
            raise ValueError('research boundary')
        seen.add(cid)
        rh = commit(r)
        line_id = commit([policy['domains']['line'], cid])
        loci = [commit([policy['domains']['locus'], cid, version, i, rh]) for i in range(28)]
        ch = r['characteristics']
        annotations = {key: ch[key] for key in (
            'publisherClassification', 'reportedFlavors', 'profileTerpenes',
            'morphologySummary', 'morphologyCoverage', 'sourceId'
        )}
        if 'narrativeTerpenes' in ch: annotations['narrativeTerpenes'] = ch['narrativeTerpenes']
        metadata = {
            'schema': 'HC.SEED.COMMON_REFERENCE_METADATA.V1', 'cultivarId': cid,
            'canonicalName': c['name'], 'canonicalRegion': c['region'],
            'referenceVersion': version, 'translationPolicyHash': policy_hash,
            'researchEntryHash': rh, 'ancestryAccount': r['ancestry'],
            'descriptiveAnnotations': annotations, 'sources': r['sources'],
            'uncertainty': r['uncertainty'],
            'semantics': 'reference annotations only; not decoded, inherited or measured biological traits'
        }
        mh = commit(metadata)
        gid = commit([policy['domains']['genome'], cid, version, line_id, mh, loci])
        entries.append({
            'cultivarId': cid, 'referenceVersion': version, 'genomeId': gid,
            'lineId': line_id, 'metadataHash': mh, 'loci': loci, 'founding': False,
            'metadata': metadata,
            'registration': {
                'method': 'registerGenome', 'args': [gid, line_id, mh, loci],
                'scopeHash': gid, 'amount': 0, 'requiresFinalizedGenesis': True,
                'status': 'prepared-not-submitted'
            }
        })
    if set(expected) != seen:
        raise ValueError('missing common')
    return {
        'schema': 'HC.SEED.COMMON_REFERENCE_GENOMES.V1', 'referenceVersion': version,
        'translationPolicyHash': policy_hash, 'catalogHash': commit(catalog),
        'researchHash': commit(research), 'status': 'REGISTRATION_READY_NOT_REGISTERED',
        'genomes': entries
    }

def validate(manifest, catalog, research, policy):
    expected = generate(catalog, research, policy, manifest.get('referenceVersion'))
    if manifest != expected:
        raise ValueError('reference manifest differs from canonical derivation')
    for field in ('genomeId', 'lineId'):
        if len({e[field] for e in manifest['genomes']}) != 23:
            raise ValueError('duplicate ' + field)
    reserved = {k(('HC.FOUNDING.GENETIC_LINE.' + str(i)).encode()) for i in range(1,17)}
    if any(e['lineId'] in reserved for e in manifest['genomes']):
        raise ValueError('reserved founding line')
    for e in manifest['genomes']:
        if len(e['loci']) != 28 or any(int(v,16) == 0 for v in [e['genomeId'],e['lineId'],e['metadataHash'],*e['loci']]):
            raise ValueError('invalid bytes32')
    return {'genomes': 23, 'lociPerGenome': 28, 'registrationStatus': manifest['status'],
            'manifestKeccak': commit(manifest)}

def describe_reference(manifest, record):
    """Only exact immutable references may display their source annotations."""
    if not isinstance(record, dict): raise ValueError('record')
    for e in manifest['genomes']:
        if record.get('genomeId') == e['genomeId']:
            if any(record.get(key) != e[key] for key in ('lineId','metadataHash','loci','founding')):
                raise ValueError('reference record mismatch')
            return {'cultivarId': e['cultivarId'], 'referenceVersion': e['referenceVersion'],
                    'annotations': copy.deepcopy(e['metadata']['descriptiveAnnotations']),
                    'performanceTraits': None, 'annotationBasis': 'exact-reference-metadata'}
    return {'cultivarId': None, 'annotations': None, 'performanceTraits': None,
            'annotationBasis': 'unknown-or-derived-genome; no inferred reference traits'}

def inputs():
    return [load(n) for n in ('seed-catalog.v1.json','common-cultivar-research.v1.json','common-genome-translation.v1.json')]

def write_manifest(target, manifest):
    if target.exists() and json.loads(target.read_text()) != manifest:
        raise ValueError('published reference version cannot be overwritten; select a new version/path')
    target.write_text(json.dumps(manifest, indent=2, ensure_ascii=True)+'\n')

def verify_engine_sources(root=ROOT):
    audit=json.loads((root/'deployments/highcountry/common-genome-engine-inspection.v1.json').read_text())
    if audit.get('schema') != 'HC.SEED.ENGINE_INSPECTION.V1' or len(audit['files']) != 5:
        raise ValueError('engine inspection manifest')
    for item in audit['files']:
        source=(root/item['path']).resolve()
        source.relative_to(root.resolve())
        if hashlib.sha256(source.read_bytes()).hexdigest() != item['sha256']:
            raise ValueError('inspected engine changed: '+item['path'])

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--reference-version', type=int, default=1)
    args=parser.parse_args()
    verify_engine_sources()
    catalog,research,policy=inputs()
    target=DATA/f'common-reference-genomes.v{args.reference_version}.json'
    if args.check:
        if json.loads(target.read_text()).get('referenceVersion') != args.reference_version:
            raise ValueError('reference filename/version mismatch')
        print(json.dumps(validate(json.loads(target.read_text()),catalog,research,policy),sort_keys=True))
    else:
        write_manifest(target, generate(catalog,research,policy,args.reference_version))

if __name__ == '__main__': main()

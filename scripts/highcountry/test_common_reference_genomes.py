import copy
import json
import unittest
from pathlib import Path
import common_reference_genomes as g

CATALOG,RESEARCH,POLICY=g.inputs()
MANIFEST=g.load('common-reference-genomes.v1.json')
class CommonReferenceGenomesTest(unittest.TestCase):
    def test_ethereum_keccak_known_vector(self):
        self.assertEqual(g.k(b''),'0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470')
    def test_all_23_canonical_records(self):
        self.assertEqual(g.validate(MANIFEST,CATALOG,RESEARCH,POLICY)['genomes'],23)
    def test_reproducible_despite_object_key_order(self):
        shuffled=json.loads(json.dumps(RESEARCH,sort_keys=True))
        self.assertEqual(g.generate(CATALOG,shuffled,POLICY),MANIFEST)
    def test_version_changes_genome_not_line(self):
        newer=g.generate(CATALOG,RESEARCH,POLICY,2)
        for a,b in zip(MANIFEST['genomes'],newer['genomes']):
            self.assertEqual(a['lineId'],b['lineId'])
            self.assertNotEqual(a['genomeId'],b['genomeId'])
            self.assertNotEqual(a['metadataHash'],b['metadataHash'])
            self.assertNotEqual(a['loci'],b['loci'])
    def test_source_change_changes_commitments(self):
        altered=copy.deepcopy(RESEARCH)
        altered['cultivars'][0]['uncertainty']['notes']+=' New source qualification.'
        newer=g.generate(CATALOG,altered,POLICY,2)
        self.assertNotEqual(newer['researchHash'],MANIFEST['researchHash'])
    def test_no_effects_or_performance_in_trait_annotations(self):
        for e in MANIFEST['genomes']:
            a=e['metadata']['descriptiveAnnotations']
            for key in ['readerReportedEffects','yield','potency','growthRate','flowering','climateResistance']:
                self.assertNotIn(key,a)
    def test_exact_reference_description_only(self):
        for e in MANIFEST['genomes']:
            self.assertEqual(g.describe_reference(MANIFEST,e)['cultivarId'],e['cultivarId'])
            self.assertIsNone(g.describe_reference(MANIFEST,e)['performanceTraits'])
    def test_bred_or_unknown_genome_cannot_inherit_source_annotations(self):
        e=copy.deepcopy(MANIFEST['genomes'][0]);e['genomeId']=g.k(b'child')
        result=g.describe_reference(MANIFEST,e)
        self.assertIsNone(result['annotations']);self.assertIsNone(result['performanceTraits'])
    def test_reference_metadata_or_locus_spoof_rejects(self):
        for field in ['lineId','metadataHash','loci','founding']:
            e=copy.deepcopy(MANIFEST['genomes'][0]);e[field]=None
            with self.subTest(field=field),self.assertRaises(ValueError):g.describe_reference(MANIFEST,e)
    def test_reference_annotations_preserve_research_uncertainty(self):
        refs={e['cultivarId']:e for e in MANIFEST['genomes']}
        for r in RESEARCH['cultivars']:
            m=refs[r['cultivarId']]['metadata']
            self.assertEqual(m['ancestryAccount'],r['ancestry'])
            self.assertEqual(m['uncertainty'],r['uncertainty'])
    def test_registration_args_exact(self):
        for e in MANIFEST['genomes']:
            self.assertEqual(e['registration']['args'],[e['genomeId'],e['lineId'],e['metadataHash'],e['loci']])
            self.assertEqual(e['registration']['scopeHash'],e['genomeId'])
            self.assertFalse(e['founding'])
    def test_mutations_fail_canonical_validation(self):
        for name in ['genomeId','lineId','metadataHash','loci','founding','registration','metadata']:
            altered=copy.deepcopy(MANIFEST);altered['genomes'][0][name]=None
            with self.subTest(field=name),self.assertRaises(ValueError):g.validate(altered,CATALOG,RESEARCH,POLICY)
    def test_missing_duplicate_or_reordered_records_reject(self):
        for mode in ['missing','duplicate','reordered']:
            altered=copy.deepcopy(MANIFEST)
            if mode=='missing':altered['genomes'].pop()
            elif mode=='duplicate':altered['genomes'][1]=altered['genomes'][0]
            else:altered['genomes'].reverse()
            with self.subTest(mode=mode),self.assertRaises(ValueError):g.validate(altered,CATALOG,RESEARCH,POLICY)
    def test_catalog_drift_rejects(self):
        altered=copy.deepcopy(RESEARCH);altered['cultivars'][0]['canonicalRegion']='Northern Lights'
        with self.assertRaises(ValueError):g.generate(CATALOG,altered,POLICY)
    def test_duplicate_research_rejects(self):
        altered=copy.deepcopy(RESEARCH);altered['cultivars'][1]=altered['cultivars'][0]
        with self.assertRaises(ValueError):g.generate(CATALOG,altered,POLICY)
    def test_founding_path_policy_rejects(self):
        altered=copy.deepcopy(POLICY);altered['registration']['founding']=True
        with self.assertRaises(ValueError):g.generate(CATALOG,RESEARCH,altered)
    def test_invalid_versions_reject(self):
        for version in [0,-1,True,1.0,'1',2**32]:
            with self.subTest(version=version),self.assertRaises(ValueError):g.generate(CATALOG,RESEARCH,POLICY,version)
    def test_sha3_is_not_ethereum_keccak(self):
        import hashlib
        self.assertNotEqual(g.k(b''),'0x'+hashlib.sha3_256(b'').hexdigest())
    def test_serialization_float_rejects(self):
        with self.assertRaises(ValueError):g.stable({'n':0.1})
    def test_serialization_non_ascii_is_explicit(self):
        self.assertEqual(g.stable({'x':'é'}),b'{"x":"\\u00e9"}')
    def test_published_version_cannot_be_overwritten(self):
        import tempfile
        with tempfile.TemporaryDirectory() as folder:
            target=Path(folder)/'reference.v1.json'
            g.write_manifest(target,MANIFEST)
            g.write_manifest(target,MANIFEST)
            changed=copy.deepcopy(MANIFEST);changed['status']='tampered'
            with self.assertRaises(ValueError):g.write_manifest(target,changed)
            self.assertEqual(json.loads(target.read_text()),MANIFEST)
    def test_engine_inspection_matches_actual_sources(self):
        g.verify_engine_sources()
    def test_engine_change_rejects(self):
        import tempfile
        import shutil
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder)
            audit=g.load('common-genome-engine-inspection.v1.json')
            target=root/'deployments/highcountry/common-genome-engine-inspection.v1.json'
            target.parent.mkdir(parents=True)
            target.write_text(json.dumps(audit))
            for item in audit['files']:
                source=root/item['path'];source.parent.mkdir(parents=True,exist_ok=True)
                shutil.copyfile(g.ROOT/item['path'],source)
            g.verify_engine_sources(root)
            (root/audit['files'][0]['path']).write_text('// changed engine')
            with self.assertRaises(ValueError):g.verify_engine_sources(root)
if __name__=='__main__':unittest.main()

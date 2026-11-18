#!/usr/bin/env python3
"""Adversarial checks for the source-bound static-review gate."""
import copy,importlib.util,json,pathlib,unittest
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('security',ROOT/'scripts/qualify-stake-security.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
class ReviewGate(unittest.TestCase):
    def setUp(self):
        self.review=json.loads((ROOT/'docs/STAKE-AUDIT-10-STATIC-REVIEW.json').read_text())
        self.raw=json.loads((ROOT/'docs/stake-security-evidence/slither.json').read_text())
    def testCompleteReviewedSet(self):self.assertEqual(m.validate_findings(self.raw,self.review),25)
    def testMissingFindingFails(self):
        self.raw['results']['detectors'].pop()
        with self.assertRaises(AssertionError):m.validate_findings(self.raw,self.review)
    def testAdditionalFindingFails(self):
        d=copy.deepcopy(self.raw['results']['detectors'][0]);d['check']='new-detector';self.raw['results']['detectors'].append(d)
        with self.assertRaises(AssertionError):m.validate_findings(self.raw,self.review)
    def testChangedSourceLocationFails(self):
        self.raw['results']['detectors'][0]['elements'][0]['source_mapping']['start']+=1
        with self.assertRaises(AssertionError):m.validate_findings(self.raw,self.review)
    def testMissingReasonFails(self):
        self.review['findings'][0]['reason']=''
        with self.assertRaises(AssertionError):m.validate_findings(self.raw,self.review)
    def testMissingEvidenceFails(self):
        self.review['findings'][0]['evidence']=''
        with self.assertRaises(AssertionError):m.validate_findings(self.raw,self.review)
    def testFailedAnalysisFails(self):
        self.raw['success']=False
        with self.assertRaises(AssertionError):m.validate_findings(self.raw,self.review)
    def testDuplicateFindingFails(self):
        self.raw['results']['detectors'].append(copy.deepcopy(self.raw['results']['detectors'][0]))
        with self.assertRaises(AssertionError):m.validate_findings(self.raw,self.review)
    def testDuplicateReviewFails(self):
        self.review['findings'].append(copy.deepcopy(self.review['findings'][0]))
        with self.assertRaises(AssertionError):m.validate_findings(self.raw,self.review)
    def testSeverityChangeFails(self):
        self.raw['results']['detectors'][0]['impact']='High'
        with self.assertRaises(AssertionError):m.validate_findings(self.raw,self.review)
    def testWhitespaceDispositionFails(self):
        self.review['findings'][0]['reason']='   '
        with self.assertRaises(AssertionError):m.validate_findings(self.raw,self.review)
    def testProductionSafetyReviewedSet(self):
        raw=json.loads((ROOT/'docs/stake-security-evidence/safety-slither.json').read_text())
        self.assertEqual(m.validate_findings(raw,self.review['safety']),9)
if __name__=='__main__':unittest.main(verbosity=2)

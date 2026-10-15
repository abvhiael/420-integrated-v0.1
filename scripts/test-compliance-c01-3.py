#!/usr/bin/env python3
"""Negative discovery authority regressions; no legal/runtime approval implied."""
import copy
import importlib.util
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('v',ROOT/'scripts/verify-compliance-c01-3.py');v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
S=v.read('docs/compliance/C01.3-SOURCE-AUTHORITY.json')
class Tests(unittest.TestCase):
    def reject(self,fn):
        s=copy.deepcopy(S);fn(s)
        with self.assertRaises(ValueError):v.validate(s)
    def test_valid(self):self.assertEqual(v.validate(S)['interpretation_questions'],25)
    def test_each_taxonomy_required(self):
        for i in range(12):
            with self.subTest(i=i):self.reject(lambda s:s['taxonomy'].pop(i))
    def test_each_source_required(self):
        for i in range(17):
            with self.subTest(i=i):self.reject(lambda s:s['sources'].pop(i))
    def test_each_owner_required(self):
        for i in range(10):
            with self.subTest(i=i):self.reject(lambda s:s['review_ownership'].pop(i))
    def test_each_question_required(self):
        for i in range(25):
            with self.subTest(i=i):self.reject(lambda s:s['questions'].pop(i))
    def test_each_provenance_required(self):
        for key in S['provenance_required']:
            with self.subTest(key=key):self.reject(lambda s:s['provenance_required'].remove(key))
    def test_each_review_control(self):
        for key in S['review_controls']:
            with self.subTest(key=key):self.reject(lambda s:s['review_controls'].update({key:False}))
    def test_legal_approval_claim(self):self.reject(lambda s:s.update(legal_approval_granted=True))
    def test_runtime_claim(self):self.reject(lambda s:s.update(runtime_authorization_implemented=True))
    def test_automatic_permission(self):self.reject(lambda s:s['taxonomy'][0].update(automatic_permission=True))
    def test_proposed_status_omission(self):self.reject(lambda s:s['legal_statuses'].remove('NOT_IN_FORCE'))
    def test_numeric_hierarchy(self):self.reject(lambda s:s['composition'].update(numeric_rank_can_resolve_conflict=True))
    def test_geographic_permission(self):self.reject(lambda s:s['composition'].update(geographic_nesting_can_prove_authority=True))
    def test_conflict_fail_open(self):self.reject(lambda s:s['composition'].update(unknown_or_conflict='ALLOW'))
    def test_source_approval(self):self.reject(lambda s:s['sources'][0].update(approved_for_policy=True))
    def test_forged_snapshot(self):self.reject(lambda s:s['sources'][0].update(snapshot_status='APPROVED'))
    def test_untrusted_host(self):self.reject(lambda s:s['sources'][0].update(url='https://laws-lois.justice.gc.ca.evil.example/act'))
    def test_non_https(self):self.reject(lambda s:s['sources'][0].update(url='http://laws-lois.justice.gc.ca/act'))
    def test_hidden_pdf_failure(self):self.reject(lambda s:s['sources'][5].update(discovery_status='INSPECTED_DISCOVERY'))
    def test_invented_appointment(self):self.reject(lambda s:s['review_ownership'][0].update(named_person='Approved Counsel'))
    def test_governance_legal_substitution(self):self.reject(lambda s:s['approval_planes'].update(governance='Legal approval'))
    def test_software_legal_substitution(self):self.reject(lambda s:s['approval_planes'].update(software='Legal approval'))
    def test_unqualified_question_owner(self):self.reject(lambda s:s['questions'][0].update(owner='GOVERNANCE_OWNER'))
    def test_unearned_answer(self):self.reject(lambda s:s['questions'][0].update(answer='Allowed'))
    def test_unearned_approval_digest(self):self.reject(lambda s:s['questions'][0].update(approval_digest='a'*64))
    def test_question_fail_open(self):self.reject(lambda s:s['questions'][0].update(decision_effect='ALLOW'))
    def test_question_unknown_source(self):self.reject(lambda s:s['questions'][0]['source_refs'].append('SRC99'))
    def test_question_unknown_journey(self):self.reject(lambda s:s['questions'][0]['journey_refs'].append('J99'))
    def test_question_closure_missing(self):self.reject(lambda s:s['questions'][0]['closure_evidence'].pop())
    def test_fetch_renews_legal_review(self):self.reject(lambda s:s['source_failure_controls'].update(fetch_success_is_legal_review=True))
    def test_unreadable_renews_review(self):self.reject(lambda s:s['source_failure_controls'].update(missing_or_unreadable_source_can_renew_review=True))
    def test_private_licence_public(self):self.reject(lambda s:s['sources'][11].update(access='PUBLIC_DISCOVERY'))
    def test_exit_criterion_missing(self):self.reject(lambda s:s['exit_criteria'].pop('prior_scope_and_qualification_preserved'))
    def test_hidden_blockers(self):self.reject(lambda s:s.update(external_blockers=[]))
    def test_wrong_sha(self):
        with self.assertRaisesRegex(ValueError,'exact implementation SHA mismatch'):v.verify(S,'0'*40)
if __name__=='__main__':unittest.main(verbosity=2)

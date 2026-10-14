#!/usr/bin/env python3
"""Product boundary regression tests, not runtime authorization tests."""
import copy
import importlib.util
import json
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('scope_verify', ROOT / 'scripts/verify-compliance-c01-2.py')
v = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v)
SCOPE = json.loads((ROOT / 'docs/compliance/C01.2-PRODUCT-SCOPE.json').read_text())

class ScopeTests(unittest.TestCase):
    def reject(self, mutation):
        candidate = copy.deepcopy(SCOPE)
        mutation(candidate)
        with self.assertRaises(ValueError):
            v.validate_product(candidate)

    def test_valid_scope(self):
        self.assertEqual(v.validate_product(SCOPE), {'actors': 9, 'journeys': 24, 'exclusions': 14})

    def test_each_actor_required(self):
        for i in range(9):
            with self.subTest(actor=i):
                self.reject(lambda s: s['actors'].pop(i))

    def test_each_journey_required(self):
        for i in range(24):
            with self.subTest(journey=i):
                self.reject(lambda s: s['journeys'].pop(i))

    def test_each_exclusion_required(self):
        for i in range(14):
            with self.subTest(exclusion=i):
                self.reject(lambda s: s['excluded_domains'].pop(i))

    def test_authority_escalation(self):
        for i in range(9):
            with self.subTest(actor=i):
                self.reject(lambda s: s['actors'][i]['allowed_actions'].append('override_denial'))

    def test_live_claim(self):
        self.reject(lambda s: s['release'].update(live_regulated_operations_enabled=True))
    def test_simulation_permission(self):
        self.reject(lambda s: s['release'].update(simulation_can_authorize=True))
    def test_informational_permission(self):
        self.reject(lambda s: s['release'].update(informational_guidance_can_authorize=True))
    def test_runtime_claim(self):
        self.reject(lambda s: s['release'].update(runtime_implemented=True))
    def test_missing_external_gate(self):
        self.reject(lambda s: s['release']['transactional_enablement_requires'].pop())
    def test_region_expansion(self):
        self.reject(lambda s: s['initial_coverage'].update(municipality='Toronto'))
    def test_domain_expansion(self):
        self.reject(lambda s: s['initial_coverage']['domains'].append('medical_cannabis'))
    def test_uncertain_boundary_fail_open(self):
        self.reject(lambda s: s['initial_coverage'].update(boundary_uncertainty='ALLOW'))
    def test_carrier_omission(self):
        self.reject(lambda s: s['initial_coverage']['carrier_classes'].pop())
    def test_duplicate_actor(self):
        self.reject(lambda s: s['actors'].append(s['actors'][0]))
    def test_private_traveller(self):
        self.reject(lambda s: s['journeys'][0].update(data_boundary='PRIVATE_OPERATIONAL'))
    def test_missing_denial_path(self):
        self.reject(lambda s: s['journeys'][7].update(denied_or_failure=''))
    def test_handover_authority_drift(self):
        self.reject(lambda s: s['journeys'][7].update(enforcement_owner='420Compliance'))
    def test_review_required_proceeds(self):
        self.reject(lambda s: s['decision_contract']['transaction_proceed_outcomes'].append('REVIEW_REQUIRED'))
    def test_unknown_outage_proceeds(self):
        self.reject(lambda s: s['decision_contract'].update(outage_fallback='ALLOW'))
    def test_receipt_binding_omission(self):
        for field in list(SCOPE['decision_contract']['required_receipt_fields']):
            with self.subTest(field=field):
                self.reject(lambda s: s['decision_contract']['required_receipt_fields'].remove(field))
    def test_input_binding_omission(self):
        self.reject(lambda s: s['decision_contract']['required_inputs'].remove('tenant'))
    def test_receipt_payment_escalation(self):
        self.reject(lambda s: s['decision_contract'].update(receipt_is_payment_authorization=True))
    def test_each_separation_control(self):
        for control in SCOPE['separation_of_duties']:
            with self.subTest(control=control):
                self.reject(lambda s: s['separation_of_duties'].update({control: False}))
    def test_public_private_evidence(self):
        self.reject(lambda s: s['data_boundary']['public_fields'].append('ID_document'))
    def test_onchain_personal_data(self):
        self.reject(lambda s: s['data_boundary'].update(personal_data_on_chain=True))
    def test_automatic_activation(self):
        self.reject(lambda s: s['policy_change_controls'].update(automatic_activation=True))
    def test_legal_approval_by_governance(self):
        self.reject(lambda s: s['authority_map'].update({'420Governance': 'legal_approval'}))
    def test_maps_missing(self):
        self.reject(lambda s: s['surfaces'].remove('Maps_via_420Location_public_projection'))
    def test_previous_evidence_pin(self):
        self.reject(lambda s: s['inherited_qualification'].update(implementation_sha='0'*40))
    def test_wrong_exact_sha(self):
        with self.assertRaisesRegex(ValueError, 'exact implementation SHA mismatch'):
            v.verify_repository(SCOPE, '0'*40)

if __name__ == '__main__':
    unittest.main(verbosity=2)

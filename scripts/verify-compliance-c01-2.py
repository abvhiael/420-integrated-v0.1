#!/usr/bin/env python3
"""Qualify the C01.2 product contract; no operational authorization is implemented."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess

ROOT = Path(__file__).resolve().parents[1]
BASE = 'c5a4f220d1fbda01f707d359aa9bb32921a138b1'
PARENT = '81955ad05e7c99e0e0fb4cf39a5960bd4a1dc553'
PRIOR_IMPLEMENTATION = '44c161d9b344080b55296b74319f096535f873c1'
ACTORS = {'traveller', 'consumer_app', 'courier_app', 'retailer', 'policy_author',
          'independent_reviewer', 'publisher', 'operator', 'auditor'}
EXCLUDED = {'medical_cannabis', 'cultivation', 'accommodation', 'events',
            'marketplace_sales', 'unreviewed_jurisdictions', 'international_and_border_crossing',
            'government_licence_issuance', 'automated_legal_approval',
            'independent_financial_execution', 'public_personal_evidence',
            'native_compliance_mobile_app', 'independent_compliance_billing',
            'universal_compliance_certification'}
FORBIDDEN_CAPABILITIES = {'execute_payment', 'override_denial', 'approve_own_policy',
                          'activate_unreviewed_policy', 'edit_approved_bytes',
                          'publish_unreviewed_policy', 'reactivate_revoked_policy',
                          'read_other_tenant', 'read_unrelated_private_decision',
                          'read_unrelated_private_evidence'}
EXPECTED_ACTIONS = {
    'traveller': {'read_guidance', 'read_coverage', 'run_informational_scenario'},
    'consumer_app': {'evaluate_consumer_action', 'read_bound_decision', 'receive_invalidation'},
    'courier_app': {'evaluate_dispatch', 'evaluate_handover', 'evaluate_return', 'read_bound_decision', 'receive_invalidation'},
    'retailer': {'submit_credential_reference', 'evaluate_retailer_action', 'read_tenant_decision', 'request_redacted_audit_export', 'receive_invalidation'},
    'policy_author': {'draft_policy', 'link_source', 'propose_change', 'simulate_policy_diff'},
    'independent_reviewer': {'review_policy', 'record_finding', 'approve_reviewed_digest', 'reject_policy', 'request_rework'},
    'publisher': {'schedule_approved_digest', 'publish_approved_digest', 'supersede_approved_policy', 'revoke_publication'},
    'operator': {'inspect_health', 'triage_source_failure', 'halt_region_domain', 'coordinate_incident', 'restore_valid_approved_publication'},
    'auditor': {'read_scoped_audit', 'reproduce_historical_decision', 'request_redacted_audit_export'},
}
AUTHORITY_MAP = {
    '420Compliance': 'reviewed_policy_and_bounded_evaluation',
    'DOOBr': 'order_dispatch_custody_handover_refusal_return_enforcement',
    '420Travel': 'public_guidance_coarse_presence_and_handoff',
    '420Location_Maps': 'geographic_resolution_and_approved_public_projection',
    '420Identity': 'canonical_profile_issuer_credential_lifecycle_not_regulatory_permission',
    '420Verify': 'bytecode_verification_or_explicitly_scoped_place_evidence_not_licence_approval',
    '420Registry': 'canonical_discovery_provenance_not_legal_permission',
    '420Oracle': 'authorized_observations_not_legal_interpretation_approval',
    '420Governance': 'canonical_protocol_configuration_not_substitute_for_legal_review',
    '420Pay': 'canonical_financial_execution',
    '420Swap': 'approved_asset_conversion_under_canonical_Pay_routes',
    '420Wallet': 'permitted_user_signing_not_policy_approval',
    '420Notifications': 'qualified_notice_transport_not_permission_source',
    '420Arbitration': 'canonical_dispute_authority_not_override_of_mandatory_rules',
    'DevelopmentCompensationVault420': 'canonical_eligible_net_protocol_revenue_routing_not_user_principal',
}
EXPECTED_ACCESS = {
    'traveller': 'PUBLIC_INFORMATION',
    'consumer_app': 'AUTHENTICATED_SERVICE_AND_BOUND_SUBJECT',
    'courier_app': 'AUTHENTICATED_SERVICE_AND_BOUND_COURIER',
    'retailer': 'AUTHENTICATED_TENANT_PRINCIPAL',
    'policy_author': 'AUTHENTICATED_SCOPED_AUTHOR',
    'independent_reviewer': 'AUTHENTICATED_SCOPED_REVIEWER',
    'publisher': 'AUTHENTICATED_SCOPED_PUBLISHER',
    'operator': 'AUTHENTICATED_SCOPED_OPERATOR',
    'auditor': 'AUTHENTICATED_READ_ONLY_AUDITOR',
}
RECEIPT_FIELDS = {'policy_version', 'policy_digest', 'evaluator_version', 'geography_version',
                  'evidence_refs_and_currentness', 'caller_tenant_actor_action_binding',
                  'operation_reference', 'evaluated_at', 'expires_at', 'outcome',
                  'obligations', 'reason_codes', 'coverage_gaps'}
INPUT_FIELDS = {'caller_identity', 'tenant', 'subject_or_actor_binding', 'action',
                'operation_reference', 'origin_destination_scope', 'actor_class',
                'required_evidence_refs', 'relevant_facts', 'evaluation_time'}
PROHIBITED_PUBLIC = {'birth_date', 'ID_document', 'private_address', 'recipient_name_signature',
                     'precise_GPS_tracking', 'private_order_details', 'reversible_personal_hash'}
SCOPED_FILES = {
    'docs/compliance/C01.2-PRODUCT-SCOPE.json',
    'docs/compliance/C01.2-PRODUCT-SCOPE-AND-JOURNEYS.md',
    'docs/compliance/420COMPLIANCE-ROADMAP.md',
    'docs/compliance/qualification/C01.2-level1.json',
    'scripts/verify-compliance-c01-2.py',
    'scripts/test-compliance-c01-2.py',
    '.github/workflows/420compliance-c01-level1.yml',
}
RETAINED_FILES = {
    'docs/compliance/C01.1-INVENTORY.json',
    'docs/compliance/C01.1-INVENTORY-REUSE-GAPS.md',
    'docs/compliance/qualification/C01.1-level1.json',
    'scripts/verify-compliance-c01-1.py',
    'scripts/test-compliance-c01-1.py',
}

def check(value, message):
    if not value:
        raise ValueError(message)

def unique(values, message):
    check(len(values) == len(set(values)), message)

def git(*args, root=ROOT):
    return subprocess.check_output(['git', *args], cwd=root)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def validate_product(scope):
    check(scope['schema'] == '420compliance-product-scope/v1', 'scope schema')
    check(scope['step'] == 'C01.2' and scope['qualification_level'] == 1, 'canonical step/level')
    check(scope['status'] == 'LOCKED_DEVELOPMENT_SCOPE', 'unlocked product scope')
    check(scope['base_sha'] == BASE and scope['parent_sha'] == PARENT, 'repository pins')
    check(scope['inherited_qualification'] == {
        'step': 'C01.1', 'implementation_sha': PRIOR_IMPLEMENTATION, 'evidence_sha': PARENT,
        'record': 'docs/compliance/qualification/C01.1-level1.json'}, 'retained qualification pins')
    release = scope['release']
    check(release['current_stage'] == 'INFRASTRUCTURE_ONLY', 'release stage drift')
    for flag in ['live_regulated_operations_enabled', 'runtime_implemented',
                 'operational_policy_approved', 'simulation_can_authorize',
                 'informational_guidance_can_authorize']:
        check(release[flag] is False, 'unsupported release/permission claim: ' + flag)
    check(set(release['modes']) == {'SIMULATION', 'REVIEWED_INFORMATION', 'TRANSACTIONAL_ENFORCEMENT'}, 'release modes')
    check(set(release['transactional_enablement_requires']) == {
        'C09_deployed_acceptance', 'C10_legal_partner_operational_acceptance',
        'DOOBr_own_release_acceptance'}, 'live acceptance gate omitted')
    coverage = scope['initial_coverage']
    check((coverage['country'], coverage['province'], coverage['municipality']) == ('CA', 'BC', 'Vancouver'), 'jurisdiction expansion')
    check(set(coverage['domains']) == {'non_medical_cannabis_delivery', 'reviewed_travel_guidance'}, 'domain expansion')
    check(coverage['candidate_delivery_pack'] == 'CA-BC-VANCOUVER-cannabis-delivery/v1', 'candidate pack')
    check(coverage['unreviewed_region_behaviour'] == 'UNKNOWN_AND_BLOCK_TRANSACTION', 'unsupported region fail-open')
    check(coverage['boundary_uncertainty'] == 'REVIEW_REQUIRED_AND_BLOCK_TRANSACTION', 'uncertain boundary fail-open')
    check(set(coverage['carrier_classes']) == {'LICENSEE_EMPLOYEE', 'DELIVERY_PERSON', 'COMMON_CARRIER'}, 'carrier branch omitted')
    actors = scope['actors']
    ids = [a['id'] for a in actors]
    unique(ids, 'duplicate actor')
    check(set(ids) == ACTORS, 'canonical actor missing/added')
    for actor in actors:
        allowed, denied = actor['allowed_actions'], actor['denied_actions']
        unique(allowed, 'duplicate allowed action')
        unique(denied, 'duplicate denied action')
        check(actor['access'] == EXPECTED_ACCESS[actor['id']], 'actor access boundary')
        check(set(allowed) == EXPECTED_ACTIONS[actor['id']], 'actor authority expanded/omitted')
        check(not set(allowed) & (set(denied) | FORBIDDEN_CAPABILITIES), 'forbidden/contradictory actor capability')
        check(bool(denied), 'actor denial boundary missing')
    check(scope['authority_map'] == AUTHORITY_MAP, 'canonical protocol authority drift')
    journeys = scope['journeys']
    unique([j['id'] for j in journeys], 'duplicate journey')
    check({j['id'] for j in journeys} == {f'J{i:02}' for i in range(1, 25)}, 'journey missing/added')
    check({j['actor'] for j in journeys} == ACTORS, 'actor journey coverage')
    for j in journeys:
        check(j['actor'] in ACTORS, 'unknown journey actor')
        for field in ['title', 'preconditions', 'success', 'denied_or_failure', 'enforcement_owner', 'data_boundary']:
            check(bool(j[field]), 'journey success/failure/owner/data requirement missing')
        check(isinstance(j['preconditions'], list) and len(j['preconditions']) >= 2, 'journey preconditions')
        if j['actor'] == 'traveller':
            check(j['data_boundary'] == 'PUBLIC_REDACTED', 'traveller private data')
        else:
            check(j['data_boundary'] in {'PRIVATE_MINIMIZED', 'PRIVATE_POLICY_REVIEW',
                  'PRIVATE_OPERATIONAL', 'PRIVATE_AUDIT_REDACTED'}, 'private journey boundary')
    required_journey_bindings = {
        'J03': ('traveller', '420Travel/Maps presence composer'),
        'J07': ('courier_app', 'DOOBr dispatch/custody workflow'),
        'J08': ('courier_app', 'DOOBr handover workflow'),
        'J09': ('courier_app', 'DOOBr safety/return workflow'),
        'J15': ('independent_reviewer', '420Compliance independent review'),
        'J17': ('publisher', '420Compliance publication service'),
        'J20': ('operator', '420Compliance halt / DOOBr recovery'),
    }
    by_id = {j['id']: j for j in journeys}
    for id, (actor, owner) in required_journey_bindings.items():
        check((by_id[id]['actor'], by_id[id]['enforcement_owner']) == (actor, owner), 'journey authority drift')
    exclusions = scope['excluded_domains']
    unique([e['id'] for e in exclusions], 'duplicate exclusion')
    check({e['id'] for e in exclusions} == EXCLUDED, 'excluded domain missing/expanded')
    for e in exclusions:
        check(bool(e['reason']) and e['revisit'] in {'C11', 'NEVER', 'SEPARATE_PRODUCT_DECISION'}, 'exclusion disposition')
    decision = scope['decision_contract']
    check(set(decision['outcomes']) == {'ALLOW', 'DENY', 'REVIEW_REQUIRED', 'UNKNOWN'}, 'decision outcomes')
    check(decision['transaction_proceed_outcomes'] == ['ALLOW'], 'non-ALLOW allowed')
    check(set(decision['required_inputs']) == INPUT_FIELDS, 'decision input binding omitted')
    check(set(decision['required_receipt_fields']) == RECEIPT_FIELDS, 'decision evidence binding omitted')
    check(decision['outage_fallback'] == 'UNKNOWN_AND_BLOCK_TRANSACTION', 'outage fail-open')
    for flag in ['obligations_must_be_fulfilled', 'history_is_immutable', 'return_is_separate_workflow']:
        check(decision[flag] is True, 'decision obligation/history/return drift')
    for flag in ['receipt_is_payment_authorization', 'receipt_is_universal_certificate']:
        check(decision[flag] is False, 'receipt authority escalation')
    check(set(decision['reauthorization_stages']) == {'consumer_operation', 'pickup_dispatch',
          'recipient_handover', 'material_fact_change', 'policy_or_evidence_expiry_revocation'}, 'stage re-evaluation omitted')
    separation = scope['separation_of_duties']
    required_controls = {'author_and_reviewer_distinct', 'publisher_distinct_from_author_and_reviewer',
        'approval_binds_immutable_digest', 'changed_bytes_invalidate_approval',
        'reviewer_scope_and_qualification_required', 'operator_can_only_reduce_permission_in_emergency',
        'no_administrator_allow_override', 'restoration_requires_current_valid_approved_state'}
    check(set(separation) == required_controls and all(v is True for v in separation.values()), 'separation/review/override control omitted')
    data = scope['data_boundary']
    check(set(data['never_public']) == PROHIBITED_PUBLIC, 'private evidence prohibition omitted')
    check(not set(data['public_fields']) & (set(data['private_fields']) | PROHIBITED_PUBLIC), 'public personal evidence')
    check(data['personal_data_on_chain'] is False and data['full_chain_evidence_storage'] is False, 'chain privacy drift')
    check(data['redacted_audit_export'] is True, 'audit redaction omitted')
    check(data['raw_ID_capture_owned_by'] == 'approved_DOOBR_or_identity_provider_boundary_not_Compliance_public_API', 'ID capture authority')
    check(data['mandatory_personal_record_retention_owned_by'] == 'accountable_retailer_DOOBR_boundary_with_reviewed_policy', 'record ownership')
    controls = scope['policy_change_controls']
    check(controls == {'automatic_source_monitoring': True, 'AI_output_is_proposal_only': True,
          'automatic_activation': False, 'formal_product_scope_change_required_for_new_domain': True,
          'new_jurisdiction_requires_C11_qualification': True}, 'automatic activation/scope drift')
    check(scope['external_acceptance_is_separate'] is True and scope['milestone'] == 'C01.8'
          and scope['phase_closeout'] == 'C08.5' and scope['next_step'] == 'C01.3', 'qualification boundary drift')
    check('Maps_via_420Location_public_projection' in scope['surfaces'], 'Maps consumer absent')
    return {'actors': len(actors), 'journeys': len(journeys), 'exclusions': len(exclusions)}

def verify_repository(scope, expected_sha, root=ROOT):
    summary = validate_product(scope)
    actual = git('rev-parse', 'HEAD', root=root).decode().strip()
    check(re.fullmatch(r'[0-9a-f]{40}', expected_sha) is not None and actual == expected_sha, 'exact implementation SHA mismatch')
    check(subprocess.run(['git', 'merge-base', '--is-ancestor', PARENT, 'HEAD'], cwd=root).returncode == 0, 'qualified parent not inherited')
    changed = set(git('diff', '--name-only', PARENT, 'HEAD', root=root).decode().splitlines())
    check(changed <= SCOPED_FILES, 'unauthorized runtime/manifest/previous-evidence change')
    for path in RETAINED_FILES:
        check((root / path).read_bytes() == git('show', PARENT + ':' + path, root=root), 'retained C01.1 evidence/source changed')
    prior = json.loads((root / 'docs/compliance/qualification/C01.1-level1.json').read_text())
    check(prior['status'] == 'COMPLETE' and prior['qualification_level'] == 1
          and prior['implementation_sha'] == PRIOR_IMPLEMENTATION and prior['base_sha'] == BASE,
          'retained C01.1 qualification invalid')
    check(prior['level1']['result'] == 'PASS' and all(r['conclusion'] == 'success'
          and r['head_sha'] == PRIOR_IMPLEMENTATION for r in prior['level1']['runs']), 'retained CI evidence invalid')
    inventory = json.loads((root / 'docs/compliance/C01.1-INVENTORY.json').read_text())
    for source in inventory['sources']:
        check(digest((root / source['path']).read_bytes()) == source['sha256'], 'canonical source changed: ' + source['path'])
    roadmap = (root / 'docs/compliance/420COMPLIANCE-ROADMAP.md').read_text()
    check(scope['canonical_definition'] in roadmap, 'canonical definition drift')
    document = (root / 'docs/compliance/C01.2-PRODUCT-SCOPE-AND-JOURNEYS.md').read_text()
    for id in ACTORS | {j['id'] for j in scope['journeys']} | EXCLUDED:
        check(id in document, 'scope/document traceability missing: ' + id)
    for term in ['C01.3', 'C01.8', 'C08.5', 'not runtime authorization tests', 'INFRASTRUCTURE_ONLY']:
        check(term in document, 'scope acceptance boundary missing')
    return {'step': 'C01.2', 'qualification_level': 1, 'implementation_sha': actual,
            'base_sha': BASE, 'parent_sha': PARENT, 'result': 'PASS', **summary,
            'retained_C01.1': 'UNCHANGED_QUALIFIED_EVIDENCE',
            'runtime_qualification': 'NOT_APPLICABLE_PRODUCT_SCOPE_STEP'}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--expected-sha', required=True)
    parser.add_argument('--output')
    args = parser.parse_args()
    scope = json.loads((ROOT / 'docs/compliance/C01.2-PRODUCT-SCOPE.json').read_text())
    result = verify_repository(scope, args.expected_sha)
    content = json.dumps(result, indent=2) + '\n'
    if args.output:
        Path(args.output).write_text(content)
    print(content, end='')

if __name__ == '__main__':
    main()

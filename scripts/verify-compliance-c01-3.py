#!/usr/bin/env python3
"""C01.3 discovery qualification; does not interpret law or authorize runtime operations."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
from urllib.parse import urlparse
ROOT=Path(__file__).resolve().parents[1]
PARENT='3da0809a63b14bb4d0ab8d07475a1aa93df364d8'
BASE='c5a4f220d1fbda01f707d359aa9bb32921a138b1'
TYPES={'STATUTE','REGULATION','AMENDMENT_COMMENCEMENT','MUNICIPAL_BYLAW','INDIGENOUS_INSTRUMENT','LICENCE_CONDITION','OFFICIAL_GUIDANCE','AUTHORITY_RESPONSE','JUDICIAL_ORDER','PRIVATE_RESTRICTION','GEOGRAPHIC_EVIDENCE','SECONDARY_MATERIAL'}
OWNERS={'REGULATORY_REVIEW_LEAD','MUNICIPAL_REVIEW_OWNER','INDIGENOUS_AUTHORITY_REVIEW_OWNER','PRIVACY_REVIEW_OWNER','RETAILER_EVIDENCE_OWNER','SOURCE_STEWARD','SOFTWARE_QUALIFICATION_OWNER','GOVERNANCE_OWNER','PUBLISHER','OPERATOR'}
PROVENANCE={'source_id','instrument_title','publisher_identity','official_url_or_private_locator','source_type','authority_scope','instrument_citation','section_anchor','raw_snapshot_digest','retrieved_at','published_at_if_available','consolidation_current_to_if_available','effective_from','effective_until_or_open','commencement_evidence','legal_status','amendment_and_supersession_refs','applicability_facts','collector_identity','reviewer_scope','reviewed_digest','reviewed_at','review_expiry','access_class'}
PLANES={'legal':'Independent scoped qualified review of cited interpretation and immutable policy digest','governance':'Canonical protocol/configuration permission; never legal approval','software':'Exact-SHA tested implementation; never legal approval','operational':'C09/C10 and accountable partner acceptance; not implied by repository PASS'}
CONTROLS={'author_cannot_review_own','publisher_separate_author_reviewer','scope_and_qualification_evidence_required','conflicts_of_interest_checked','review_binds_digest_sources_scope_and_effective_interval','changed_bytes_or_sources_require_new_review','expired_or_revoked_review_blocks','ai_and_collection_cannot_approve','regulator_response_must_be_scoped_and_preserved','operator_halt_cannot_grant_allow'}
CLOSURE={'operative_section_citations_and_source_digests','applicability_and_actor_class_facts','signed_independent_reviewer_scope_and_digest','effective_interval_and_revalidation_trigger','linked_policy_requirement_and_positive_negative_tests'}
DOMAINS={'laws-lois.justice.gc.ca','www.bclaws.gov.bc.ca','www2.gov.bc.ca','vancouver.ca'}
ALLOWED={'docs/compliance/C01.3-SOURCE-AUTHORITY.json','docs/compliance/C01.3-SOURCE-AUTHORITY-AND-REVIEW.md','docs/compliance/C01.3-RETAINED-PINS.json','docs/compliance/420COMPLIANCE-ROADMAP.md','docs/compliance/qualification/C01.3-level1.json','scripts/verify-compliance-c01-3.py','scripts/test-compliance-c01-3.py','.github/workflows/420compliance-c01-level1.yml'}
NEXT='C01.4 — Agree shared authority with DOOBr and Travel; replace duplicated proposed policy ownership through an explicit roadmap amendment with preserved requirement IDs.'
def check(value,message):
    if not value: raise ValueError(message)
def unique(items,message):
    check(len(items)==len(set(items)),message)
def read(path): return json.loads((ROOT/path).read_text())
def git(*args): return subprocess.check_output(['git',*args],cwd=ROOT)
def validate(s):
    check(s['schema']=='420compliance-source-authority/v1' and s['step']=='C01.3' and s['qualification_level']==1,'step/schema')
    check(s['base_sha']==BASE and s['parent_sha']==PARENT,'repository pins')
    check(s['status']=='LOCKED_DISCOVERY_CONTRACT' and s['release']=='INFRASTRUCTURE_ONLY','scope drift')
    check(s['legal_approval_granted'] is False and s['runtime_authorization_implemented'] is False,'unsupported legal/runtime approval')
    ts=[x['id'] for x in s['taxonomy']];unique(ts,'duplicate taxonomy');check(set(ts)==TYPES,'taxonomy coverage')
    for x in s['taxonomy']:check(x['meaning'] and x['automatic_permission'] is False,'taxonomy permission escalation')
    check(set(s['legal_statuses'])=={'PROPOSED','NOT_IN_FORCE','IN_FORCE','REPEALED','SUPERSEDED','UNKNOWN'},'operative status coverage')
    check(set(s['authority_dimensions'])=={'FEDERAL','PROVINCIAL','MUNICIPAL','INDIGENOUS','ENTITY_SPECIFIC'},'authority dimensions')
    check(s['composition']=={'numeric_rank_can_resolve_conflict':False,'geographic_nesting_can_prove_authority':False,'unknown_or_conflict':'REVIEW_REQUIRED_AND_BLOCK','mandatory_rules_cannot_be_waived_by_private_terms':True,'guidance_is_not_operative_law':True,'authority_graph_requires_review':True},'authority composition drift')
    unique(s['provenance_required'],'duplicate provenance');check(set(s['provenance_required'])==PROVENANCE,'provenance missing')
    source_ids=[x['id'] for x in s['sources']];unique(source_ids,'duplicate source');check(set(source_ids)=={f'SRC{i:02}' for i in range(1,18)},'source coverage')
    for x in s['sources']:
        check(x['type'] in TYPES and x['authority'] in s['authority_dimensions'],'source taxonomy')
        check(x['legal_status']=='UNKNOWN' and x['approved_for_policy'] is False and x['snapshot_status']=='NOT_COLLECTED_C02','unearned source approval')
        check(x['discovery_status'] in {'INSPECTED_DISCOVERY','FETCH_FAILED','DISCOVERY_REQUIRED','PARTNER_EVIDENCE_REQUIRED'},'source discovery status')
        check(x['title'] and x['inspection_scope'] and x['owner']=='SOURCE_STEWARD' and x['resolution_step']=='C02/C04','source accountability')
        if x['url'] is not None:
            u=urlparse(x['url']);check(u.scheme=='https' and u.hostname in DOMAINS and not u.username and not u.password,'untrusted official source')
        if x['discovery_status']=='INSPECTED_DISCOVERY':check(x['url'] and x['inspected_at_utc']=='2026-10-10','inspection evidence')
        if x['authority']=='ENTITY_SPECIFIC':check(x['access']=='PRIVATE_RESTRICTED' and x['url'] is None,'private source leak')
    bysrc={x['id']:x for x in s['sources']}
    check(bysrc['SRC06']['discovery_status']=='FETCH_FAILED' and bysrc['SRC07']['discovery_status']=='FETCH_FAILED','hidden handbook fetch failure')
    for id in ['SRC09','SRC10','SRC11','SRC15','SRC17']:check(bysrc[id]['discovery_status']=='DISCOVERY_REQUIRED','unresolved instrument hidden')
    ids=[x['id'] for x in s['review_ownership']];unique(ids,'duplicate owner');check(set(ids)==OWNERS,'review ownership missing')
    for x in s['review_ownership']:
        check(x['qualification'] and x['responsibility'] and x['named_person'] is None,'invented reviewer appointment')
        expected='UNAPPOINTED_EXTERNAL' if x['id'] in {'REGULATORY_REVIEW_LEAD','MUNICIPAL_REVIEW_OWNER','INDIGENOUS_AUTHORITY_REVIEW_OWNER','PRIVACY_REVIEW_OWNER','RETAILER_EVIDENCE_OWNER'} else 'ROLE_DEFINED_NO_PRODUCTION_GRANT'
        check(x['appointment_status']==expected,'unearned reviewer mandate')
    check(s['approval_planes']==PLANES,'legal governance software conflation')
    check(set(s['review_controls'])==CONTROLS and all(x is True for x in s['review_controls'].values()),'review independence/gates')
    questions=s['questions']; ids=[x['id'] for x in questions];unique(ids,'duplicate question');check(set(ids)=={f'Q{i:02}' for i in range(1,26)},'question coverage')
    for x in questions:
        check(x['topic'] and x['question'] and x['target_step'],'question incomplete')
        check(x['owner'] in {'REGULATORY_REVIEW_LEAD','MUNICIPAL_REVIEW_OWNER','INDIGENOUS_AUTHORITY_REVIEW_OWNER','PRIVACY_REVIEW_OWNER'},'unqualified question owner')
        check(x['source_refs'] and set(x['source_refs'])<=set(source_ids),'question source missing')
        check(x['journey_refs'] and set(x['journey_refs'])<={f'J{i:02}' for i in range(1,25)},'question journey missing')
        check(x['status']=='OPEN_QUALIFIED_INTERPRETATION_REQUIRED' and x['answer'] is None and x['approval_digest'] is None,'unearned interpretation')
        check(x['decision_effect']=='BLOCK_AFFECTED_PERMISSION' and set(x['closure_evidence'])==CLOSURE,'question fail-open/closure omitted')
    check(s['source_failure_controls']=={'fetch_success_is_legal_review':False,'missing_or_unreadable_source_can_renew_review':False,'changed_source_requires_triage':True,'no_mirror_silent_substitution':True,'untrusted_text_has_no_tool_or_approval_authority':True},'source failure approval bypass')
    exits={'taxonomy_and_operative_status_defined','role_ownership_and_unappointed_external_gates_visible','BC_Vancouver_question_register_with_closure_evidence','legal_governance_software_operational_planes_separate','prior_scope_and_qualification_preserved'}
    check(set(s['exit_criteria'])==exits and all(v is True for v in s['exit_criteria'].values()),'exit criterion omitted')
    check(len(s['external_blockers'])==4 and all(s['external_blockers']),'external blockers hidden')
    check(s['level2']=='C01.8' and s['level3']=='C08.5' and s['next_step']==NEXT,'roadmap drift')
    return {'taxonomy_types':12,'sources':17,'review_roles':10,'interpretation_questions':25,'exit_criteria':5}
def verify(s,expected):
    result=validate(s)
    check(re.fullmatch('[0-9a-f]{40}',expected) and git('rev-parse','HEAD').decode().strip()==expected,'exact implementation SHA mismatch')
    check(subprocess.run(['git','merge-base','--is-ancestor',PARENT,'HEAD'],cwd=ROOT).returncode==0,'parent ancestry')
    check(set(git('diff','--name-only',PARENT,'HEAD').decode().splitlines())<=ALLOWED,'unauthorized change')
    pins=read('docs/compliance/C01.3-RETAINED-PINS.json')
    required={'docs/compliance/C01.1-INVENTORY.json','docs/compliance/C01.1-INVENTORY-REUSE-GAPS.md','docs/compliance/qualification/C01.1-level1.json','scripts/verify-compliance-c01-1.py','scripts/test-compliance-c01-1.py','docs/compliance/C01.2-PRODUCT-SCOPE.json','docs/compliance/C01.2-PRODUCT-SCOPE-AND-JOURNEYS.md','docs/compliance/qualification/C01.2-level1.json','scripts/verify-compliance-c01-2.py','scripts/test-compliance-c01-2.py'}
    check(set(pins)==required,'retained evidence coverage')
    for path,sha in pins.items():
        data=(ROOT/path).read_bytes();check(data==git('show',PARENT+':'+path) and hashlib.sha256(data).hexdigest()==sha,'retained evidence changed')
    for step,sha in [('C01.1','44c161d9b344080b55296b74319f096535f873c1'),('C01.2','2fba2d7de9c2362fb9cba22de57ee97b0a48ef8b')]:
        evidence=read('docs/compliance/qualification/'+step+'-level1.json')
        check(evidence['status']=='COMPLETE' and evidence['implementation_sha']==sha and evidence['level1']['result']=='PASS','prior qualification invalid')
        check(len(evidence['level1']['runs'])>=1 and all(x['conclusion']=='success' and x['head_sha']==sha for x in evidence['level1']['runs']),'stale prior CI')
    for x in read('docs/compliance/C01.1-INVENTORY.json')['sources']:
        check(hashlib.sha256((ROOT/x['path']).read_bytes()).hexdigest()==x['sha256'],'canonical source changed')
    doc=(ROOT/'docs/compliance/C01.3-SOURCE-AUTHORITY-AND-REVIEW.md').read_text()
    for x in TYPES|OWNERS|set(source_ids(s))|{q['id'] for q in s['questions']}:
        check(x in doc,'document traceability missing')
    roadmap=(ROOT/'docs/compliance/420COMPLIANCE-ROADMAP.md').read_text();check(s['canonical_definition'] in roadmap and NEXT.split(' — ')[1] in roadmap,'canonical roadmap drift')
    return {'step':'C01.3','qualification_level':1,'implementation_sha':expected,'base_sha':BASE,'parent_sha':PARENT,'result':'PASS',**result,'prior_qualification':'C01.1_C01.2_UNCHANGED','legal_and_operational_acceptance':'NOT_GRANTED','runtime_tests':'NOT_APPLICABLE_DISCOVERY_STEP'}
def source_ids(s):return [x['id'] for x in s['sources']]
def main():
    p=argparse.ArgumentParser();p.add_argument('--expected-sha',required=True);p.add_argument('--output');a=p.parse_args()
    content=json.dumps(verify(read('docs/compliance/C01.3-SOURCE-AUTHORITY.json'),a.expected_sha),indent=2)+'\n'
    if a.output:Path(a.output).write_text(content)
    print(content,end='')
if __name__=='__main__':main()

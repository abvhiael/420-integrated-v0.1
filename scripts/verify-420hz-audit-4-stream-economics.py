#!/usr/bin/env python3
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUNDLE = ROOT / "contracts/config/creative/420hz-stream-economics-bundle.json"
PLAN = ROOT / "contracts/src/creative/economics/HzStreamEconomicsPlan420.sol"
TEST = ROOT / "contracts/test/HzStreamEconomics420.t.sol"
SCHEDULES = ROOT / "contracts/src/creative/economics/RoyaltyScheduleRegistry420.sol"
ROUTER = ROOT / "contracts/src/creative/economics/RoyaltyRouter420.sol"
STREAM = ROOT / "contracts/src/creative/economics/StreamingRoyaltySettlement420.sol"
TYPES = ROOT / "contracts/src/creative/shared/CreativeTypes420.sol"
DECISION10 = ROOT / "contracts/script/Decision10DeploySeed420.s.sol"

errors = []

def need(condition, message):
    if not condition:
        errors.append(message)

for path in [BUNDLE, PLAN, TEST, SCHEDULES, ROUTER, STREAM, TYPES, DECISION10]:
    need(path.is_file(), f"missing required file: {path.relative_to(ROOT)}")

if errors:
    print(json.dumps({"pass": False, "errors": errors}, indent=2))
    raise SystemExit(2)

d = json.loads(BUNDLE.read_text())
plan = PLAN.read_text()
test = TEST.read_text()
schedules = SCHEDULES.read_text()
router = ROUTER.read_text()
stream = STREAM.read_text()
types = TYPES.read_text()
decision10 = DECISION10.read_text()

need(d.get("schema") == "420.hz.stream.economics.bundle.v1", "schema drift")
need(d.get("roadmap_step") == "HZ-AUDIT-4", "roadmap step drift")
need(d.get("status") == "REPOSITORY_STREAM_ECONOMICS_READY_LIVE_EXECUTION_DEFERRED", "status drift")
need(d.get("repository_ready") is True, "repository readiness missing")
need(d.get("live_qualified") is False, "fabricated live qualification")
need(d.get("revenue_type") == "STREAM", "revenue type drift")
need(d.get("schedule_version") == 1, "schedule version drift")
need(d.get("effective_at") == 0, "effective-at drift")
need("ZERO_IS_AN_EXPLICIT_DETERMINISTIC_VALUE" in d.get("effective_at_policy", ""), "effective-at policy missing")
need("420.hz.stream.schedule.v1" in d.get("terms_hash_policy", ""), "terms-hash domain drift")

supported = d.get("supported_recording_classes", [])
need(len(supported) == 2, "supported STREAM class inventory must contain exactly ORIGINAL and REMIX")
need([x.get("recording_class") for x in supported] == ["ORIGINAL", "REMIX"], "supported class/order drift")

expected = {
    "ORIGINAL": (1250, 0, 8500, 250),
    "REMIX": (1000, 1500, 7250, 250),
}
for entry in supported:
    name = entry.get("recording_class")
    terms = expected.get(name)
    need(terms is not None, f"unexpected supported class: {name}")
    if terms:
        work, source, current, protocol = terms
        need(entry.get("work_bps") == work, f"{name} work bps drift")
        need(entry.get("source_bps") == source, f"{name} source bps drift")
        need(entry.get("current_recording_bps") == current, f"{name} current bps drift")
        need(entry.get("protocol_bps") == protocol, f"{name} protocol bps drift")
        need(work + source + current + protocol == 10_000, f"{name} total not 10000")
        need(protocol <= 500, f"{name} protocol fee exceeds cap")
        need(entry.get("version") == 1, f"{name} version drift")
        need(entry.get("effective_at") == 0, f"{name} effective-at drift")
        preimage = entry.get("terms_hash_preimage", {})
        need(preimage.get("domain") == "420.hz.stream.schedule.v1", f"{name} terms domain drift")
        need(preimage.get("recording_class") == name, f"{name} terms class drift")
        need(preimage.get("revenue_type") == "STREAM", f"{name} terms revenue drift")
        need(preimage.get("work_bps") == work, f"{name} terms work drift")
        need(preimage.get("source_bps") == source, f"{name} terms source drift")
        need(preimage.get("current_recording_bps") == current, f"{name} terms current drift")
        need(preimage.get("protocol_bps") == protocol, f"{name} terms protocol drift")
        need(preimage.get("version") == 1, f"{name} terms version drift")
        need(preimage.get("effective_at") == 0, f"{name} terms effective-at drift")

unsupported_expected = [
    "COVER",
    "STEM_REMIX",
    "SAMPLE_DERIVATIVE",
    "AI_DERIVATIVE",
    "LIVE",
    "ACOUSTIC",
    "REMASTER",
    "RADIO_EDIT",
    "CLEAN_EDIT",
    "SPATIAL",
    "RESTORATION",
    "OTHER",
]
need(
    d.get("unsupported_recording_classes_until_canonical_terms_exist") == unsupported_expected,
    "unsupported class inventory drift",
)

need(
    d.get("governance_initialization") == [
        "RoyaltyScheduleRegistry420.registerSchedule(RecordingClass.ORIGINAL,RevenueType.STREAM,HzStreamEconomicsPlan420.originalSchedule())",
        "RoyaltyScheduleRegistry420.registerSchedule(RecordingClass.REMIX,RevenueType.STREAM,HzStreamEconomicsPlan420.remixSchedule())",
    ],
    "governance initialization sequence drift",
)

for token in [
    "ORIGINAL_WORK_BPS = 1_250",
    "ORIGINAL_SOURCE_BPS = 0",
    "ORIGINAL_CURRENT_BPS = 8_500",
    "ORIGINAL_PROTOCOL_BPS = 250",
    "REMIX_WORK_BPS = 1_000",
    "REMIX_SOURCE_BPS = 1_500",
    "REMIX_CURRENT_BPS = 7_250",
    "REMIX_PROTOCOL_BPS = 250",
    "VERSION = 1",
    "EFFECTIVE_AT = 0",
    '"420.hz.stream.schedule.v1"',
    "function originalSchedule()",
    "function remixSchedule()",
    "function isSupported(",
]:
    need(token in plan, f"STREAM economics plan missing invariant: {token}")

need(
    '_registerSchedule(kernel.schedules, RecordingClass.ORIGINAL, RevenueType.DIRECT_SALE, 1250, 0, 8500, 250);'
    in decision10,
    "Decision10 ORIGINAL canonical split drift",
)
need(
    '_registerSchedule(kernel.schedules, RecordingClass.REMIX, RevenueType.DIRECT_SALE, 1000, 1500, 7250, 250);'
    in decision10,
    "Decision10 REMIX canonical split drift",
)
need("enum RevenueType { STREAM," in types, "STREAM revenue enum missing")
need("function registerSchedule(" in schedules and "onlyGovernance" in schedules, "schedule governance API drift")
need("total != CreativeConstants420.BPS_DENOMINATOR" in schedules, "schedule total invariant missing")
need("MAX_PROTOCOL_FEE_BPS" in schedules, "protocol fee cap missing")
need("RevenueType.STREAM" in stream, "stream adapter no longer routes STREAM")
need("settlementSource[msg.sender]" in router, "router settlement-source authorization missing")
need("schedules.schedule(context.recordingClass, revenueType, context.scheduleVersion)" in router, "router schedule lookup drift")

for token in [
    "testStreamV1SchedulesMatchCanonicalTermsAndCommitments",
    "testStreamRoutingPreservesCanonicalOriginalAndRemixSplits",
    "testGovernanceOnlyRegistrationAndDuplicateVersionFailClosed",
    "testUnsupportedRecordingClassesHaveNoStreamSchedule",
    "testInvalidEconomicSchedulesFailClosed",
    "gross/conservation",
    "unauthorized/register",
    "duplicate/version-replay",
    "unsupported/schedule-exists",
    "protocol-cap/accepted",
]:
    need(token in test, f"focused STREAM economics test missing invariant: {token}")

live = d.get("live_evidence", {})
need(live.get("required_in_step") == "HZ-AUDIT-7", "live evidence boundary drift")
for key in ["network", "chain_id", "royalty_schedule_registry"]:
    need(live.get(key) is None, f"fabricated live value present: {key}")
for key in ["registration_transactions", "registered_schedule_reads", "stream_route_transactions", "vault_balance_evidence"]:
    need(live.get(key) == [], f"fabricated live list present: {key}")

out = {
    "pass": not errors,
    "step": "HZ-AUDIT-4",
    "bundle": str(BUNDLE.relative_to(ROOT)),
    "checks": {
        "supported_recording_classes": ["ORIGINAL", "REMIX"],
        "schedule_version": 1,
        "effective_at": 0,
        "original_split_bps": [1250, 0, 8500, 250],
        "remix_split_bps": [1000, 1500, 7250, 250],
        "live_evidence_deferred_to": "HZ-AUDIT-7",
    },
    "errors": errors,
}
print(json.dumps(out, indent=2))
raise SystemExit(0 if not errors else 2)

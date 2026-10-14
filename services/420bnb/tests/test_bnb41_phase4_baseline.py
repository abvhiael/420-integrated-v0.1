"""BNB-4.1 executable source-boundary inventory guard; no external authority asserted."""
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
BNB=ROOT/"services"/"420bnb"

def test_phase4_canonical_sequence_and_predecessor():
    roadmap=(ROOT/"docs/bnb/BNB-PHASE4-ROADMAP.md").read_text()
    certificate=(ROOT/"docs/bnb/BNB-3.12-PHASE3-LEVEL3-CLOSEOUT.md").read_text()
    assert "BNB-4.1" in roadmap and "BNB-4.12" in roadmap
    assert "847142aa402d40cd342c8d7ed236ee8f4ea619ba" in roadmap
    assert "cfe6e0f689c44d27597b4373659df8260487a308" in certificate
    assert "REPOSITORY LEVEL 3 PASS" in certificate

def test_all_live_authority_gates_preserved():
    source=(ROOT/"docs/bnb/BNB-TESTNET-WORK-ROADMAP.md").read_text()
    roadmap=(ROOT/"docs/bnb/BNB-PHASE4-ROADMAP.md").read_text()
    gates=[line.split(" — ")[0].removeprefix("## ") for line in source.splitlines() if line.startswith("## T-BNB-")]
    assert len(gates)==17 and len(set(gates))==17
    for gate in gates:
        assert gate in roadmap or (gate in ("T-BNB-IDENTITY-1","T-BNB-IDENTITY-2") and "T-BNB-IDENTITY-1/2" in roadmap) or (gate.endswith("210A") and "T-BNB-TRAVEL-210/210A" in roadmap)
    assert "travel.bnb_booking=false" in roadmap

def test_api_provider_authority_and_routes_remain_bound():
    api=(BNB/"api.py").read_text()
    assert 'app = FastAPI(' in api
    for route in ("/v1/bnb/travel/discovery","/v1/bnb/compliance/eligibility",
                  "/v1/bnb/booking-requests","/v1/bnb/internal/pay/finality",
                  "/v1/bnb/internal/appeals/{appeal_id}/decision",
                  "/v1/bnb/account/properties/{property_id}/calendar"):
        assert route in api
    for issuer in ("BNB_LOCATION_AUTHORITY","BNB_COMPLIANCE_AUTHORITY",
                   "BNB_REPUTATION","BNB_GUEST_REVIEW","BNB_CALENDAR_SYNC"):
        assert issuer in api
    assert "NEVER accepts client financial finality" in api

def test_production_and_ci_boundaries_fail_closed():
    production=(BNB/"production.py").read_text()
    compose=(BNB/"compose.production.yml").read_text()
    workflow=(ROOT/".github/workflows/bnb-runtime.yml").read_text()
    assert "verify_database" in production and "controlled_migration" in production
    for requirement in ("api-a:", "api-b:", "migrate:", "read_only: true",
                        "no-new-privileges:true", "runtime.dsn", "migrator.dsn"):
        assert requirement in compose
    assert "Exact SHA" in workflow and "Runtime security and API tests" in workflow
    migrations=sorted((BNB/"migrations").glob("[0-9][0-9][0-9]_*.sql"))
    assert len(migrations)==29
    assert migrations[-1].name=="029_incremental_discovery.sql"

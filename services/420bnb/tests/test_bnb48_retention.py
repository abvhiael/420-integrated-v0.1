"""BNB-4.8 conservative retention, host casework and immutable review seams."""
import importlib.util
from pathlib import Path
import pytest

spec=importlib.util.spec_from_file_location("bnb48_policy",
    Path(__file__).resolve().parents[1]/"casework_policy.py")
policy=importlib.util.module_from_spec(spec)
spec.loader.exec_module(policy)


@pytest.mark.parametrize("value",["","0","30","89","-1","99999","90 days","9O","3651"])
def test_invalid_or_weakened_retention_policy_fails_closed(monkeypatch,value):
    monkeypatch.setenv("BNB_REPORT_RETENTION_DAYS",value)
    with pytest.raises(ValueError,match="RETENTION_POLICY_INVALID"):
        policy.report_retention_interval()


def test_default_and_longer_policy_dont_weaken_qualified_floor(monkeypatch):
    monkeypatch.delenv("BNB_REPORT_RETENTION_DAYS",raising=False)
    assert policy.report_retention_days()==90
    monkeypatch.setenv("BNB_REPORT_RETENTION_DAYS","365")
    assert policy.report_retention_days()==365
    assert policy.report_retention_interval().days==365


def test_packaged_production_image_contains_casework_and_saga_dependencies():
    root=Path(__file__).resolve().parents[1]
    docker=(root/"Dockerfile").read_text()
    assert "COPY services/420bnb/casework_policy.py /app/casework_policy.py" in docker
    assert "COPY services/420bnb/booking_saga.py /app/booking_saga.py" in docker
    assert "USER bnb" in docker

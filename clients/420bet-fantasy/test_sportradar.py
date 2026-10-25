"""Offline synthetic HTTP-response tests; never authenticated provider evidence."""
import copy
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import urllib.error
from sportradar import BASE, CaptureError, NoRedirect, TrialClient, endpoint, inspect_summary, inspect_schedule, load_capture, strict_json

ID = "2010fc1d-05a9-46a9-ab51-57941d7e31a7"
PLAYER = "433de553-0f24-11e2-8525-18a905767e44"
KEY = "x" * 40  # public synthetic test value, never a provider credential


class Response:
    status = 200
    def __init__(self, path, raw, headers=None):
        self.path,self.raw = path,raw
        self.headers = headers or {"content-type":"application/json", "etag":"fixture", "x-generated-date":"2026-10-25T00:00:00Z"}
    def __enter__(self): return self
    def __exit__(self,*_): pass
    def geturl(self): return BASE+self.path
    def read(self,n): return self.raw[:n]


def sample():
    # Synthetic values, matching the structure observed in authenticated v7 JSON.
    return {"id":ID,"status":"closed","home":{"players":[{"id":PLAYER,"reference":"8471675","primary_position":"C","played":True,
        "statistics":{"total":{"goals":1,"assists":2,"shots":5,"blocked_shots":3},"shorthanded":{"goals":1,"assists":1}}}]},"away":{"players":[]}}



class SportradarTrialTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.client=TrialClient(self.tmp.name,KEY)
        self.addCleanup(self.tmp.cleanup);self.addCleanup(self.client.close)
    def capture(self,data=None,kind="summary",identifier=ID):
        path=endpoint(kind,identifier);raw=json.dumps(sample() if data is None else data).encode()
        with patch.object(self.client.transport,"open",return_value=Response(path,raw)) as sent:
            manifest=self.client.fetch(kind,identifier)
        return manifest,sent.call_args.args[0]
    def test_exact_endpoint_paths(self):
        self.assertEqual(endpoint("summary",ID),f"games/{ID}/summary.json")
        self.assertEqual(endpoint("schedule","2026-10-25"),"games/2026/10/25/schedule.json")
        self.assertEqual(endpoint("changes","2026-10-25"),"league/2026/10/25/changes.json")
        self.assertEqual(endpoint("pbp",ID),f"games/{ID}/pbp.json")
    def test_endpoint_injection_rejected_before_network(self):
        for val in ["https://attacker.example", ID+"?api_key=test", "../summary",ID.upper(),None]:
            with self.subTest(val=val),self.assertRaises(CaptureError):endpoint("summary",val)
    def test_invalid_date_and_endpoint_rejected(self):
        for val in ["2026-02-30","20261025","2026-1-01",None]:
            with self.subTest(val=val),self.assertRaises(CaptureError):endpoint("schedule",val)
        with self.assertRaises(CaptureError):endpoint("unknown",ID)
    def test_no_key_fails_before_request(self):
        with patch.dict("os.environ",{},clear=True),self.assertRaises(CaptureError):TrialClient(self.tmp.name)
    def test_header_only_secret_and_immutable_manifest(self):
        manifest,req=self.capture();record,data=load_capture(manifest)
        self.assertEqual(req.get_header("X-api-key"),KEY)
        self.assertNotIn(KEY,req.full_url);self.assertNotIn(KEY,manifest.read_text())
        self.assertFalse(record["oracleAccepted"]);self.assertEqual(data,sample())
        self.assertEqual(record["responseHeaders"]["etag"],"fixture")
    def test_one_second_guard_persists_across_clients(self):
        self.client.reserve("a");other=TrialClient(self.tmp.name,KEY)
        try:
            with self.assertRaisesRegex(CaptureError,"one-request"):other.reserve("b")
        finally:other.close()
    def test_budget_counts_failed_attempts(self):
        self.client.quota=1
        with patch.object(self.client.transport,"open",side_effect=urllib.error.URLError(KEY)):
            with self.assertRaises(CaptureError) as error:self.client.fetch("summary",ID)
        self.assertNotIn(KEY,str(error.exception))
        with self.assertRaisesRegex(CaptureError,"budget"):self.client.reserve("b")
    def test_budget_rolling_window(self):
        self.client.quota=1
        self.client.db.execute("INSERT INTO attempts VALUES (?,?)",(1,"old"));self.client.db.commit()
        self.client.reserve("new")
    def test_quota_cannot_exceed_trial_default(self):
        for value in [0,1001,True,2.5]:
            with self.subTest(value=value),self.assertRaises(CaptureError):TrialClient(self.tmp.name,KEY,value)
    def test_429_persists_cooldown_without_retry(self):
        error=urllib.error.HTTPError(BASE+endpoint("summary",ID),429,"limited",{"Retry-After":"120"},io.BytesIO(b"never log "+KEY.encode()))
        with patch.object(self.client.transport,"open",side_effect=error) as sent:
            with self.assertRaisesRegex(CaptureError,"429"):self.client.fetch("summary",ID)
        self.assertEqual(sent.call_count,1)
        with self.assertRaisesRegex(CaptureError,"cooldown"):self.client.reserve("other")
    def test_auth_failure_not_faked(self):
        for code in (401,403):
            with tempfile.TemporaryDirectory() as d:
                c=TrialClient(d,KEY)
                try:
                    error=urllib.error.HTTPError(BASE+endpoint("summary",ID),code,"denied",{},io.BytesIO(KEY.encode()))
                    with patch.object(c.transport,"open",side_effect=error),self.assertRaisesRegex(CaptureError,str(code)):c.fetch("summary",ID)
                    self.assertFalse((Path(d)/"captures").exists())
                finally:c.close()
    def test_redirects_do_not_forward_secret(self):
        self.assertIsNone(NoRedirect().redirect_request(None,None,302,"redirect",{},"https://attacker.example"))
    def test_unexpected_response_url_rejected(self):
        response=Response(endpoint("summary",ID),b"{}")
        with patch.object(response,"geturl",return_value="https://attacker.example"),patch.object(self.client.transport,"open",return_value=response),self.assertRaises(CaptureError):self.client.fetch("summary",ID)
    def test_wrong_content_type_rejected(self):
        r=Response(endpoint("summary",ID),b"{}",{"content-type":"text/html"})
        with patch.object(self.client.transport,"open",return_value=r),self.assertRaises(CaptureError):self.client.fetch("summary",ID)
    def test_oversized_response_rejected(self):
        import sportradar
        with patch.object(sportradar,"MAX_BYTES",8),patch.object(self.client.transport,"open",return_value=Response(endpoint("summary",ID),b" "*10)),self.assertRaises(CaptureError):self.client.fetch("summary",ID)
    def test_key_echo_never_saved(self):
        with patch.object(self.client.transport,"open",return_value=Response(endpoint("summary",ID),json.dumps({"echo":KEY}).encode())),self.assertRaises(CaptureError):self.client.fetch("summary",ID)
        self.assertFalse((Path(self.tmp.name)/"captures").exists())
    def test_json_duplicate_nonfinite_and_wrong_root_rejected(self):
        for raw in [b'{"a":1,"a":2}',b'{"a":NaN}',b'{"a":1e999}',b'[]',b'not JSON',b'\xff']:
            with self.subTest(raw=raw),self.assertRaises(CaptureError):strict_json(raw)
    def test_body_tampering_rejected(self):
        manifest,_=self.capture();d=json.loads(manifest.read_text());p=Path(self.tmp.name)/"bodies"/(d["bodySHA256"]+".json");p.write_bytes(b"{}")
        with self.assertRaisesRegex(CaptureError,"checksum"):load_capture(manifest)
    def test_digest_path_traversal_rejected(self):
        manifest,_=self.capture();d=json.loads(manifest.read_text());d["bodySHA256"]="../../private";manifest.write_text(json.dumps(d))
        with self.assertRaises(CaptureError):load_capture(manifest)
    def test_coverage_never_claims_settlement(self):
        manifest,_=self.capture();r=inspect_summary(manifest)
        self.assertFalse(r["settlementReady"]);self.assertFalse(r["oracleAccepted"])
        self.assertEqual(r["players"][0]["observedSkaterFields"],{"goals":1,"assists":2,"shots":5,"blocks":3,"shorthanded":2})
    def test_missing_stats_not_zero(self):
        data=sample();del data["home"]["players"][0]["statistics"]["total"]["shots"]
        manifest,_=self.capture(data);self.assertIsNone(inspect_summary(manifest)["players"][0]["observedSkaterFields"]["shots"])
    def test_missing_inventory_and_duplicates_rejected(self):
        for mutate in [lambda d:d.pop("away"),lambda d:d["away"]["players"].append(copy.deepcopy(d["home"]["players"][0]))]:
            with tempfile.TemporaryDirectory() as td:
                data=sample();mutate(data)
                c=TrialClient(td,KEY)
                try:
                    with patch.object(c.transport,"open",return_value=Response(endpoint("summary",ID),json.dumps(data).encode())):manifest=c.fetch("summary",ID)
                    with self.assertRaises(CaptureError):inspect_summary(manifest)
                finally:c.close()
    def test_schedule_normalizes_timezone_without_changing_original(self):
        manifest,_=self.capture({"games":[{"id":ID,"scheduled":"2026-10-25T19:00:00-04:00","status":"scheduled"}]},"schedule","2026-10-25")
        r=inspect_schedule(manifest)
        self.assertEqual(r["games"][0]["scheduledUTC"],"2026-10-25T23:00:00+00:00")
        self.assertFalse(r["oracleAccepted"])
    def test_schedule_missing_timezone_rejected(self):
        manifest,_=self.capture({"games":[{"id":ID,"scheduled":"2026-10-25T19:00:00"}]},"schedule","2026-10-25")
        with self.assertRaises(CaptureError):inspect_schedule(manifest)
    def test_private_key_file_supported_without_cli_secret(self):
        p=Path(self.tmp.name)/"key";p.write_text(KEY)
        with patch.dict("os.environ",{"SPORTRADAR_API_KEY_FILE":str(p)},clear=True):
            c=TrialClient(self.tmp.name)
            try:self.assertEqual(c.key,KEY)
            finally:c.close()
    def test_wrong_game_domain_rejected(self):
        manifest,_=self.capture();d=json.loads(manifest.read_text());d["endpoint"]=endpoint("summary",PLAYER);manifest.write_text(json.dumps(d))
        with self.assertRaises(CaptureError):inspect_summary(manifest)
    def test_wrapped_game_schema_rejected(self):
        manifest,_=self.capture({"game":sample()})
        with self.assertRaises(CaptureError):inspect_summary(manifest)
    def test_invalid_numeric_fields_stay_unresolved(self):
        data=sample();data["home"]["players"][0]["statistics"]["total"]["goals"]=True
        manifest,_=self.capture(data);self.assertIsNone(inspect_summary(manifest)["players"][0]["observedSkaterFields"]["goals"])


if __name__=="__main__":unittest.main()

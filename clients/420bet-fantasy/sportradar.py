"""Sportradar NHL v7 trial capture adapter; no oracle signing or settlement authority.

Raw captures are evidence of this client's HTTPS response, not provider-signed facts.
Only explicit, budgeted requests reach the fixed vendor origin. Offline inspection
never promotes incomplete records to accepted engine statistics.
"""
import argparse
from datetime import date, datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import re
import sqlite3
import sys
import time
import urllib.error
import urllib.request
from uuid import UUID

BASE = "https://api.sportradar.com/nhl/trial/v7/en/"
WINDOW = 30 * 86400
MAX_BYTES = 8 * 1024 * 1024
HEADERS = ("date", "last-modified", "x-generated-date", "etag", "cache-control", "content-type")


class CaptureError(Exception):
    pass


def strict_json(raw):
    def pairs(items):
        result = {}
        for k, v in items:
            if k in result:
                raise CaptureError("duplicate JSON key")
            result[k] = v
        return result
    def invalid(_):
        raise CaptureError("non-finite JSON number")
    def finite_float(text):
        value = float(text)
        if not math.isfinite(value):
            raise CaptureError("non-finite JSON number")
        return value
    try:
        value = json.loads(raw.decode("utf-8"), object_pairs_hook=pairs, parse_constant=invalid, parse_float=finite_float)
    except (ValueError, UnicodeError):
        raise CaptureError("invalid UTF-8 JSON response") from None
    if not isinstance(value, dict):
        raise CaptureError("response must be a JSON object")
    return value


def endpoint(kind, identifier=None):
    if kind in ("schedule", "changes"):
        try:
            day = date.fromisoformat(identifier)
        except (TypeError, ValueError):
            raise CaptureError("date must be YYYY-MM-DD") from None
        if day.isoformat() != identifier:
            raise CaptureError("date must be YYYY-MM-DD")
        prefix = "games" if kind == "schedule" else "league"
        return f"{prefix}/{day:%Y/%m/%d}/" + ("schedule.json" if kind == "schedule" else "changes.json")
    if kind in ("summary", "pbp", "time-on-ice", "team", "player"):
        try:
            uid = str(UUID(identifier))
        except (TypeError, ValueError, AttributeError):
            raise CaptureError("provider ID must be a canonical UUID") from None
        if uid != identifier:
            raise CaptureError("provider ID must be a canonical UUID")
        if kind in ("team", "player"):
            return f"{kind}s/{uid}/profile.json"
        suffix = {"summary": "summary", "pbp": "pbp", "time-on-ice": "time_on_ice"}[kind]
        return f"games/{uid}/{suffix}.json"
    raise CaptureError("unsupported endpoint")


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Never forward a secret header to another URL, even on the same host.
        return None


class TrialClient:
    def __init__(self, directory, api_key=None, quota=1000):
        self.root = Path(directory).resolve()
        self.key = api_key if api_key is not None else os.environ.get("SPORTRADAR_API_KEY", "")
        key_file = os.environ.get("SPORTRADAR_API_KEY_FILE")
        if not self.key and key_file:
            try:
                self.key = Path(key_file).read_text(encoding="utf-8").strip()
            except OSError:
                raise CaptureError("cannot read configured private API key file") from None
        if not re.fullmatch(r"[A-Za-z0-9_-]{24,128}", self.key):
            raise CaptureError("configure SPORTRADAR_API_KEY; no key is accepted on the command line")
        if type(quota) is not int or not 1 <= quota <= 1000:
            raise CaptureError("local trial quota must be between 1 and 1000")
        self.quota = quota
        self.root.mkdir(parents=True, exist_ok=True)
        self.db = sqlite3.connect(self.root / "requests.sqlite3", timeout=30)
        self.db.execute("CREATE TABLE IF NOT EXISTS attempts (at REAL NOT NULL, endpoint TEXT NOT NULL)")
        self.db.execute("CREATE TABLE IF NOT EXISTS control (id INTEGER PRIMARY KEY CHECK(id=1), blocked REAL NOT NULL)")
        self.db.execute("INSERT OR IGNORE INTO control VALUES (1,0)")
        self.db.commit()
        # Ignore ambient proxy configuration to keep credential delivery at the
        # intended HTTPS origin; TLS verification uses the system trust store.
        self.transport = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())

    def close(self):
        self.db.close()

    def reserve(self, path):
        now = time.time()
        self.db.execute("BEGIN IMMEDIATE")
        try:
            blocked = self.db.execute("SELECT blocked FROM control WHERE id=1").fetchone()[0]
            count, latest = self.db.execute("SELECT count(*),max(at) FROM attempts WHERE at>=?", (now-WINDOW,)).fetchone()
            if now < blocked:
                raise CaptureError("provider cooldown active; no request sent")
            if count >= self.quota:
                raise CaptureError("local rolling trial budget exhausted; no request sent")
            if latest is not None and now < latest + 1.05:
                raise CaptureError("one-request-per-second guard; retry later")
            self.db.execute("INSERT INTO attempts VALUES (?,?)", (now, path))
            self.db.commit()
            return now
        except Exception:
            self.db.rollback()
            raise

    def fetch(self, kind, identifier):
        path = endpoint(kind, identifier)
        requested = self.reserve(path)
        req = urllib.request.Request(BASE + path, headers={"x-api-key": self.key, "Accept": "application/json", "User-Agent": "420Bet-NHL-Trial/1"})
        try:
            with self.transport.open(req, timeout=30) as response:
                if response.status != 200 or response.geturl() != BASE + path:
                    raise CaptureError("unexpected status or redirected response")
                raw = response.read(MAX_BYTES + 1)
                if len(raw) > MAX_BYTES:
                    raise CaptureError("response exceeds capture size limit")
                headers = {h: response.headers[h] for h in HEADERS if response.headers.get(h) is not None}
                if "application/json" not in headers.get("content-type", "").lower():
                    raise CaptureError("response is not application/json")
                if self.key.encode() in raw or self.key in json.dumps(headers):
                    raise CaptureError("response contains credential material; refusing capture")
                strict_json(raw)
        except urllib.error.HTTPError as error:
            status = error.code
            if status == 429:
                # Persist conservative backoff across invocations. No automatic
                # retry burns extra quota, and arbitrary response text is never logged.
                retry = error.headers.get("Retry-After", "60")
                delay = int(retry) if retry.isdigit() else 60
                self.db.execute("UPDATE control SET blocked=max(blocked,?) WHERE id=1", (time.time()+max(60, delay),))
                self.db.commit()
            error.close()
            raise CaptureError(f"provider HTTP {status}; request counted, no accepted capture") from None
        except (urllib.error.URLError, OSError, TimeoutError):
            raise CaptureError("provider transport failed; request counted, no accepted capture") from None
        digest = hashlib.sha256(raw).hexdigest()
        captured = time.time()
        record = {"schema": "420.SPORTRADAR.NHL.CAPTURE.V1", "provider": "SPORTRADAR", "access": "trial", "apiVersion": 7,
                  "endpoint": path, "requestedAt": requested, "capturedAt": captured, "bodySHA256": digest,
                  "responseHeaders": headers, "authentication": "HTTPS with x-api-key; not a provider-signed attestation",
                  "oracleAccepted": False}
        # Each observation has a separate manifest even when response bytes repeat.
        # Body files are content-addressed; creation never overwrites old evidence.
        bodies = self.root / "bodies"; bodies.mkdir(exist_ok=True)
        target = bodies / (digest + ".json")
        try:
            with target.open("xb") as f: f.write(raw)
        except FileExistsError:
            if target.read_bytes() != raw: raise CaptureError("capture store integrity failure")
        manifests = self.root / "captures"; manifests.mkdir(exist_ok=True)
        from uuid import uuid4
        manifest = manifests / (str(uuid4()) + ".json")
        with manifest.open("x", encoding="utf-8") as f:
            json.dump(record, f, indent=2); f.write("\n")
        return manifest


def load_capture(manifest):
    manifest = Path(manifest).resolve()
    try:
        record = strict_json(manifest.read_bytes())
        digest = record["bodySHA256"]
        if not re.fullmatch(r"[0-9a-f]{64}", digest): raise CaptureError("invalid body digest")
        raw = (manifest.parent.parent / "bodies" / (digest + ".json")).read_bytes()
        if hashlib.sha256(raw).hexdigest() != digest: raise CaptureError("capture checksum mismatch")
        if record["schema"] != "420.SPORTRADAR.NHL.CAPTURE.V1" or record["provider"] != "SPORTRADAR" or record["access"] != "trial" or record["apiVersion"] != 7:
            raise CaptureError("unsupported capture domain")
        if not isinstance(record["capturedAt"], (float,int)) or not math.isfinite(record["capturedAt"]): raise CaptureError("invalid capture timestamp")
        return record, strict_json(raw)
    except (KeyError, OSError, TypeError):
        raise CaptureError("incomplete capture evidence") from None


def inspect_schedule(manifest):
    record, data = load_capture(manifest)
    match = re.fullmatch(r"games/(\d{4})/(\d{2})/(\d{2})/schedule.json", record["endpoint"])
    if not match: raise CaptureError("not a daily schedule capture")
    day = "-".join(match.groups())
    endpoint("schedule", day)
    games = data.get("games")
    if not isinstance(games,list): raise CaptureError("missing schedule games")
    seen = set(); result = []
    for game in games:
        if not isinstance(game,dict): raise CaptureError("invalid schedule game")
        gid = game.get("id"); endpoint("summary",gid)
        if gid in seen: raise CaptureError("duplicate game ID")
        seen.add(gid)
        try:
            instant = datetime.fromisoformat(game["scheduled"].replace("Z","+00:00"))
            if instant.tzinfo is None: raise ValueError()
        except (KeyError,ValueError,TypeError,AttributeError):
            raise CaptureError("missing timezone-qualified scheduled time") from None
        result.append({"providerGameID":gid,"scheduledUTC":instant.astimezone(timezone.utc).isoformat(),"status":game.get("status")})
    return {"date":day,"bodySHA256":record["bodySHA256"],"capturedAt":record["capturedAt"],"games":result,
            "notice":"observed schedule only; freeze approved original times before entry; later captures cannot extend locks",
            "oracleAccepted":False}


def inspect_summary(manifest):
    """Coverage inventory only: missing facts never become settlement-ready stats.

    Live payload equivalence and goalie/full-game semantics require licensed
    captures. A fixture-based parser cannot claim those gates have passed.
    """
    record, data = load_capture(manifest)
    # Actual v7 JSON has the game at the document root.
    game = data
    if "game" in data: raise CaptureError("unexpected wrapped game schema")
    gid = game.get("id")
    if record["endpoint"] != endpoint("summary", gid): raise CaptureError("game/endpoint mismatch")
    result = {"provider": "SPORTRADAR", "gameID": gid, "status": game.get("status"), "bodySHA256": record["bodySHA256"],
              "capturedAt": record["capturedAt"], "settlementReady": False, "oracleAccepted": False, "players": []}
    seen = set()
    for side in ("home", "away"):
        team = game.get(side)
        if not isinstance(team, dict) or not isinstance(team.get("players"), list): raise CaptureError("missing complete team/player inventory")
        for player in team["players"]:
            if not isinstance(player, dict): raise CaptureError("invalid player")
            pid = player.get("id")
            endpoint("player", pid)
            if pid in seen: raise CaptureError("duplicate player ID")
            seen.add(pid)
            fields = {}
            stats = player.get("statistics", {})
            if not isinstance(stats, dict): raise CaptureError("invalid statistics object")
            totals = stats.get("total", {})
            if not isinstance(totals, dict): raise CaptureError("invalid statistics totals")
            for target, source in (("goals","goals"),("assists","assists"),("shots","shots"),("blocks","blocked_shots")):
                value = totals.get(source)
                fields[target] = value if type(value) is int and 0 <= value < 65536 else None
            short = stats.get("shorthanded", {})
            fields["shorthanded"] = None
            if isinstance(short, dict) and all(type(short.get(k)) is int and 0 <= short[k] < 65536 for k in ("goals","assists")):
                total = short["goals"] + short["assists"]
                if total < 65536: fields["shorthanded"] = total
            result["players"].append({"providerID": pid, "nhlReference": player.get("reference"), "primaryPosition": player.get("primary_position"),
                                      "played": player.get("played") if type(player.get("played")) is bool else None,
                                      "observedSkaterFields": fields,
                                      "unresolved": [k for k,v in fields.items() if v is None] + ["shootout semantics", "complete revision", "canonical slate/athlete mapping"] +
                                      (["goalie credit/saves/GA", "entire-game and sole-goalie evidence"] if player.get("primary_position") == "G" else [])})
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest="command", required=True)
    fetch = commands.add_parser("fetch")
    fetch.add_argument("kind", choices=("schedule","changes","summary","pbp","time-on-ice","team","player"))
    fetch.add_argument("identifier")
    fetch.add_argument("--store", required=True, help="private capture directory outside the Git checkout")
    for name in ("inspect-summary", "inspect-schedule"):
        inspect = commands.add_parser(name)
        inspect.add_argument("manifest")
    args = parser.parse_args()
    client = None
    try:
        if args.command == "fetch":
            client = TrialClient(args.store)
            print(json.dumps({"captureManifest": str(client.fetch(args.kind,args.identifier)), "oracleAccepted": False}))
        else:
            print(json.dumps((inspect_summary if args.command == "inspect-summary" else inspect_schedule)(args.manifest), indent=2))
    except CaptureError as error:
        print(str(error), file=sys.stderr)
        return 2
    finally:
        if client is not None: client.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())

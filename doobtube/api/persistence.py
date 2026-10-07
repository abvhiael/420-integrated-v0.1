"""SQLite durable state for DOOBTUBE-5."""
from __future__ import annotations

from contextlib import contextmanager
from dataclasses import dataclass
from pathlib import Path
import hashlib
import json
import sqlite3
from typing import Any, Iterator

SCHEMA_VERSION = 2


class PersistenceError(RuntimeError):
    pass


@dataclass(frozen=True)
class IdempotencyRecord:
    key: str
    actor: str
    operation: str
    request_hash: str
    response_json: str


class Store:
    def __init__(self, path: str):
        self.path = path
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.row_factory = sqlite3.Row
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.execute("PRAGMA journal_mode=WAL")
        self.migrate()

    def close(self) -> None:
        self.db.close()

    @contextmanager
    def tx(self) -> Iterator[sqlite3.Connection]:
        try:
            self.db.execute("BEGIN IMMEDIATE")
            yield self.db
            self.db.commit()
        except Exception:
            self.db.rollback()
            raise

    def migrate(self) -> None:
        with self.tx() as db:
            db.execute("CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT NOT NULL)")
            row = db.execute("SELECT v FROM meta WHERE k='schema_version'").fetchone()
            current = int(row["v"]) if row else 0
            if current > SCHEMA_VERSION:
                raise PersistenceError("database schema is newer than runtime")
            if current < 1:
                db.executescript("""
                CREATE TABLE IF NOT EXISTS idempotency (
                    k TEXT NOT NULL,
                    actor TEXT NOT NULL,
                    operation TEXT NOT NULL,
                    request_hash TEXT NOT NULL,
                    response_json TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    PRIMARY KEY(k, actor, operation)
                );
                CREATE TABLE IF NOT EXISTS preferences (
                    actor TEXT PRIMARY KEY,
                    payload_json TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS jobs (
                    job_id TEXT PRIMARY KEY,
                    kind TEXT NOT NULL,
                    payload_json TEXT NOT NULL,
                    state TEXT NOT NULL,
                    attempts INTEGER NOT NULL,
                    max_attempts INTEGER NOT NULL,
                    next_attempt_at TEXT NOT NULL,
                    last_error TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS projection_blocks (
                    height INTEGER PRIMARY KEY,
                    block_hash TEXT NOT NULL UNIQUE,
                    parent_hash TEXT NOT NULL,
                    finalized INTEGER NOT NULL,
                    observed_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS feed_items (
                    media_asset_id TEXT PRIMARY KEY,
                    block_height INTEGER NOT NULL,
                    block_hash TEXT NOT NULL,
                    title TEXT NOT NULL,
                    creator_ref TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    FOREIGN KEY(block_height) REFERENCES projection_blocks(height) ON DELETE CASCADE
                );
                """)
                db.execute(
                    "INSERT INTO meta(k,v) VALUES('schema_version',?) "
                    "ON CONFLICT(k) DO UPDATE SET v=excluded.v",
                    ("1",),
                )
                current = 1
            if current < 2:
                db.executescript("""
                CREATE TABLE IF NOT EXISTS media_sessions (
                    session_id TEXT PRIMARY KEY,
                    spec_json TEXT NOT NULL,
                    state TEXT NOT NULL,
                    desired_live INTEGER NOT NULL,
                    reconnect_attempts INTEGER NOT NULL,
                    last_error TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );
                """)
                db.execute(
                    "INSERT INTO meta(k,v) VALUES('schema_version',?) "
                    "ON CONFLICT(k) DO UPDATE SET v=excluded.v",
                    ("2",),
                )

    @staticmethod
    def request_hash(payload: Any) -> str:
        encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        return hashlib.sha256(encoded).hexdigest()

    def get_idempotency(self, key: str, actor: str, operation: str) -> IdempotencyRecord | None:
        row = self.db.execute(
            "SELECT * FROM idempotency WHERE k=? AND actor=? AND operation=?",
            (key, actor, operation),
        ).fetchone()
        if not row:
            return None
        return IdempotencyRecord(row["k"], row["actor"], row["operation"], row["request_hash"], row["response_json"])

    def put_idempotency(
        self, key: str, actor: str, operation: str, request_hash: str, response: Any, created_at: str
    ) -> None:
        self.db.execute(
            "INSERT INTO idempotency(k,actor,operation,request_hash,response_json,created_at) VALUES(?,?,?,?,?,?)",
            (key, actor, operation, request_hash, json.dumps(response, sort_keys=True), created_at),
        )

    def put_preferences(self, actor: str, payload: dict[str, Any], updated_at: str) -> None:
        self.db.execute(
            "INSERT INTO preferences(actor,payload_json,updated_at) VALUES(?,?,?) "
            "ON CONFLICT(actor) DO UPDATE SET payload_json=excluded.payload_json,updated_at=excluded.updated_at",
            (actor, json.dumps(payload, sort_keys=True), updated_at),
        )

    def get_preferences(self, actor: str) -> dict[str, Any] | None:
        row = self.db.execute("SELECT payload_json FROM preferences WHERE actor=?", (actor,)).fetchone()
        return json.loads(row["payload_json"]) if row else None

    def enqueue_job(self, job: dict[str, Any]) -> None:
        self.db.execute(
            "INSERT INTO jobs(job_id,kind,payload_json,state,attempts,max_attempts,next_attempt_at,last_error,created_at,updated_at) "
            "VALUES(?,?,?,?,?,?,?,?,?,?)",
            (
                job["job_id"], job["kind"], json.dumps(job["payload"], sort_keys=True), job["state"],
                job["attempts"], job["max_attempts"], job["next_attempt_at"], job["last_error"],
                job["created_at"], job["updated_at"],
            ),
        )

    def due_jobs(self, now: str, limit: int = 20) -> list[sqlite3.Row]:
        return list(self.db.execute(
            "SELECT * FROM jobs WHERE state IN ('PENDING','RETRY') AND next_attempt_at<=? "
            "ORDER BY next_attempt_at,job_id LIMIT ?",
            (now, limit),
        ))

    def save_job_state(self, job_id: str, state: str, attempts: int, next_attempt_at: str, last_error: str, updated_at: str) -> None:
        self.db.execute(
            "UPDATE jobs SET state=?,attempts=?,next_attempt_at=?,last_error=?,updated_at=? WHERE job_id=?",
            (state, attempts, next_attempt_at, last_error, updated_at, job_id),
        )

    def block_at(self, height: int):
        return self.db.execute("SELECT * FROM projection_blocks WHERE height=?", (height,)).fetchone()

    def tip(self):
        return self.db.execute("SELECT * FROM projection_blocks ORDER BY height DESC LIMIT 1").fetchone()

    def rollback_after(self, height: int) -> None:
        self.db.execute("DELETE FROM projection_blocks WHERE height>?", (height,))

    def finalized_height(self) -> int:
        row = self.db.execute("SELECT COALESCE(MAX(height),-1) AS h FROM projection_blocks WHERE finalized=1").fetchone()
        return int(row["h"])

    def put_projection_event(self, event, observed_at: str) -> None:
        finalized = 1 if event.block_height <= event.finalized_height else 0
        self.db.execute(
            "INSERT INTO projection_blocks(height,block_hash,parent_hash,finalized,observed_at) VALUES(?,?,?,?,?)",
            (event.block_height, event.block_hash, event.parent_hash, finalized, observed_at),
        )
        if event.media_state == "READY" and event.visibility == "PUBLIC" and event.rights_authorized:
            self.db.execute(
                "INSERT INTO feed_items(media_asset_id,block_height,block_hash,title,creator_ref,updated_at) VALUES(?,?,?,?,?,?) "
                "ON CONFLICT(media_asset_id) DO UPDATE SET block_height=excluded.block_height,block_hash=excluded.block_hash,"
                "title=excluded.title,creator_ref=excluded.creator_ref,updated_at=excluded.updated_at",
                (event.media_asset_id, event.block_height, event.block_hash, event.title, event.creator_ref, observed_at),
            )
        else:
            self.db.execute("DELETE FROM feed_items WHERE media_asset_id=?", (event.media_asset_id,))

    def mark_finalized_through(self, height: int) -> None:
        self.db.execute("UPDATE projection_blocks SET finalized=1 WHERE height<=?", (height,))

    def feed_page(self, offset: int, limit: int) -> list[sqlite3.Row]:
        return list(self.db.execute(
            "SELECT media_asset_id,title,creator_ref,block_height,block_hash,updated_at "
            "FROM feed_items ORDER BY block_height DESC,media_asset_id LIMIT ? OFFSET ?",
            (limit, offset),
        ))

    def clear_projection(self) -> None:
        self.db.execute("DELETE FROM projection_blocks")


    def put_media_session(self, record) -> None:
        from dataclasses import asdict
        from datetime import datetime
        spec = asdict(record.spec)
        self.db.execute(
            "INSERT INTO media_sessions(session_id,spec_json,state,desired_live,reconnect_attempts,last_error,updated_at) "
            "VALUES(?,?,?,?,?,?,?) ON CONFLICT(session_id) DO UPDATE SET "
            "spec_json=excluded.spec_json,state=excluded.state,desired_live=excluded.desired_live,"
            "reconnect_attempts=excluded.reconnect_attempts,last_error=excluded.last_error,updated_at=excluded.updated_at",
            (
                record.spec.session_id, json.dumps(spec, sort_keys=True), record.state,
                1 if record.desired_live else 0, record.reconnect_attempts,
                record.last_error, record.updated_at.astimezone().isoformat(),
            ),
        )
        self.db.commit()

    def _media_record(self, row):
        if row is None:
            return None
        from datetime import datetime
        from doobtube.media.types import LivestreamRecord, LivestreamSpec
        spec = LivestreamSpec(**json.loads(row["spec_json"]))
        return LivestreamRecord(
            spec=spec,
            state=row["state"],
            desired_live=bool(row["desired_live"]),
            reconnect_attempts=int(row["reconnect_attempts"]),
            last_error=row["last_error"],
            updated_at=datetime.fromisoformat(row["updated_at"]),
        )

    def get_media_session(self, session_id: str):
        row = self.db.execute("SELECT * FROM media_sessions WHERE session_id=?", (session_id,)).fetchone()
        return self._media_record(row)

    def list_media_sessions(self):
        rows = self.db.execute("SELECT * FROM media_sessions ORDER BY session_id").fetchall()
        return [self._media_record(row) for row in rows]

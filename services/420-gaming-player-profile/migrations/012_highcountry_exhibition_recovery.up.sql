-- HC-NEXT-7.5-D: additive immutable adjudication history, not a replacement result ledger.
CREATE TABLE IF NOT EXISTS highcountry_exhibitions.adjudication_history(
 game_id text NOT NULL,event_id text NOT NULL,account_id text NOT NULL,
 adjudicator text NOT NULL,harvest_id text NOT NULL,reason_hash text NOT NULL,
 disposition text NOT NULL,original_winner text,original_score integer,
 decided_at bigint NOT NULL,PRIMARY KEY(game_id,event_id,account_id,disposition),
 FOREIGN KEY(game_id,event_id,account_id) REFERENCES highcountry_exhibitions.results(game_id,event_id,account_id),
 CHECK(reason_hash ~ '^0x[0-9a-f]{64}$'),
 CHECK(disposition IN ('PRE_FINAL_REJECTION','POST_FINAL_VALID','POST_FINAL_INVALID')),
 CHECK(original_score IS NULL OR original_score BETWEEN 0 AND 10000)
);
-- One terminal post-final review per submitted candidate; history is never updated.
CREATE UNIQUE INDEX IF NOT EXISTS hc_adjudication_postfinal_terminal
 ON highcountry_exhibitions.adjudication_history(game_id,event_id,account_id)
 WHERE disposition IN ('POST_FINAL_VALID','POST_FINAL_INVALID');
REVOKE ALL ON highcountry_exhibitions.adjudication_history FROM PUBLIC;
GRANT SELECT,INSERT ON highcountry_exhibitions.adjudication_history TO gaming_datastore_runtime;

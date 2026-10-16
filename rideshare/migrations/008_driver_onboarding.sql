-- Private onboarding records; document bytes belong in independent encrypted vault, never this table.
CREATE TABLE liftd.driver_onboarding (
 driver_id text PRIMARY KEY CHECK(driver_id ~ '^[A-Za-z0-9_-]{1,128}$'),
 revision bigint NOT NULL CHECK(revision>0),
 payload jsonb NOT NULL CHECK(jsonb_typeof(payload)='object'),
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE liftd.driver_onboarding_commands (
 driver_id text NOT NULL,
 command_id text NOT NULL,
 revision bigint NOT NULL,
 PRIMARY KEY(driver_id,command_id)
);
REVOKE ALL ON liftd.driver_onboarding FROM PUBLIC;
REVOKE ALL ON liftd.driver_onboarding_commands FROM PUBLIC;

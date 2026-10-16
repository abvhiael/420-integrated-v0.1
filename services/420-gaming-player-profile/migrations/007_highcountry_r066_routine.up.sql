-- R06.6 at-most-once routine admission. Provision under the restricted gaming_datastore_migrator.
-- A RESERVED operation is NEVER automatically released after ambiguous execution failures.
CREATE TABLE gaming_datastore.highcountry_r066_routine_operations (
 principal gaming_datastore.opaque_id NOT NULL,
 session_id gaming_datastore.opaque_id NOT NULL,
 operation gaming_datastore.opaque_id NOT NULL,
 action gaming_datastore.opaque_id NOT NULL,
 admitted_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY (principal,session_id,operation)
);
ALTER TABLE gaming_datastore.highcountry_r066_routine_operations OWNER TO gaming_datastore_migrator;
ALTER TABLE gaming_datastore.highcountry_r066_routine_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE gaming_datastore.highcountry_r066_routine_operations FORCE ROW LEVEL SECURITY;
CREATE POLICY r066_routine_runtime ON gaming_datastore.highcountry_r066_routine_operations
 TO gaming_datastore_runtime USING (true) WITH CHECK (true);
GRANT SELECT,INSERT ON gaming_datastore.highcountry_r066_routine_operations TO gaming_datastore_runtime;
-- Keep UPDATE/DELETE/TRUNCATE and schema change inaccessible to the runtime role.

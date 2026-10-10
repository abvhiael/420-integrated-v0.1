-- GROW-V2-06: validated tenant-private telemetry metadata and indexed chart reads
BEGIN;
SELECT pg_advisory_xact_lock(420203);
ALTER TABLE grow_private.observations ADD COLUMN sensor_id text NOT NULL DEFAULT 'legacy:unknown';
ALTER TABLE grow_private.observations ADD CONSTRAINT sensor_id_present CHECK(length(sensor_id) BETWEEN 1 AND 128);
ALTER TABLE grow_private.observations ADD CONSTRAINT telemetry_units CHECK(
 (kind='temperature' AND unit='C' AND reading BETWEEN -50 AND 100) OR
 (kind='humidity' AND unit='%' AND reading BETWEEN 0 AND 100) OR
 (kind='ph' AND unit='pH' AND reading BETWEEN 0 AND 14) OR
 (kind='light' AND unit='lux' AND reading BETWEEN 0 AND 300000) OR
 (kind='conductivity' AND unit='mS/cm' AND reading BETWEEN 0 AND 100) OR
 (kind='water_level' AND unit='cm' AND reading BETWEEN 0 AND 100000));
CREATE INDEX observations_history_range ON grow_private.observations
(tenant_id,facility_id,zone_id,kind,measured_at,observation_id);
COMMIT;

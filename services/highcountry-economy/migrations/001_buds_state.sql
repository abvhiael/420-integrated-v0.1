-- Apply under a separately authenticated migration role.
-- No service request or guest is authorized to create namespaces.
CREATE TABLE IF NOT EXISTS highcountry_buds_state (
    namespace text PRIMARY KEY CHECK (length(namespace) BETWEEN 1 AND 128),
    state jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
-- Provision registered namespaces through an approved operator migration;
-- never use a request-derived namespace or an unaudited guest save.
-- INSERT INTO highcountry_buds_state(namespace,state) VALUES
-- ('reviewed-namespace', '{"schema":1,"balances":[],"operations":[],"claims":[],"sourceIssued":[],"issued":0,"burned":0}'::jsonb);
-- Grant service role SELECT and UPDATE only; deny INSERT, DELETE, TRUNCATE and DDL.

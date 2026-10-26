-- Provision through the privileged migration role, never from a gameplay request.
CREATE TABLE IF NOT EXISTS highcountry_social_operations (
 scope text NOT NULL,
 operation_id text NOT NULL,
 principal text NOT NULL,
 wallet text NOT NULL,
 action text NOT NULL,
 tx_hash text NOT NULL,
 state text NOT NULL CHECK (state IN ('submitted','finalized')),
 block_hash text,
 PRIMARY KEY(scope,operation_id),
 CHECK (length(scope) BETWEEN 1 AND 128),
 CHECK (length(principal) BETWEEN 1 AND 128)
);
CREATE INDEX IF NOT EXISTS highcountry_social_operations_owner_idx ON highcountry_social_operations (scope,principal);
ALTER TABLE highcountry_social_operations ENABLE ROW LEVEL SECURITY;
-- The game runtime may access only its own provisioned namespace through a
-- separately granted role and RLS policy. No blanket PUBLIC access is granted.
REVOKE ALL ON highcountry_social_operations FROM PUBLIC;

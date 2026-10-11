-- BNB-2.7: noncustodial Pay-owned economic event mirror.
-- All amounts are canonical integer units of the captured asset; no local funds.
CREATE TABLE IF NOT EXISTS bnb_settlement_split (
 reservation_id uuid PRIMARY KEY REFERENCES bnb_reservation(id),
 pay_payment_id text NOT NULL UNIQUE,
 chain_id bigint NOT NULL,
 asset text NOT NULL,
 captured_amount numeric(78,0) NOT NULL CHECK(captured_amount>0),
 host_recipient text NOT NULL,
 platform_recipient text NOT NULL,
 developer_recipient text NOT NULL,
 host_amount numeric(78,0) NOT NULL CHECK(host_amount>=0),
 platform_amount numeric(78,0) NOT NULL CHECK(platform_amount>=0),
 developer_amount numeric(78,0) NOT NULL CHECK(developer_amount>=0),
 retained_amount numeric(78,0) NOT NULL CHECK(retained_amount>=0),
 policy_version text NOT NULL,
 canonical_split_id text NOT NULL UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(host_amount+platform_amount+developer_amount+retained_amount=captured_amount)
);
CREATE TABLE IF NOT EXISTS bnb_pay_disbursement (
 id uuid PRIMARY KEY,
 reservation_id uuid NOT NULL REFERENCES bnb_settlement_split(reservation_id),
 kind text NOT NULL CHECK(kind IN ('refund','host','platform','developer','retained')),
 pay_operation_id text NOT NULL UNIQUE,
 pay_event_id text UNIQUE,
 recipient text NOT NULL,
 amount numeric(78,0) NOT NULL CHECK(amount>0),
 chain_id bigint NOT NULL,
 asset text NOT NULL,
 state text NOT NULL CHECK(state IN ('reserved','finalized','failed')),
 policy_version text NOT NULL,
 pay_receipt_hash text UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(reservation_id,kind,pay_operation_id)
);
CREATE TABLE IF NOT EXISTS bnb_pay_disbursement_event (
 issuer text NOT NULL,
 jti text NOT NULL,
 pay_operation_id text NOT NULL,
 event_id text NOT NULL UNIQUE,
 event_digest text NOT NULL,
 state text NOT NULL CHECK(state IN ('reserved','finalized','failed')),
 received_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(issuer,jti)
);
CREATE INDEX IF NOT EXISTS bnb_pay_disbursement_reservation
 ON bnb_pay_disbursement(reservation_id,kind,state);

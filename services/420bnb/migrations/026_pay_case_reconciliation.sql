-- BNB-4.6: Pay-authenticated, append-only dispute and refund-case evidence.
-- All case transitions and financial dispositions are attested by independent 420Pay.
-- This ledger records case state only; it has zero transfer/custody authority.
CREATE TABLE bnb_pay_case_event (
 issuer text NOT NULL,
 jti text NOT NULL,
 event_id text NOT NULL UNIQUE,
 case_id text NOT NULL,
 revision integer NOT NULL CHECK (revision>0),
 reservation_id uuid NOT NULL REFERENCES bnb_reservation(id),
 pay_invoice_id text NOT NULL,
 pay_payment_id text NOT NULL,
 event_state text NOT NULL CHECK (event_state IN ('opened','refund_requested','resolved')),
 resolution text CHECK (resolution IN ('upheld','refund_pending','refund_completed')),
 payout_release_authorized boolean NOT NULL DEFAULT false,
 event_digest char(64) NOT NULL,
 recorded_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(issuer,jti),
 UNIQUE(case_id,revision),
 CHECK ((event_state='resolved') = (resolution IS NOT NULL)),
 CHECK (NOT payout_release_authorized OR
        (event_state='resolved' AND resolution='upheld'))
);
CREATE INDEX bnb_pay_case_reservation_revision
 ON bnb_pay_case_event(reservation_id,case_id,revision DESC);

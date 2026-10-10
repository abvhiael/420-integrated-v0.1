-- BNB-2.6: requests and immutable Pay/Swap settlement evidence, no local custody.
CREATE TABLE IF NOT EXISTS bnb_pay_intent (
 id uuid PRIMARY KEY,
 reservation_id uuid NOT NULL UNIQUE REFERENCES bnb_reservation(id),
 quote_id uuid NOT NULL REFERENCES bnb_price_quote(id),
 requester text NOT NULL,
 merchant_id text NOT NULL,
 payout_controller text NOT NULL,
 chain_id bigint NOT NULL CHECK(chain_id>0),
 asset text NOT NULL,
 asset_amount text NOT NULL,
 settlement_currency char(3) NOT NULL,
 quoted_minor bigint NOT NULL CHECK(quoted_minor>=0),
 pay_invoice_id text NOT NULL UNIQUE,
 pay_invoice_expires timestamptz NOT NULL,
 conversion_route_id text,
 conversion_quote_id text,
 conversion_expires timestamptz,
 minimum_received text,
 payer_max text,
 state text NOT NULL DEFAULT 'pending' CHECK(state IN
   ('pending','finalized','recovery_required','expired')),
 pay_payment_id text UNIQUE,
 receipt_hash text UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS bnb_pay_finality_event (
 issuer text NOT NULL,
 jti text NOT NULL,
 pay_payment_id text NOT NULL,
 pay_invoice_id text NOT NULL,
 reservation_id uuid NOT NULL REFERENCES bnb_reservation(id),
 receipt_hash text NOT NULL,
 chain_id bigint NOT NULL,
 finality text NOT NULL CHECK(finality IN ('FINALIZED','SETTLED')),
 received_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(issuer,jti),
 UNIQUE(issuer,receipt_hash),
 UNIQUE(pay_payment_id)
);

-- COM-6 governed refund request outbox: merchant requests are not Pay approvals or transfers.
CREATE TABLE IF NOT EXISTS refund_requests (
  request_id TEXT PRIMARY KEY CHECK(length(request_id)=64),
  store_id TEXT NOT NULL,
  attempt_id TEXT NOT NULL,
  payment_id TEXT NOT NULL,
  order_id TEXT NOT NULL,
  amount TEXT NOT NULL,
  asset TEXT NOT NULL,
  recipient TEXT NOT NULL,
  reason_hash TEXT NOT NULL,
  payment_refunded_at_request TEXT NOT NULL,
  request_state TEXT NOT NULL CHECK(request_state='PENDING_GOVERNANCE'),
  created_at INTEGER NOT NULL,
  UNIQUE(payment_id,reason_hash,amount),
  FOREIGN KEY(store_id) REFERENCES stores(store_id)
);
CREATE INDEX IF NOT EXISTS refund_requests_store ON refund_requests(store_id,created_at);
INSERT INTO migrations(version) VALUES(3);

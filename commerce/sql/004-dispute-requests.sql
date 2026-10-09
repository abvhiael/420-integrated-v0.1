-- Merchant dispute intent is not canonical Market dispute or Arbitration case.
CREATE TABLE dispute_requests (
 request_id TEXT PRIMARY KEY CHECK(length(request_id)=64),
 store_id TEXT NOT NULL,
 attempt_id TEXT NOT NULL,
 order_id TEXT NOT NULL,
 dispute_hash TEXT NOT NULL CHECK(length(dispute_hash)=66),
 requester TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state='AWAITING_MARKET_WALLET_SUBMISSION'),
 created_at INTEGER NOT NULL,
 UNIQUE(order_id,dispute_hash),
 FOREIGN KEY(store_id) REFERENCES stores(store_id)
);
CREATE INDEX dispute_requests_store_order ON dispute_requests(store_id,created_at);
INSERT INTO migrations(version) VALUES(4);

-- Local opt-in merchant presentation only; 420Notifications owns external dispatch.
CREATE TABLE commerce_notification_preferences (
 store_id TEXT PRIMARY KEY REFERENCES stores(store_id),
 controller TEXT NOT NULL,
 enabled INTEGER NOT NULL CHECK(enabled IN (0,1)),
 updated_at INTEGER NOT NULL
);
CREATE TABLE commerce_notification_feed (
 store_id TEXT NOT NULL REFERENCES stores(store_id),
 event_id TEXT NOT NULL REFERENCES event_inbox(event_id),
 notification_id TEXT NOT NULL CHECK(length(notification_id)=64),
 operation TEXT NOT NULL,
 read_at INTEGER,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(store_id,event_id),
 UNIQUE(store_id,notification_id)
);
CREATE INDEX commerce_notification_feed_page ON commerce_notification_feed(store_id,created_at DESC,event_id DESC);
INSERT INTO migrations(version) VALUES(6);

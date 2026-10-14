-- BNB-4.5 messaging delivery cursors; no independent notification provider authority.
CREATE TABLE IF NOT EXISTS bnb_message_delivery_cursor (
 request_id uuid NOT NULL REFERENCES bnb_booking_request(id),
 subject text NOT NULL REFERENCES bnb_account(subject),
 device_id text NOT NULL CHECK(length(device_id) BETWEEN 8 AND 128),
 last_message_id uuid,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(request_id,subject,device_id)
);
CREATE INDEX IF NOT EXISTS bnb_message_delivery_cursor_subject
 ON bnb_message_delivery_cursor(subject,updated_at);

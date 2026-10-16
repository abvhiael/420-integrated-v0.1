-- BNB-5.8 device authority and delivery preferences; no provider activation.
CREATE TABLE bnb_message_device (
 subject text NOT NULL REFERENCES bnb_account(subject),
 device_id text NOT NULL CHECK(length(device_id) BETWEEN 8 AND 128),
 authority_expires_at timestamptz NOT NULL,
 revoked_at timestamptz,
 notifications_enabled boolean NOT NULL DEFAULT true,
 registered_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(subject,device_id),
 CHECK(authority_expires_at>registered_at)
);
CREATE INDEX bnb_message_device_active ON bnb_message_device(subject,authority_expires_at)
 WHERE revoked_at IS NULL;
CREATE TABLE bnb_message_notice (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 request_id uuid NOT NULL REFERENCES bnb_booking_request(id),
 message_id uuid NOT NULL REFERENCES bnb_guest_message(id),
 recipient_subject text NOT NULL REFERENCES bnb_account(subject),
 device_id text NOT NULL,
 delivered_at timestamptz,
 acknowledged_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 UNIQUE(message_id,recipient_subject,device_id),
 FOREIGN KEY (recipient_subject,device_id) REFERENCES bnb_message_device(subject,device_id)
);
CREATE INDEX bnb_message_notice_pending ON bnb_message_notice(recipient_subject,device_id,created_at)
 WHERE acknowledged_at IS NULL;

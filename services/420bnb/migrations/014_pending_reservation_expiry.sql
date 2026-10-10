-- BNB-2.5: pending-payment reservation timeouts are distinct from
-- an authorized guest/host cancellation or confirmed paid reservation.
ALTER TABLE bnb_reservation DROP CONSTRAINT IF EXISTS bnb_reservation_status_check;
ALTER TABLE bnb_reservation ADD CONSTRAINT bnb_reservation_status_check
 CHECK(status IN ('payment_pending','confirmed','cancelled','recovery_required','expired'));

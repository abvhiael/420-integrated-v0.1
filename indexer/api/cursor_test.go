package api

import "testing"

func TestCursorRoundTripPinsSnapshot(t *testing.T) {
	in := Cursor{SnapshotHeight: 100, SnapshotHash: "0xabc", BeforeHeight: 80, Limit: 25}
	encoded, err := EncodeCursor(in)
	if err != nil { t.Fatal(err) }
	out, err := DecodeCursor(encoded)
	if err != nil { t.Fatal(err) }
	if out != in { t.Fatalf("round trip mismatch: %+v != %+v", out, in) }
}

func TestCursorRejectsInvalidSnapshot(t *testing.T) {
	if _, err := EncodeCursor(Cursor{SnapshotHeight: 10, Limit: 25}); err != ErrInvalidCursor { t.Fatalf("expected invalid cursor, got %v", err) }
	if _, err := DecodeCursor("not-base64%%"); err != ErrInvalidCursor { t.Fatalf("expected invalid cursor, got %v", err) }
}

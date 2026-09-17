package feed

import (
	"testing"
	"time"

	"github.com/420integrated/420-integrated/notifications/security"
)

func provenance(id string) security.Provenance {
	return security.Provenance{
		ChainID: "420", BlockNumber: "10", BlockHash: "0xblock" + id,
		TransactionHash: "0xtx" + id, LogIndex: 0, SourceID: "420/service/pay/v1",
		OriginURL: "https://explorer.420/tx/0xtx" + id,
	}
}

func item(id string, at time.Time) Item {
	return Item{ID: id, EventID: "event-" + id, SubscriptionID: "sub-1", Title: "title", Body: "body", Provenance: provenance(id), CreatedAt: at}
}

func TestFeedIsNonAuthoritativeAndPreservesProvenance(t *testing.T) {
	s := NewStore()
	it := item("1", time.Unix(100, 0).UTC())
	stored, err := s.Put(it)
	if err != nil { t.Fatal(err) }
	if stored.Authoritative { t.Fatal("feed item became authoritative") }
	if stored.Provenance.TransactionHash != it.Provenance.TransactionHash { t.Fatal("provenance was not preserved") }
}

func TestReadUnreadAndDeliveryStatus(t *testing.T) {
	s := NewStore()
	if _, err := s.Put(item("1", time.Unix(100, 0).UTC())); err != nil { t.Fatal(err) }
	updated, err := s.SetRead("1", true, time.Unix(101, 0).UTC())
	if err != nil { t.Fatal(err) }
	if !updated.Read { t.Fatal("notification not marked read") }
	updated, err = s.SetRead("1", false, time.Unix(102, 0).UTC())
	if err != nil { t.Fatal(err) }
	if updated.Read { t.Fatal("notification not marked unread") }
	updated, err = s.SetDeliveryStatus("1", DeliveryDelivered, time.Unix(103, 0).UTC())
	if err != nil { t.Fatal(err) }
	if updated.DeliveryStatus != DeliveryDelivered { t.Fatalf("status=%q", updated.DeliveryStatus) }
}

func TestReplaySafePagination(t *testing.T) {
	s := NewStore()
	base := time.Unix(1000, 0).UTC()
	for _, id := range []string{"a", "b", "c"} {
		if _, err := s.Put(item(id, base)); err != nil { t.Fatal(err) }
	}
	first := s.List("", 2)
	if len(first.Items) != 2 || first.NextCursor == "" { t.Fatalf("unexpected first page: %+v", first) }
	second := s.List(first.NextCursor, 2)
	if len(second.Items) != 1 { t.Fatalf("unexpected second page: %+v", second) }
	if first.Items[0].ID != "a" || first.Items[1].ID != "b" || second.Items[0].ID != "c" { t.Fatalf("unstable pagination order") }
}

func TestRejectsInvalidProvenanceAndAuthority(t *testing.T) {
	s := NewStore()
	bad := item("1", time.Unix(100, 0).UTC())
	bad.Authoritative = true
	if _, err := s.Put(bad); err == nil { t.Fatal("expected authoritative item rejection") }
	bad = item("2", time.Unix(100, 0).UTC())
	bad.Provenance.OriginURL = "javascript:alert(1)"
	if _, err := s.Put(bad); err == nil { t.Fatal("expected hostile provenance rejection") }
}

package api

import (
	"testing"
	"time"

	"github.com/420integrated/420-integrated/notifications/feed"
	"github.com/420integrated/420-integrated/notifications/security"
	"github.com/420integrated/420-integrated/notifications/subscriptions"
)

func testSub() subscriptions.Subscription {
	return subscriptions.Subscription{
		ID: "sub-1",
		Filters: subscriptions.Filters{Sources: []string{"420/service/pay/v1"}},
		MinimumSeverity: subscriptions.SeverityInfo,
		Channels: []subscriptions.Channel{subscriptions.ChannelInApp},
		Active: true,
		OperationalConsent: true,
	}
}

func testItem() feed.Item {
	return feed.Item{
		ID: "n-1", EventID: "e-1", SubscriptionID: "sub-1", Title: "paid", Body: "invoice paid",
		CreatedAt: time.Unix(100, 0).UTC(),
		Provenance: security.Provenance{ChainID: "420", BlockNumber: "1", BlockHash: "0xb", TransactionHash: "0xt", LogIndex: 0, SourceID: "420/service/pay/v1", OriginURL: "https://explorer.420/tx/0xt"},
	}
}

func TestSubscriptionCRUDAndFeedState(t *testing.T) {
	subs := subscriptions.NewStore()
	history := feed.NewStore()
	if _, err := history.Put(testItem()); err != nil { t.Fatal(err) }
	svc, err := NewService(subs, history)
	if err != nil { t.Fatal(err) }

	created, err := svc.CreateSubscription(testSub())
	if err != nil { t.Fatal(err) }
	if created.ID != "sub-1" { t.Fatalf("id=%q", created.ID) }
	if _, err := svc.GetSubscription("sub-1"); err != nil { t.Fatal(err) }
	if len(svc.ListSubscriptions()) != 1 { t.Fatal("subscription list mismatch") }

	updated := testSub()
	updated.Muted = true
	if _, err := svc.UpdateSubscription(updated); err != nil { t.Fatal(err) }

	page := svc.Feed("", 10)
	if len(page.Items) != 1 || page.Items[0].ID != "n-1" { t.Fatalf("feed mismatch: %+v", page) }
	read, err := svc.SetRead("n-1", true, time.Unix(101, 0).UTC())
	if err != nil || !read.Read { t.Fatalf("read update failed: %+v %v", read, err) }
	status, err := svc.SetDeliveryStatus("n-1", feed.DeliveryDelivered, time.Unix(102, 0).UTC())
	if err != nil || status.DeliveryStatus != feed.DeliveryDelivered { t.Fatalf("delivery update failed: %+v %v", status, err) }

	if err := svc.DeleteSubscription("sub-1"); err != nil { t.Fatal(err) }
	if len(svc.ListSubscriptions()) != 0 { t.Fatal("subscription delete failed") }
}

func TestServiceRequiresStores(t *testing.T) {
	if _, err := NewService(nil, feed.NewStore()); err == nil { t.Fatal("expected missing subscription store rejection") }
	if _, err := NewService(subscriptions.NewStore(), nil); err == nil { t.Fatal("expected missing feed store rejection") }
}

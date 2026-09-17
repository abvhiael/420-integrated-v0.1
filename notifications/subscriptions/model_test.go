package subscriptions

import "testing"

func validSubscription() Subscription {
	return Subscription{
		ID: "sub-1",
		Filters: Filters{
			Sources: []string{"420Pay"},
			Topics:  []string{"Payments"},
			Events:  []string{"Invoice.Paid"},
		},
		MinimumSeverity:    SeverityWarning,
		Channels:           []Channel{ChannelPush, ChannelInApp},
		Active:             true,
		OperationalConsent: true,
	}
}

func TestSubscriptionRequiresExplicitOptIn(t *testing.T) {
	sub := validSubscription()
	sub.Active = false
	if err := sub.Validate(); err == nil {
		t.Fatal("expected inactive subscription to fail validation")
	}
}

func TestSubscriptionRequiresFilterAndChannel(t *testing.T) {
	sub := validSubscription()
	sub.Filters = Filters{}
	if err := sub.Validate(); err == nil {
		t.Fatal("expected missing filters to fail validation")
	}
	sub = validSubscription()
	sub.Channels = nil
	if err := sub.Validate(); err == nil {
		t.Fatal("expected missing channels to fail validation")
	}
}

func TestPromotionalConsentIsIndependent(t *testing.T) {
	sub := validSubscription()
	if sub.AllowsPromotional() {
		t.Fatal("promotional delivery must be off without separate consent")
	}
	if !sub.AllowsOperational() {
		t.Fatal("operational consent should remain enabled")
	}
	sub.PromotionalConsent = true
	if !sub.AllowsPromotional() {
		t.Fatal("promotional delivery should require explicit consent")
	}
}

func TestMuteSuppressesAllDeliveryWithoutDestroyingSubscription(t *testing.T) {
	sub := validSubscription()
	sub.PromotionalConsent = true
	sub.Muted = true
	if sub.AllowsOperational() || sub.AllowsPromotional() {
		t.Fatal("muted subscription must suppress delivery")
	}
	if !sub.Active {
		t.Fatal("mute must not unsubscribe")
	}
}

func TestNormalizeMakesFiltersAndChannelsDeterministic(t *testing.T) {
	sub := validSubscription()
	sub.Filters.Sources = []string{" 420Pay ", "420pay", "420Bridge"}
	sub.Filters.Topics = []string{"Zeta", "alpha", "ALPHA"}
	sub.Channels = []Channel{ChannelPush, ChannelInApp, ChannelPush}
	n := Normalize(sub)
	if len(n.Filters.Sources) != 2 || n.Filters.Sources[0] != "420bridge" || n.Filters.Sources[1] != "420pay" {
		t.Fatalf("unexpected sources: %#v", n.Filters.Sources)
	}
	if len(n.Filters.Topics) != 2 || n.Filters.Topics[0] != "alpha" || n.Filters.Topics[1] != "zeta" {
		t.Fatalf("unexpected topics: %#v", n.Filters.Topics)
	}
	if len(n.Channels) != 2 || n.Channels[0] != ChannelInApp || n.Channels[1] != ChannelPush {
		t.Fatalf("unexpected channels: %#v", n.Channels)
	}
}

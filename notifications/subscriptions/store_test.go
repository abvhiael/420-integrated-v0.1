package subscriptions

import (
	"errors"
	"testing"
)

func TestStoreLifecycleIsReversible(t *testing.T) {
	store := NewStore()
	created, err := store.Create(validSubscription())
	if err != nil { t.Fatal(err) }
	if created.ID != "sub-1" { t.Fatalf("id=%q", created.ID) }

	muted, err := store.SetMuted("sub-1", true)
	if err != nil { t.Fatal(err) }
	if !muted.Muted { t.Fatal("expected muted subscription") }

	unmuted, err := store.SetMuted("sub-1", false)
	if err != nil { t.Fatal(err) }
	if unmuted.Muted { t.Fatal("expected unmuted subscription") }

	promo, err := store.SetPromotionalConsent("sub-1", true)
	if err != nil { t.Fatal(err) }
	if !promo.PromotionalConsent { t.Fatal("expected promotional consent") }

	if err := store.Unsubscribe("sub-1"); err != nil { t.Fatal(err) }
	if _, err := store.Get("sub-1"); !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected removed subscription, got %v", err)
	}
}

func TestStoreDoesNotExposeMutableInternalSlices(t *testing.T) {
	store := NewStore()
	created, err := store.Create(validSubscription())
	if err != nil { t.Fatal(err) }
	created.Filters.Sources[0] = "tampered"
	created.Channels[0] = ChannelWeb

	got, err := store.Get("sub-1")
	if err != nil { t.Fatal(err) }
	if got.Filters.Sources[0] == "tampered" { t.Fatal("store leaked mutable source slice") }
	if got.Channels[0] == ChannelWeb { t.Fatal("store leaked mutable channel slice") }
}

func TestStoreRejectsDuplicateAndMissingUpdates(t *testing.T) {
	store := NewStore()
	if _, err := store.Create(validSubscription()); err != nil { t.Fatal(err) }
	if _, err := store.Create(validSubscription()); !errors.Is(err, ErrExists) {
		t.Fatalf("expected ErrExists, got %v", err)
	}
	missing := validSubscription()
	missing.ID = "missing"
	if _, err := store.Update(missing); !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected ErrNotFound, got %v", err)
	}
}

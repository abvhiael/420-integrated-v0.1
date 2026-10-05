package model

import (
	"encoding/json"
	"testing"
	"time"
)

func TestObjectIDIsOpaque(t *testing.T) {
	for _, id := range []ObjectID{"opaque-01HXYZ", "did:420:abc/def", "not-a-parsed-schema"} {
		if !id.Valid() {
			t.Fatalf("expected opaque ID %q to be accepted", id)
		}
	}
	for _, id := range []ObjectID{"", " leading", "trailing "} {
		if id.Valid() {
			t.Fatalf("expected invalid ID %q", id)
		}
	}
}

func TestEnvelopeJSONUsesCanonicalMetadataKeys(t *testing.T) {
	now := time.Unix(1_700_000_000, 0).UTC()
	value := Community{
		Envelope: Envelope{
			ID: ObjectID("community-fixture"),
			Kind: KindCommunity,
			Namespace: Namespace420Town,
			Version: SchemaVersion,
			CreatedAt: now,
			UpdatedAt: now,
			Visibility: VisibilityPublic,
			Source: "fixture",
		},
		OwnerIdentityID: ObjectID("identity-fixture"),
		Title: "Fixture",
	}
	data, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	var decoded map[string]any
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatal(err)
	}
	for _, key := range []string{"id", "kind", "namespace", "version", "created_at", "updated_at", "visibility", "source"} {
		if _, ok := decoded[key]; !ok {
			t.Fatalf("missing canonical metadata key %s", key)
		}
	}
}

func TestCanonicalVisibilityVocabulary(t *testing.T) {
	values := []Visibility{
		VisibilityPublic, VisibilityUnlisted, VisibilityFollowers, VisibilityCommunityOnly,
		VisibilityPurchasersBackers, VisibilityPrivate, VisibilityOrganizationMember,
		VisibilityModerators, VisibilityAdmins,
	}
	if len(values) != 9 {
		t.Fatal("canonical visibility vocabulary changed")
	}
}

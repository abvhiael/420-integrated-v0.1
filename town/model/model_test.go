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

func TestAuthorityVocabularyMatchesTOWN3(t *testing.T) {
	if MembershipActive != "ACTIVE" || MembershipRemoved != "REMOVED" {
		t.Fatal("membership lifecycle drift")
	}
	if SubscriptionCancelled != "CANCELLED" || SubscriptionExpired != "EXPIRED" {
		t.Fatal("subscription lifecycle drift")
	}
	if EntitlementRevoked != "REVOKED" || EntitlementExpired != "EXPIRED" {
		t.Fatal("entitlement lifecycle drift")
	}
	if RoleAdmin != "ADMIN" || RoleModerator != "MODERATOR" || RoleMember != "MEMBER" {
		t.Fatal("role vocabulary drift")
	}
	permissions := []PermissionID{
		PermissionManageMembers,
		PermissionManageRoles,
		PermissionManageSubscriptions,
		PermissionManageEntitlements,
		PermissionManageTreasury,
	}
	if len(permissions) != 5 {
		t.Fatal("permission vocabulary drift")
	}
}


func TestCanonicalModerationVocabulary(t *testing.T) {
	values := []ModerationActionName{
		ModerationReport, ModerationHide, ModerationBlock, ModerationMute,
		ModerationSuspend, ModerationAppeal, ModerationModeratorDecision,
		ModerationRestore, ModerationLock,
	}
	want := []string{
		"REPORT", "HIDE", "BLOCK", "MUTE", "SUSPEND",
		"APPEAL", "MODERATOR_DECISION", "RESTORE", "LOCK",
	}
	if len(values) != len(want) {
		t.Fatal("canonical moderation vocabulary length drift")
	}
	for i := range values {
		if string(values[i]) != want[i] {
			t.Fatalf("moderation action %d=%s want %s", i, values[i], want[i])
		}
	}
}

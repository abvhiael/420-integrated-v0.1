package subjects

import (
	"context"
	"errors"
	"testing"

	"github.com/420integrated/420-integrated/reputation/model"
)

type fakeIdentity struct {
	profile IdentityProfile
	err     error
}

func (f fakeIdentity) Profile(context.Context, string) (IdentityProfile, error) {
	return f.profile, f.err
}

type fakeRegistry struct {
	record RegistryRecord
	err    error
}

func (f fakeRegistry) Record(context.Context, string, string) (RegistryRecord, error) {
	return f.record, f.err
}

type fakeApplication struct {
	exists bool
	err    error
}

func (f fakeApplication) Exists(context.Context, string) (bool, error) {
	return f.exists, f.err
}

func TestBinderDispatchesGenesisSubjectTypes(t *testing.T) {
	identity, err := NewIdentityAdapter(fakeIdentity{profile: IdentityProfile{
		ID: "profile-1", Controller: "0xabc", Active: true,
	}})
	if err != nil { t.Fatal(err) }

	service, err := NewRegistryAdapter(SubjectService, fakeRegistry{record: RegistryRecord{
		ID: "420/service/media/v1", Kind: SubjectService, Active: true,
	}})
	if err != nil { t.Fatal(err) }

	place, err := NewApplicationAdapter(SubjectPlace, fakeApplication{exists: true})
	if err != nil { t.Fatal(err) }

	binder, err := NewBinder(map[string]Adapter{
		SubjectProfile: identity,
		SubjectService: service,
		SubjectPlace:   place,
	})
	if err != nil { t.Fatal(err) }

	tests := []model.SubjectRef{
		{Type: "profile", ID: "profile-1"},
		{Type: "SERVICE", ID: "420/service/media/v1"},
		{Type: " place ", ID: "place-1"},
	}
	for _, subject := range tests {
		if err := binder.ValidateSubject(context.Background(), subject); err != nil {
			t.Fatalf("subject %+v failed: %v", subject, err)
		}
	}
}

func TestBinderRejectsUnconfiguredAndUnknownTypes(t *testing.T) {
	identity, _ := NewIdentityAdapter(fakeIdentity{profile: IdentityProfile{
		ID: "profile-1", Controller: "0xabc", Active: true,
	}})
	binder, err := NewBinder(map[string]Adapter{SubjectProfile: identity})
	if err != nil { t.Fatal(err) }

	if err := binder.ValidateSubject(context.Background(), model.SubjectRef{Type: SubjectPlace, ID: "place-1"}); !errors.Is(err, ErrUnsupportedSubject) {
		t.Fatalf("expected unsupported unconfigured subject, got %v", err)
	}
	if err := binder.ValidateSubject(context.Background(), model.SubjectRef{Type: "WALLET_BALANCE", ID: "x"}); !errors.Is(err, ErrUnsupportedSubject) {
		t.Fatalf("expected unknown subject rejection, got %v", err)
	}
}

func TestIdentityAdapterRequiresActiveControlledProfile(t *testing.T) {
	tests := []IdentityProfile{
		{},
		{ID: "profile-1", Controller: "", Active: true},
		{ID: "profile-1", Controller: "0xabc", Active: false},
	}
	for _, profile := range tests {
		adapter, err := NewIdentityAdapter(fakeIdentity{profile: profile})
		if err != nil { t.Fatal(err) }
		if err := adapter.Validate(context.Background(), model.SubjectRef{Type: SubjectProfile, ID: "profile-1"}); err == nil {
			t.Fatalf("expected profile rejection: %+v", profile)
		}
	}
}

func TestRegistryAdapterRequiresMatchingActiveCanonicalRecord(t *testing.T) {
	adapter, err := NewRegistryAdapter(SubjectOrganization, fakeRegistry{record: RegistryRecord{
		ID: "org-1", Kind: SubjectOrganization, Active: true,
	}})
	if err != nil { t.Fatal(err) }
	if err := adapter.Validate(context.Background(), model.SubjectRef{Type: SubjectOrganization, ID: "org-1"}); err != nil {
		t.Fatal(err)
	}

	inactive, _ := NewRegistryAdapter(SubjectOrganization, fakeRegistry{record: RegistryRecord{
		ID: "org-1", Kind: SubjectOrganization, Active: false,
	}})
	if err := inactive.Validate(context.Background(), model.SubjectRef{Type: SubjectOrganization, ID: "org-1"}); !errors.Is(err, ErrSubjectInactive) {
		t.Fatalf("expected inactive rejection, got %v", err)
	}
}

func TestApplicationAdapterIsStrictlyScoped(t *testing.T) {
	adapter, err := NewApplicationAdapter(SubjectListing, fakeApplication{exists: true})
	if err != nil { t.Fatal(err) }
	if err := adapter.Validate(context.Background(), model.SubjectRef{Type: SubjectListing, ID: "listing-1"}); err != nil {
		t.Fatal(err)
	}
	if err := adapter.Validate(context.Background(), model.SubjectRef{Type: SubjectCampaign, ID: "listing-1"}); !errors.Is(err, ErrUnsupportedSubject) {
		t.Fatalf("expected cross-kind rejection, got %v", err)
	}
}

func TestSourceErrorsPropagateWithoutInventingAuthority(t *testing.T) {
	want := errors.New("source unavailable")
	adapter, err := NewApplicationAdapter(SubjectCommunity, fakeApplication{err: want})
	if err != nil { t.Fatal(err) }
	if err := adapter.Validate(context.Background(), model.SubjectRef{Type: SubjectCommunity, ID: "community-1"}); !errors.Is(err, want) {
		t.Fatalf("expected source failure propagation, got %v", err)
	}
}

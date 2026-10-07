package storage

import (
	"context"
	"errors"
	"testing"

	"github.com/420integrated/420-integrated/media/authority"
)

type rightsGuardFake struct {
	publicationErr error
	reuseErr       error
	publications   int
	reuses         int
}

func (f *rightsGuardFake) AuthorizePublication(context.Context, authority.Actor, authority.Binding) error {
	f.publications++
	return f.publicationErr
}

func (f *rightsGuardFake) AuthorizeReuse(context.Context, authority.Actor, authority.Binding) error {
	f.reuses++
	return f.reuseErr
}

func TestPublicProjectionRequiresLiveRightsAuthorization(t *testing.T) {
	asset := assetFixture()
	asset.State = StateReady
	asset.Visibility = VisibilityPublic
	guard := &rightsGuardFake{}
	if err := AuthorizePublicProjection(
		context.Background(), guard,
		authority.Actor{Wallet: "0x1111111111111111111111111111111111111111"},
		asset,
		authority.Binding{SubjectID: [32]byte{31: 1}, ProvenanceHash: [32]byte{31: 2}, RightID: [32]byte{31: 3}},
	); err != nil {
		t.Fatal(err)
	}
	if guard.publications != 1 {
		t.Fatalf("publication calls=%d", guard.publications)
	}

	asset.Visibility = VisibilityPrivate
	if err := AuthorizePublicProjection(context.Background(), guard, authority.Actor{}, asset, authority.Binding{}); !errors.Is(err, ErrAccessDenied) {
		t.Fatalf("private err=%v", err)
	}
	if guard.publications != 1 {
		t.Fatalf("private asset reached rights guard")
	}
}

func TestDerivativeReuseRequiresLocalIntegrityThenLiveLicense(t *testing.T) {
	source := assetFixture()
	source.State = StateReady
	derivative := assetFixture()
	derivative.ID = "derivative"
	derivative.DerivativeOf = source.ID
	derivative.ProvenanceRef = "derivative-provenance"

	guard := &rightsGuardFake{}
	if err := ValidateDerivativeReuse(
		context.Background(), guard,
		authority.Actor{Wallet: "0x1111111111111111111111111111111111111111"},
		source, derivative,
		authority.Binding{
			SubjectID: [32]byte{31: 1}, ProvenanceHash: [32]byte{31: 2},
			RightID: [32]byte{31: 3}, LicenseID: [32]byte{31: 4}, ScopeHash: [32]byte{31: 5},
		},
	); err != nil {
		t.Fatal(err)
	}
	if guard.reuses != 1 {
		t.Fatalf("reuse calls=%d", guard.reuses)
	}

	derivative.OwnerRef = "other-owner"
	if err := ValidateDerivativeReuse(context.Background(), guard, authority.Actor{}, source, derivative, authority.Binding{}); !errors.Is(err, ErrInvalidAsset) {
		t.Fatalf("invalid derivative err=%v", err)
	}
	if guard.reuses != 1 {
		t.Fatalf("invalid derivative reached rights guard")
	}
}

func TestRightsGateFailurePropagatesWithoutLocalOverride(t *testing.T) {
	asset := assetFixture()
	asset.State = StateReady
	asset.Visibility = VisibilityPublic
	guard := &rightsGuardFake{publicationErr: authority.ErrRightsNotEffective}
	err := AuthorizePublicProjection(context.Background(), guard, authority.Actor{}, asset, authority.Binding{})
	if !errors.Is(err, authority.ErrRightsNotEffective) {
		t.Fatalf("err=%v", err)
	}
}

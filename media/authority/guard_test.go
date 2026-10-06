package authority

import (
	"context"
	"errors"
	"testing"
)

const walletA = "0x1111111111111111111111111111111111111111"
const walletB = "0x2222222222222222222222222222222222222222"

type identityFake struct {
	profile IdentityProfile
	err     error
	calls   int
}

func (f *identityFake) Profile(context.Context, [32]byte) (IdentityProfile, error) {
	f.calls++
	return f.profile, f.err
}

type rightsFake struct {
	subject RightsSubject
	right   Right
	canUse  bool
	err     error
}

func (f *rightsFake) Subject(context.Context, [32]byte) (RightsSubject, error) {
	return f.subject, f.err
}
func (f *rightsFake) Right(context.Context, [32]byte) (Right, error) {
	return f.right, f.err
}
func (f *rightsFake) CanUse(context.Context, [32]byte, string, [32]byte) (bool, error) {
	return f.canUse, f.err
}

func word(v byte) [32]byte {
	var out [32]byte
	out[31] = v
	return out
}

func TestWalletOnlyActorPreservesOptionalPseudonymousIdentity(t *testing.T) {
	id := &identityFake{profile: IdentityProfile{Controller: walletB, Active: false}}
	g := Guard{Identity: id}
	if err := g.AuthorizeActor(context.Background(), Actor{Wallet: walletA}); err != nil {
		t.Fatal(err)
	}
	if id.calls != 0 {
		t.Fatalf("optional identity unexpectedly queried %d times", id.calls)
	}
}

func TestSuppliedIdentityMustBeActiveAndWalletControlled(t *testing.T) {
	id := &identityFake{profile: IdentityProfile{Controller: walletA, Active: true}}
	g := Guard{Identity: id}
	actor := Actor{Wallet: walletA, ProfileID: word(1)}
	if err := g.AuthorizeActor(context.Background(), actor); err != nil {
		t.Fatal(err)
	}
	id.profile.Controller = walletB
	if err := g.AuthorizeActor(context.Background(), actor); !errors.Is(err, ErrIdentityMismatch) {
		t.Fatalf("controller mismatch err=%v", err)
	}
	id.profile.Controller = walletA
	id.profile.Active = false
	if err := g.AuthorizeActor(context.Background(), actor); !errors.Is(err, ErrIdentityInactive) {
		t.Fatalf("inactive err=%v", err)
	}
}

func TestPublicationRequiresExactCanonicalProvenanceEffectiveRightAndHolder(t *testing.T) {
	binding := Binding{SubjectID: word(1), ProvenanceHash: word(2), RightID: word(3)}
	rights := &rightsFake{
		subject: RightsSubject{Controller: walletA, ProvenanceHash: binding.ProvenanceHash},
		right: Right{SubjectID: binding.SubjectID, Holder: walletA, Effective: true},
	}
	g := Guard{Rights: rights}
	actor := Actor{Wallet: walletA}
	if err := g.AuthorizePublication(context.Background(), actor, binding); err != nil {
		t.Fatal(err)
	}

	rights.subject.ProvenanceHash = word(9)
	if err := g.AuthorizePublication(context.Background(), actor, binding); !errors.Is(err, ErrProvenanceMismatch) {
		t.Fatalf("provenance err=%v", err)
	}
	rights.subject.ProvenanceHash = binding.ProvenanceHash
	rights.right.SubjectID = word(8)
	if err := g.AuthorizePublication(context.Background(), actor, binding); !errors.Is(err, ErrRightsSubject) {
		t.Fatalf("subject err=%v", err)
	}
	rights.right.SubjectID = binding.SubjectID
	rights.right.Effective = false
	if err := g.AuthorizePublication(context.Background(), actor, binding); !errors.Is(err, ErrRightsNotEffective) {
		t.Fatalf("effective err=%v", err)
	}
	rights.right.Effective = true
	rights.right.Holder = walletB
	if err := g.AuthorizePublication(context.Background(), actor, binding); !errors.Is(err, ErrRightsHolder) {
		t.Fatalf("holder err=%v", err)
	}
}

func TestReuseRequiresExactLicenseActorScopeAndLiveRight(t *testing.T) {
	binding := Binding{
		SubjectID: word(1), ProvenanceHash: word(2), RightID: word(3),
		LicenseID: word(4), ScopeHash: word(5),
	}
	rights := &rightsFake{
		subject: RightsSubject{Controller: walletB, ProvenanceHash: binding.ProvenanceHash},
		right: Right{SubjectID: binding.SubjectID, Holder: walletB, Effective: true},
		canUse: true,
	}
	g := Guard{Rights: rights}
	if err := g.AuthorizeReuse(context.Background(), Actor{Wallet: walletA}, binding); err != nil {
		t.Fatal(err)
	}
	rights.canUse = false
	if err := g.AuthorizeReuse(context.Background(), Actor{Wallet: walletA}, binding); !errors.Is(err, ErrLicenseDenied) {
		t.Fatalf("license err=%v", err)
	}
}

func TestMalformedActorsAndBindingsFailClosed(t *testing.T) {
	g := Guard{}
	if err := g.AuthorizeActor(context.Background(), Actor{Wallet: "not-an-address"}); !errors.Is(err, ErrInvalidActor) {
		t.Fatalf("actor err=%v", err)
	}
	if err := g.AuthorizePublication(context.Background(), Actor{Wallet: walletA}, Binding{}); !errors.Is(err, ErrInvalidRights) {
		t.Fatalf("publication err=%v", err)
	}
	if err := g.AuthorizeReuse(context.Background(), Actor{Wallet: walletA}, Binding{}); !errors.Is(err, ErrInvalidRights) {
		t.Fatalf("reuse err=%v", err)
	}
}

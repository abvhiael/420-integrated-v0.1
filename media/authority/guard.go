package authority

import (
	"context"
	"encoding/hex"
	"errors"
	"strings"
)

var (
	ErrInvalidActor       = errors.New("420media authority: invalid actor")
	ErrIdentityInactive   = errors.New("420media authority: identity profile inactive")
	ErrIdentityMismatch   = errors.New("420media authority: identity controller mismatch")
	ErrInvalidRights      = errors.New("420media authority: invalid rights binding")
	ErrRightsNotEffective = errors.New("420media authority: right not effective")
	ErrRightsHolder       = errors.New("420media authority: wallet is not current right holder")
	ErrRightsSubject      = errors.New("420media authority: rights subject mismatch")
	ErrProvenanceMismatch = errors.New("420media authority: provenance mismatch")
	ErrLicenseDenied      = errors.New("420media authority: license does not authorize use")
)

type Actor struct {
	Wallet    string
	ProfileID [32]byte
}

type IdentityProfile struct {
	Controller string
	Active     bool
}

type IdentityReader interface {
	Profile(context.Context, [32]byte) (IdentityProfile, error)
}

type RightsSubject struct {
	Controller     string
	ProvenanceHash [32]byte
}

type Right struct {
	SubjectID [32]byte
	Holder    string
	Effective bool
}

type RightsReader interface {
	Subject(context.Context, [32]byte) (RightsSubject, error)
	Right(context.Context, [32]byte) (Right, error)
	CanUse(context.Context, [32]byte, string, [32]byte) (bool, error)
}

type Binding struct {
	SubjectID      [32]byte
	ProvenanceHash [32]byte
	RightID        [32]byte
	LicenseID      [32]byte
	ScopeHash      [32]byte
}

type Guard struct {
	Identity IdentityReader
	Rights   RightsReader
}

func (g Guard) AuthorizeActor(ctx context.Context, actor Actor) error {
	wallet, ok := normalizeWallet(actor.Wallet)
	if !ok {
		return ErrInvalidActor
	}
	if actor.ProfileID == ([32]byte{}) {
		return nil
	}
	if g.Identity == nil {
		return ErrIdentityMismatch
	}
	profile, err := g.Identity.Profile(ctx, actor.ProfileID)
	if err != nil {
		return err
	}
	controller, ok := normalizeWallet(profile.Controller)
	if !ok || controller != wallet {
		return ErrIdentityMismatch
	}
	if !profile.Active {
		return ErrIdentityInactive
	}
	return nil
}

func (g Guard) AuthorizePublication(ctx context.Context, actor Actor, binding Binding) error {
	if err := g.AuthorizeActor(ctx, actor); err != nil {
		return err
	}
	if g.Rights == nil || !validPublicationBinding(binding) {
		return ErrInvalidRights
	}
	subject, err := g.Rights.Subject(ctx, binding.SubjectID)
	if err != nil {
		return err
	}
	if subject.ProvenanceHash != binding.ProvenanceHash {
		return ErrProvenanceMismatch
	}
	right, err := g.Rights.Right(ctx, binding.RightID)
	if err != nil {
		return err
	}
	if right.SubjectID != binding.SubjectID {
		return ErrRightsSubject
	}
	if !right.Effective {
		return ErrRightsNotEffective
	}
	wallet, _ := normalizeWallet(actor.Wallet)
	holder, ok := normalizeWallet(right.Holder)
	if !ok || holder != wallet {
		return ErrRightsHolder
	}
	return nil
}

func (g Guard) AuthorizeReuse(ctx context.Context, actor Actor, binding Binding) error {
	if err := g.AuthorizeActor(ctx, actor); err != nil {
		return err
	}
	if g.Rights == nil || !validReuseBinding(binding) {
		return ErrInvalidRights
	}
	subject, err := g.Rights.Subject(ctx, binding.SubjectID)
	if err != nil {
		return err
	}
	if subject.ProvenanceHash != binding.ProvenanceHash {
		return ErrProvenanceMismatch
	}
	right, err := g.Rights.Right(ctx, binding.RightID)
	if err != nil {
		return err
	}
	if right.SubjectID != binding.SubjectID {
		return ErrRightsSubject
	}
	if !right.Effective {
		return ErrRightsNotEffective
	}
	allowed, err := g.Rights.CanUse(ctx, binding.LicenseID, actor.Wallet, binding.ScopeHash)
	if err != nil {
		return err
	}
	if !allowed {
		return ErrLicenseDenied
	}
	return nil
}

func validPublicationBinding(b Binding) bool {
	return b.SubjectID != ([32]byte{}) &&
		b.ProvenanceHash != ([32]byte{}) &&
		b.RightID != ([32]byte{}) &&
		b.LicenseID == ([32]byte{})
}

func validReuseBinding(b Binding) bool {
	return b.SubjectID != ([32]byte{}) &&
		b.ProvenanceHash != ([32]byte{}) &&
		b.RightID != ([32]byte{}) &&
		b.LicenseID != ([32]byte{}) &&
		b.ScopeHash != ([32]byte{})
}

func normalizeWallet(v string) (string, bool) {
	v = strings.ToLower(strings.TrimSpace(v))
	if len(v) != 42 || !strings.HasPrefix(v, "0x") {
		return "", false
	}
	if _, err := hex.DecodeString(v[2:]); err != nil {
		return "", false
	}
	if v == "0x0000000000000000000000000000000000000000" {
		return "", false
	}
	return v, true
}

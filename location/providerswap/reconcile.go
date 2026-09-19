package providerswap

import (
	"errors"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/location/model"
	"github.com/420integrated/420-integrated/location/providers"
	"github.com/420integrated/420-integrated/location/repository"
)

var (
	ErrCanonicalPlaceRequired = errors.New("canonical place id is required")
	ErrProviderAliasRequired   = errors.New("provider provenance alias is required")
	ErrCanonicalMismatch       = errors.New("provider alias resolves to a different canonical place")
)

type Store interface {
	Get(string) (model.Place, error)
	Update(model.Place, uint32) (model.Place, error)
	FindByProviderAlias(provider, id string) (model.Place, bool)
}

type Reconciler struct {
	store Store
	now   func() time.Time
}

func New(store Store, now func() time.Time) (*Reconciler, error) {
	if store == nil {
		return nil, errors.New("place store is required")
	}
	if now == nil {
		now = time.Now
	}
	return &Reconciler{store: store, now: now}, nil
}

// AttachProviderAlias records provider-specific identity as an alias on an
// already-existing canonical Place. It never creates or replaces canonical IDs.
func (r *Reconciler) AttachProviderAlias(canonicalPlaceID string, provenance providers.Provenance) (model.Place, error) {
	canonicalPlaceID = strings.TrimSpace(canonicalPlaceID)
	if canonicalPlaceID == "" {
		return model.Place{}, ErrCanonicalPlaceRequired
	}
	providerName := strings.TrimSpace(provenance.Provider)
	providerID := strings.TrimSpace(provenance.ProviderPlaceID)
	if providerName == "" || providerID == "" {
		return model.Place{}, ErrProviderAliasRequired
	}
	if err := provenance.Validate(); err != nil {
		return model.Place{}, err
	}

	if existing, ok := r.store.FindByProviderAlias(providerName, providerID); ok {
		if existing.ID != canonicalPlaceID {
			return model.Place{}, ErrCanonicalMismatch
		}
		return existing, nil
	}

	place, err := r.store.Get(canonicalPlaceID)
	if err != nil {
		return model.Place{}, err
	}

	for _, alias := range place.ProviderAliases {
		if strings.EqualFold(strings.TrimSpace(alias.Provider), providerName) &&
			strings.TrimSpace(alias.ID) == providerID {
			return place, nil
		}
	}

	beforeRegistry := place.RegistryRecordID
	beforeOrg := place.OrganizationID
	beforeOwner := place.Owner
	beforeCreated := place.CreatedAt

	place.ProviderAliases = append(place.ProviderAliases, model.ProviderAlias{
		Provider: providerName,
		ID:       providerID,
	})
	expectedVersion := place.Version
	place.Version++
	updatedAt := r.now().UTC()
	if !updatedAt.After(place.UpdatedAt) {
		updatedAt = place.UpdatedAt.Add(time.Nanosecond)
	}
	place.UpdatedAt = updatedAt

	updated, err := r.store.Update(place, expectedVersion)
	if err != nil {
		if errors.Is(err, repository.ErrAliasCollision) {
			return model.Place{}, ErrCanonicalMismatch
		}
		return model.Place{}, err
	}

	if updated.ID != canonicalPlaceID ||
		updated.RegistryRecordID != beforeRegistry ||
		updated.OrganizationID != beforeOrg ||
		updated.Owner != beforeOwner ||
		!updated.CreatedAt.Equal(beforeCreated) {
		return model.Place{}, errors.New("provider alias reconciliation changed canonical place identity")
	}
	return updated, nil
}

type ReferenceSet struct {
	RegistryRecordID string
	OrganizationID   string
	EventPlaceIDs    []string
	ReviewSubjectIDs []string
}

func CaptureReferences(place model.Place, eventPlaceIDs, reviewSubjectIDs []string) ReferenceSet {
	return ReferenceSet{
		RegistryRecordID: place.RegistryRecordID,
		OrganizationID:   place.OrganizationID,
		EventPlaceIDs:    append([]string(nil), eventPlaceIDs...),
		ReviewSubjectIDs: append([]string(nil), reviewSubjectIDs...),
	}
}

func (r ReferenceSet) ValidateStable(place model.Place) error {
	if r.RegistryRecordID != place.RegistryRecordID {
		return errors.New("registry reference changed during provider swap")
	}
	if r.OrganizationID != place.OrganizationID {
		return errors.New("organization reference changed during provider swap")
	}
	for _, id := range r.EventPlaceIDs {
		if id != place.ID {
			return errors.New("event place reference is not canonical place id")
		}
	}
	for _, id := range r.ReviewSubjectIDs {
		if id != place.ID {
			return errors.New("review subject reference is not canonical place id")
		}
	}
	return nil
}

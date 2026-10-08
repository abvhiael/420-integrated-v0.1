package reeferreview

import (
	"errors"
	"strings"
)

var ErrDurableDependency = errors.New("reefer review: durable publishing dependency not qualified")

func NewDurablePublishingService(base Service, storePath string) (Service, error) {
	if strings.TrimSpace(storePath) == "" {
		return Service{}, ErrDurableDependency
	}
	if err := validateBlobSecurity(base.Blobs); err != nil {
		return Service{}, err
	}
	if _, ok := base.Rights.(RightsProvenanceProvider); !ok {
		return Service{}, ErrRightsProvenance
	}
	store, err := OpenDurableStore(storePath)
	if err != nil {
		return Service{}, err
	}
	base.Store = store
	if err := base.validate(); err != nil {
		return Service{}, err
	}
	return base, nil
}

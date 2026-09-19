package registry

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/location/model"
)

var (
	ErrRegistryRecordRequired = errors.New("registry record id is required")
	ErrRegistryRecordNotFound = errors.New("registry record not found")
	ErrRegistryRecordMismatch = errors.New("registry record does not match place")
	ErrRegistryInactive       = errors.New("registry record is inactive")
)

type Record struct {
	ID             string
	Kind           string
	OrganizationID string
	Active         bool
	MetadataURI    string
	Source         string
	Version        uint32
	ObservedAt     time.Time
}

type Reader interface {
	Ready(context.Context) error
	Record(context.Context, string) (Record, error)
}

type Binding struct {
	RegistryRecordID string
	OrganizationID   string
	Active           bool
	MetadataURI      string
	Source           string
	Version          uint32
	ObservedAt       time.Time
}

type PlaceProjection struct {
	Place    model.Place
	Registry Binding
}

type Adapter struct {
	reader Reader
}

func New(reader Reader) (*Adapter, error) {
	if reader == nil {
		return nil, errors.New("420Registry reader is required")
	}
	return &Adapter{reader: reader}, nil
}

func (a *Adapter) Ready(ctx context.Context) error {
	return a.reader.Ready(ctx)
}

// Resolve is deliberately read-only. Registry remains the canonical owner of
// Registry state; 420Location only validates and projects that state.
func (a *Adapter) Resolve(ctx context.Context, place model.Place) (PlaceProjection, error) {
	if err := place.Validate(); err != nil {
		return PlaceProjection{}, err
	}
	recordID := strings.TrimSpace(place.RegistryRecordID)
	if recordID == "" {
		return PlaceProjection{}, ErrRegistryRecordRequired
	}

	record, err := a.reader.Record(ctx, recordID)
	if err != nil {
		return PlaceProjection{}, err
	}
	if strings.TrimSpace(record.ID) == "" {
		return PlaceProjection{}, ErrRegistryRecordNotFound
	}
	if !strings.EqualFold(strings.TrimSpace(record.ID), recordID) {
		return PlaceProjection{}, ErrRegistryRecordMismatch
	}
	if strings.TrimSpace(record.OrganizationID) != "" &&
		strings.TrimSpace(place.OrganizationID) != "" &&
		!strings.EqualFold(strings.TrimSpace(record.OrganizationID), strings.TrimSpace(place.OrganizationID)) {
		return PlaceProjection{}, ErrRegistryRecordMismatch
	}

	binding := Binding{
		RegistryRecordID: record.ID,
		OrganizationID:   record.OrganizationID,
		Active:           record.Active,
		MetadataURI:      record.MetadataURI,
		Source:           record.Source,
		Version:          record.Version,
		ObservedAt:       record.ObservedAt,
	}

	return PlaceProjection{
		Place:    model.ClonePlace(place),
		Registry: binding,
	}, nil
}

func (a *Adapter) RequireActive(ctx context.Context, place model.Place) (PlaceProjection, error) {
	projection, err := a.Resolve(ctx, place)
	if err != nil {
		return PlaceProjection{}, err
	}
	if !projection.Registry.Active {
		return PlaceProjection{}, ErrRegistryInactive
	}
	return projection, nil
}

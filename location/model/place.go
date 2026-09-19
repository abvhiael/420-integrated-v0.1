package model

import (
	"errors"
	"math"
	"strings"
	"time"
)

type Visibility string

const (
	VisibilityPublic   Visibility = "PUBLIC"
	VisibilityUnlisted Visibility = "UNLISTED"
	VisibilityPrivate  Visibility = "PRIVATE"
)

type ProviderAlias struct {
	Provider string
	ID       string
}

type Place struct {
	ID                  string
	Name                string
	Category            Category
	Visibility          Visibility
	Precision           PlacePrecision
	Source              string
	Owner               SubjectRef
	OrganizationID      string
	RegistryRecordID    string
	Address             string
	Country             string
	Region              string
	City                string
	PostalRegion        string
	Latitude            *float64
	Longitude           *float64
	ServiceRadiusMeters uint64
	HoursRef            string
	ContactRef          string
	MetadataURI         string
	ProviderAliases     []ProviderAlias
	Version             uint32
	CreatedAt           time.Time
	UpdatedAt           time.Time
}

func (p Place) Validate() error {
	if strings.TrimSpace(p.ID) == "" {
		return errors.New("place id is required")
	}
	if strings.TrimSpace(p.Name) == "" {
		return errors.New("place name is required")
	}
	if !ValidCategory(p.Category) {
		return errors.New("place category is invalid")
	}
	switch p.Visibility {
	case VisibilityPublic, VisibilityUnlisted, VisibilityPrivate:
	default:
		return errors.New("place visibility is invalid")
	}
	switch p.Precision {
	case PrecisionExactPublic, PrecisionApproximate, PrecisionPrivate:
	default:
		return errors.New("place precision is invalid")
	}
	if strings.TrimSpace(p.Source) == "" {
		return errors.New("place source is required")
	}
	if err := p.Owner.Validate(); err != nil {
		return err
	}
	if (p.Latitude == nil) != (p.Longitude == nil) {
		return errors.New("place latitude and longitude must be provided together")
	}
	if p.Latitude != nil {
		if math.IsNaN(*p.Latitude) || math.IsInf(*p.Latitude, 0) || *p.Latitude < -90 || *p.Latitude > 90 {
			return errors.New("place latitude is invalid")
		}
		if math.IsNaN(*p.Longitude) || math.IsInf(*p.Longitude, 0) || *p.Longitude < -180 || *p.Longitude > 180 {
			return errors.New("place longitude is invalid")
		}
	}
	if p.Precision == PrecisionExactPublic && p.Visibility != VisibilityPublic {
		return errors.New("exact public place precision requires public visibility")
	}
	if p.Precision == PrecisionExactPublic && p.Latitude == nil {
		return errors.New("exact public place requires coordinates")
	}
	if p.Precision == PrecisionPrivate && p.Visibility == VisibilityPublic {
		return errors.New("private place precision cannot be public")
	}
	seen := map[string]struct{}{}
	for _, alias := range p.ProviderAliases {
		provider := strings.ToLower(strings.TrimSpace(alias.Provider))
		id := strings.TrimSpace(alias.ID)
		if provider == "" || id == "" {
			return errors.New("provider alias requires provider and id")
		}
		key := provider + "\x00" + id
		if _, ok := seen[key]; ok {
			return errors.New("duplicate provider alias")
		}
		seen[key] = struct{}{}
	}
	if p.Version == 0 {
		return errors.New("place version is required")
	}
	if p.CreatedAt.IsZero() || p.UpdatedAt.IsZero() {
		return errors.New("place timestamps are required")
	}
	if p.UpdatedAt.Before(p.CreatedAt) {
		return errors.New("place updated time cannot precede created time")
	}
	return nil
}

func ClonePlace(in Place) Place {
	out := in
	out.ProviderAliases = append([]ProviderAlias(nil), in.ProviderAliases...)
	if in.Latitude != nil {
		v := *in.Latitude
		out.Latitude = &v
	}
	if in.Longitude != nil {
		v := *in.Longitude
		out.Longitude = &v
	}
	return out
}

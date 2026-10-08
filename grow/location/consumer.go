// Package grow provides a non-authoritative, read-only 420Grow projection
// of the canonical GEN-SVC-2 public Place SDK. It never queries private stores.
package grow

import (
	"context"
	"errors"
	"math"
	"strings"

	"github.com/420integrated/420-integrated/genesis/svc2/sdk"
	"github.com/420integrated/420-integrated/location/model"
	"github.com/420integrated/420-integrated/location/uikit"
)

var ErrInvalidProjection = errors.New("invalid public 420Location projection")
var ErrUnavailable = errors.New("public 420Location service unavailable")

// PublicReader is satisfied by sdk.Client, preserving versioned HTTP access.
type PublicReader interface {
	Places(context.Context) (uikit.View, error)
}

// Card exposes only already-public, precision-constrained place presentation.
// Source and optional Registry record ID are upstream provenance references.
// They never assert that Grow has verified a business or owns the record.
type Card struct {
	ID        string         `json:"id"`
	Name      string         `json:"name"`
	Category  model.Category `json:"category"`
	Source    string         `json:"source"`
	RegistryRecordID string `json:"registryRecordId,omitempty"`
	Kind      uikit.Kind     `json:"kind"`
	Latitude  *float64       `json:"latitude,omitempty"`
	Longitude *float64       `json:"longitude,omitempty"`
	Region    string         `json:"region,omitempty"`
	City      string         `json:"city,omitempty"`
	Country   string         `json:"country,omitempty"`
}
type View struct {
	Items               []Card `json:"items"`
	Empty               bool   `json:"empty"`
	ProvenanceAvailable bool   `json:"provenanceAvailable"`
}

// Read returns no results on any upstream failure or invalid record. In
// particular unknown categories, duplicate IDs, invalid coordinates and
// approximate-area coordinates are rejected rather than partially rendered.
func Read(ctx context.Context, reader PublicReader) (View, error) {
	if reader == nil {
		return View{}, ErrUnavailable
	}
	upstream, err := reader.Places(ctx)
	if err != nil {
		return View{}, ErrUnavailable
	} // do not forward upstream secrets/errors
	if len(upstream.Items) > uikit.MaxMapItems || upstream.Empty != (len(upstream.Items) == 0) {
		return View{}, ErrInvalidProjection
	}
	seen := make(map[string]struct{}, len(upstream.Items))
	result := View{Items: make([]Card, 0), Empty: true, ProvenanceAvailable: true}
	for _, item := range upstream.Items {
		if strings.TrimSpace(item.ID) == "" || strings.TrimSpace(item.Name) == "" || strings.TrimSpace(item.Source) == "" {
			return View{}, ErrInvalidProjection
		}
		if _, ok := seen[item.ID]; ok {
			return View{}, ErrInvalidProjection
		}
		seen[item.ID] = struct{}{}
		// Validate ALL upstream items, not just FARM/BUSINESS. No invalid record can
		// be silently filtered away as if the upstream projection were trustworthy.
		if !model.ValidCategory(item.Category) {
			return View{}, ErrInvalidProjection
		}
		switch item.Kind {
		case uikit.KindArea:
			if item.Latitude != nil || item.Longitude != nil {
				return View{}, ErrInvalidProjection
			}
			if strings.TrimSpace(item.Region) == "" && strings.TrimSpace(item.City) == "" && strings.TrimSpace(item.Country) == "" {
				return View{}, ErrInvalidProjection
			}
		case uikit.KindPin:
			if item.Latitude == nil || item.Longitude == nil {
				return View{}, ErrInvalidProjection
			}
			lat, lon := *item.Latitude, *item.Longitude
			if math.IsNaN(lat) || math.IsInf(lat, 0) || math.IsNaN(lon) || math.IsInf(lon, 0) || lat < -90 || lat > 90 || lon < -180 || lon > 180 {
				return View{}, ErrInvalidProjection
			}
		default:
			return View{}, ErrInvalidProjection
		}
		if item.Category != model.CategoryFarm && item.Category != model.CategoryBusiness {
			continue
		}
		card := Card{ID: item.ID, Name: item.Name, Category: item.Category, Source: item.Source, RegistryRecordID: item.RegistryRecordID, Kind: item.Kind, Region: item.Region, City: item.City, Country: item.Country}
		if item.Kind == uikit.KindPin {
			lat, lon := *item.Latitude, *item.Longitude
			card.Latitude = &lat
			card.Longitude = &lon
		}
		result.Items = append(result.Items, card)
	}
	result.Empty = len(result.Items) == 0
	return result, nil
}

// Compile-time guard for the real SDK dependency.
var _ PublicReader = sdk.Client{}

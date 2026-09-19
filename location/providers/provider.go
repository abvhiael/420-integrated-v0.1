package providers

import (
	"context"
	"errors"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/location/geo"
)

type Capability string

const (
	CapabilityGeocode        Capability = "GEOCODE"
	CapabilityReverseGeocode Capability = "REVERSE_GEOCODE"
	CapabilityMapTiles       Capability = "MAP_TILES"
	CapabilityRouting        Capability = "ROUTING"
	CapabilityPlaceLookup    Capability = "PLACE_LOOKUP"
)

var GenesisCapabilities = []Capability{
	CapabilityGeocode,
	CapabilityReverseGeocode,
	CapabilityMapTiles,
	CapabilityRouting,
	CapabilityPlaceLookup,
}

type Provenance struct {
	Provider          string
	ProviderRequestID string
	ProviderPlaceID   string
	RetrievedAt       time.Time
	Confidence        float64
	Attribution       string
}

func (p Provenance) Validate() error {
	if strings.TrimSpace(p.Provider) == "" {
		return errors.New("provider provenance requires provider")
	}
	if p.RetrievedAt.IsZero() {
		return errors.New("provider provenance requires retrieved time")
	}
	if p.Confidence < 0 || p.Confidence > 1 {
		return errors.New("provider confidence must be between 0 and 1")
	}
	return nil
}

type AddressQuery struct {
	Address string
	Country string
	Region  string
	City    string
}

func (q AddressQuery) Validate() error {
	if strings.TrimSpace(q.Address) == "" &&
		strings.TrimSpace(q.Country) == "" &&
		strings.TrimSpace(q.Region) == "" &&
		strings.TrimSpace(q.City) == "" {
		return errors.New("geocode query requires address or region context")
	}
	return nil
}

type CoordinateQuery struct {
	Latitude  float64
	Longitude float64
}

type PlaceCandidate struct {
	Name         string
	Address      string
	Country      string
	Region       string
	City         string
	PostalRegion string
	Latitude     float64
	Longitude    float64
	Provenance   Provenance
}

type PlaceLookupQuery struct {
	Name       string
	ExternalID string
	Latitude   *float64
	Longitude  *float64
}

type TileRequest struct {
	Z uint32
	X uint32
	Y uint32
}

type Tile struct {
	ContentType string
	Data        []byte
	Provenance  Provenance
}

type RouteRequest struct {
	Origin      geo.RoutePoint
	Destination geo.RoutePoint
	Waypoints   []geo.RoutePoint
}

type Geocoder interface {
	Ready(context.Context) error
	Geocode(context.Context, AddressQuery) ([]PlaceCandidate, error)
}

type ReverseGeocoder interface {
	Ready(context.Context) error
	ReverseGeocode(context.Context, CoordinateQuery) ([]PlaceCandidate, error)
}

type Router interface {
	Ready(context.Context) error
	Route(context.Context, RouteRequest) (geo.Route, Provenance, error)
}

type TileProvider interface {
	Ready(context.Context) error
	Tile(context.Context, TileRequest) (Tile, error)
}

type PlaceLookup interface {
	Ready(context.Context) error
	Lookup(context.Context, PlaceLookupQuery) ([]PlaceCandidate, error)
}

type Provider interface {
	Geocoder
	ReverseGeocoder
	Router
	TileProvider
	PlaceLookup
	Name() string
	Capabilities() []Capability
}

type ErrorKind string

const (
	ErrorUnavailable         ErrorKind = "PROVIDER_UNAVAILABLE"
	ErrorQuotaExceeded       ErrorKind = "QUOTA_EXCEEDED"
	ErrorNoResult            ErrorKind = "NO_RESULT"
	ErrorMalformedResult     ErrorKind = "MALFORMED_RESULT"
	ErrorAmbiguousResult     ErrorKind = "AMBIGUOUS_RESULT"
	ErrorInvalidQuery        ErrorKind = "INVALID_QUERY"
	ErrorUnsupported         ErrorKind = "UNSUPPORTED_CAPABILITY"
	ErrorTemporaryUpstream   ErrorKind = "TEMPORARY_UPSTREAM_FAILURE"
)

type ProviderError struct {
	Kind     ErrorKind
	Provider string
	Message  string
}

func (e *ProviderError) Error() string {
	if e == nil {
		return ""
	}
	if strings.TrimSpace(e.Provider) == "" {
		return string(e.Kind) + ": " + e.Message
	}
	return e.Provider + ": " + string(e.Kind) + ": " + e.Message
}

func HasCapability(capabilities []Capability, want Capability) bool {
	for _, capability := range capabilities {
		if capability == want {
			return true
		}
	}
	return false
}

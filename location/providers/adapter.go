package providers

import (
	"context"
	"errors"
	"strings"

	"github.com/420integrated/420-integrated/location/geo"
)

type Adapter struct {
	provider Provider
}

func NewAdapter(provider Provider) (*Adapter, error) {
	if provider == nil {
		return nil, errors.New("map provider is required")
	}
	if strings.TrimSpace(provider.Name()) == "" {
		return nil, errors.New("map provider name is required")
	}
	caps := provider.Capabilities()
	for _, required := range GenesisCapabilities {
		if !HasCapability(caps, required) {
			return nil, errors.New("map provider missing required capability: " + string(required))
		}
	}
	return &Adapter{provider: provider}, nil
}

func (a *Adapter) Ready(ctx context.Context) error {
	return a.provider.Ready(ctx)
}

func (a *Adapter) ProviderName() string {
	return a.provider.Name()
}

func (a *Adapter) Geocode(ctx context.Context, query AddressQuery) ([]PlaceCandidate, error) {
	if err := query.Validate(); err != nil {
		return nil, &ProviderError{Kind: ErrorInvalidQuery, Provider: a.provider.Name(), Message: err.Error()}
	}
	out, err := a.provider.Geocode(ctx, query)
	if err != nil {
		return nil, err
	}
	return validateCandidates(a.provider.Name(), out)
}

func (a *Adapter) ReverseGeocode(ctx context.Context, query CoordinateQuery) ([]PlaceCandidate, error) {
	out, err := a.provider.ReverseGeocode(ctx, query)
	if err != nil {
		return nil, err
	}
	return validateCandidates(a.provider.Name(), out)
}

func (a *Adapter) Lookup(ctx context.Context, query PlaceLookupQuery) ([]PlaceCandidate, error) {
	out, err := a.provider.Lookup(ctx, query)
	if err != nil {
		return nil, err
	}
	return validateCandidates(a.provider.Name(), out)
}

func (a *Adapter) Route(ctx context.Context, req RouteRequest) (geo.Route, Provenance, error) {
	r, p, err := a.provider.Route(ctx, req)
	if err != nil {
		return geo.Route{}, Provenance{}, err
	}
	if err := r.Validate(); err != nil {
		return geo.Route{}, Provenance{}, &ProviderError{Kind: ErrorMalformedResult, Provider: a.provider.Name(), Message: err.Error()}
	}
	if err := p.Validate(); err != nil {
		return geo.Route{}, Provenance{}, &ProviderError{Kind: ErrorMalformedResult, Provider: a.provider.Name(), Message: err.Error()}
	}
	return r, p, nil
}

func (a *Adapter) Tile(ctx context.Context, req TileRequest) (Tile, error) {
	tile, err := a.provider.Tile(ctx, req)
	if err != nil {
		return Tile{}, err
	}
	if strings.TrimSpace(tile.ContentType) == "" || len(tile.Data) == 0 {
		return Tile{}, &ProviderError{Kind: ErrorMalformedResult, Provider: a.provider.Name(), Message: "tile payload is incomplete"}
	}
	if err := tile.Provenance.Validate(); err != nil {
		return Tile{}, &ProviderError{Kind: ErrorMalformedResult, Provider: a.provider.Name(), Message: err.Error()}
	}
	return tile, nil
}

func validateCandidates(provider string, candidates []PlaceCandidate) ([]PlaceCandidate, error) {
	for _, candidate := range candidates {
		if strings.TrimSpace(candidate.Name) == "" {
			return nil, &ProviderError{Kind: ErrorMalformedResult, Provider: provider, Message: "candidate name is required"}
		}
		if err := candidate.Provenance.Validate(); err != nil {
			return nil, &ProviderError{Kind: ErrorMalformedResult, Provider: provider, Message: err.Error()}
		}
	}
	return append([]PlaceCandidate(nil), candidates...), nil
}

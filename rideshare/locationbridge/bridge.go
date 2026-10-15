// Package locationbridge consumes the canonical provider adapter without owning
// map, geographic or passenger-transport authority. Approved gateways sign output.
package locationbridge

import (
	"context"
	"errors"
	"math"

	"github.com/420integrated/420-integrated/location/geo"
	"github.com/420integrated/420-integrated/location/providers"
)

type Endpoint struct {
	Latitude float64 `json:"latitude"`
	Longitude float64 `json:"longitude"`
	Precision string `json:"precision"`
}

type Request struct {
	Nonce string `json:"nonce"`
	RouteRef string `json:"routeRef"`
	RiderID string `json:"riderId"`
	PointsDigest string `json:"pointsDigest"`
	Origin Endpoint `json:"origin"`
	Destination Endpoint `json:"destination"`
	PassengerCount uint32 `json:"passengerCount"`
}

type Scope struct {
	Ref string
	Revision uint64
	Country string
	Region string
	Municipality string
	Airport bool
	CrossBoundary bool
}

type ScopeResolver interface {
	Resolve(context.Context, geo.Route) (Scope, error)
}

type Projection struct {
	Nonce string `json:"nonce"`
	RouteRef string `json:"routeRef"`
	PointsDigest string `json:"pointsDigest"`
	Provider string `json:"provider"`
	ProvenanceRef string `json:"provenanceRef"`
	Revision uint64 `json:"revision"`
	DistanceMeters uint64 `json:"distanceMeters"`
	DurationSeconds uint64 `json:"durationSeconds"`
	Country string `json:"country"`
	Region string `json:"region"`
	Municipality string `json:"municipality"`
	Service string `json:"service"`
	Airport bool `json:"airport"`
	CrossBoundary bool `json:"crossBoundary"`
	Available bool `json:"available"`
	Ambiguous bool `json:"ambiguous"`
}

type Bridge struct {
	adapter *providers.Adapter
	scope ScopeResolver
}

func New(adapter *providers.Adapter, scope ScopeResolver) (*Bridge, error) {
	if adapter == nil || scope == nil {
		return nil, errors.New("approved Location adapter and scope resolver required")
	}
	return &Bridge{adapter: adapter, scope: scope}, nil
}

func validEndpoint(point Endpoint) bool {
	if math.IsNaN(point.Latitude) || math.IsInf(point.Latitude, 0) || math.IsNaN(point.Longitude) || math.IsInf(point.Longitude, 0) || math.Abs(point.Latitude) > 90 || math.Abs(point.Longitude) > 180 {
		return false
	}
	if point.Precision == "exact" {
		return true
	}
	return point.Precision == "approximate" && math.Abs(point.Latitude*100-math.Round(point.Latitude*100)) < 1e-8 && math.Abs(point.Longitude*100-math.Round(point.Longitude*100)) < 1e-8
}

func (b *Bridge) Project(ctx context.Context, request Request) (Projection, error) {
	if request.Nonce == "" || request.RouteRef == "" || request.RiderID == "" || len(request.PointsDigest) != 64 || request.PassengerCount == 0 || request.PassengerCount > 32 || !validEndpoint(request.Origin) || !validEndpoint(request.Destination) {
		return Projection{}, errors.New("invalid bounded private route request")
	}
	route, provenance, err := b.adapter.Route(ctx, providers.RouteRequest{
		Origin: geo.RoutePoint{Latitude: request.Origin.Latitude, Longitude: request.Origin.Longitude},
		Destination: geo.RoutePoint{Latitude: request.Destination.Latitude, Longitude: request.Destination.Longitude},
	})
	if err != nil {
		return Projection{}, errors.New("Location route unavailable")
	}
	scope, err := b.scope.Resolve(ctx, route)
	if err != nil || scope.Ref == "" || scope.Country != "CA" || scope.Region != "BC" || scope.Municipality != "Vancouver" || scope.Airport || scope.CrossBoundary || route.DistanceMeters > 100000000 || route.DurationSeconds > 604800 {
		return Projection{}, errors.New("Location scope unavailable or outside launch market")
	}
	return Projection{Nonce: request.Nonce, RouteRef: request.RouteRef, PointsDigest: request.PointsDigest,
		Provider: provenance.Provider, ProvenanceRef: scope.Ref, Revision: scope.Revision,
		DistanceMeters: uint64(math.Ceil(route.DistanceMeters)), DurationSeconds: route.DurationSeconds,
		Country: scope.Country, Region: scope.Region, Municipality: scope.Municipality,
		Service: "liftd-passenger", Airport: false, CrossBoundary: false, Available: true, Ambiguous: false}, nil
}

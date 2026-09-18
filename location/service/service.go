package service

import (
	"context"
	"errors"

	"github.com/420integrated/420-integrated/location/model"
)

type PlaceRepository interface {
	Ready(context.Context) error
}

type GeoIndex interface {
	Ready(context.Context) error
}

type MapProvider interface {
	Ready(context.Context) error
}

type RegistryReader interface {
	Ready(context.Context) error
}

type VerifyReader interface {
	Ready(context.Context) error
}

type VisibilityPolicy interface {
	Ready(context.Context) error
}

type SubjectAuthorizer interface {
	Ready(context.Context) error
}

type Dependencies struct {
	Places      PlaceRepository
	Geo         GeoIndex
	Provider    MapProvider
	Registry    RegistryReader
	Verify      VerifyReader
	Visibility  VisibilityPolicy
	Authorizer  SubjectAuthorizer
}

type Service struct {
	places     PlaceRepository
	geo        GeoIndex
	provider   MapProvider
	registry   RegistryReader
	verify     VerifyReader
	visibility VisibilityPolicy
	authorizer SubjectAuthorizer
}

func New(deps Dependencies) (*Service, error) {
	switch {
	case deps.Places == nil:
		return nil, errors.New("420Location requires place repository")
	case deps.Geo == nil:
		return nil, errors.New("420Location requires geospatial index")
	case deps.Provider == nil:
		return nil, errors.New("420Location requires map provider")
	case deps.Registry == nil:
		return nil, errors.New("420Location requires Registry reader")
	case deps.Verify == nil:
		return nil, errors.New("420Location requires Verify reader")
	case deps.Visibility == nil:
		return nil, errors.New("420Location requires visibility policy")
	case deps.Authorizer == nil:
		return nil, errors.New("420Location requires subject authorizer")
	}
	return &Service{
		places:deps.Places,
		geo:deps.Geo,
		provider:deps.Provider,
		registry:deps.Registry,
		verify:deps.Verify,
		visibility:deps.Visibility,
		authorizer:deps.Authorizer,
	},nil
}

func (s *Service) ServiceID() string { return model.ServiceID }
func (s *Service) APIVersion() string { return model.APIVersion }
func (s *Service) Boundary() model.ServiceBoundary { return model.GenesisBoundary() }

func (s *Service) QueryCapabilities() []model.QueryCapability {
	out:=make([]model.QueryCapability,len(model.GenesisQueryCapabilities))
	copy(out,model.GenesisQueryCapabilities)
	return out
}

func (s *Service) Ready(ctx context.Context) error {
	checks:=[]struct{
		name string
		fn func(context.Context) error
	}{
		{"place repository",s.places.Ready},
		{"geospatial index",s.geo.Ready},
		{"map provider",s.provider.Ready},
		{"Registry reader",s.registry.Ready},
		{"Verify reader",s.verify.Ready},
		{"visibility policy",s.visibility.Ready},
		{"subject authorizer",s.authorizer.Ready},
	}
	for _,check:=range checks {
		if err:=check.fn(ctx); err!=nil {
			return errors.New("420Location dependency not ready: "+check.name+": "+err.Error())
		}
	}
	return nil
}

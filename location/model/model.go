package model

import (
	"errors"
	"strings"
)

const (
	ServiceID  = "420/service/location/v1"
	APIVersion = "v1"
)

type QueryCapability string

const (
	QueryNearPoint    QueryCapability = "NEAR_POINT"
	QueryWithinRadius QueryCapability = "WITHIN_RADIUS"
	QueryWithinRegion QueryCapability = "WITHIN_REGION"
	QueryBoundingBox  QueryCapability = "BOUNDING_BOX"
	QueryNearRoute    QueryCapability = "NEAR_ROUTE"
	QueryByCategory   QueryCapability = "BY_CATEGORY"
)

var GenesisQueryCapabilities = []QueryCapability{
	QueryNearPoint,
	QueryWithinRadius,
	QueryWithinRegion,
	QueryBoundingBox,
	QueryNearRoute,
	QueryByCategory,
}

func ValidQueryCapability(value QueryCapability) bool {
	for _, candidate := range GenesisQueryCapabilities {
		if value == candidate {
			return true
		}
	}
	return false
}

type Precision string

const (
	PrecisionExactPublic PlacePrecision = "EXACT_PUBLIC_PLACE"
	PrecisionApproximate PlacePrecision = "APPROXIMATE_AREA"
	PrecisionPrivate     PlacePrecision = "PRIVATE"
)

type PlacePrecision = Precision

type Category string

const (
	CategoryBusiness        Category = "BUSINESS"
	CategoryVenue           Category = "VENUE"
	CategoryAttraction      Category = "ATTRACTION"
	CategoryDispensary      Category = "DISPENSARY"
	CategoryHotel           Category = "HOTEL"
	CategoryRental          Category = "RENTAL"
	CategoryRestaurant      Category = "RESTAURANT"
	CategoryFarm            Category = "FARM"
	CategoryEventLocation   Category = "EVENT_LOCATION"
	CategoryServiceProvider Category = "SERVICE_PROVIDER"
	CategoryOther           Category = "OTHER"
)

var GenesisCategories = []Category{
	CategoryBusiness,
	CategoryVenue,
	CategoryAttraction,
	CategoryDispensary,
	CategoryHotel,
	CategoryRental,
	CategoryRestaurant,
	CategoryFarm,
	CategoryEventLocation,
	CategoryServiceProvider,
	CategoryOther,
}

func ValidCategory(value Category) bool {
	for _, candidate := range GenesisCategories {
		if value == candidate {
			return true
		}
	}
	return false
}

type SubjectRef struct {
	Type string
	ID   string
}

func (s SubjectRef) Validate() error {
	if strings.TrimSpace(s.Type) == "" {
		return errors.New("location subject type is required")
	}
	if strings.TrimSpace(s.ID) == "" {
		return errors.New("location subject id is required")
	}
	return nil
}

type ServiceBoundary struct {
	CanonicalGeographicAuthority bool
	RegistryAuthority            bool
	IdentityAuthority            bool
	PaymentAuthority             bool
	BookingAuthority             bool
	ProviderOutputCanonical      bool
	GeospatialIndexRebuildable   bool
	PublicSearchCanIncreasePrecision bool
	PrivateCoordinatesPublicByDefault bool
}

func GenesisBoundary() ServiceBoundary {
	return ServiceBoundary{
		CanonicalGeographicAuthority: false,
		RegistryAuthority: false,
		IdentityAuthority: false,
		PaymentAuthority: false,
		BookingAuthority: false,
		ProviderOutputCanonical: false,
		GeospatialIndexRebuildable: true,
		PublicSearchCanIncreasePrecision: false,
		PrivateCoordinatesPublicByDefault: false,
	}
}

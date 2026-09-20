package privacy

import (
	"errors"
	"strings"

	"github.com/420integrated/420-integrated/location/model"
)

var (
	ErrNotPublic        = errors.New("place is not publicly discoverable")
	ErrPrecisionDenied  = errors.New("requested operation exceeds allowed location precision")
	ErrPrivateOperation = errors.New("operation is not permitted for private location data")
)

type PublicPlace struct {
	ID               string
	Name             string
	Category         model.Category
	Precision        model.PlacePrecision
	Country          string
	Region           string
	City             string
	PostalRegion     string
	Latitude         *float64
	Longitude        *float64
	RegistryRecordID string
	OrganizationID   string
}

type Policy struct{}

func New() Policy { return Policy{} }

func (Policy) PublicProjection(place model.Place) (PublicPlace, error) {
	if err := place.Validate(); err != nil {
		return PublicPlace{}, err
	}
	if place.Visibility != model.VisibilityPublic || place.Precision == model.PrecisionPrivate {
		return PublicPlace{}, ErrNotPublic
	}

	out := PublicPlace{
		ID:               place.ID,
		Name:             place.Name,
		Category:         place.Category,
		Precision:        place.Precision,
		Country:          place.Country,
		Region:           place.Region,
		City:             place.City,
		PostalRegion:     place.PostalRegion,
		RegistryRecordID: place.RegistryRecordID,
		OrganizationID:   place.OrganizationID,
	}

	if place.Precision == model.PrecisionExactPublic {
		if place.Latitude == nil || place.Longitude == nil {
			return PublicPlace{}, ErrPrecisionDenied
		}
		lat, lon := *place.Latitude, *place.Longitude
		out.Latitude = &lat
		out.Longitude = &lon
	}
	return out, nil
}

func (Policy) CanUseExactCoordinates(place model.Place) bool {
	return place.Visibility == model.VisibilityPublic &&
		place.Precision == model.PrecisionExactPublic &&
		place.Latitude != nil &&
		place.Longitude != nil
}

func (Policy) CanReverseGeocode(place model.Place) bool {
	return (Policy{}).CanUseExactCoordinates(place)
}

func (Policy) CanPublicProximitySearch(place model.Place) bool {
	return (Policy{}).CanUseExactCoordinates(place)
}

func (Policy) RedactError(err error, place *model.Place) error {
	if err == nil {
		return nil
	}
	if place == nil || (Policy{}).CanUseExactCoordinates(*place) {
		return err
	}
	msg := strings.ToLower(err.Error())
	if strings.Contains(msg, "latitude") ||
		strings.Contains(msg, "longitude") ||
		strings.Contains(msg, "coordinate") ||
		strings.Contains(msg, "address") {
		return ErrPrivateOperation
	}
	return err
}

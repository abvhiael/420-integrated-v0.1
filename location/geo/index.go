package geo

import (
	"context"
	"errors"
	"math"
	"sort"
	"strings"
	"sync"

	"github.com/420integrated/420-integrated/location/model"
)

const earthRadiusMeters = 6371000.0

type Document struct {
	PlaceID       string
	Name          string
	Category      model.Category
	Visibility    model.Visibility
	Precision     model.PlacePrecision
	Country       string
	Region        string
	City          string
	PostalRegion  string
	Latitude      *float64
	Longitude     *float64
}

type Result struct {
	Document
	DistanceMeters float64
}

type Index struct {
	mu    sync.RWMutex
	items map[string]Document
}

func NewIndex() *Index {
	return &Index{items: map[string]Document{}}
}

func (i *Index) Ready(context.Context) error {
	if i == nil {
		return errors.New("geospatial index is nil")
	}
	return nil
}

func (i *Index) Replace(place model.Place) error {
	doc, ok, err := project(place)
	if err != nil {
		return err
	}
	i.mu.Lock()
	defer i.mu.Unlock()
	if !ok {
		delete(i.items, place.ID)
		return nil
	}
	i.items[place.ID] = doc
	return nil
}

func (i *Index) Remove(placeID string) {
	i.mu.Lock()
	defer i.mu.Unlock()
	delete(i.items, strings.TrimSpace(placeID))
}

func (i *Index) Rebuild(places []model.Place) error {
	next := map[string]Document{}
	for _, place := range places {
		doc, ok, err := project(place)
		if err != nil {
			return err
		}
		if !ok {
			continue
		}
		if _, exists := next[doc.PlaceID]; exists {
			return errors.New("duplicate place id in geospatial rebuild")
		}
		next[doc.PlaceID] = doc
	}
	i.mu.Lock()
	i.items = next
	i.mu.Unlock()
	return nil
}

func (i *Index) WithinRadius(lat, lon, radiusMeters float64, category model.Category) ([]Result, error) {
	if err := validatePoint(lat, lon); err != nil {
		return nil, err
	}
	if math.IsNaN(radiusMeters) || math.IsInf(radiusMeters, 0) || radiusMeters < 0 {
		return nil, errors.New("radius is invalid")
	}
	if category != "" && !model.ValidCategory(category) {
		return nil, errors.New("category is invalid")
	}
	i.mu.RLock()
	defer i.mu.RUnlock()
	out := make([]Result, 0)
	for _, doc := range i.items {
		if category != "" && doc.Category != category {
			continue
		}
		if doc.Latitude == nil || doc.Longitude == nil {
			continue
		}
		d := haversine(lat, lon, *doc.Latitude, *doc.Longitude)
		if d <= radiusMeters {
			out = append(out, Result{Document: cloneDocument(doc), DistanceMeters: d})
		}
	}
	sort.Slice(out, func(a, b int) bool {
		if out[a].DistanceMeters != out[b].DistanceMeters {
			return out[a].DistanceMeters < out[b].DistanceMeters
		}
		return out[a].PlaceID < out[b].PlaceID
	})
	return out, nil
}

func (i *Index) WithinBoundingBox(south, west, north, east float64, category model.Category) ([]Document, error) {
	if south > north {
		return nil, errors.New("bounding box south exceeds north")
	}
	if err := validatePoint(south, west); err != nil {
		return nil, err
	}
	if err := validatePoint(north, east); err != nil {
		return nil, err
	}
	if category != "" && !model.ValidCategory(category) {
		return nil, errors.New("category is invalid")
	}
	i.mu.RLock()
	defer i.mu.RUnlock()
	out := make([]Document, 0)
	for _, doc := range i.items {
		if category != "" && doc.Category != category {
			continue
		}
		if doc.Latitude == nil || doc.Longitude == nil {
			continue
		}
		if *doc.Latitude < south || *doc.Latitude > north {
			continue
		}
		if !longitudeInBox(*doc.Longitude, west, east) {
			continue
		}
		out = append(out, cloneDocument(doc))
	}
	sort.Slice(out, func(a, b int) bool { return out[a].PlaceID < out[b].PlaceID })
	return out, nil
}

func (i *Index) WithinRegion(country, region, city string, category model.Category) ([]Document, error) {
	country = strings.TrimSpace(country)
	region = strings.TrimSpace(region)
	city = strings.TrimSpace(city)
	if country == "" && region == "" && city == "" {
		return nil, errors.New("region query requires country, region or city")
	}
	if category != "" && !model.ValidCategory(category) {
		return nil, errors.New("category is invalid")
	}
	i.mu.RLock()
	defer i.mu.RUnlock()
	out := make([]Document, 0)
	for _, doc := range i.items {
		if category != "" && doc.Category != category {
			continue
		}
		if country != "" && !strings.EqualFold(doc.Country, country) {
			continue
		}
		if region != "" && !strings.EqualFold(doc.Region, region) {
			continue
		}
		if city != "" && !strings.EqualFold(doc.City, city) {
			continue
		}
		out = append(out, cloneDocument(doc))
	}
	sort.Slice(out, func(a, b int) bool { return out[a].PlaceID < out[b].PlaceID })
	return out, nil
}

func (i *Index) Snapshot() []Document {
	i.mu.RLock()
	defer i.mu.RUnlock()
	out := make([]Document, 0, len(i.items))
	for _, doc := range i.items {
		out = append(out, cloneDocument(doc))
	}
	sort.Slice(out, func(a, b int) bool { return out[a].PlaceID < out[b].PlaceID })
	return out
}

func project(place model.Place) (Document, bool, error) {
	if err := place.Validate(); err != nil {
		return Document{}, false, err
	}
	if place.Visibility != model.VisibilityPublic || place.Precision == model.PrecisionPrivate {
		return Document{}, false, nil
	}
	doc := Document{
		PlaceID: place.ID,
		Name: place.Name,
		Category: place.Category,
		Visibility: place.Visibility,
		Precision: place.Precision,
		Country: place.Country,
		Region: place.Region,
		City: place.City,
		PostalRegion: place.PostalRegion,
	}
	if place.Precision == model.PrecisionExactPublic {
		if place.Latitude == nil || place.Longitude == nil {
			return Document{}, false, errors.New("exact public place lacks coordinates")
		}
		lat := *place.Latitude
		lon := *place.Longitude
		doc.Latitude = &lat
		doc.Longitude = &lon
	}
	return doc, true, nil
}

func cloneDocument(in Document) Document {
	out := in
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

func validatePoint(lat, lon float64) error {
	if math.IsNaN(lat) || math.IsNaN(lon) || math.IsInf(lat, 0) || math.IsInf(lon, 0) {
		return errors.New("coordinate is invalid")
	}
	if lat < -90 || lat > 90 || lon < -180 || lon > 180 {
		return errors.New("coordinate is out of range")
	}
	return nil
}

func longitudeInBox(lon, west, east float64) bool {
	if west <= east {
		return lon >= west && lon <= east
	}
	return lon >= west || lon <= east
}

func haversine(lat1, lon1, lat2, lon2 float64) float64 {
	toRad := math.Pi / 180
	phi1 := lat1 * toRad
	phi2 := lat2 * toRad
	dPhi := (lat2 - lat1) * toRad
	dLambda := (lon2 - lon1) * toRad
	a := math.Sin(dPhi/2)*math.Sin(dPhi/2) + math.Cos(phi1)*math.Cos(phi2)*math.Sin(dLambda/2)*math.Sin(dLambda/2)
	return earthRadiusMeters * 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
}

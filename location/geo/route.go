package geo

import (
	"errors"
	"math"
	"sort"

	"github.com/420integrated/420-integrated/location/model"
)

type RoutePoint struct {
	Latitude  float64
	Longitude float64
}

type Route struct {
	Points          []RoutePoint
	DistanceMeters  float64
	DurationSeconds uint64
	Provider        string
}

func (r Route) Validate() error {
	if len(r.Points) < 2 {
		return errors.New("route requires at least two points")
	}
	for _, p := range r.Points {
		if err := validatePoint(p.Latitude, p.Longitude); err != nil {
			return err
		}
	}
	if math.IsNaN(r.DistanceMeters) || math.IsInf(r.DistanceMeters, 0) || r.DistanceMeters < 0 {
		return errors.New("route distance is invalid")
	}
	return nil
}

func (i *Index) NearRoute(route Route, corridorMeters float64, category model.Category) ([]Result, error) {
	if err := route.Validate(); err != nil {
		return nil, err
	}
	if math.IsNaN(corridorMeters) || math.IsInf(corridorMeters, 0) || corridorMeters < 0 {
		return nil, errors.New("route corridor is invalid")
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
		d := distanceToRouteMeters(*doc.Latitude, *doc.Longitude, route.Points)
		if d <= corridorMeters {
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

func distanceToRouteMeters(lat, lon float64, points []RoutePoint) float64 {
	best := math.Inf(1)
	for n := 0; n < len(points)-1; n++ {
		d := distanceToSegmentMeters(lat, lon, points[n], points[n+1])
		if d < best {
			best = d
		}
	}
	return best
}

func distanceToSegmentMeters(lat, lon float64, a, b RoutePoint) float64 {
	refLat := (a.Latitude + b.Latitude + lat) / 3
	metersPerDegreeLat := 111320.0
	metersPerDegreeLon := 111320.0 * math.Cos(refLat*math.Pi/180)

	ax := unwrapLongitude(a.Longitude, lon) * metersPerDegreeLon
	ay := a.Latitude * metersPerDegreeLat
	bx := unwrapLongitude(b.Longitude, lon) * metersPerDegreeLon
	by := b.Latitude * metersPerDegreeLat
	px := lon * metersPerDegreeLon
	py := lat * metersPerDegreeLat

	dx := bx - ax
	dy := by - ay
	if dx == 0 && dy == 0 {
		return math.Hypot(px-ax, py-ay)
	}

	t := ((px-ax)*dx + (py-ay)*dy) / (dx*dx + dy*dy)
	if t < 0 {
		t = 0
	} else if t > 1 {
		t = 1
	}
	cx := ax + t*dx
	cy := ay + t*dy
	return math.Hypot(px-cx, py-cy)
}

func unwrapLongitude(value, reference float64) float64 {
	for value-reference > 180 {
		value -= 360
	}
	for value-reference < -180 {
		value += 360
	}
	return value
}

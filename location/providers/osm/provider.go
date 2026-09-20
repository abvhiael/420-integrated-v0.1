package osm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/420integrated/420-integrated/location/geo"
	"github.com/420integrated/420-integrated/location/providers"
)

const (
	defaultNominatim = "https://nominatim.openstreetmap.org"
	defaultOSRM      = "https://router.project-osrm.org"
	defaultTiles     = "https://tile.openstreetmap.org"
	attribution      = "© OpenStreetMap contributors"
)

type Config struct {
	NominatimBaseURL    string
	OSRMBaseURL         string
	TileBaseURL         string
	UserAgent           string
	HTTPClient          *http.Client
	NominatimMinInterval time.Duration
	RouteProfile        string
	Now                 func() time.Time
}

type cachedTile struct {
	tile      providers.Tile
	expiresAt time.Time
}

type Provider struct {
	nominatim string
	osrm      string
	tiles     string
	userAgent string
	client    *http.Client
	interval  time.Duration
	profile   string
	now       func() time.Time

	nominatimMu   sync.Mutex
	nextNominatim time.Time

	cacheMu sync.Mutex
	cache   map[string]cachedTile
}

func New(cfg Config) (*Provider, error) {
	nominatim := strings.TrimRight(strings.TrimSpace(cfg.NominatimBaseURL), "/")
	if nominatim == "" {
		nominatim = defaultNominatim
	}
	osrm := strings.TrimRight(strings.TrimSpace(cfg.OSRMBaseURL), "/")
	if osrm == "" {
		osrm = defaultOSRM
	}
	tiles := strings.TrimRight(strings.TrimSpace(cfg.TileBaseURL), "/")
	if tiles == "" {
		tiles = defaultTiles
	}
	for label, raw := range map[string]string{"nominatim": nominatim, "osrm": osrm, "tiles": tiles} {
		u, err := url.Parse(raw)
		if err != nil || u.Scheme == "" || u.Host == "" {
			return nil, fmt.Errorf("%s base URL is invalid", label)
		}
		if u.Scheme != "https" && !isLoopbackHost(u.Hostname()) {
			return nil, fmt.Errorf("%s base URL must use https", label)
		}
	}
	ua := strings.TrimSpace(cfg.UserAgent)
	if ua == "" {
		ua = "420Integrated/0.1 (+https://420integrated.org)"
	}
	client := cfg.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	interval := cfg.NominatimMinInterval
	if interval == 0 {
		interval = time.Second
	}
	profile := strings.TrimSpace(cfg.RouteProfile)
	if profile == "" {
		profile = "driving"
	}
	now := cfg.Now
	if now == nil {
		now = time.Now
	}
	return &Provider{
		nominatim: nominatim,
		osrm: osrm,
		tiles: tiles,
		userAgent: ua,
		client: client,
		interval: interval,
		profile: profile,
		now: now,
		cache: map[string]cachedTile{},
	}, nil
}

func (p *Provider) Name() string { return "openstreetmap" }

func (p *Provider) Capabilities() []providers.Capability {
	return append([]providers.Capability(nil), providers.GenesisCapabilities...)
}

func (p *Provider) Ready(context.Context) error {
	if p == nil || p.client == nil || strings.TrimSpace(p.userAgent) == "" {
		return errors.New("openstreetmap provider is not configured")
	}
	return nil
}

type nominatimResult struct {
	PlaceID     json.Number       `json:"place_id"`
	OSMType     string            `json:"osm_type"`
	OSMID       json.Number       `json:"osm_id"`
	Lat         string            `json:"lat"`
	Lon         string            `json:"lon"`
	DisplayName string            `json:"display_name"`
	Name        string            `json:"name"`
	Importance  float64           `json:"importance"`
	Address     map[string]string `json:"address"`
	Licence     string            `json:"licence"`
}

func (p *Provider) Geocode(ctx context.Context, q providers.AddressQuery) ([]providers.PlaceCandidate, error) {
	if err := q.Validate(); err != nil {
		return nil, providerErr(providers.ErrorInvalidQuery, err.Error())
	}
	if err := p.waitNominatim(ctx); err != nil {
		return nil, err
	}
	values := url.Values{
		"format": {"jsonv2"},
		"addressdetails": {"1"},
		"limit": {"10"},
	}
	if strings.TrimSpace(q.Address) != "" {
		parts := []string{q.Address, q.City, q.Region, q.Country}
		values.Set("q", joinNonEmpty(parts, ", "))
	} else {
		if q.City != "" { values.Set("city", q.City) }
		if q.Region != "" { values.Set("state", q.Region) }
		if q.Country != "" { values.Set("country", q.Country) }
	}
	var raw []nominatimResult
	requestID, err := p.getJSON(ctx, p.nominatim+"/search?"+values.Encode(), &raw, 2<<20)
	if err != nil {
		return nil, err
	}
	if len(raw) == 0 {
		return nil, providerErr(providers.ErrorNoResult, "geocoder returned no results")
	}
	return p.candidates(raw, requestID)
}

func (p *Provider) ReverseGeocode(ctx context.Context, q providers.CoordinateQuery) ([]providers.PlaceCandidate, error) {
	if err := validateCoordinate(q.Latitude, q.Longitude); err != nil {
		return nil, providerErr(providers.ErrorInvalidQuery, err.Error())
	}
	if err := p.waitNominatim(ctx); err != nil {
		return nil, err
	}
	values := url.Values{
		"format": {"jsonv2"},
		"addressdetails": {"1"},
		"lat": {strconv.FormatFloat(q.Latitude, 'f', -1, 64)},
		"lon": {strconv.FormatFloat(q.Longitude, 'f', -1, 64)},
	}
	var raw nominatimResult
	requestID, err := p.getJSON(ctx, p.nominatim+"/reverse?"+values.Encode(), &raw, 2<<20)
	if err != nil {
		return nil, err
	}
	out, err := p.candidates([]nominatimResult{raw}, requestID)
	if err != nil {
		return nil, err
	}
	if len(out) == 0 {
		return nil, providerErr(providers.ErrorNoResult, "reverse geocoder returned no result")
	}
	return out, nil
}

func (p *Provider) Lookup(ctx context.Context, q providers.PlaceLookupQuery) ([]providers.PlaceCandidate, error) {
	if strings.TrimSpace(q.ExternalID) != "" {
		id, err := normalizeOSMID(q.ExternalID)
		if err != nil {
			return nil, providerErr(providers.ErrorInvalidQuery, err.Error())
		}
		if err := p.waitNominatim(ctx); err != nil {
			return nil, err
		}
		values := url.Values{
			"format": {"jsonv2"},
			"addressdetails": {"1"},
			"osm_ids": {id},
		}
		var raw []nominatimResult
		requestID, err := p.getJSON(ctx, p.nominatim+"/lookup?"+values.Encode(), &raw, 2<<20)
		if err != nil {
			return nil, err
		}
		if len(raw) == 0 {
			return nil, providerErr(providers.ErrorNoResult, "place lookup returned no results")
		}
		return p.candidates(raw, requestID)
	}
	if q.Latitude != nil || q.Longitude != nil {
		if q.Latitude == nil || q.Longitude == nil {
			return nil, providerErr(providers.ErrorInvalidQuery, "lookup coordinates must be supplied together")
		}
		return p.ReverseGeocode(ctx, providers.CoordinateQuery{Latitude: *q.Latitude, Longitude: *q.Longitude})
	}
	if strings.TrimSpace(q.Name) != "" {
		return p.Geocode(ctx, providers.AddressQuery{Address: q.Name})
	}
	return nil, providerErr(providers.ErrorInvalidQuery, "place lookup requires external ID, coordinates or name")
}

type osrmResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Routes  []struct {
		Distance float64 `json:"distance"`
		Duration float64 `json:"duration"`
		Geometry struct {
			Coordinates [][]float64 `json:"coordinates"`
			Type        string      `json:"type"`
		} `json:"geometry"`
	} `json:"routes"`
}

func (p *Provider) Route(ctx context.Context, req providers.RouteRequest) (geo.Route, providers.Provenance, error) {
	points := make([]geo.RoutePoint, 0, len(req.Waypoints)+2)
	points = append(points, req.Origin)
	points = append(points, req.Waypoints...)
	points = append(points, req.Destination)
	for _, point := range points {
		if err := validateCoordinate(point.Latitude, point.Longitude); err != nil {
			return geo.Route{}, providers.Provenance{}, providerErr(providers.ErrorInvalidQuery, err.Error())
		}
	}
	if len(points) < 2 {
		return geo.Route{}, providers.Provenance{}, providerErr(providers.ErrorInvalidQuery, "route requires origin and destination")
	}
	encoded := make([]string, 0, len(points))
	for _, point := range points {
		encoded = append(encoded, strconv.FormatFloat(point.Longitude, 'f', -1, 64)+","+strconv.FormatFloat(point.Latitude, 'f', -1, 64))
	}
	endpoint := p.osrm+"/route/v1/"+url.PathEscape(p.profile)+"/"+strings.Join(encoded, ";")+"?overview=full&geometries=geojson&steps=false"
	var raw osrmResponse
	requestID, err := p.getJSON(ctx, endpoint, &raw, 8<<20)
	if err != nil {
		return geo.Route{}, providers.Provenance{}, err
	}
	if raw.Code != "Ok" {
		if raw.Code == "NoRoute" {
			return geo.Route{}, providers.Provenance{}, providerErr(providers.ErrorNoResult, "routing provider found no route")
		}
		return geo.Route{}, providers.Provenance{}, providerErr(providers.ErrorInvalidQuery, "routing provider rejected request: "+raw.Code+" "+raw.Message)
	}
	if len(raw.Routes) == 0 {
		return geo.Route{}, providers.Provenance{}, providerErr(providers.ErrorMalformedResult, "routing provider returned no route object")
	}
	first := raw.Routes[0]
	routePoints := make([]geo.RoutePoint, 0, len(first.Geometry.Coordinates))
	for _, pair := range first.Geometry.Coordinates {
		if len(pair) < 2 {
			return geo.Route{}, providers.Provenance{}, providerErr(providers.ErrorMalformedResult, "routing geometry coordinate is malformed")
		}
		routePoints = append(routePoints, geo.RoutePoint{Latitude: pair[1], Longitude: pair[0]})
	}
	route := geo.Route{
		Points: routePoints,
		DistanceMeters: first.Distance,
		DurationSeconds: uint64(math.Round(first.Duration)),
		Provider: p.Name(),
	}
	if err := route.Validate(); err != nil {
		return geo.Route{}, providers.Provenance{}, providerErr(providers.ErrorMalformedResult, err.Error())
	}
	provenance := providers.Provenance{
		Provider: p.Name(),
		ProviderRequestID: requestID,
		RetrievedAt: p.now().UTC(),
		Confidence: 1,
		Attribution: attribution,
	}
	return route, provenance, nil
}

func (p *Provider) Tile(ctx context.Context, req providers.TileRequest) (providers.Tile, error) {
	if req.Z > 30 {
		return providers.Tile{}, providerErr(providers.ErrorInvalidQuery, "tile zoom is out of range")
	}
	limit := uint64(1) << req.Z
	if uint64(req.X) >= limit || uint64(req.Y) >= limit {
		return providers.Tile{}, providerErr(providers.ErrorInvalidQuery, "tile coordinate is out of range")
	}
	key := fmt.Sprintf("%d/%d/%d", req.Z, req.X, req.Y)
	now := p.now().UTC()
	p.cacheMu.Lock()
	if cached, ok := p.cache[key]; ok && now.Before(cached.expiresAt) {
		tile := cached.tile
		tile.Data = append([]byte(nil), tile.Data...)
		p.cacheMu.Unlock()
		return tile, nil
	}
	p.cacheMu.Unlock()

	endpoint := fmt.Sprintf("%s/%d/%d/%d.png", p.tiles, req.Z, req.X, req.Y)
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return providers.Tile{}, providerErr(providers.ErrorInvalidQuery, err.Error())
	}
	p.setHeaders(httpReq)
	resp, err := p.client.Do(httpReq)
	if err != nil {
		return providers.Tile{}, providerErr(providers.ErrorTemporaryUpstream, err.Error())
	}
	defer resp.Body.Close()
	if err := p.statusError(resp); err != nil {
		return providers.Tile{}, err
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, 10<<20))
	if err != nil {
		return providers.Tile{}, providerErr(providers.ErrorTemporaryUpstream, "read tile: "+err.Error())
	}
	if len(body) == 0 {
		return providers.Tile{}, providerErr(providers.ErrorMalformedResult, "tile provider returned empty body")
	}
	contentType := strings.TrimSpace(resp.Header.Get("Content-Type"))
	if contentType == "" {
		contentType = "image/png"
	}
	tile := providers.Tile{
		ContentType: contentType,
		Data: append([]byte(nil), body...),
		Provenance: providers.Provenance{
			Provider: p.Name(),
			ProviderRequestID: requestIDFrom(resp),
			RetrievedAt: now,
			Confidence: 1,
			Attribution: attribution,
		},
	}
	expiresAt := cacheExpiry(resp.Header, now)
	p.cacheMu.Lock()
	p.cache[key] = cachedTile{tile: tile, expiresAt: expiresAt}
	p.cacheMu.Unlock()
	return tile, nil
}

func (p *Provider) candidates(raw []nominatimResult, requestID string) ([]providers.PlaceCandidate, error) {
	out := make([]providers.PlaceCandidate, 0, len(raw))
	for _, item := range raw {
		lat, err := strconv.ParseFloat(item.Lat, 64)
		if err != nil {
			return nil, providerErr(providers.ErrorMalformedResult, "invalid latitude from Nominatim")
		}
		lon, err := strconv.ParseFloat(item.Lon, 64)
		if err != nil {
			return nil, providerErr(providers.ErrorMalformedResult, "invalid longitude from Nominatim")
		}
		if err := validateCoordinate(lat, lon); err != nil {
			return nil, providerErr(providers.ErrorMalformedResult, err.Error())
		}
		name := strings.TrimSpace(item.Name)
		if name == "" {
			name = strings.TrimSpace(item.DisplayName)
		}
		if name == "" {
			return nil, providerErr(providers.ErrorMalformedResult, "Nominatim result has no display name")
		}
		city := firstNonEmpty(item.Address["city"], item.Address["town"], item.Address["village"], item.Address["municipality"])
		region := firstNonEmpty(item.Address["state"], item.Address["province"], item.Address["region"])
		license := strings.TrimSpace(item.Licence)
		if license == "" {
			license = attribution
		}
		out = append(out, providers.PlaceCandidate{
			Name: name,
			Address: item.DisplayName,
			Country: item.Address["country"],
			Region: region,
			City: city,
			PostalRegion: item.Address["postcode"],
			Latitude: lat,
			Longitude: lon,
			Provenance: providers.Provenance{
				Provider: p.Name(),
				ProviderRequestID: requestID,
				ProviderPlaceID: osmObjectID(item.OSMType, item.OSMID.String()),
				RetrievedAt: p.now().UTC(),
				Confidence: clamp(item.Importance, 0, 1),
				Attribution: license,
			},
		})
	}
	return out, nil
}

func (p *Provider) waitNominatim(ctx context.Context) error {
	if p.interval < 0 {
		return nil
	}
	p.nominatimMu.Lock()
	defer p.nominatimMu.Unlock()
	now := p.now()
	if now.Before(p.nextNominatim) {
		timer := time.NewTimer(p.nextNominatim.Sub(now))
		defer timer.Stop()
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-timer.C:
		}
	}
	p.nextNominatim = p.now().Add(p.interval)
	return nil
}

func (p *Provider) getJSON(ctx context.Context, endpoint string, out any, maxBytes int64) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return "", providerErr(providers.ErrorInvalidQuery, err.Error())
	}
	p.setHeaders(req)
	resp, err := p.client.Do(req)
	if err != nil {
		return "", providerErr(providers.ErrorTemporaryUpstream, err.Error())
	}
	defer resp.Body.Close()
	if err := p.statusError(resp); err != nil {
		return "", err
	}
	dec := json.NewDecoder(io.LimitReader(resp.Body, maxBytes))
	dec.UseNumber()
	if err := dec.Decode(out); err != nil {
		return "", providerErr(providers.ErrorMalformedResult, "decode upstream response: "+err.Error())
	}
	return requestIDFrom(resp), nil
}

func (p *Provider) setHeaders(req *http.Request) {
	req.Header.Set("User-Agent", p.userAgent)
	req.Header.Set("Accept", "application/json")
}

func (p *Provider) statusError(resp *http.Response) error {
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}
	switch resp.StatusCode {
	case http.StatusTooManyRequests:
		return providerErr(providers.ErrorQuotaExceeded, "upstream rate limit exceeded")
	case http.StatusBadRequest, http.StatusUnprocessableEntity:
		return providerErr(providers.ErrorInvalidQuery, "upstream rejected request")
	case http.StatusNotFound:
		return providerErr(providers.ErrorNoResult, "upstream resource not found")
	}
	if resp.StatusCode >= 500 {
		return providerErr(providers.ErrorTemporaryUpstream, "upstream service failure")
	}
	return providerErr(providers.ErrorUnavailable, "upstream returned HTTP "+strconv.Itoa(resp.StatusCode))
}

func providerErr(kind providers.ErrorKind, message string) error {
	return &providers.ProviderError{Kind: kind, Provider: "openstreetmap", Message: message}
}

func validateCoordinate(lat, lon float64) error {
	if math.IsNaN(lat) || math.IsNaN(lon) || math.IsInf(lat, 0) || math.IsInf(lon, 0) {
		return errors.New("coordinate is invalid")
	}
	if lat < -90 || lat > 90 || lon < -180 || lon > 180 {
		return errors.New("coordinate is out of range")
	}
	return nil
}

func normalizeOSMID(in string) (string, error) {
	in = strings.ToUpper(strings.TrimSpace(in))
	if len(in) < 2 || (in[0] != 'N' && in[0] != 'W' && in[0] != 'R') {
		return "", errors.New("OSM external ID must use N, W or R prefix")
	}
	if _, err := strconv.ParseUint(in[1:], 10, 64); err != nil {
		return "", errors.New("OSM external ID suffix must be numeric")
	}
	return in, nil
}

func osmObjectID(kind, id string) string {
	kind = strings.ToLower(strings.TrimSpace(kind))
	switch kind {
	case "node", "n":
		return "N" + id
	case "way", "w":
		return "W" + id
	case "relation", "r":
		return "R" + id
	default:
		return ""
	}
}

func requestIDFrom(resp *http.Response) string {
	for _, name := range []string{"X-Request-ID", "X-Request-Id", "Request-ID"} {
		if value := strings.TrimSpace(resp.Header.Get(name)); value != "" {
			return value
		}
	}
	return ""
}

func cacheExpiry(header http.Header, now time.Time) time.Time {
	for _, directive := range strings.Split(header.Get("Cache-Control"), ",") {
		directive = strings.TrimSpace(directive)
		if strings.HasPrefix(strings.ToLower(directive), "max-age=") {
			seconds, err := strconv.ParseInt(strings.TrimSpace(strings.TrimPrefix(strings.ToLower(directive), "max-age=")), 10, 64)
			if err == nil && seconds >= 0 {
				return now.Add(time.Duration(seconds) * time.Second)
			}
		}
	}
	if expires := strings.TrimSpace(header.Get("Expires")); expires != "" {
		if parsed, err := http.ParseTime(expires); err == nil && parsed.After(now) {
			return parsed
		}
	}
	return now.Add(7 * 24 * time.Hour)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func joinNonEmpty(values []string, sep string) string {
	out := make([]string, 0, len(values))
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			out = append(out, strings.TrimSpace(value))
		}
	}
	return strings.Join(out, sep)
}

func clamp(value, min, max float64) float64 {
	if value < min { return min }
	if value > max { return max }
	return value
}

func isLoopbackHost(host string) bool {
	host = strings.ToLower(strings.TrimSpace(host))
	return host == "localhost" || host == "127.0.0.1" || host == "::1"
}

package discovery

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/search/architecture"
	"github.com/420integrated/420-integrated/search/indexerclient"
	searchresult "github.com/420integrated/420-integrated/search/result"
)

const publicEcosystemHistoryLimit uint32 = 200

type PublicEcosystemReader interface {
	Qualified(context.Context) error
	Status(context.Context) (indexerclient.Status, error)
	ProtocolEvents(context.Context, string, string, uint32) (indexerclient.ProtocolEventPage, error)
}

type PublicEcosystemDiscovery struct {
	reader PublicEcosystemReader
	publicCommonsVisibility map[string]struct{}
	now func() time.Time
}

func NewPublicEcosystemDiscovery(reader PublicEcosystemReader, publicCommonsVisibility []string) (*PublicEcosystemDiscovery, error) {
	if reader == nil { return nil, errors.New("public ecosystem reader required") }
	allowed := map[string]struct{}{}
	for _, value := range publicCommonsVisibility {
		value = strings.ToLower(strings.TrimSpace(value))
		if value != "" { allowed[value] = struct{}{} }
	}
	return &PublicEcosystemDiscovery{reader: reader, publicCommonsVisibility: allowed, now: time.Now}, nil
}

func (d *PublicEcosystemDiscovery) ResolveMarketListing(ctx context.Context, listingID string) ([]searchresult.Result, error) {
	return d.resolve(ctx, publicSpec{protocol:"420Market", domain:architecture.DomainMarketListing, source:architecture.SourceMarket, authority:"420Market ListingRegistry420", objectID:listingID, title:"Market listing", category:"market_listing", path:"/market/listings/", createEvents:map[string]bool{"ListingPublished":true}, inactiveEvents:map[string]bool{"ListingCancelled":true}})
}

func (d *PublicEcosystemDiscovery) ResolveRightsRecord(ctx context.Context, recordID string) ([]searchresult.Result, error) {
	return d.resolve(ctx, publicSpec{protocol:"420Rights", domain:architecture.DomainRightsRecord, source:architecture.SourceRights, authority:"420Rights canonical public registries", objectID:recordID, title:"Rights record", category:"rights_record", path:"/rights/", createEvents:map[string]bool{"SubjectRegistered":true,"ClaimDeclared":true,"LicenseGranted":true}, inactiveEvents:map[string]bool{"LicenseRevoked":true,"LicenseRenounced":true,"ClaimSuperseded":true}})
}

func (d *PublicEcosystemDiscovery) ResolvePublicCommons(ctx context.Context, spaceID string) ([]searchresult.Result, error) {
	if len(d.publicCommonsVisibility) == 0 { return nil, errors.New("public Commons visibility configuration required") }
	results, err := d.resolve(ctx, publicSpec{protocol:"420Commons", domain:architecture.DomainPublicCommons, source:architecture.SourceCommons, authority:"420Commons SpaceRegistry420 public state", objectID:spaceID, title:"Commons space", category:"public_commons", path:"/commons/spaces/", createEvents:map[string]bool{"SpaceCreated":true,"SpaceUpdated":true}})
	if err != nil || len(results) == 0 { return results, err }
	page, err := d.reader.ProtocolEvents(ctx, "420Commons", strings.ToLower(strings.TrimSpace(spaceID)), publicEcosystemHistoryLimit)
	if err != nil { return nil, err }
	if len(page.Items) == 0 { return nil, nil }
	latest := page.Items[len(page.Items)-1]
	visibility := strings.ToLower(fieldString(latest.Fields, "visibility"))
	if _, ok := d.publicCommonsVisibility[visibility]; !ok { return nil, nil }
	if active, ok := latest.Fields["active"].(bool); ok && !active { return nil, nil }
	return results, nil
}

func (d *PublicEcosystemDiscovery) ResolvePublicPulse(ctx context.Context, publicationID string) ([]searchresult.Result, error) {
	return d.resolve(ctx, publicSpec{protocol:"420Pulse", domain:architecture.DomainPublicPulse, source:architecture.SourcePulse, authority:"420Pulse PublicationRegistry420 public state", objectID:publicationID, title:"Pulse publication", category:"public_pulse", path:"/pulse/publications/", createEvents:map[string]bool{"PublicationCreated":true,"PublicationUpdated":true}, inactiveEvents:map[string]bool{"PublicationDeactivated":true,"PublicationDeleted":true}})
}

type publicSpec struct {
	protocol string
	domain architecture.ResultDomain
	source architecture.SourceBoundary
	authority string
	objectID string
	title string
	category string
	path string
	createEvents map[string]bool
	inactiveEvents map[string]bool
}

func (d *PublicEcosystemDiscovery) resolve(ctx context.Context, spec publicSpec) ([]searchresult.Result, error) {
	id := strings.ToLower(strings.TrimSpace(spec.objectID))
	if id == "" { return nil, errors.New("public ecosystem object id required") }
	if err := d.reader.Qualified(ctx); err != nil { return nil, err }
	status, err := d.reader.Status(ctx)
	if err != nil { return nil, err }
	indexedHeight, err := parseOptionalUint(status.IndexedHead)
	if err != nil { return nil, fmt.Errorf("invalid indexed head: %w", err) }
	safeHeight, err := parseOptionalUint(status.Finality.SafeHead)
	if err != nil { return nil, fmt.Errorf("invalid safe head: %w", err) }
	page, err := d.reader.ProtocolEvents(ctx, spec.protocol, id, publicEcosystemHistoryLimit)
	if err != nil { return nil, err }
	if page.NextCursor != nil { return nil, errors.New("public ecosystem history exceeds bounded reconstruction window") }
	if len(page.Items) == 0 { return nil, nil }
	var created bool
	for _, event := range page.Items { if spec.createEvents[event.EventName] { created = true } }
	if !created { return nil, errors.New("public ecosystem history missing canonical creation event") }
	latest := page.Items[len(page.Items)-1]
	if spec.inactiveEvents[latest.EventName] { return nil, nil }
	if active, ok := latest.Fields["active"].(bool); ok && !active { return nil, nil }
	blockNumber, err := strconv.ParseUint(latest.BlockNumber, 10, 64)
	if err != nil { return nil, errors.New("invalid public ecosystem block number") }
	logIndex := uint64(latest.LogIndex)
	p := provenance(latest.ChainID, &blockNumber, latest.BlockHash, latest.TransactionHash, indexedHeight, safeHeight, d.now())
	p.Source = spec.source
	p.Authority = spec.authority + " via qualified 420Indexer projection"
	p.LogIndex = &logIndex
	r, err := searchresult.New(spec.domain, id, architecture.SearchModeResolver, p, searchresult.Presentation{Title:spec.title+" "+id, Snippet:"latest indexed public event: "+latest.EventName, Category:spec.category, CanonicalURL:spec.path+url.PathEscape(id), Tags:[]string{spec.category, strings.ToLower(spec.protocol)}})
	if err != nil { return nil, err }
	return []searchresult.Result{r}, nil
}

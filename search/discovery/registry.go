package discovery

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/search/architecture"
	"github.com/420integrated/420-integrated/search/indexerclient"
	searchresult "github.com/420integrated/420-integrated/search/result"
)

type RegistryReader interface {
	Qualified(context.Context) error
	Status(context.Context) (indexerclient.Status, error)
	Services(context.Context) ([]indexerclient.ServiceSummary, error)
	Service(context.Context, string) (indexerclient.ServiceSummary, error)
	ServiceVersion(context.Context, string, uint32) (indexerclient.ServiceVersion, error)
}

type RegistryDiscovery struct {
	reader RegistryReader
	now    func() time.Time
}

func NewRegistryDiscovery(reader RegistryReader) (*RegistryDiscovery, error) {
	if reader == nil { return nil, errors.New("registry reader required") }
	return &RegistryDiscovery{reader: reader, now: time.Now}, nil
}

func (d *RegistryDiscovery) Discover(ctx context.Context, query string) ([]searchresult.Result, error) {
	if err := d.reader.Qualified(ctx); err != nil { return nil, err }
	status, err := d.reader.Status(ctx)
	if err != nil { return nil, err }
	indexedHeight, err := parseOptionalUint(status.IndexedHead)
	if err != nil { return nil, err }
	safeHeight, err := parseOptionalUint(status.Finality.SafeHead)
	if err != nil { return nil, err }
	services, err := d.reader.Services(ctx)
	if err != nil { return nil, err }
	needle := strings.ToLower(strings.TrimSpace(query))
	out := make([]searchresult.Result, 0)
	for _, svc := range services {
		if needle != "" && !strings.Contains(strings.ToLower(svc.ServiceID), needle) { continue }
		r, err := d.serviceResult(svc, indexedHeight, safeHeight)
		if err != nil { return nil, err }
		out = append(out, r)
		for _, version := range svc.Versions {
			vr, err := d.versionResult(version, indexedHeight, safeHeight)
			if err != nil { return nil, err }
			out = append(out, vr)
		}
	}
	return out, nil
}

func (d *RegistryDiscovery) ResolveService(ctx context.Context, serviceID string) (searchresult.Result, error) {
	if err := d.reader.Qualified(ctx); err != nil { return searchresult.Result{}, err }
	status, err := d.reader.Status(ctx)
	if err != nil { return searchresult.Result{}, err }
	indexedHeight, _ := parseOptionalUint(status.IndexedHead)
	safeHeight, _ := parseOptionalUint(status.Finality.SafeHead)
	svc, err := d.reader.Service(ctx, serviceID)
	if err != nil { return searchresult.Result{}, err }
	return d.serviceResult(svc, indexedHeight, safeHeight)
}

func (d *RegistryDiscovery) ResolveVersion(ctx context.Context, serviceID string, version uint32) (searchresult.Result, error) {
	if err := d.reader.Qualified(ctx); err != nil { return searchresult.Result{}, err }
	status, err := d.reader.Status(ctx)
	if err != nil { return searchresult.Result{}, err }
	indexedHeight, _ := parseOptionalUint(status.IndexedHead)
	safeHeight, _ := parseOptionalUint(status.Finality.SafeHead)
	record, err := d.reader.ServiceVersion(ctx, serviceID, version)
	if err != nil { return searchresult.Result{}, err }
	return d.versionResult(record, indexedHeight, safeHeight)
}

func (d *RegistryDiscovery) serviceResult(svc indexerclient.ServiceSummary, indexedHeight, safeHeight *uint64) (searchresult.Result, error) {
	if strings.TrimSpace(svc.ServiceID) == "" || svc.LatestVersion == 0 { return searchresult.Result{}, errors.New("invalid registry service summary") }
	var blockNumber *uint64
	var blockHash string
	if len(svc.Versions) > 0 {
		latest := svc.Versions[len(svc.Versions)-1]
		bn := latest.ActivatedBlock
		blockNumber = &bn
		blockHash = latest.ActivatedHash
	}
	return searchresult.New(
		architecture.DomainService,
		svc.ServiceID,
		architecture.SearchModeDiscovery,
		registryProvenance(blockNumber, blockHash, indexedHeight, safeHeight, d.now()),
		searchresult.Presentation{
			Title: svc.ServiceID,
			Subtitle: fmt.Sprintf("latest v%d", svc.LatestVersion),
			Snippet: registrySummary(svc),
			Category: "registered service/application",
			CanonicalURL: "/services/" + svc.ServiceID,
			Tags: []string{"420Registry", "registered-service"},
		},
	)
}

func (d *RegistryDiscovery) versionResult(v indexerclient.ServiceVersion, indexedHeight, safeHeight *uint64) (searchresult.Result, error) {
	if strings.TrimSpace(v.ServiceID) == "" || v.Version == 0 || strings.TrimSpace(v.Implementation) == "" { return searchresult.Result{}, errors.New("invalid registry service version") }
	bn := v.ActivatedBlock
	state := "deprecated"
	if v.Active { state = "active" }
	return searchresult.New(
		architecture.DomainService,
		fmt.Sprintf("%s@%d", v.ServiceID, v.Version),
		architecture.SearchModeDiscovery,
		registryProvenance(&bn, v.ActivatedHash, indexedHeight, safeHeight, d.now()),
		searchresult.Presentation{
			Title: fmt.Sprintf("%s v%d", v.ServiceID, v.Version),
			Subtitle: state + " · " + v.Implementation,
			Snippet: fmt.Sprintf("component type %d · code %s · metadata %s", v.ComponentType, v.CodeHash, v.MetadataHash),
			Category: "registered service version",
			CanonicalURL: fmt.Sprintf("/services/%s/versions/%d", v.ServiceID, v.Version),
			Tags: []string{"420Registry", state},
		},
	)
}

func registryProvenance(blockNumber *uint64, blockHash string, indexedHeight, safeHeight *uint64, at time.Time) searchresult.Provenance {
	finality := searchresult.FinalityHead
	if blockNumber != nil && safeHeight != nil && *blockNumber <= *safeHeight { finality = searchresult.FinalitySafe }
	return searchresult.Provenance{
		Source: architecture.SourceRegistry,
		Authority: "420Registry / ProtocolRegistry",
		ChainID: 420,
		BlockNumber: blockNumber,
		BlockHash: blockHash,
		Finality: finality,
		IndexedAt: at,
		IndexedHeight: indexedHeight,
	}
}

func registrySummary(svc indexerclient.ServiceSummary) string {
	if svc.ActiveVersion != 0 { return fmt.Sprintf("registered service with active version %d of %d", svc.ActiveVersion, svc.LatestVersion) }
	return fmt.Sprintf("registered service with %d published version(s)", len(svc.Versions))
}

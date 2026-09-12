package discovery

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/search/architecture"
	"github.com/420integrated/420-integrated/search/indexerclient"
	searchresult "github.com/420integrated/420-integrated/search/result"
)

type fakeRegistryReader struct {
	qualifiedErr error
	status indexerclient.Status
	services []indexerclient.ServiceSummary
	service indexerclient.ServiceSummary
	version indexerclient.ServiceVersion
}

func (f *fakeRegistryReader) Qualified(context.Context) error { return f.qualifiedErr }
func (f *fakeRegistryReader) Status(context.Context) (indexerclient.Status, error) { return f.status, nil }
func (f *fakeRegistryReader) Services(context.Context) ([]indexerclient.ServiceSummary, error) { return f.services, nil }
func (f *fakeRegistryReader) Service(context.Context, string) (indexerclient.ServiceSummary, error) { return f.service, nil }
func (f *fakeRegistryReader) ServiceVersion(context.Context, string, uint32) (indexerclient.ServiceVersion, error) { return f.version, nil }

func registryFixture() indexerclient.ServiceVersion {
	return indexerclient.ServiceVersion{
		ServiceID: "420/service/search/v1", Version: 1,
		Implementation: "0x420", CodeHash: "0xcode", MetadataHash: "0xmeta",
		ComponentType: 2, ManifestHash: "0xmanifest", DependencyRoot: "0xdeps", InterfaceHash: "0xiface",
		ActivatedBlock: 42, ActivatedHash: "0xblock", Active: true,
	}
}

func TestRegistryDiscoveryEmitsServiceAndVersionResults(t *testing.T) {
	v := registryFixture()
	svc := indexerclient.ServiceSummary{ServiceID: v.ServiceID, LatestVersion: 1, ActiveVersion: 1, Implementation: v.Implementation, Versions: []indexerclient.ServiceVersion{v}}
	reader := &fakeRegistryReader{status: qualifiedStatus(), services: []indexerclient.ServiceSummary{svc}}
	d, err := NewRegistryDiscovery(reader)
	if err != nil { t.Fatal(err) }
	d.now = func() time.Time { return time.Unix(1700000100, 0).UTC() }
	results, err := d.Discover(context.Background(), "search")
	if err != nil { t.Fatal(err) }
	if len(results) != 2 { t.Fatalf("expected service + version, got %d", len(results)) }
	for _, r := range results {
		if r.Domain != architecture.DomainService { t.Fatalf("wrong domain %s", r.Domain) }
		if r.Provenance.Source != architecture.SourceRegistry { t.Fatalf("wrong source %s", r.Provenance.Source) }
		if r.Provenance.Authority != "420Registry / ProtocolRegistry" { t.Fatal("registry authority not preserved") }
		if err := r.Validate(); err != nil { t.Fatal(err) }
	}
	if results[0].SourceKey != v.ServiceID { t.Fatalf("unexpected service key %s", results[0].SourceKey) }
	if results[1].SourceKey != v.ServiceID+"@1" { t.Fatalf("unexpected version key %s", results[1].SourceKey) }
	if results[1].Provenance.Finality != searchresult.FinalitySafe { t.Fatalf("expected safe finality, got %s", results[1].Provenance.Finality) }
}

func TestRegistryDiscoveryFiltersByServiceID(t *testing.T) {
	v := registryFixture()
	svc := indexerclient.ServiceSummary{ServiceID: v.ServiceID, LatestVersion: 1, ActiveVersion: 1, Versions: []indexerclient.ServiceVersion{v}}
	reader := &fakeRegistryReader{status: qualifiedStatus(), services: []indexerclient.ServiceSummary{svc}}
	d, _ := NewRegistryDiscovery(reader)
	if results, err := d.Discover(context.Background(), "wallet"); err != nil || len(results) != 0 { t.Fatalf("expected no matches, got %d err=%v", len(results), err) }
}

func TestRegistryResolveVersionPreservesActivationProvenance(t *testing.T) {
	v := registryFixture()
	reader := &fakeRegistryReader{status: qualifiedStatus(), version: v}
	d, _ := NewRegistryDiscovery(reader)
	d.now = func() time.Time { return time.Unix(1700000100, 0).UTC() }
	r, err := d.ResolveVersion(context.Background(), v.ServiceID, 1)
	if err != nil { t.Fatal(err) }
	if r.Provenance.BlockNumber == nil || *r.Provenance.BlockNumber != 42 || r.Provenance.BlockHash != "0xblock" { t.Fatalf("activation provenance missing: %+v", r.Provenance) }
	if r.Presentation.CanonicalURL != "/services/420/service/search/v1/versions/1" { t.Fatalf("unexpected canonical url %s", r.Presentation.CanonicalURL) }
}

func TestRegistryDiscoveryFailsClosedBeforeRegistryReads(t *testing.T) {
	reader := &fakeRegistryReader{qualifiedErr: errors.New("indexer stale")}
	d, _ := NewRegistryDiscovery(reader)
	if _, err := d.Discover(context.Background(), "search"); err == nil { t.Fatal("expected qualification failure") }
}

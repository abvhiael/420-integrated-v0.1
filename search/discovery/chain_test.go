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

type fakeChainReader struct {
	qualifiedErr error
	status       indexerclient.Status
	matches      []indexerclient.SearchResult
	block        indexerclient.Block
	tx           indexerclient.Transaction
	address      indexerclient.Address
}

func (f *fakeChainReader) Qualified(context.Context) error { return f.qualifiedErr }
func (f *fakeChainReader) Status(context.Context) (indexerclient.Status, error) { return f.status, nil }
func (f *fakeChainReader) Search(context.Context, string, uint32) ([]indexerclient.SearchResult, error) { return f.matches, nil }
func (f *fakeChainReader) Block(context.Context, string) (indexerclient.Block, error) { return f.block, nil }
func (f *fakeChainReader) Transaction(context.Context, string) (indexerclient.Transaction, error) { return f.tx, nil }
func (f *fakeChainReader) Address(context.Context, string) (indexerclient.Address, error) { return f.address, nil }

func qualifiedStatus() indexerclient.Status {
	var status indexerclient.Status
	status.ChainID = "420"
	status.IndexedHead = "100"
	status.IndexedHeadTimestamp = "1700000000"
	status.Finality.Mode = "confirmations"
	status.Finality.SafeHead = "90"
	return status
}

func TestChainDiscoveryBlockPreservesProvenance(t *testing.T) {
	reader := &fakeChainReader{
		status: qualifiedStatus(),
		matches: []indexerclient.SearchResult{{Type: "block", Key: "42", Value: "0xblock"}},
		block: indexerclient.Block{ChainID: "420", Number: "42", Hash: "0xblock", ParentHash: "0xparent", Timestamp: "1"},
	}
	d, err := NewChainDiscovery(reader)
	if err != nil { t.Fatal(err) }
	d.now = func() time.Time { return time.Unix(1700000100, 0).UTC() }
	results, err := d.Resolve(context.Background(), "42")
	if err != nil { t.Fatal(err) }
	if len(results) != 1 { t.Fatalf("expected one result, got %d", len(results)) }
	r := results[0]
	if r.Domain != architecture.DomainBlock || r.Provenance.ChainID != 420 || r.Provenance.BlockHash != "0xblock" { t.Fatalf("unexpected block result: %+v", r) }
	if r.Provenance.Finality != searchresult.FinalitySafe { t.Fatalf("expected safe finality, got %s", r.Provenance.Finality) }
	if r.Provenance.IndexedHeight == nil || *r.Provenance.IndexedHeight != 100 { t.Fatal("indexed height missing") }
	if r.Provenance.FinalizedHeight != nil { t.Fatal("safe head must not be mislabeled finalized") }
	if err := r.Validate(); err != nil { t.Fatal(err) }
}

func TestChainDiscoveryTransactionAboveSafeHeadIsHead(t *testing.T) {
	reader := &fakeChainReader{
		status: qualifiedStatus(),
		matches: []indexerclient.SearchResult{{Type: "transaction", Key: "0xtx", Value: "0xtx"}},
		tx: indexerclient.Transaction{ChainID: "420", Hash: "0xtx", BlockNumber: "95", BlockHash: "0x95"},
	}
	d, _ := NewChainDiscovery(reader)
	d.now = func() time.Time { return time.Unix(1700000100, 0).UTC() }
	results, err := d.Resolve(context.Background(), "0xtx")
	if err != nil { t.Fatal(err) }
	if results[0].Domain != architecture.DomainTransaction { t.Fatalf("wrong domain: %s", results[0].Domain) }
	if results[0].Provenance.Finality != searchresult.FinalityHead { t.Fatalf("expected head finality, got %s", results[0].Provenance.Finality) }
	if results[0].Provenance.TransactionHash != "0xtx" { t.Fatal("transaction provenance missing") }
}

func TestChainDiscoveryDistinguishesAddressAndContract(t *testing.T) {
	for _, tc := range []struct {
		name string
		isContract bool
		domain architecture.ResultDomain
		url string
	}{
		{name: "eoa", isContract: false, domain: architecture.DomainAddress, url: "/addresses/0xabc"},
		{name: "contract", isContract: true, domain: architecture.DomainContract, url: "/contracts/0xabc"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			reader := &fakeChainReader{
				status: qualifiedStatus(),
				matches: []indexerclient.SearchResult{{Type: "address", Key: "0xabc", Value: "0xabc"}},
				address: indexerclient.Address{ChainID: "420", Address: "0xabc", IsContract: tc.isContract},
			}
			d, _ := NewChainDiscovery(reader)
			d.now = func() time.Time { return time.Unix(1700000100, 0).UTC() }
			results, err := d.Resolve(context.Background(), "0xabc")
			if err != nil { t.Fatal(err) }
			if results[0].Domain != tc.domain { t.Fatalf("expected %s, got %s", tc.domain, results[0].Domain) }
			if results[0].Presentation.CanonicalURL != tc.url { t.Fatalf("unexpected canonical URL %s", results[0].Presentation.CanonicalURL) }
			if results[0].Provenance.Source != architecture.SourceIndexer { t.Fatal("wrong source boundary") }
		})
	}
}

func TestChainDiscoveryFailsClosedBeforeReadingResults(t *testing.T) {
	reader := &fakeChainReader{qualifiedErr: errors.New("indexer stale")}
	d, _ := NewChainDiscovery(reader)
	if _, err := d.Resolve(context.Background(), "42"); err == nil { t.Fatal("expected qualification failure") }
}

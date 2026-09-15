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

type fakeAssetValidatorReader struct {
	qualifiedErr error
	status indexerclient.Status
	assetPage indexerclient.AssetTransferPage
	tx indexerclient.Transaction
	events indexerclient.ProtocolEventPage
}

func (f *fakeAssetValidatorReader) Qualified(context.Context) error { return f.qualifiedErr }
func (f *fakeAssetValidatorReader) Status(context.Context) (indexerclient.Status, error) { return f.status, nil }
func (f *fakeAssetValidatorReader) AssetTransfers(context.Context, string, uint32) (indexerclient.AssetTransferPage, error) { return f.assetPage, nil }
func (f *fakeAssetValidatorReader) Transaction(context.Context, string) (indexerclient.Transaction, error) { return f.tx, nil }
func (f *fakeAssetValidatorReader) ProtocolEvents(context.Context, string, string, uint32) (indexerclient.ProtocolEventPage, error) { return f.events, nil }

func status420() indexerclient.Status {
	var s indexerclient.Status
	s.ChainID = "420"
	s.IndexedHead = "100"
	s.IndexedHeadTimestamp = "2000000000"
	s.Finality.SafeHead = "90"
	return s
}

func TestResolveAssetPreservesTransferProvenance(t *testing.T) {
	contract := "0x0000000000000000000000000000000000000420"
	reader := &fakeAssetValidatorReader{
		status: status420(),
		assetPage: indexerclient.AssetTransferPage{Items: []indexerclient.AssetTransfer{{
			ChainID:"420", BlockNumber:"88", TransactionHash:"0xtx", LogIndex:3,
			AssetKey:"erc20:0x0000000000000000000000000000000000000420", AssetKind:"erc20",
			ContractAddress:&contract, From:"0xa", To:"0xb", Amount:"420",
		}}},
		tx: indexerclient.Transaction{ChainID:"420", Hash:"0xtx", BlockNumber:"88", BlockHash:"0xblock"},
	}
	d, _ := NewAssetValidatorDiscovery(reader)
	d.now = func() time.Time { return time.Unix(2_000_000_000, 0) }
	got, err := d.ResolveAsset(context.Background(), "erc20:0x0000000000000000000000000000000000000420")
	if err != nil { t.Fatal(err) }
	if len(got) != 1 { t.Fatalf("expected one asset, got %d", len(got)) }
	r := got[0]
	if r.Domain != architecture.DomainAsset || r.Provenance.BlockHash != "0xblock" || r.Provenance.TransactionHash != "0xtx" { t.Fatalf("bad asset result: %+v", r) }
	if r.Provenance.LogIndex == nil || *r.Provenance.LogIndex != 3 || r.Provenance.Finality != searchresult.FinalitySafe { t.Fatalf("bad asset provenance: %+v", r.Provenance) }
	if err := r.Validate(); err != nil { t.Fatal(err) }
}

func TestNativeAssetOmitsSyntheticNegativeLogIndex(t *testing.T) {
	reader := &fakeAssetValidatorReader{
		status: status420(),
		assetPage: indexerclient.AssetTransferPage{Items: []indexerclient.AssetTransfer{{ChainID:"420", BlockNumber:"99", TransactionHash:"0xtx", LogIndex:-1, AssetKey:"native:420", AssetKind:"native", From:"0xa", To:"0xb", Amount:"1"}}},
		tx: indexerclient.Transaction{ChainID:"420", Hash:"0xtx", BlockNumber:"99", BlockHash:"0xblock"},
	}
	d, _ := NewAssetValidatorDiscovery(reader)
	d.now = func() time.Time { return time.Unix(2_000_000_000, 0) }
	got, err := d.ResolveAsset(context.Background(), "native:420")
	if err != nil { t.Fatal(err) }
	if got[0].Provenance.LogIndex != nil { t.Fatalf("synthetic native transfer must not claim canonical log index: %+v", got[0].Provenance) }
}

func TestResolveValidatorUsesCanonicalRegistryProjection(t *testing.T) {
	id := "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	key := id
	reader := &fakeAssetValidatorReader{
		status: status420(),
		events: indexerclient.ProtocolEventPage{Items: []indexerclient.ProtocolEvent{
			{ChainID:"420", BlockNumber:"40", BlockHash:"0x40", TransactionHash:"0xtx40", LogIndex:1, Protocol:"420Stake", EventName:"ValidatorRegistered", ObjectKey:&key, Fields:map[string]any{"validatorId":id,"owner":"0xowner","withdrawal":"0xwithdraw"}},
			{ChainID:"420", BlockNumber:"80", BlockHash:"0x80", TransactionHash:"0xtx80", LogIndex:2, Protocol:"420Stake", EventName:"ConsensusStateApplied", ObjectKey:&key, Fields:map[string]any{"validatorId":id,"newStatus":"3"}},
		}},
	}
	d, _ := NewAssetValidatorDiscovery(reader)
	d.now = func() time.Time { return time.Unix(2_000_000_000, 0) }
	got, err := d.ResolveValidator(context.Background(), id)
	if err != nil { t.Fatal(err) }
	if len(got) != 1 { t.Fatalf("expected one validator, got %d", len(got)) }
	r := got[0]
	if r.Domain != architecture.DomainValidator || r.SourceKey != id { t.Fatalf("bad validator identity: %+v", r) }
	if r.Provenance.BlockNumber == nil || *r.Provenance.BlockNumber != 80 || r.Provenance.LogIndex == nil || *r.Provenance.LogIndex != 2 { t.Fatalf("bad validator provenance: %+v", r.Provenance) }
	if r.Provenance.Authority != "ValidatorRegistry canonical lifecycle via qualified 420Indexer 420Stake projection" { t.Fatalf("bad authority: %s", r.Provenance.Authority) }
	if err := r.Validate(); err != nil { t.Fatal(err) }
}

func TestValidatorHistoryFailsClosedWhenIncomplete(t *testing.T) {
	cursor := "more"
	reader := &fakeAssetValidatorReader{status: status420(), events:indexerclient.ProtocolEventPage{NextCursor:&cursor, Items:[]indexerclient.ProtocolEvent{{ChainID:"420", Protocol:"420Stake"}}}}
	d, _ := NewAssetValidatorDiscovery(reader)
	_, err := d.ResolveValidator(context.Background(), "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
	if err == nil { t.Fatal("expected bounded-history failure") }
}

func TestAssetValidatorDiscoveryRequiresQualifiedIndexer(t *testing.T) {
	reader := &fakeAssetValidatorReader{qualifiedErr: errors.New("not qualified"), status: status420()}
	d, _ := NewAssetValidatorDiscovery(reader)
	if _, err := d.ResolveAsset(context.Background(), "native:420"); err == nil { t.Fatal("expected asset qualification failure") }
	if _, err := d.ResolveValidator(context.Background(), "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"); err == nil { t.Fatal("expected validator qualification failure") }
}

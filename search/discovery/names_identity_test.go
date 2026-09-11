package discovery

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/search/architecture"
	"github.com/420integrated/420-integrated/search/indexerclient"
	searchresult "github.com/420integrated/420-integrated/search/result"
)

type fakeNamesIdentityReader struct {
	qualifiedErr error
	status       indexerclient.Status
	state        indexerclient.ProtocolState
	page         indexerclient.ProtocolEventPage
	stateCalls   int
	eventCalls   int
}

func (f *fakeNamesIdentityReader) Qualified(context.Context) error { return f.qualifiedErr }
func (f *fakeNamesIdentityReader) Status(context.Context) (indexerclient.Status, error) { return f.status, nil }
func (f *fakeNamesIdentityReader) ProtocolState(context.Context, string, string) (indexerclient.ProtocolState, error) {
	f.stateCalls++
	return f.state, nil
}
func (f *fakeNamesIdentityReader) ProtocolEvents(context.Context, string, string, uint32) (indexerclient.ProtocolEventPage, error) {
	f.eventCalls++
	return f.page, nil
}

func event420(protocol, objectKey, eventName, block string, logIndex int, fields map[string]any) indexerclient.ProtocolEvent {
	key := objectKey
	return indexerclient.ProtocolEvent{
		ChainID: "420", BlockNumber: block, BlockHash: "0xblock" + block,
		TransactionHash: "0xtx" + block, TransactionIndex: 0, LogIndex: logIndex,
		ContractAddress: "0xcontract", Protocol: protocol, EventName: eventName,
		ObjectKey: &key, Fields: fields,
	}
}

func TestNameDiscoveryReconstructsPublicRecordWithoutPlaintextRecovery(t *testing.T) {
	label := "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	reader := &fakeNamesIdentityReader{
		status: qualifiedStatus(),
		state: indexerclient.ProtocolState{ChainID:"420", Protocol:"420Names", ObjectKey:label},
		page: indexerclient.ProtocolEventPage{Items: []indexerclient.ProtocolEvent{
			event420("420Names", label, "NameRegistered", "40", 1, map[string]any{"labelHash":label,"owner":"0xowner","expiresAt":"2000000200","labelLength":"7"}),
			event420("420Names", label, "ResolutionUpdated", "41", 2, map[string]any{"labelHash":label,"resolvedAddress":"0xresolved","profileId":"0xprofile","serviceId":"0xservice"}),
		}},
	}
	d, err := NewNamesIdentityDiscovery(reader)
	if err != nil { t.Fatal(err) }
	d.now = func() time.Time { return time.Unix(2_000_000_000, 0).UTC() }
	r, ok, err := d.ResolveName(context.Background(), "labelHash:"+strings.ToUpper(label))
	if err != nil { t.Fatal(err) }
	if !ok { t.Fatal("expected active name") }
	if r.Domain != architecture.DomainName || r.Provenance.Source != architecture.SourceNames { t.Fatalf("unexpected result: %+v", r) }
	if r.Provenance.BlockNumber == nil || *r.Provenance.BlockNumber != 41 || r.Provenance.TransactionHash != "0xtx41" { t.Fatal("latest canonical provenance missing") }
	if r.Provenance.Finality != searchresult.FinalitySafe { t.Fatalf("expected safe result, got %s", r.Provenance.Finality) }
	if !strings.Contains(r.Presentation.Snippet, "0xprofile") || !strings.Contains(r.Presentation.Snippet, "0xservice") { t.Fatal("public resolution references missing") }
	if strings.Contains(strings.ToLower(r.Presentation.Title), "plaintext") { t.Fatal("name result must not claim recovered plaintext") }
	if err := r.Validate(); err != nil { t.Fatal(err) }
}

func TestExpiredNameIsExcluded(t *testing.T) {
	label := "0xbb"
	reader := &fakeNamesIdentityReader{
		status: qualifiedStatus(), state: indexerclient.ProtocolState{ChainID:"420", Protocol:"420Names", ObjectKey:label},
		page: indexerclient.ProtocolEventPage{Items: []indexerclient.ProtocolEvent{
			event420("420Names", label, "NameRegistered", "40", 1, map[string]any{"labelHash":label,"owner":"0xowner","expiresAt":"100"}),
		}},
	}
	d, _ := NewNamesIdentityDiscovery(reader)
	d.now = func() time.Time { return time.Unix(200, 0).UTC() }
	_, ok, err := d.ResolveName(context.Background(), label)
	if err != nil { t.Fatal(err) }
	if ok { t.Fatal("expired name must be excluded") }
}

func TestPublicIdentityReconstructsAnchorAndNeverRetrievesMetadata(t *testing.T) {
	profile := "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
	metadata := "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
	nameHash := "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
	reader := &fakeNamesIdentityReader{
		status: qualifiedStatus(), state: indexerclient.ProtocolState{ChainID:"420", Protocol:"420Identity", ObjectKey:profile},
		page: indexerclient.ProtocolEventPage{Items: []indexerclient.ProtocolEvent{
			event420("420Identity", profile, "ProfileCreated", "50", 1, map[string]any{"profileId":profile,"controller":"0xcontroller","metadataHash":metadata}),
			event420("420Identity", profile, "PrimaryNameSet", "60", 2, map[string]any{"profileId":profile,"labelHash":nameHash}),
		}},
	}
	d, _ := NewNamesIdentityDiscovery(reader)
	d.now = func() time.Time { return time.Unix(2_000_000_000, 0).UTC() }
	r, ok, err := d.ResolvePublicIdentity(context.Background(), profile)
	if err != nil { t.Fatal(err) }
	if !ok { t.Fatal("expected active public profile anchor") }
	if r.Domain != architecture.DomainPublicIdentity || r.Provenance.Source != architecture.SourceIdentity { t.Fatalf("unexpected identity result: %+v", r) }
	if !strings.Contains(r.Presentation.Snippet, "metadata commitment "+metadata) { t.Fatal("metadata commitment should be labeled as commitment") }
	if !strings.Contains(r.Presentation.Snippet, "primary name hash "+nameHash) { t.Fatal("primary name hash missing") }
	if strings.Contains(strings.ToLower(r.Presentation.Snippet), "payload") { t.Fatal("search must not expose or imply metadata payload recovery") }
	if err := r.Validate(); err != nil { t.Fatal(err) }
}

func TestInactiveIdentityIsExcluded(t *testing.T) {
	profile := "0xprofile"
	reader := &fakeNamesIdentityReader{
		status: qualifiedStatus(), state: indexerclient.ProtocolState{ChainID:"420", Protocol:"420Identity", ObjectKey:profile},
		page: indexerclient.ProtocolEventPage{Items: []indexerclient.ProtocolEvent{
			event420("420Identity", profile, "ProfileCreated", "50", 1, map[string]any{"profileId":profile,"controller":"0xcontroller","metadataHash":"0xmeta"}),
			event420("420Identity", profile, "ProfileUpdated", "51", 2, map[string]any{"profileId":profile,"metadataHash":"0xmeta2","active":false}),
		}},
	}
	d, _ := NewNamesIdentityDiscovery(reader)
	d.now = func() time.Time { return time.Unix(2_000_000_000, 0).UTC() }
	_, ok, err := d.ResolvePublicIdentity(context.Background(), profile)
	if err != nil { t.Fatal(err) }
	if ok { t.Fatal("inactive identity must be excluded from public Search") }
}

func TestNamesIdentityFailsClosedBeforeProtocolReads(t *testing.T) {
	reader := &fakeNamesIdentityReader{qualifiedErr: errors.New("indexer stale")}
	d, _ := NewNamesIdentityDiscovery(reader)
	if _, _, err := d.ResolvePublicIdentity(context.Background(), "0xprofile"); err == nil { t.Fatal("expected qualification failure") }
	if reader.stateCalls != 0 || reader.eventCalls != 0 { t.Fatal("protocol reads must not occur before qualification") }
}

func TestNamesIdentityRejectsIncompleteHistory(t *testing.T) {
	profile := "0xprofile"
	cursor := "more"
	reader := &fakeNamesIdentityReader{
		status: qualifiedStatus(), state: indexerclient.ProtocolState{ChainID:"420", Protocol:"420Identity", ObjectKey:profile},
		page: indexerclient.ProtocolEventPage{NextCursor:&cursor},
	}
	d, _ := NewNamesIdentityDiscovery(reader)
	_, _, err := d.ResolvePublicIdentity(context.Background(), profile)
	if !errors.Is(err, ErrProtocolHistoryIncomplete) { t.Fatalf("expected bounded-history failure, got %v", err) }
}

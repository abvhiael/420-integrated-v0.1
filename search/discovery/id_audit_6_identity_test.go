package discovery

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/search/indexerclient"
)

func TestIDAudit6ProfileHistoryCoversControllerTransferPrimaryNameAndReactivation(t *testing.T) {
	profile := "0xprofile"
	firstController := "0x1111111111111111111111111111111111111111"
	nextController := "0x2222222222222222222222222222222222222222"
	nameHash := "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
	metadata1 := "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
	metadata2 := "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"

	events := []indexerclient.ProtocolEvent{
		event420("420Identity", profile, "ProfileCreated", "10", 0, map[string]any{
			"profileId": profile, "controller": firstController, "metadataHash": metadata1,
		}),
		event420("420Identity", profile, "ProfileControllerTransferStarted", "11", 0, map[string]any{
			"profileId": profile, "currentController": firstController, "pendingController": nextController,
		}),
		event420("420Identity", profile, "PrimaryNameSet", "12", 0, map[string]any{
			"profileId": profile, "labelHash": nameHash,
		}),
		event420("420Identity", profile, "ProfileUpdated", "13", 0, map[string]any{
			"profileId": profile, "metadataHash": metadata2, "active": false,
		}),
		event420("420Identity", profile, "ProfileControllerTransferred", "14", 0, map[string]any{
			"profileId": profile, "previousController": firstController, "newController": nextController,
		}),
		event420("420Identity", profile, "ProfileUpdated", "15", 0, map[string]any{
			"profileId": profile, "metadataHash": metadata2, "active": true,
		}),
	}

	state, err := reduceProfileHistory(profile, events)
	if err != nil { t.Fatal(err) }
	if !state.known || !state.active { t.Fatalf("expected active reconstructed profile: %+v", state) }
	if state.controller != nextController { t.Fatalf("controller=%s", state.controller) }
	if state.primaryName != nameHash { t.Fatalf("primaryName=%s", state.primaryName) }
	if state.metadataHash != metadata2 { t.Fatalf("metadataHash=%s", state.metadataHash) }
	if state.last.EventName != "ProfileUpdated" || state.last.BlockNumber != "15" {
		t.Fatalf("latest provenance not retained: %+v", state.last)
	}
}

func TestIDAudit6PublicIdentitySuppressesInactiveAndRestoresAfterReactivation(t *testing.T) {
	profile := "0xprofile"
	base := []indexerclient.ProtocolEvent{
		event420("420Identity", profile, "ProfileCreated", "10", 0, map[string]any{
			"profileId": profile, "controller": "0xcontroller", "metadataHash": "0xcommitment",
		}),
		event420("420Identity", profile, "ProfileUpdated", "11", 0, map[string]any{
			"profileId": profile, "metadataHash": "0xcommitment2", "active": false,
		}),
	}
	reader := &fakeNamesIdentityReader{
		status: qualifiedStatus(),
		state: indexerclient.ProtocolState{ChainID:"420", Protocol:"420Identity", ObjectKey:profile},
		page: indexerclient.ProtocolEventPage{Items: base},
	}
	d, _ := NewNamesIdentityDiscovery(reader)
	d.now = func() time.Time { return time.Unix(2_000_000_000, 0).UTC() }

	if _, ok, err := d.ResolvePublicIdentity(context.Background(), profile); err != nil || ok {
		t.Fatalf("inactive profile leaked into public Search: ok=%v err=%v", ok, err)
	}

	reader.page.Items = append(reader.page.Items, event420("420Identity", profile, "ProfileUpdated", "12", 0, map[string]any{
		"profileId": profile, "metadataHash": "0xcommitment3", "active": true,
	}))
	result, ok, err := d.ResolvePublicIdentity(context.Background(), profile)
	if err != nil || !ok { t.Fatalf("reactivated profile missing: ok=%v err=%v", ok, err) }
	if !strings.Contains(result.Presentation.Snippet, "metadata commitment 0xcommitment3") {
		t.Fatalf("commitment not presented as commitment: %s", result.Presentation.Snippet)
	}
}

func TestIDAudit6MetadataCommitmentsNeverBecomePayloads(t *testing.T) {
	profile := "0xprofile"
	secretLooking := "0xdeadbeef"
	reader := &fakeNamesIdentityReader{
		status: qualifiedStatus(),
		state: indexerclient.ProtocolState{ChainID:"420", Protocol:"420Identity", ObjectKey:profile},
		page: indexerclient.ProtocolEventPage{Items: []indexerclient.ProtocolEvent{
			event420("420Identity", profile, "ProfileCreated", "10", 0, map[string]any{
				"profileId": profile, "controller": "0xcontroller", "metadataHash": secretLooking,
				"metadataPayload": "this-field-must-never-be-indexed-by-search",
			}),
		}},
	}
	d, _ := NewNamesIdentityDiscovery(reader)
	d.now = func() time.Time { return time.Unix(2_000_000_000, 0).UTC() }
	result, ok, err := d.ResolvePublicIdentity(context.Background(), profile)
	if err != nil || !ok { t.Fatalf("resolve failed: ok=%v err=%v", ok, err) }
	if strings.Contains(result.Presentation.Snippet, "this-field-must-never-be-indexed-by-search") {
		t.Fatal("Search exposed metadata payload")
	}
	if !strings.Contains(result.Presentation.Snippet, "metadata commitment "+secretLooking) {
		t.Fatal("Search must expose only the public commitment reference")
	}
}

func TestIDAudit6ProfileRebuildIsDeterministicForCanonicalHistory(t *testing.T) {
	profile := "0xprofile"
	history := []indexerclient.ProtocolEvent{
		event420("420Identity", profile, "ProfileCreated", "10", 0, map[string]any{
			"profileId": profile, "controller": "0xone", "metadataHash": "0xa",
		}),
		event420("420Identity", profile, "PrimaryNameSet", "11", 0, map[string]any{
			"profileId": profile, "labelHash": "0xname",
		}),
		event420("420Identity", profile, "ProfileControllerTransferred", "12", 0, map[string]any{
			"profileId": profile, "previousController": "0xone", "newController": "0xtwo",
		}),
	}
	first, err := reduceProfileHistory(profile, history)
	if err != nil { t.Fatal(err) }
	second, err := reduceProfileHistory(profile, append([]indexerclient.ProtocolEvent(nil), history...))
	if err != nil { t.Fatal(err) }
	if first.controller != second.controller || first.primaryName != second.primaryName ||
		first.metadataHash != second.metadataHash || first.active != second.active {
		t.Fatalf("rebuild drift: first=%+v second=%+v", first, second)
	}
}

func TestIDAudit6RejectsCrossObjectReplay(t *testing.T) {
	_, err := reduceProfileHistory("0xprofile-a", []indexerclient.ProtocolEvent{
		event420("420Identity", "0xprofile-b", "ProfileCreated", "10", 0, map[string]any{
			"profileId": "0xprofile-b", "controller": "0xcontroller", "metadataHash": "0xmeta",
		}),
	})
	if err == nil || !strings.Contains(err.Error(), "invalid 420Identity event history") {
		t.Fatalf("expected cross-object replay rejection, got %v", err)
	}
}

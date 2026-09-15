package discovery

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/search/architecture"
	"github.com/420integrated/420-integrated/search/indexerclient"
	searchresult "github.com/420integrated/420-integrated/search/result"
)

const protocolHistoryLimit uint32 = 200

var ErrProtocolHistoryIncomplete = errors.New("public protocol history exceeds bounded search window")

type NamesIdentityReader interface {
	Qualified(context.Context) error
	Status(context.Context) (indexerclient.Status, error)
	ProtocolState(context.Context, string, string) (indexerclient.ProtocolState, error)
	ProtocolEvents(context.Context, string, string, uint32) (indexerclient.ProtocolEventPage, error)
}

type NamesIdentityDiscovery struct {
	reader NamesIdentityReader
	now    func() time.Time
}

func NewNamesIdentityDiscovery(reader NamesIdentityReader) (*NamesIdentityDiscovery, error) {
	if reader == nil { return nil, errors.New("names/identity reader required") }
	return &NamesIdentityDiscovery{reader: reader, now: time.Now}, nil
}

type publicNameState struct {
	labelHash       string
	owner           string
	pendingOwner    string
	resolvedAddress string
	profileID       string
	serviceID       string
	expiresAt       uint64
	labelLength     uint64
	last            indexerclient.ProtocolEvent
}

type publicProfileState struct {
	profileID  string
	controller string
	metadataHash string
	primaryName string
	active     bool
	known      bool
	last       indexerclient.ProtocolEvent
}

// ResolveName resolves a canonical label-hash object. Names420 intentionally
// does not publish plaintext labels, so Search never attempts dictionary
// recovery or commitment reversal. The bool is false for expired/nonexistent
// records.
func (d *NamesIdentityDiscovery) ResolveName(ctx context.Context, labelHash string) (searchresult.Result, bool, error) {
	key := normalizeObjectKey("labelHash", labelHash)
	if key == "" { return searchresult.Result{}, false, errors.New("label hash required") }
	status, indexedHeight, safeHeight, err := d.qualifiedStatus(ctx)
	if err != nil { return searchresult.Result{}, false, err }
	_ = status
	if _, err := d.reader.ProtocolState(ctx, "420Names", key); err != nil { return searchresult.Result{}, false, err }
	page, err := d.reader.ProtocolEvents(ctx, "420Names", key, protocolHistoryLimit)
	if err != nil { return searchresult.Result{}, false, err }
	if page.NextCursor != nil { return searchresult.Result{}, false, ErrProtocolHistoryIncomplete }
	state, err := reduceNameHistory(key, page.Items)
	if err != nil { return searchresult.Result{}, false, err }
	if state.owner == "" || state.expiresAt == 0 || uint64(d.now().Unix()) >= state.expiresAt { return searchresult.Result{}, false, nil }
	p, err := protocolProvenance(architecture.SourceNames, "420Names / Names420", state.last, indexedHeight, safeHeight, d.now())
	if err != nil { return searchresult.Result{}, false, err }
	subtitle := state.resolvedAddress
	if subtitle == "" { subtitle = state.owner }
	snippet := fmt.Sprintf("canonical .420 label-hash record · owner %s · expires %d", state.owner, state.expiresAt)
	if state.profileID != "" && !zeroHex(state.profileID) { snippet += " · profile " + state.profileID }
	if state.serviceID != "" && !zeroHex(state.serviceID) { snippet += " · service " + state.serviceID }
	r, err := searchresult.New(
		architecture.DomainName,
		key,
		architecture.SearchModeResolver,
		p,
		searchresult.Presentation{
			Title: "420 Name " + key,
			Subtitle: subtitle,
			Snippet: snippet,
			Category: "420 name",
			CanonicalURL: "/names/" + key,
			Tags: []string{"420Names", "label-hash", "public-onchain-anchor"},
		},
	)
	return r, true, err
}

// ResolvePublicIdentity exposes only the public on-chain profile anchor. A
// metadataHash is presented as a commitment/reference only; this code never
// dereferences it or retrieves a profile payload. Inactive profiles are not
// emitted into public Search results.
func (d *NamesIdentityDiscovery) ResolvePublicIdentity(ctx context.Context, profileID string) (searchresult.Result, bool, error) {
	key := normalizeObjectKey("profileId", profileID)
	if key == "" { return searchresult.Result{}, false, errors.New("profile id required") }
	_, indexedHeight, safeHeight, err := d.qualifiedStatus(ctx)
	if err != nil { return searchresult.Result{}, false, err }
	if _, err := d.reader.ProtocolState(ctx, "420Identity", key); err != nil { return searchresult.Result{}, false, err }
	page, err := d.reader.ProtocolEvents(ctx, "420Identity", key, protocolHistoryLimit)
	if err != nil { return searchresult.Result{}, false, err }
	if page.NextCursor != nil { return searchresult.Result{}, false, ErrProtocolHistoryIncomplete }
	state, err := reduceProfileHistory(key, page.Items)
	if err != nil { return searchresult.Result{}, false, err }
	if !state.known || !state.active || state.controller == "" { return searchresult.Result{}, false, nil }
	p, err := protocolProvenance(architecture.SourceIdentity, "420Identity / Identity420 public on-chain anchor", state.last, indexedHeight, safeHeight, d.now())
	if err != nil { return searchresult.Result{}, false, err }
	snippet := "active public on-chain identity anchor"
	if state.metadataHash != "" && !zeroHex(state.metadataHash) { snippet += " · metadata commitment " + state.metadataHash }
	if state.primaryName != "" && !zeroHex(state.primaryName) { snippet += " · primary name hash " + state.primaryName }
	r, err := searchresult.New(
		architecture.DomainPublicIdentity,
		key,
		architecture.SearchModeResolver,
		p,
		searchresult.Presentation{
			Title: "420 Identity " + key,
			Subtitle: state.controller,
			Snippet: snippet,
			Category: "public identity/profile",
			CanonicalURL: "/identities/" + key,
			Tags: []string{"420Identity", "public-onchain-anchor"},
		},
	)
	return r, true, err
}

func (d *NamesIdentityDiscovery) qualifiedStatus(ctx context.Context) (indexerclient.Status, *uint64, *uint64, error) {
	if err := d.reader.Qualified(ctx); err != nil { return indexerclient.Status{}, nil, nil, err }
	status, err := d.reader.Status(ctx)
	if err != nil { return indexerclient.Status{}, nil, nil, err }
	indexed, err := parseOptionalUint(status.IndexedHead)
	if err != nil { return indexerclient.Status{}, nil, nil, err }
	safe, err := parseOptionalUint(status.Finality.SafeHead)
	if err != nil { return indexerclient.Status{}, nil, nil, err }
	return status, indexed, safe, nil
}

func reduceNameHistory(key string, events []indexerclient.ProtocolEvent) (publicNameState, error) {
	state := publicNameState{labelHash: key}
	for _, event := range events {
		if event.Protocol != "420Names" || event.ObjectKey == nil || normalizeObjectKey("labelHash", *event.ObjectKey) != key { return publicNameState{}, errors.New("invalid 420Names event history") }
		state.last = event
		switch event.EventName {
		case "NameRegistered":
			state.owner = fieldString(event.Fields, "owner")
			state.resolvedAddress = state.owner
			state.expiresAt = fieldUint(event.Fields, "expiresAt")
			state.labelLength = fieldUint(event.Fields, "labelLength")
			state.pendingOwner = ""
			state.profileID, state.serviceID = "", ""
		case "NameRenewed":
			if owner := fieldString(event.Fields, "owner"); owner != "" { state.owner = owner }
			if expires := fieldUint(event.Fields, "expiresAt"); expires != 0 { state.expiresAt = expires }
		case "ResolutionUpdated":
			state.resolvedAddress = fieldString(event.Fields, "resolvedAddress")
			state.profileID = fieldString(event.Fields, "profileId")
			state.serviceID = fieldString(event.Fields, "serviceId")
		case "NameTransferStarted":
			state.pendingOwner = fieldString(event.Fields, "pendingOwner")
		case "NameTransferred":
			if owner := fieldString(event.Fields, "newOwner"); owner != "" { state.owner = owner; state.resolvedAddress = owner }
			state.pendingOwner = ""
			state.profileID, state.serviceID = "", ""
		}
	}
	return state, nil
}

func reduceProfileHistory(key string, events []indexerclient.ProtocolEvent) (publicProfileState, error) {
	state := publicProfileState{profileID: key}
	for _, event := range events {
		if event.Protocol != "420Identity" || event.ObjectKey == nil || normalizeObjectKey("profileId", *event.ObjectKey) != key { return publicProfileState{}, errors.New("invalid 420Identity event history") }
		state.last = event
		switch event.EventName {
		case "ProfileCreated":
			state.known = true
			state.active = true
			state.controller = fieldString(event.Fields, "controller")
			state.metadataHash = fieldString(event.Fields, "metadataHash")
		case "ProfileUpdated":
			if metadata := fieldString(event.Fields, "metadataHash"); metadata != "" { state.metadataHash = metadata }
			if active, ok := fieldBool(event.Fields, "active"); ok { state.active = active }
		case "PrimaryNameSet":
			state.primaryName = fieldString(event.Fields, "labelHash")
		case "ProfileControllerTransferred":
			if controller := fieldString(event.Fields, "newController"); controller != "" { state.controller = controller }
		}
	}
	return state, nil
}

func protocolProvenance(source architecture.SourceBoundary, authority string, event indexerclient.ProtocolEvent, indexedHeight, safeHeight *uint64, at time.Time) (searchresult.Provenance, error) {
	chainID, err := strconv.ParseUint(event.ChainID, 10, 64)
	if err != nil || chainID == 0 { return searchresult.Provenance{}, errors.New("invalid protocol event chain id") }
	blockNumber, err := strconv.ParseUint(event.BlockNumber, 10, 64)
	if err != nil { return searchresult.Provenance{}, errors.New("invalid protocol event block number") }
	if event.LogIndex < 0 { return searchresult.Provenance{}, errors.New("invalid protocol event log index") }
	logIndex := uint64(event.LogIndex)
	finality := searchresult.FinalityHead
	if safeHeight != nil && blockNumber <= *safeHeight { finality = searchresult.FinalitySafe }
	return searchresult.Provenance{
		Source: source,
		Authority: authority,
		ChainID: chainID,
		BlockNumber: &blockNumber,
		BlockHash: event.BlockHash,
		TransactionHash: event.TransactionHash,
		LogIndex: &logIndex,
		Finality: finality,
		IndexedAt: at,
		IndexedHeight: indexedHeight,
	}, nil
}

func normalizeObjectKey(field, value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	prefix := strings.ToLower(field) + ":"
	value = strings.TrimPrefix(value, prefix)
	return value
}

func fieldString(fields map[string]any, key string) string {
	value, ok := fields[key]
	if !ok || value == nil { return "" }
	if s, ok := value.(string); ok { return strings.ToLower(strings.TrimSpace(s)) }
	return fmt.Sprint(value)
}

func fieldUint(fields map[string]any, key string) uint64 {
	value, ok := fields[key]
	if !ok || value == nil { return 0 }
	s := fmt.Sprint(value)
	n, _ := strconv.ParseUint(s, 10, 64)
	return n
}

func fieldBool(fields map[string]any, key string) (bool, bool) {
	value, ok := fields[key]
	if !ok { return false, false }
	b, ok := value.(bool)
	return b, ok
}

func zeroHex(value string) bool {
	value = strings.TrimPrefix(strings.ToLower(strings.TrimSpace(value)), "0x")
	if value == "" { return true }
	for _, r := range value { if r != '0' { return false } }
	return true
}

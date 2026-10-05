package integrations

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/420integrated/420-integrated/notifications/feed"
	notificationsecurity "github.com/420integrated/420-integrated/notifications/security"
	"github.com/420integrated/420-integrated/search/architecture"
	"github.com/420integrated/420-integrated/search/privacy"
	searchresult "github.com/420integrated/420-integrated/search/result"
	storage420 "github.com/420integrated/420-integrated/sdk/storage420"
	"github.com/420integrated/420-integrated/town/content"
	"github.com/420integrated/420-integrated/town/model"
)

const (
	IdentityServiceID      = "420/service/identity/v1"
	StorageServiceID       = "420/service/resource-protocol/v1"
	SearchServiceID        = "420/service/search/v1"
	NotificationsServiceID = "420/service/notifications/v1"
	MessengerServiceID     = "420/service/messenger/v1"
	TownServiceID          = "420/service/town/v1"
)

var (
	ErrInvalidIntegration = errors.New("invalid Town integration input")
	ErrDependencyUnavailable = errors.New("Town dependency unavailable")
	ErrDependencyMismatch = errors.New("Town dependency identity mismatch")
	ErrUnauthorizedIntegration = errors.New("Town integration unauthorized")
	ErrIntegrity = errors.New("Town integration integrity failure")
	sha256Hex = regexp.MustCompile("^[a-f0-9]{64}$")
)

type IdentityProfile struct {
	ProfileID model.ObjectID
	Controller string
	Active bool
}

type IdentityReader interface {
	Profile(context.Context, model.ObjectID) (IdentityProfile, error)
}

// IdentityAdapter binds a Town actor ID to the canonical Identity420 profile ID.
// Town does not mint, mutate or infer Identity credentials.
type IdentityAdapter struct{ Reader IdentityReader }

func (a IdentityAdapter) RequireActiveProfile(ctx context.Context, actor model.ObjectID) (IdentityProfile, error) {
	if a.Reader == nil || !actor.Valid() { return IdentityProfile{}, ErrInvalidIntegration }
	p, err := a.Reader.Profile(ctx, actor)
	if err != nil { return IdentityProfile{}, fmt.Errorf("%w: identity: %v", ErrDependencyUnavailable, err) }
	if p.ProfileID != actor || strings.TrimSpace(p.Controller) == "" { return IdentityProfile{}, ErrDependencyMismatch }
	if !p.Active { return IdentityProfile{}, ErrUnauthorizedIntegration }
	return p, nil
}

type StorageAdapter struct{ Client *storage420.Client }

func (a StorageAdapter) PrepareContent(ctx context.Context, object storage420.ObjectRef, digest, idempotencyKey string, pre storage420.UploadPreconditions) (content.ContentAnchor, storage420.UploadPlan, error) {
	digest = strings.ToLower(strings.TrimSpace(digest))
	if a.Client == nil || !validObjectRef(object) || !sha256Hex.MatchString(digest) || strings.TrimSpace(idempotencyKey) == "" {
		return content.ContentAnchor{}, storage420.UploadPlan{}, ErrInvalidIntegration
	}
	plan, err := a.Client.PrepareUpload(ctx, storage420.UploadPrepareRequest{
		Version: storage420.APIVersion, Object: object, IdempotencyKey: idempotencyKey, Preconditions: pre,
	})
	if err != nil { return content.ContentAnchor{}, storage420.UploadPlan{}, err }
	if plan.Object.ObjectID != object.ObjectID || plan.Object.ManifestID != object.ManifestID || plan.IdempotencyKey != idempotencyKey {
		return content.ContentAnchor{}, storage420.UploadPlan{}, ErrDependencyMismatch
	}
	ref := storageRef(object)
	return content.ContentAnchor{Ref: ref, SHA256: digest}, plan, nil
}

func (a StorageAdapter) RetrieveContent(ctx context.Context, anchor content.ContentAnchor, object storage420.ObjectRef, access storage420.ReadAccess) ([]byte, error) {
	if a.Client == nil || !validObjectRef(object) || anchor.Ref != storageRef(object) || !sha256Hex.MatchString(anchor.SHA256) {
		return nil, ErrInvalidIntegration
	}
	out, err := a.Client.Retrieve(ctx, storage420.RetrieveRequest{Version: storage420.APIVersion, Object: object, Access: access})
	if err != nil { return nil, err }
	if out.Object.ObjectID != object.ObjectID || out.Object.ManifestID != object.ManifestID { return nil, ErrDependencyMismatch }
	sum := sha256.Sum256(out.Payload)
	if hex.EncodeToString(sum[:]) != anchor.SHA256 { return nil, ErrIntegrity }
	return append([]byte(nil), out.Payload...), nil
}

func storageRef(o storage420.ObjectRef) string {
	return "storage420://object/" + url.PathEscape(o.ObjectID) + "?manifest=" + url.QueryEscape(o.ManifestID)
}

func validObjectRef(o storage420.ObjectRef) bool {
	return strings.TrimSpace(o.ObjectID)!="" && strings.TrimSpace(o.ManifestID)!="" &&
		strings.TrimSpace(o.ShardRoot)!="" && strings.TrimSpace(o.CommitmentID)!=""
}

type PublicDocument struct {
	Kind string
	ID model.ObjectID
	CommunityID model.ObjectID
	Title string
	Snippet string
	Visibility model.Visibility
	Active bool
	IndexedAt time.Time
}

// SearchResult constructs a 420Search-owned, non-canonical discovery result.
// Only explicitly PUBLIC active Town material is eligible.
func SearchResult(doc PublicDocument) (searchresult.Result, error) {
	if (doc.Kind!="community" && doc.Kind!="post") || !doc.ID.Valid() || !doc.CommunityID.Valid() ||
		strings.TrimSpace(doc.Title)=="" || doc.Visibility!=model.VisibilityPublic || !doc.Active || doc.IndexedAt.IsZero() {
		return searchresult.Result{}, ErrInvalidIntegration
	}
	candidate:=privacy.Candidate{
		Source: architecture.SourceTown, Domain: architecture.DomainPublicTown,
		Classification: privacy.ClassPublicOnChain, Public: true,
	}
	if err:=privacy.Admit(candidate);err!=nil{return searchresult.Result{},err}
	path:="/town/communities/"+url.PathEscape(string(doc.CommunityID))
	if doc.Kind=="post"{path+="/posts/"+url.PathEscape(string(doc.ID))}
	return searchresult.New(
		architecture.DomainPublicTown,
		doc.Kind+":"+string(doc.ID),
		architecture.SearchModeDiscovery,
		searchresult.Provenance{
			Source:architecture.SourceTown,
			Authority:"420Town application state; Search projection is non-canonical",
			Finality:searchresult.FinalityUnknown,
			IndexedAt:doc.IndexedAt.UTC(),
		},
		searchresult.Presentation{
			Title:doc.Title,Snippet:doc.Snippet,Category:"420town",CanonicalURL:path,
			Tags:[]string{"420town",doc.Kind},
		},
	)
}

type NotificationCandidate struct {
	ID string
	EventID string
	SubscriptionID string
	Title string
	Body string
	Provenance notificationsecurity.Provenance
	CreatedAt time.Time
}

// NotificationFeedSink is an explicit handoff into the qualified 420Notifications
// feed store after recipient/subscription consent has already been selected by
// the notifications service. Town never chooses a recipient implicitly.
type NotificationFeedSink struct{ Store *feed.Store }

func (s NotificationFeedSink) Submit(ctx context.Context, n NotificationCandidate) (feed.Item,error) {
	if err:=ctx.Err();err!=nil{return feed.Item{},err}
	if s.Store==nil || strings.TrimSpace(n.ID)=="" || strings.TrimSpace(n.EventID)=="" ||
		strings.TrimSpace(n.SubscriptionID)=="" || strings.TrimSpace(n.Title)=="" || n.CreatedAt.IsZero() {
		return feed.Item{},ErrInvalidIntegration
	}
	item:=feed.Item{
		ID:n.ID,EventID:n.EventID,SubscriptionID:n.SubscriptionID,Title:n.Title,Body:n.Body,
		Provenance:n.Provenance,CreatedAt:n.CreatedAt.UTC(),UpdatedAt:n.CreatedAt.UTC(),
		DeliveryStatus:feed.DeliveryPending,Authoritative:false,
	}
	return s.Store.Put(item)
}

type MessengerAuthority interface {
	EndpointActive(context.Context, model.ObjectID) (bool,error)
	ConversationActive(context.Context, string) (bool,error)
	ConversationParticipant(context.Context, string, model.ObjectID) (bool,error)
	Blocked(context.Context, model.ObjectID, model.ObjectID) (bool,error)
}

type EncryptedTransport interface {
	SendEncrypted(context.Context, EncryptedEnvelope) (TransportReceipt,error)
}

type EncryptedEnvelope struct {
	ConversationID string
	SenderID model.ObjectID
	RecipientID model.ObjectID
	Sequence uint64
	EnvelopeSHA256 string
	StorageRefSHA256 string
	Ciphertext []byte
}

type TransportReceipt struct {
	ProviderID string
	TransportMessageID string
	AcceptedAt time.Time
}

// MessengerAdapter uses canonical Messenger authorization/state and a replaceable
// encrypted transport. It never stores plaintext or mutates Town authority.
type MessengerAdapter struct {
	Authority MessengerAuthority
	Transport EncryptedTransport
}

func (a MessengerAdapter) Send(ctx context.Context, e EncryptedEnvelope) (TransportReceipt,error) {
	if a.Authority==nil || a.Transport==nil || strings.TrimSpace(e.ConversationID)=="" ||
		!e.SenderID.Valid() || !e.RecipientID.Valid() || e.SenderID==e.RecipientID || e.Sequence==0 ||
		!sha256Hex.MatchString(e.EnvelopeSHA256) || !sha256Hex.MatchString(e.StorageRefSHA256) || len(e.Ciphertext)==0 {
		return TransportReceipt{},ErrInvalidIntegration
	}
	for _,id:=range []model.ObjectID{e.SenderID,e.RecipientID}{
		active,err:=a.Authority.EndpointActive(ctx,id);if err!=nil{return TransportReceipt{},fmt.Errorf("%w: messenger endpoint: %v",ErrDependencyUnavailable,err)}
		if !active{return TransportReceipt{},ErrUnauthorizedIntegration}
	}
	active,err:=a.Authority.ConversationActive(ctx,e.ConversationID)
	if err!=nil{return TransportReceipt{},fmt.Errorf("%w: messenger conversation: %v",ErrDependencyUnavailable,err)}
	if !active{return TransportReceipt{},ErrUnauthorizedIntegration}
	for _,id:=range []model.ObjectID{e.SenderID,e.RecipientID}{
		ok,err:=a.Authority.ConversationParticipant(ctx,e.ConversationID,id)
		if err!=nil{return TransportReceipt{},fmt.Errorf("%w: messenger participant: %v",ErrDependencyUnavailable,err)}
		if !ok{return TransportReceipt{},ErrUnauthorizedIntegration}
	}
	for _,pair:=range [][2]model.ObjectID{{e.SenderID,e.RecipientID},{e.RecipientID,e.SenderID}}{
		blocked,err:=a.Authority.Blocked(ctx,pair[0],pair[1])
		if err!=nil{return TransportReceipt{},fmt.Errorf("%w: messenger block state: %v",ErrDependencyUnavailable,err)}
		if blocked{return TransportReceipt{},ErrUnauthorizedIntegration}
	}
	r,err:=a.Transport.SendEncrypted(ctx,e)
	if err!=nil{return TransportReceipt{},err}
	if strings.TrimSpace(r.ProviderID)=="" || strings.TrimSpace(r.TransportMessageID)=="" || r.AcceptedAt.IsZero(){
		return TransportReceipt{},ErrDependencyMismatch
	}
	return r,nil
}

type ServiceBinding struct {
	ServiceID string
	Endpoint string
	Revision string
	Active bool
}

type ServiceResolver interface {
	Resolve(context.Context,string)(ServiceBinding,error)
}

// ResolveService supports optional Registry/service discovery without changing
// Town's frozen-application classification. Returned bindings must match the
// requested stable service ID and be active.
func ResolveService(ctx context.Context,resolver ServiceResolver,serviceID string)(ServiceBinding,error){
	if resolver==nil || strings.TrimSpace(serviceID)==""{return ServiceBinding{},ErrInvalidIntegration}
	b,err:=resolver.Resolve(ctx,serviceID)
	if err!=nil{return ServiceBinding{},fmt.Errorf("%w: discovery: %v",ErrDependencyUnavailable,err)}
	if b.ServiceID!=serviceID || !b.Active{return ServiceBinding{},ErrDependencyMismatch}
	return b,nil
}

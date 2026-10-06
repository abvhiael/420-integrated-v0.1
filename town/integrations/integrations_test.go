package integrations

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"testing"
	"time"

	notificationsecurity "github.com/420integrated/420-integrated/notifications/security"
	"github.com/420integrated/420-integrated/notifications/feed"
	"github.com/420integrated/420-integrated/notifications/subscriptions"
	"github.com/420integrated/420-integrated/search/architecture"
	storage420 "github.com/420integrated/420-integrated/sdk/storage420"
	"github.com/420integrated/420-integrated/town/content"
	"github.com/420integrated/420-integrated/town/model"
)

type identityFake struct{ p IdentityProfile; err error }
func(f identityFake)Profile(context.Context,model.ObjectID)(IdentityProfile,error){return f.p,f.err}

type storageTransportFake struct{ payload []byte; badPlan bool }
func(f storageTransportFake)Retrieve(_ context.Context,r storage420.RetrieveRequest)(storage420.RetrieveResult,error){
	return storage420.RetrieveResult{Version:storage420.APIVersion,Object:r.Object,Payload:append([]byte(nil),f.payload...)},nil
}
func(f storageTransportFake)PrepareUpload(_ context.Context,r storage420.UploadPrepareRequest)(storage420.UploadPlan,error){
	obj:=r.Object;if f.badPlan{obj.ObjectID="other"}
	return storage420.UploadPlan{Version:storage420.APIVersion,UploadID:"u1",Object:obj,IdempotencyKey:r.IdempotencyKey,Preconditions:r.Preconditions,ProviderID:"p",NodeID:"n",ServiceID:StorageServiceID},nil
}
func(storageTransportFake)Discover(context.Context,storage420.DiscoveryRequest)(storage420.DiscoveryResult,error){return storage420.DiscoveryResult{},nil}
func(storageTransportFake)Status(context.Context)(storage420.ResourceStatus,error){return storage420.ResourceStatus{},nil}

type messengerAuthorityFake struct{ active bool; participant bool; blocked bool; err error }
func(f messengerAuthorityFake)EndpointActive(context.Context,model.ObjectID)(bool,error){return f.active,f.err}
func(f messengerAuthorityFake)ConversationActive(context.Context,string)(bool,error){return f.active,f.err}
func(f messengerAuthorityFake)ConversationParticipant(context.Context,string,model.ObjectID)(bool,error){return f.participant,f.err}
func(f messengerAuthorityFake)Blocked(context.Context,model.ObjectID,model.ObjectID)(bool,error){return f.blocked,f.err}
func(f messengerAuthorityFake)CommitEnvelope(context.Context,EncryptedEnvelope)(CanonicalEnvelopeReceipt,error){
	if f.err!=nil{return CanonicalEnvelopeReceipt{},f.err}
	return CanonicalEnvelopeReceipt{MessageID:"canonical-msg-1",CommittedAt:time.Unix(1700000001,0).UTC()},nil
}

type transportFake struct{ got EncryptedEnvelope; err error }
func(f *transportFake)SendEncrypted(_ context.Context,e EncryptedEnvelope)(TransportReceipt,error){
	f.got=e
	if f.err!=nil{return TransportReceipt{},f.err}
	return TransportReceipt{ProviderID:"replaceable-1",TransportMessageID:"msg-1",AcceptedAt:time.Unix(1700000000,0).UTC()},nil
}

type resolverFake struct{ b ServiceBinding; err error }
func(f resolverFake)Resolve(context.Context,string)(ServiceBinding,error){return f.b,f.err}

func TestIdentityRequiresExactActiveCanonicalProfile(t *testing.T){
	id:=model.ObjectID("profile:alice")
	a:=IdentityAdapter{Reader:identityFake{p:IdentityProfile{ProfileID:id,Controller:"0xabc",Active:true}}}
	if _,err:=a.RequireActiveProfile(context.Background(),id);err!=nil{t.Fatal(err)}
	for _,tc:=range []IdentityProfile{
		{ProfileID:"profile:bob",Controller:"0xabc",Active:true},
		{ProfileID:id,Controller:"",Active:true},
		{ProfileID:id,Controller:"0xabc",Active:false},
	}{
		a.Reader=identityFake{p:tc}
		if _,err:=a.RequireActiveProfile(context.Background(),id);err==nil{t.Fatalf("expected fail closed for %+v",tc)}
	}
}

func TestIdentityDependencyFailureDoesNotInventLocalAuthority(t *testing.T){
	id:=model.ObjectID("profile:alice")
	a:=IdentityAdapter{Reader:identityFake{err:errors.New("rpc unavailable")}}
	if _,err:=a.RequireActiveProfile(context.Background(),id);!errors.Is(err,ErrDependencyUnavailable){t.Fatalf("got %v",err)}
}

func objectFixture()storage420.ObjectRef{
	return storage420.ObjectRef{ObjectID:"obj-1",ManifestID:"manifest-1",ShardIndex:0,ShardRoot:"root-1",SizeBytes:5,CommitmentID:"commit-1"}
}

func TestStoragePrepareAndRetrieveVerifiesPayloadIntegrity(t *testing.T){
	payload:=[]byte("hello")
	sum:=sha256.Sum256(payload);digest:=hex.EncodeToString(sum[:])
	client:=storage420.NewClient(storageTransportFake{payload:payload});client.Retry.MaxAttempts=1
	a:=StorageAdapter{Client:client}
	anchor,plan,err:=a.PrepareContent(context.Background(),objectFixture(),digest,"idem-1",storage420.UploadPreconditions{AgreementID:"a",CapacityReservationID:"c",CommitmentID:"commit-1"})
	if err!=nil{t.Fatal(err)}
	if plan.ServiceID!=StorageServiceID || anchor.Ref=="" || anchor.SHA256!=digest{t.Fatalf("bad prepare %+v %+v",anchor,plan)}
	got,err:=a.RetrieveContent(context.Background(),anchor,objectFixture(),storage420.ReadAccess{Mode:storage420.AccessPublic})
	if err!=nil || string(got)!="hello"{t.Fatalf("retrieve %q %v",got,err)}
}

func TestStorageRejectsProviderSubstitutionAndPayloadTampering(t *testing.T){
	payload:=[]byte("hello");sum:=sha256.Sum256(payload);digest:=hex.EncodeToString(sum[:])
	client:=storage420.NewClient(storageTransportFake{payload:payload,badPlan:true});client.Retry.MaxAttempts=1
	a:=StorageAdapter{Client:client}
	if _,_,err:=a.PrepareContent(context.Background(),objectFixture(),digest,"idem-1",storage420.UploadPreconditions{});!errors.Is(err,ErrDependencyMismatch){t.Fatalf("got %v",err)}
	client=storage420.NewClient(storageTransportFake{payload:[]byte("tampered")});client.Retry.MaxAttempts=1
	a.Client=client
	anchor:=content.ContentAnchor{Ref:storageRef(objectFixture()),SHA256:digest}
	_,err:=a.RetrieveContent(context.Background(),anchor,objectFixture(),storage420.ReadAccess{Mode:storage420.AccessPublic})
	if !errors.Is(err,ErrIntegrity){t.Fatalf("got %v",err)}
}

func TestSearchProjectsOnlyExplicitPublicTownMaterial(t *testing.T){
	now:=time.Unix(1700000000,0).UTC()
	r,err:=SearchResult(PublicDocument{Kind:"post",ID:"post:1",CommunityID:"community:1",Title:"hello",Visibility:model.VisibilityPublic,Active:true,IndexedAt:now})
	if err!=nil{t.Fatal(err)}
	if r.Domain!=architecture.DomainPublicTown || r.Provenance.Source!=architecture.SourceTown || r.Ranking.Canonical || r.Sponsorship.Canonical{t.Fatalf("unsafe result %+v",r)}
	if err:=r.Validate();err!=nil{t.Fatal(err)}
	for _,v:=range []model.Visibility{model.VisibilityPrivate,model.VisibilityCommunityOnly,model.VisibilityFollowers}{
		if _,err:=SearchResult(PublicDocument{Kind:"post",ID:"post:1",CommunityID:"community:1",Title:"hidden",Visibility:v,Active:true,IndexedAt:now});err==nil{
			t.Fatalf("visibility %s leaked to search",v)
		}
	}
}

func TestNotificationHandoffRemainsNonAuthoritativeAndProvenanceBound(t *testing.T){
	store:=feed.NewStore();subs:=subscriptions.NewStore()
	_,err:=subs.Create(subscriptions.Subscription{ID:"sub-1",Filters:subscriptions.Filters{Sources:[]string{TownServiceID}},MinimumSeverity:subscriptions.SeverityInfo,Channels:[]subscriptions.Channel{subscriptions.ChannelInApp},Active:true,OperationalConsent:true})
	if err!=nil{t.Fatal(err)}
	sink:=NotificationFeedSink{Store:store,Subscriptions:subs}
	now:=time.Unix(1700000000,0).UTC()
	p:=notificationsecurity.Provenance{ChainID:"420",BlockNumber:"10",BlockHash:"0xabc",TransactionHash:"0xdef",LogIndex:1,SourceID:TownServiceID,OriginURL:"https://town.example/post/1"}
	item,err:=sink.Submit(context.Background(),NotificationCandidate{ID:"notice-1",EventID:"post:1",SubscriptionID:"sub-1",Title:"reply",Provenance:p,CreatedAt:now})
	if err!=nil{t.Fatal(err)}
	if item.Authoritative || item.DeliveryStatus!=feed.DeliveryPending{t.Fatalf("unsafe notification %+v",item)}
	if _,err:=sink.Submit(context.Background(),NotificationCandidate{ID:"notice-2",EventID:"post:2",SubscriptionID:"",Title:"reply",Provenance:p,CreatedAt:now});err==nil{
		t.Fatal("notification without explicit subscription selection must fail")
	}
	muted,_:=subs.SetMuted("sub-1",true)
	if !muted.Muted{t.Fatal("expected muted subscription")}
	if _,err:=sink.Submit(context.Background(),NotificationCandidate{ID:"notice-3",EventID:"post:3",SubscriptionID:"sub-1",Title:"reply",Provenance:p,CreatedAt:now});!errors.Is(err,ErrUnauthorizedIntegration){t.Fatalf("muted subscription got %v",err)}
}

func envelopeFixture()EncryptedEnvelope{
	return EncryptedEnvelope{
		ConversationID:"conv-1",SenderID:"profile:alice",RecipientID:"profile:bob",Sequence:1,
		EnvelopeSHA256:"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		StorageRefSHA256:"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
		Ciphertext:[]byte{1,2,3},
	}
}

func TestMessengerRequiresCanonicalAuthorizationAndReplaceableEncryptedTransport(t *testing.T){
	tx:=&transportFake{}
	a:=MessengerAdapter{Authority:messengerAuthorityFake{active:true,participant:true},Transport:tx}
	r,err:=a.Send(context.Background(),envelopeFixture())
	if err!=nil{t.Fatal(err)}
	if r.ProviderID!="replaceable-1" || r.CanonicalMessageID!="canonical-msg-1" || len(tx.got.Ciphertext)==0{t.Fatalf("bad receipt %+v",r)}
	a.Authority=messengerAuthorityFake{active:true,participant:true,blocked:true}
	if _,err:=a.Send(context.Background(),envelopeFixture());!errors.Is(err,ErrUnauthorizedIntegration){t.Fatalf("blocked send got %v",err)}
}

func TestMessengerFailsClosedOnAuthorityOutageAndNeverFallsBack(t *testing.T){
	tx:=&transportFake{}
	a:=MessengerAdapter{Authority:messengerAuthorityFake{err:errors.New("rpc unavailable")},Transport:tx}
	if _,err:=a.Send(context.Background(),envelopeFixture());!errors.Is(err,ErrDependencyUnavailable){t.Fatalf("got %v",err)}
	if tx.got.ConversationID!=""{t.Fatal("transport must not receive data when canonical authorization is unavailable")}
}

func TestServiceDiscoveryRejectsWrongOrInactiveBinding(t *testing.T){
	ctx:=context.Background()
	want:=SearchServiceID
	if _,err:=ResolveService(ctx,resolverFake{b:ServiceBinding{ServiceID:want,Endpoint:"https://search.example",Revision:"1",Active:true}},want);err!=nil{t.Fatal(err)}
	for _,b:=range []ServiceBinding{
		{ServiceID:"wrong",Active:true},
		{ServiceID:want,Active:false},
	}{
		if _,err:=ResolveService(ctx,resolverFake{b:b},want);!errors.Is(err,ErrDependencyMismatch){t.Fatalf("binding %+v got %v",b,err)}
	}
}

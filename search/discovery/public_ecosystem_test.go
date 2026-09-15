package discovery

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/search/architecture"
	"github.com/420integrated/420-integrated/search/indexerclient"
)

type publicReaderStub struct {
	qualifiedErr error
	status indexerclient.Status
	pages map[string]indexerclient.ProtocolEventPage
}
func (s *publicReaderStub) Qualified(context.Context) error { return s.qualifiedErr }
func (s *publicReaderStub) Status(context.Context) (indexerclient.Status,error) { return s.status,nil }
func (s *publicReaderStub) ProtocolEvents(_ context.Context, protocol, object string, _ uint32) (indexerclient.ProtocolEventPage,error) { return s.pages[protocol+":"+object],nil }

func publicStatus() indexerclient.Status {
	var s indexerclient.Status
	s.ChainID="420"; s.IndexedHead="100"; s.IndexedHeadTimestamp="2000000000"; s.Finality.SafeHead="90"
	return s
}
func pe(protocol,event,object string, block string, fields map[string]any) indexerclient.ProtocolEvent {
	obj:=object
	return indexerclient.ProtocolEvent{ChainID:"420",BlockNumber:block,BlockHash:"0xblock",TransactionHash:"0xtx",LogIndex:1,Protocol:protocol,EventName:event,ObjectKey:&obj,Fields:fields}
}

func TestPublicEcosystemDomainsPreserveAuthority(t *testing.T) {
	r:=&publicReaderStub{status:publicStatus(),pages:map[string]indexerclient.ProtocolEventPage{
		"420Market:0xlist":{Items:[]indexerclient.ProtocolEvent{pe("420Market","ListingPublished","0xlist","80",map[string]any{"active":true})}},
		"420Rights:0xright":{Items:[]indexerclient.ProtocolEvent{pe("420Rights","ClaimDeclared","0xright","81",nil)}},
		"420Pulse:0xpulse":{Items:[]indexerclient.ProtocolEvent{pe("420Pulse","PublicationCreated","0xpulse","82",map[string]any{"active":true})}},
	}}
	d,_:=NewPublicEcosystemDiscovery(r,[]string{"0xpublic"}); d.now=func()time.Time{return time.Unix(2000000001,0)}
	market,_:=d.ResolveMarketListing(context.Background(),"0xlist")
	rights,_:=d.ResolveRightsRecord(context.Background(),"0xright")
	pulse,_:=d.ResolvePublicPulse(context.Background(),"0xpulse")
	if len(market)!=1||market[0].Domain!=architecture.DomainMarketListing||market[0].Provenance.Source!=architecture.SourceMarket { t.Fatalf("bad market result: %+v",market) }
	if len(rights)!=1||rights[0].Domain!=architecture.DomainRightsRecord||rights[0].Provenance.Source!=architecture.SourceRights { t.Fatalf("bad rights result: %+v",rights) }
	if len(pulse)!=1||pulse[0].Domain!=architecture.DomainPublicPulse||pulse[0].Provenance.Source!=architecture.SourcePulse { t.Fatalf("bad pulse result: %+v",pulse) }
	if market[0].Provenance.Finality!="safe" { t.Fatalf("expected safe finality") }
}

func TestCommonsFailsClosedOnPrivateVisibility(t *testing.T) {
	r:=&publicReaderStub{status:publicStatus(),pages:map[string]indexerclient.ProtocolEventPage{
		"420Commons:0xspace":{Items:[]indexerclient.ProtocolEvent{pe("420Commons","SpaceCreated","0xspace","80",map[string]any{"visibility":"0xprivate"})}},
	}}
	d,_:=NewPublicEcosystemDiscovery(r,[]string{"0xpublic"})
	got,err:=d.ResolvePublicCommons(context.Background(),"0xspace")
	if err!=nil||len(got)!=0 { t.Fatalf("private Commons leaked: %+v %v",got,err) }
}

func TestCommonsRequiresExplicitPublicVisibilityConfig(t *testing.T) {
	r:=&publicReaderStub{status:publicStatus(),pages:map[string]indexerclient.ProtocolEventPage{}}
	d,_:=NewPublicEcosystemDiscovery(r,nil)
	if _,err:=d.ResolvePublicCommons(context.Background(),"0xspace"); err==nil { t.Fatal("expected fail-closed visibility configuration error") }
}

func TestInactivePublicObjectsAreExcluded(t *testing.T) {
	r:=&publicReaderStub{status:publicStatus(),pages:map[string]indexerclient.ProtocolEventPage{
		"420Market:0xlist":{Items:[]indexerclient.ProtocolEvent{pe("420Market","ListingPublished","0xlist","80",nil),pe("420Market","ListingCancelled","0xlist","91",nil)}},
	}}
	d,_:=NewPublicEcosystemDiscovery(r,[]string{"0xpublic"})
	got,err:=d.ResolveMarketListing(context.Background(),"0xlist")
	if err!=nil||len(got)!=0 { t.Fatalf("inactive listing leaked: %+v %v",got,err) }
}

func TestPublicEcosystemFailsClosedOnUnqualifiedIndexerAndTruncatedHistory(t *testing.T) {
	r:=&publicReaderStub{qualifiedErr:errors.New("down"),status:publicStatus(),pages:map[string]indexerclient.ProtocolEventPage{}}
	d,_:=NewPublicEcosystemDiscovery(r,[]string{"0xpublic"})
	if _,err:=d.ResolvePublicPulse(context.Background(),"0xpulse"); err==nil { t.Fatal("expected qualification failure") }
	next:="cursor"; r.qualifiedErr=nil; r.pages["420Pulse:0xpulse"]=indexerclient.ProtocolEventPage{Items:[]indexerclient.ProtocolEvent{pe("420Pulse","PublicationCreated","0xpulse","82",nil)},NextCursor:&next}
	if _,err:=d.ResolvePublicPulse(context.Background(),"0xpulse"); err==nil { t.Fatal("expected bounded-history failure") }
}

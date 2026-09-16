package proxy

import (
	"testing"

	"github.com/420integrated/420-integrated/verify/architecture"
	"github.com/420integrated/420-integrated/verify/evidence"
)

type fakeStorage map[string]string
func (f fakeStorage) StorageAt(address, slot, block string) (string,error) { return f[slot],nil }

func deployment() evidence.DeploymentEvidence {
	return evidence.DeploymentEvidence{
		ChainID:420,
		Address:"0x1111111111111111111111111111111111111111",
		RuntimeBytecode:"0x60016000",
		RuntimeCodeHash:"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
		ObservedAt:evidence.BlockContext{Number:100,Hash:"0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"},
		FirstCodeBlock:evidence.BlockContext{Number:90,Hash:"0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"},
		MissingContextReason:evidence.MissingCreationTxUnresolved,
		Provenance:"canonical_chain_state/rpc",
	}
}

func TestDetectEIP1967Implementation(t *testing.T) {
	d:=deployment()
	reader:=fakeStorage{ImplementationSlot:"0x0000000000000000000000002222222222222222222222222222222222222222",AdminSlot:"0x0000000000000000000000003333333333333333333333333333333333333333"}
	r,err:=Detect(d,reader); if err!=nil{t.Fatal(err)}
	if r.Kind!=KindEIP1967 || r.ImplementationAddress!="0x2222222222222222222222222222222222222222" { t.Fatalf("unexpected relationship: %#v",r) }
	if r.AdminAddress!="0x3333333333333333333333333333333333333333" { t.Fatal("admin not preserved") }
}

func TestDetectMinimal1167(t *testing.T) {
	d:=deployment()
	d.RuntimeBytecode="0x363d3d373d3d3d363d7344444444444444444444444444444444444444445af43d82803e903d91602b57fd5bf3"
	r,err:=Detect(d,nil); if err!=nil{t.Fatal(err)}
	if r.Kind!=KindMinimal1167 || r.ImplementationAddress!="0x4444444444444444444444444444444444444444" { t.Fatalf("unexpected relationship: %#v",r) }
}

func TestUpgradeInvalidatesInheritedImplementationVerification(t *testing.T) {
	tracker:=NewTracker()
	first:=Relationship{ChainID:420,ProxyAddress:"0x1111111111111111111111111111111111111111",ProxyRuntimeCodeHash:"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",Kind:KindEIP1967,ImplementationAddress:"0x2222222222222222222222222222222222222222",ObservedBlock:100,ObservedBlockHash:"0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}
	changed,gen,err:=tracker.Observe(first); if err!=nil{t.Fatal(err)}; if !changed||gen!=1{t.Fatalf("unexpected initial observe %v %d",changed,gen)}
	pair:=VerificationPair{ProxyBinding:"420:proxy:hash",ProxyClass:architecture.ResultFullMatch,ImplementationAddress:first.ImplementationAddress,ImplementationBinding:"420:impl:hash",ImplementationClass:architecture.ResultFullMatch,ImplementationCurrent:true,Generation:gen}

	second:=first; second.ImplementationAddress="0x5555555555555555555555555555555555555555"; second.ObservedBlock=101; second.ObservedBlockHash="0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd"
	changed,gen,err=tracker.Observe(second); if err!=nil{t.Fatal(err)}; if !changed||gen!=2{t.Fatalf("upgrade not detected: %v %d",changed,gen)}
	pair=ApplyRelationship(pair,second,changed,gen)
	if pair.ImplementationCurrent || pair.ImplementationBinding!="" || pair.ImplementationClass!="" { t.Fatalf("old implementation status survived upgrade: %#v",pair) }
	if len(tracker.History(420,first.ProxyAddress))!=2 { t.Fatal("upgrade history not preserved") }
}

func TestProxyAndImplementationRemainIndependent(t *testing.T) {
	r:=Relationship{ChainID:420,ProxyAddress:"0x1111111111111111111111111111111111111111",ProxyRuntimeCodeHash:"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",Kind:KindEIP1967,ImplementationAddress:"0x2222222222222222222222222222222222222222",ObservedBlock:100,ObservedBlockHash:"0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}
	impl:=deployment(); impl.Address=r.ImplementationAddress; impl.RuntimeCodeHash="0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"
	pair:=VerificationPair{ProxyBinding:"proxy-binding",ProxyClass:architecture.ResultMismatch,Generation:1}
	bound,err:=BindImplementation(pair,r,impl,architecture.ResultFullMatch); if err!=nil{t.Fatal(err)}
	if bound.ProxyClass!=architecture.ResultMismatch || bound.ImplementationClass!=architecture.ResultFullMatch { t.Fatal("proxy and implementation classifications were conflated") }
}

func TestBindRejectsDifferentImplementation(t *testing.T) {
	r:=Relationship{ChainID:420,ProxyAddress:"0x1111111111111111111111111111111111111111",ProxyRuntimeCodeHash:"0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",Kind:KindEIP1967,ImplementationAddress:"0x2222222222222222222222222222222222222222",ObservedBlock:100,ObservedBlockHash:"0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}
	impl:=deployment(); impl.Address="0x9999999999999999999999999999999999999999"
	if _,err:=BindImplementation(VerificationPair{},r,impl,architecture.ResultFullMatch); err==nil { t.Fatal("mismatched implementation must be rejected") }
}

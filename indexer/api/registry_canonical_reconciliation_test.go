package api

import (
	"errors"
	"testing"

	"github.com/420integrated/420-integrated/indexer/decoder"
	"github.com/420integrated/420-integrated/indexer/model"
)

type registryReadStore420 struct{}
func (registryReadStore420) Checkpoint()(model.ChainCheckpoint,bool,error){return model.ChainCheckpoint{ChainID:420,IndexedHeight:1,IndexedHash:"h1"},true,nil}
func (registryReadStore420) Block(uint64)(model.BlockRecord,bool,error){return model.BlockRecord{},false,nil}
func (registryReadStore420) Transaction(string)(model.TransactionRecord,bool,error){return model.TransactionRecord{},false,nil}
func (registryReadStore420) Receipt(string)(model.ReceiptRecord,bool,error){return model.ReceiptRecord{},false,nil}
func (registryReadStore420) LogsByBlock(uint64)([]model.LogRecord,error){return nil,nil}

type canonicalRegistryReader420 struct {
	version decoder.ServiceVersion
	service decoder.ServiceSummary
	err error
}
func (r canonicalRegistryReader420) ServiceVersion(string,uint32)(decoder.ServiceVersion,error){return r.version,r.err}
func (r canonicalRegistryReader420) Service(string)(decoder.ServiceSummary,error){return r.service,r.err}

func projectedRegistryFixture420(t *testing.T)(*decoder.Catalog,decoder.ServiceVersion,decoder.ServiceSummary){
	t.Helper()
	c:=decoder.NewCatalog()
	if err:=c.ApplyVersion(decoder.VersionPublished{ServiceID:"0x11",Version:1,Implementation:"0xabc",CodeHash:"0x01",MetadataHash:"0x02",Active:true,BlockNumber:1,BlockHash:"h1"});err!=nil{t.Fatal(err)}
	v,err:=c.Version("0x11",1);if err!=nil{t.Fatal(err)}
	s,err:=c.Service("0x11");if err!=nil{t.Fatal(err)}
	return c,v,s
}

func TestCanonicalRegistryComparisonAcceptsExactProjection(t *testing.T){
	c,v,s:=projectedRegistryFixture420(t)
	b:=NewStoreBackend(registryReadStore420{},c).WithCanonicalRegistryReader(canonicalRegistryReader420{version:v,service:s})
	if _,err:=b.ServiceVersion("0x11",1);err!=nil{t.Fatal(err)}
	if _,err:=b.Service("0x11");err!=nil{t.Fatal(err)}
}

func TestCanonicalRegistryComparisonFailsClosedOnProjectionMismatch(t *testing.T){
	c,v,s:=projectedRegistryFixture420(t)
	v.Implementation="0xdef"
	s.Implementation="0xdef"
	b:=NewStoreBackend(registryReadStore420{},c).WithCanonicalRegistryReader(canonicalRegistryReader420{version:v,service:s})
	if _,err:=b.ServiceVersion("0x11",1);!errors.Is(err,ErrRegistryProjectionMismatch){t.Fatalf("expected version mismatch failure, got %v",err)}
	if _,err:=b.Service("0x11");!errors.Is(err,ErrRegistryProjectionMismatch){t.Fatalf("expected service mismatch failure, got %v",err)}
}

func TestCanonicalRegistryComparisonFailsClosedWhenDirectReadFails(t *testing.T){
	c,_,_:=projectedRegistryFixture420(t)
	want:=errors.New("canonical Registry unavailable")
	b:=NewStoreBackend(registryReadStore420{},c).WithCanonicalRegistryReader(canonicalRegistryReader420{err:want})
	if _,err:=b.ServiceVersion("0x11",1);!errors.Is(err,want){t.Fatalf("expected canonical read error, got %v",err)}
	if _,err:=b.Service("0x11");!errors.Is(err,want){t.Fatalf("expected canonical read error, got %v",err)}
}

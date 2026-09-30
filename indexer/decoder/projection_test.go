package decoder

import (
	"testing"

	"github.com/420integrated/420-integrated/indexer/model"
)

type registryProjectionStoreFixture420 struct {
	cp model.ChainCheckpoint
	blocks map[uint64]model.BlockRecord
	logs map[uint64][]model.LogRecord
}
func (s *registryProjectionStoreFixture420) Checkpoint()(model.ChainCheckpoint,bool,error){ return s.cp,true,nil }
func (s *registryProjectionStoreFixture420) Block(n uint64)(model.BlockRecord,bool,error){ b,ok:=s.blocks[n];return b,ok,nil }
func (s *registryProjectionStoreFixture420) LogsByBlock(n uint64)([]model.LogRecord,error){ return append([]model.LogRecord(nil),s.logs[n]...),nil }

func registryProjectionBlock420(n uint64, hash, parent string) model.BlockRecord {
	return model.BlockRecord{ChainID:420,Number:n,Hash:hash,ParentHash:parent,SchemaVersion:"420-indexer-v1"}
}
func registryProjectionVersionLog420(block uint64, hash, service string, version string, implementation string) model.LogRecord {
	return model.LogRecord{
		ChainID:420,BlockNumber:block,BlockHash:hash,TransactionHash:hash+"-tx",TransactionIndex:0,LogIndex:0,
		Address:ProtocolRegistryCanonicalAddress420,
		Topics:[]string{ProtocolRegistryTopics420().VersionPublished,topicWord(service),topicWord(version),topicWord(implementation)},
		Data:dataWords(padWord("22"),padWord("33"),padWord("01")),
	}
}

func TestRebuildProtocolRegistryCatalog420FromCanonicalLogs(t *testing.T){
	s:=&registryProjectionStoreFixture420{
		cp:model.ChainCheckpoint{ChainID:420,IndexedHeight:2,IndexedHash:"h2"},
		blocks:map[uint64]model.BlockRecord{0:registryProjectionBlock420(0,"h0",""),1:registryProjectionBlock420(1,"h1","h0"),2:registryProjectionBlock420(2,"h2","h1")},
		logs:map[uint64][]model.LogRecord{
			1:{registryProjectionVersionLog420(1,"h1","11","01","1234567890abcdef1234567890abcdef12345678")},
		},
	}
	c,err:=RebuildProtocolRegistryCatalog420(s);if err!=nil{t.Fatal(err)}
	got,err:=c.Version(topicWord("11"),1);if err!=nil{t.Fatal(err)}
	if got.ActivatedBlock!=1 || got.ActivatedHash!="h1" || !got.Active {t.Fatalf("unexpected rebuilt record: %+v",got)}
}

func TestRebuildProtocolRegistryCatalog420DropsOrphanedRegistryHistoryAfterReorg(t *testing.T){
	s:=&registryProjectionStoreFixture420{
		cp:model.ChainCheckpoint{ChainID:420,IndexedHeight:2,IndexedHash:"old2"},
		blocks:map[uint64]model.BlockRecord{0:registryProjectionBlock420(0,"h0",""),1:registryProjectionBlock420(1,"h1","h0"),2:registryProjectionBlock420(2,"old2","h1")},
		logs:map[uint64][]model.LogRecord{2:{registryProjectionVersionLog420(2,"old2","11","01","1111111111111111111111111111111111111111")}},
	}
	old,err:=RebuildProtocolRegistryCatalog420(s);if err!=nil{t.Fatal(err)}
	if _,err:=old.Version(topicWord("11"),1);err!=nil{t.Fatal(err)}

	s.cp.IndexedHash="new2"
	s.blocks[2]=registryProjectionBlock420(2,"new2","h1")
	s.logs[2]=[]model.LogRecord{registryProjectionVersionLog420(2,"new2","22","01","2222222222222222222222222222222222222222")}
	rebuilt,err:=RebuildProtocolRegistryCatalog420(s);if err!=nil{t.Fatal(err)}
	if _,err:=rebuilt.Version(topicWord("11"),1);err!=ErrUnknownServiceVersion{t.Fatalf("orphaned registry history survived reorg: %v",err)}
	got,err:=rebuilt.Version(topicWord("22"),1);if err!=nil{t.Fatal(err)}
	if got.ActivatedHash!="new2"{t.Fatalf("replacement registry history missing: %+v",got)}
}

func TestRebuildProtocolRegistryCatalog420FailsClosedOnCanonicalProvenanceMismatch(t *testing.T){
	log:=registryProjectionVersionLog420(1,"evil","11","01","1234567890abcdef1234567890abcdef12345678")
	s:=&registryProjectionStoreFixture420{
		cp:model.ChainCheckpoint{ChainID:420,IndexedHeight:1,IndexedHash:"h1"},
		blocks:map[uint64]model.BlockRecord{0:registryProjectionBlock420(0,"h0",""),1:registryProjectionBlock420(1,"h1","h0")},
		logs:map[uint64][]model.LogRecord{1:{log}},
	}
	if _,err:=RebuildProtocolRegistryCatalog420(s);err==nil{t.Fatal("expected registry projection provenance mismatch")}
}

func TestRebuildProtocolRegistryCatalog420FailsClosedOnMalformedTrackedEvent(t *testing.T){
	s:=&registryProjectionStoreFixture420{
		cp:model.ChainCheckpoint{ChainID:420,IndexedHeight:1,IndexedHash:"h1"},
		blocks:map[uint64]model.BlockRecord{0:registryProjectionBlock420(0,"h0",""),1:registryProjectionBlock420(1,"h1","h0")},
		logs:map[uint64][]model.LogRecord{1:{{
			ChainID:420,BlockNumber:1,BlockHash:"h1",TransactionHash:"tx",Address:ProtocolRegistryCanonicalAddress420,
			Topics:[]string{ProtocolRegistryTopics420().VersionPublished},Data:"0x",
		}}},
	}
	if _,err:=RebuildProtocolRegistryCatalog420(s);err==nil{t.Fatal("expected malformed tracked Registry event failure")}
}

package ingest

import (
	"context"
	"strings"
	"testing"

	"github.com/420integrated/420-integrated/indexer/decoder"
	"github.com/420integrated/420-integrated/indexer/model"
	indexerrpc "github.com/420integrated/420-integrated/indexer/rpc"
	"github.com/420integrated/420-integrated/indexer/store"
)

func regPad420(tail string) string { return strings.Repeat("0",64-len(tail))+tail }
func regTopic420(tail string) string { return "0x"+regPad420(tail) }
func regData420(words ...string) string { return "0x"+strings.Join(words,"") }
func registryVersionBundle420(n uint64, hash,parent,service,implementation string) indexerrpc.Bundle {
	b:=bundle(n,hash,parent)
	b.Logs=[]model.LogRecord{{
		ChainID:420,BlockNumber:n,BlockHash:hash,TransactionHash:hash+"-registry",TransactionIndex:0,LogIndex:0,
		Address:decoder.ProtocolRegistryCanonicalAddress420,
		Topics:[]string{decoder.ProtocolRegistryTopics420().VersionPublished,regTopic420(service),regTopic420("01"),regTopic420(implementation)},
		Data:regData420(regPad420("22"),regPad420("33"),regPad420("01")),
	}}
	return b
}

func TestRegistryProjectionRebuildTracksCanonicalReorgReplay(t *testing.T){
	path:=t.TempDir()+"/registry-reorg.json"
	initial:=integrationSource{bundles:map[uint64]indexerrpc.Bundle{
		0:bundle(0,"g",""),
		1:bundle(1,"a1","g"),
		2:registryVersionBundle420(2,"a2","a1","11","1111111111111111111111111111111111111111"),
	},head:2,safe:2,finalized:1}
	s,err:=store.NewFileStore(path);if err!=nil{t.Fatal(err)}
	if err:=New(420,"420-indexer-v1",initial,s).CatchUp(context.Background());err!=nil{t.Fatal(err)}
	first,err:=decoder.RebuildProtocolRegistryCatalog420(s);if err!=nil{t.Fatal(err)}
	record,err:=first.Version(regTopic420("11"),1);if err!=nil{t.Fatal(err)}
	if record.Implementation!="0x1111111111111111111111111111111111111111"||record.ActivatedHash!="a2"{t.Fatalf("unexpected initial Registry projection: %+v",record)}

	fork:=integrationSource{bundles:map[uint64]indexerrpc.Bundle{
		0:bundle(0,"g",""),
		1:bundle(1,"a1","g"),
		2:registryVersionBundle420(2,"b2","a1","11","2222222222222222222222222222222222222222"),
		3:bundle(3,"b3","b2"),
	},head:3,safe:2,finalized:1}
	if err:=New(420,"420-indexer-v1",fork,s).CatchUp(context.Background());err!=nil{t.Fatal(err)}
	rebuilt,err:=decoder.RebuildProtocolRegistryCatalog420(s);if err!=nil{t.Fatal(err)}
	record,err=rebuilt.Version(regTopic420("11"),1);if err!=nil{t.Fatal(err)}
	if record.Implementation!="0x2222222222222222222222222222222222222222"||record.ActivatedHash!="b2"{t.Fatalf("orphaned Registry history survived canonical replay: %+v",record)}
	logs,err:=s.LogsByBlock(2);if err!=nil{t.Fatal(err)}
	if len(logs)!=1||logs[0].BlockHash!="b2"{t.Fatalf("orphaned Registry log survived rollback: %+v",logs)}
}

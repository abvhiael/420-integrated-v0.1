package service

import (
	"context"
	"strings"
	"testing"
	"time"

	indexerapi "github.com/420integrated/420-integrated/indexer/api"
	"github.com/420integrated/420-integrated/indexer/model"
)

func exp25Fake(input, value string, logs []model.LogRecord, status uint64) *fakeIndexer {
	return &fakeIndexer{
		health:indexerapi.HealthResponse{Health:model.Health{ChainID:420,IndexedHeight:9,State:"HEALTHY",LastIngestAt:time.Now()}},
		tx:model.TransactionRecord{ChainID:420,BlockNumber:9,BlockHash:"0xblock",Hash:"0xtx",Index:2,From:"0x1111111111111111111111111111111111111111",To:"0x2222222222222222222222222222222222222222",ValueWei:value,Input:input},
		receipt:model.ReceiptRecord{ChainID:420,BlockNumber:9,BlockHash:"0xblock",TransactionHash:"0xtx",TransactionIndex:2,Status:status,GasUsed:21000,EffectiveGasPriceWei:"1",ActualFeeWei:"21000"},
		block:model.BlockRecord{ChainID:420,Number:9,Hash:"0xblock",Finality:model.FinalityFinalized,Producer:&model.BlockProducer{ConsensusSlot:9,ProducerSeat:1,ConsensusBlockRoot:"0xc",Certified:true}},
		logs:logs,
	}
}

func exp25Log(topics []string, data string) model.LogRecord {
	return model.LogRecord{
		ChainID:420,BlockNumber:9,BlockHash:"0xblock",TransactionHash:"0xtx",TransactionIndex:2,LogIndex:0,
		Address:"0x3333333333333333333333333333333333333333",Topics:topics,Data:data,DecoderVersion:"raw-v1",
	}
}

func TestEXP25TransactionPreservesRawCallAndEventPayload(t *testing.T){
	topic0:="0x"+strings.Repeat("11",32)
	topic1:="0x"+strings.Repeat("22",32)
	idx:=exp25Fake("0xdeadbeef","420",[]model.LogRecord{exp25Log([]string{topic0,topic1},"0x01020304")},0)
	svc,_:=New(idx,420,time.Minute)
	view,err:=svc.TransactionDetail(context.Background(),"0xtx")
	if err!=nil{t.Fatal(err)}
	if view.Receipt.StatusLabel!="REVERTED" || view.Transaction.Input!="0xdeadbeef" || view.Transaction.ValueWei!="420"{
		t.Fatalf("raw failed-call context lost: %+v",view)
	}
	if len(view.Logs)!=1 || len(view.Logs[0].Topics)!=2 || view.Logs[0].Topics[1]!=topic1 || view.Logs[0].Data!="0x01020304"{
		t.Fatalf("raw event payload lost: %+v",view.Logs)
	}
	if view.Logs[0].Address!="0x3333333333333333333333333333333333333333" || view.Logs[0].DecoderVersion!="raw-v1"{
		t.Fatalf("event provenance lost: %+v",view.Logs[0])
	}
}

func TestEXP25RawEventSupportsEmptyData(t *testing.T){
	topic:="0x"+strings.Repeat("aa",32)
	idx:=exp25Fake("0x","0",[]model.LogRecord{exp25Log([]string{topic},"0x")},1)
	svc,_:=New(idx,420,time.Minute)
	view,err:=svc.TransactionDetail(context.Background(),"0xtx")
	if err!=nil{t.Fatal(err)}
	if len(view.Logs)!=1 || view.Logs[0].Data!="0x"{t.Fatalf("empty data not preserved: %+v",view.Logs)}
}

func TestEXP25RejectsMalformedRawPayloads(t *testing.T){
	cases:=[]struct{name string; input string; value string; log model.LogRecord; want string}{
		{"input","0xabc","0",exp25Log(nil,"0x"),"transaction input"},
		{"value","0x","-1",exp25Log(nil,"0x"),"invalid value"},
		{"topic","0x","0",exp25Log([]string{"0x1234"},"0x"),"log topic"},
		{"data","0x","0",exp25Log(nil,"0x123"),"log data"},
		{"address","0x","0",func() model.LogRecord { l:=exp25Log(nil,"0x"); l.Address="0x1234"; return l }(),"log address"},
	}
	for _,tc:=range cases{
		t.Run(tc.name,func(t *testing.T){
			idx:=exp25Fake(tc.input,tc.value,[]model.LogRecord{tc.log},1)
			svc,_:=New(idx,420,time.Minute)
			_,err:=svc.TransactionDetail(context.Background(),"0xtx")
			if err==nil || !strings.Contains(err.Error(),tc.want){t.Fatalf("err=%v want %q",err,tc.want)}
		})
	}
}

func TestEXP25BlockDetailUsesValidatedRawEventView(t *testing.T){
	topic:="0x"+strings.Repeat("bb",32)
	idx:=exp25Fake("0x","0",[]model.LogRecord{exp25Log([]string{topic},"0x4200")},1)
	svc,_:=New(idx,420,time.Minute)
	view,err:=svc.BlockDetail(context.Background(),9)
	if err!=nil{t.Fatal(err)}
	if view.LogCount!=1 || view.Logs[0].Topics[0]!=topic || view.Logs[0].Data!="0x4200"{
		t.Fatalf("unexpected block raw events: %+v",view.Logs)
	}
}

func TestEXP25BlockDetailRejectsMalformedRawEvent(t *testing.T){
	idx:=exp25Fake("0x","0",[]model.LogRecord{exp25Log([]string{"0xnope"},"0x")},1)
	svc,_:=New(idx,420,time.Minute)
	if _,err:=svc.BlockDetail(context.Background(),9);err==nil || !strings.Contains(err.Error(),"log topic"){
		t.Fatalf("expected malformed topic rejection, got %v",err)
	}
}

package assets

import (
	"strings"
	"testing"

	"github.com/420integrated/420-integrated/indexer/model"
)

func topicAddress(address string) string {
	return "0x" + strings.Repeat("0", 24) + strings.TrimPrefix(strings.ToLower(address), "0x")
}
func wordHex(v string) string { return strings.Repeat("0", 64-len(v)) + v }

func TestDecodeNativeAndERCTransfers(t *testing.T) {
	from := "0x1111111111111111111111111111111111111111"
	to := "0x2222222222222222222222222222222222222222"
	contract := "0x3333333333333333333333333333333333333333"
	txs := []model.TransactionRecord{{ChainID:420, BlockNumber:7, BlockHash:"0xblock", Hash:"0xnative", Index:0, From:from, To:to, ValueWei:"42"}}
	logs := []model.LogRecord{
		{ChainID:420, BlockNumber:7, BlockHash:"0xblock", TransactionHash:"0xerc20", TransactionIndex:1, LogIndex:0, Address:contract, Topics:[]string{ercTransferTopic, topicAddress(from), topicAddress(to)}, Data:"0x"+wordHex("2a")},
		{ChainID:420, BlockNumber:7, BlockHash:"0xblock", TransactionHash:"0xerc721", TransactionIndex:2, LogIndex:1, Address:contract, Topics:[]string{ercTransferTopic, topicAddress(from), topicAddress(to), "0x"+wordHex("7")}, Data:"0x"},
		{ChainID:420, BlockNumber:7, BlockHash:"0xblock", TransactionHash:"0x1155", TransactionIndex:3, LogIndex:2, Address:contract, Topics:[]string{erc1155Single, topicAddress("0x4444444444444444444444444444444444444444"), topicAddress(from), topicAddress(to)}, Data:"0x"+wordHex("5")+wordHex("9")},
	}
	got, err := DecodeBundle(txs, logs)
	if err != nil { t.Fatal(err) }
	if len(got) != 4 { t.Fatalf("expected 4 transfers, got %d: %+v", len(got), got) }
	if got[0].AssetKey != "native:420" || got[0].Amount != "42" || got[0].LogIndex != -1 { t.Fatalf("unexpected native transfer: %+v", got[0]) }
	if got[1].AssetKind != "erc20" || got[1].Amount != "42" { t.Fatalf("unexpected erc20 transfer: %+v", got[1]) }
	if got[2].AssetKind != "erc721" || got[2].TokenID != "7" || got[2].Amount != "1" { t.Fatalf("unexpected erc721 transfer: %+v", got[2]) }
	if got[3].AssetKind != "erc1155" || got[3].TokenID != "5" || got[3].Amount != "9" { t.Fatalf("unexpected erc1155 transfer: %+v", got[3]) }
}

func TestDecodeERC1155Batch(t *testing.T) {
	from := "0x1111111111111111111111111111111111111111"
	to := "0x2222222222222222222222222222222222222222"
	contract := "0x3333333333333333333333333333333333333333"
	// head: offsets to ids (64 bytes) and values (160 bytes), then ids[2], then values[2]
	data := "0x" + wordHex("40") + wordHex("a0") + wordHex("2") + wordHex("1") + wordHex("2") + wordHex("2") + wordHex("a") + wordHex("14")
	lg := model.LogRecord{ChainID:420, BlockNumber:8, BlockHash:"0x8", TransactionHash:"0xbatch", TransactionIndex:0, LogIndex:3, Address:contract, Topics:[]string{erc1155Batch, topicAddress("0x4444444444444444444444444444444444444444"), topicAddress(from), topicAddress(to)}, Data:data}
	got, err := DecodeLog(lg)
	if err != nil { t.Fatal(err) }
	if len(got) != 2 || got[0].TokenID != "1" || got[0].Amount != "10" || got[1].TokenID != "2" || got[1].Amount != "20" { t.Fatalf("unexpected batch: %+v", got) }
}

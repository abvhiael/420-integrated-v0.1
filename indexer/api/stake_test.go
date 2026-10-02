package api

import (
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/indexer/decoder"
	"github.com/420integrated/420-integrated/indexer/model"
	"github.com/420integrated/420-integrated/indexer/store"
)

const testValidatorID = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
const testOwner = "0x1111111111111111111111111111111111111111"

func indexedAddressTopic420(address string) string {
	return "0x" + strings.Repeat("0", 24) + strings.TrimPrefix(strings.ToLower(address), "0x")
}

func putStakeBundle420(t *testing.T, s *store.FileStore, number uint64, hash string, finality model.Finality, log model.LogRecord) {
	t.Helper()
	block := model.BlockRecord{ChainID:420, Number:number, Hash:hash, ParentHash:"0xparent", Finality:finality, SchemaVersion:"v1"}
	log.ChainID=420; log.BlockNumber=number; log.BlockHash=hash
	if err:=s.PutBundle(block,nil,nil,[]model.LogRecord{log});err!=nil{t.Fatal(err)}
}

func TestStakeActivityIsFinalityAwareFilteredAndReorgRebuildable(t *testing.T) {
	path:=filepath.Join(t.TempDir(),"indexer.json")
	s,err:=store.NewFileStore(path);if err!=nil{t.Fatal(err)}

	putStakeBundle420(t,s,10,"0x10",model.FinalityFinalized,model.LogRecord{
		TransactionHash:"0xtx10",TransactionIndex:0,LogIndex:0,Address:StakeValidatorRegistryAddress,
		Topics:[]string{"0x537da8f0566ceb8b64ae0932b9127c20d0e6541bedb3c8d7b59357c664fea2ca",testValidatorID,indexedAddressTopic420(testOwner),indexedAddressTopic420(testOwner)},Data:"0x",
	})
	putStakeBundle420(t,s,11,"0x11",model.FinalitySafe,model.LogRecord{
		TransactionHash:"0xtx11",TransactionIndex:0,LogIndex:0,Address:StakeValidatorRegistryAddress,
		Topics:[]string{"0xb2989b10c145e3ec749d2c1aff6ee707b518b4f105704e464e274dd04f8c60ac",testValidatorID},Data:"0x",
	})
	putStakeBundle420(t,s,12,"0x12",model.FinalityHead,model.LogRecord{
		TransactionHash:"0xtx12",TransactionIndex:0,LogIndex:0,Address:StakeRewardControllerAddress,
		Topics:[]string{"0xae18fd01a17597538ecc00e53160b731f191d8172d52086d7ad0ca16a76816ef","0x"+strings.Repeat("0",63)+"c",indexedAddressTopic420(testOwner)},Data:"0x",
	})
	if err:=s.SaveCheckpoint(model.ChainCheckpoint{
		ChainID:420,IndexedHeight:12,IndexedHash:"0x12",SafeHeight:11,SafeHash:"0x11",FinalizedHeight:10,FinalizedHash:"0x10",SchemaVersion:"v1",UpdatedAt:time.Now().UTC(),
	});err!=nil{t.Fatal(err)}

	backend:=NewStoreBackend(s,decoder.NewCatalog())
	page,err:=backend.StakeActivity("","",50);if err!=nil{t.Fatal(err)}
	if page.CanonicalAuthority {t.Fatal("derived Stake page claimed canonical authority")}
	if len(page.Records)!=3 {t.Fatalf("records=%d",len(page.Records))}
	if page.Records[0].EventName!="RewardApplied"||page.Records[0].Finality!=model.FinalityHead {t.Fatalf("unexpected head record: %+v",page.Records[0])}
	if page.Records[1].EventName!="SlashApplied"||page.Records[1].Finality!=model.FinalitySafe {t.Fatalf("unexpected safe record: %+v",page.Records[1])}
	if page.Records[2].EventName!="ValidatorRegistered"||page.Records[2].Finality!=model.FinalityFinalized {t.Fatalf("unexpected finalized record: %+v",page.Records[2])}

	validatorPage,err:=backend.StakeActivity(testValidatorID,"",50);if err!=nil{t.Fatal(err)}
	if len(validatorPage.Records)!=2 {t.Fatalf("validator records=%d",len(validatorPage.Records))}
	addressPage,err:=backend.StakeActivity("",testOwner,50);if err!=nil{t.Fatal(err)}
	if len(addressPage.Records)!=2 {t.Fatalf("address records=%d",len(addressPage.Records))}

	if err:=s.DeleteBlocksAbove(11);err!=nil{t.Fatal(err)}
	if err:=s.SaveCheckpoint(model.ChainCheckpoint{
		ChainID:420,IndexedHeight:11,IndexedHash:"0x11",SafeHeight:11,SafeHash:"0x11",FinalizedHeight:10,FinalizedHash:"0x10",SchemaVersion:"v1",UpdatedAt:time.Now().UTC(),
	});err!=nil{t.Fatal(err)}
	reorged,err:=backend.StakeActivity("","",50);if err!=nil{t.Fatal(err)}
	if len(reorged.Records)!=2 {t.Fatalf("orphan event survived rollback: %+v",reorged.Records)}
	for _,record:=range reorged.Records{if record.BlockNumber==12{t.Fatal("orphaned reward survived rollback")}}
}

func TestStakeActivityRejectsMalformedFiltersAndTopics(t *testing.T) {
	path:=filepath.Join(t.TempDir(),"indexer.json")
	s,err:=store.NewFileStore(path);if err!=nil{t.Fatal(err)}
	putStakeBundle420(t,s,1,"0x1",model.FinalityHead,model.LogRecord{
		TransactionHash:"0xtx",Address:StakeValidatorRegistryAddress,
		Topics:[]string{"0x537da8f0566ceb8b64ae0932b9127c20d0e6541bedb3c8d7b59357c664fea2ca","0x1234"},Data:"0x",
	})
	if err:=s.SaveCheckpoint(model.ChainCheckpoint{ChainID:420,IndexedHeight:1,IndexedHash:"0x1",SchemaVersion:"v1",UpdatedAt:time.Now().UTC()});err!=nil{t.Fatal(err)}
	backend:=NewStoreBackend(s,decoder.NewCatalog())
	if _,err:=backend.StakeActivity("0x1234","",50);err==nil{t.Fatal("invalid validator filter accepted")}
	if _,err:=backend.StakeActivity("","0x1234",50);err==nil{t.Fatal("invalid address filter accepted")}
	if _,err:=backend.StakeActivity("","",50);err==nil||!strings.Contains(err.Error(),"malformed Stake validator topic"){t.Fatalf("expected malformed topic rejection, got %v",err)}
}

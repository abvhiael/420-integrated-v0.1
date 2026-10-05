package recovery

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/420integrated/420-integrated/town/model"
	"github.com/420integrated/420-integrated/town/projection"
)

func TestSaveLoadRestoreRoundTrip(t *testing.T){
	store:=projection.NewStore()
	err:=store.ApplyBlock(projection.Block{Height:1,Hash:"h1",Events:[]projection.Event{{ID:"e1",Kind:projection.EventPostUpsert,Post:projection.PostDocument{ID:"post:1",CommunityID:"community:1",AuthorID:"actor:alice",Visibility:model.VisibilityPublic,ContentRef:"storage://1",ContentSHA256:"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",Revision:1,UpdatedAt:time.Unix(1,0).UTC()}}}})
	if err!=nil{t.Fatal(err)}
	path:=filepath.Join(t.TempDir(),"town-recovery.json")
	if err:=Save(path,store.SnapshotRecovery());err!=nil{t.Fatal(err)}
	info,err:=os.Stat(path);if err!=nil{t.Fatal(err)}
	if info.Mode().Perm()!=0o600{t.Fatalf("mode=%o",info.Mode().Perm())}
	state,err:=Load(path);if err!=nil{t.Fatal(err)}
	if len(state.Blocks)!=1 || state.Blocks[0].Hash!="h1"{t.Fatalf("state=%+v",state)}
	restored:=projection.NewStore()
	if err:=Restore(path,restored);err!=nil{t.Fatal(err)}
	if p,ok:=restored.GetPost("post:1");!ok || !p.Active{t.Fatalf("post=%+v ok=%v",p,ok)}
}

func TestLoadRejectsTrailingJSONAndUnsupportedSchema(t *testing.T){
	dir:=t.TempDir()
	path:=filepath.Join(dir,"bad.json")
	if err:=os.WriteFile(path,[]byte("{\"Schema\":\"420-town-projection-recovery-v1\",\"Generation\":1,\"Blocks\":[]} {}"),0o600);err!=nil{t.Fatal(err)}
	if _,err:=Load(path);err==nil{t.Fatal("expected trailing JSON rejection")}
	if err:=os.WriteFile(path,[]byte("{\"Schema\":\"wrong\",\"Generation\":1,\"Blocks\":[]}"),0o600);err!=nil{t.Fatal(err)}
	if _,err:=Load(path);err==nil{t.Fatal("expected schema rejection")}
}

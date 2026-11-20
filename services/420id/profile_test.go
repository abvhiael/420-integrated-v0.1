package account
import("errors";"strings";"testing")
func TestUniversalProfileValidation(t *testing.T){
 valid:=ProfileUpdate{Username:"Example_420",DisplayName:"Prairie Friend",Bio:"Hello,\n420 community!",AvatarRef:"sha256:"+strings.Repeat("a",64),Visibility:"private"}
 normalized,e:=normalizeProfileUpdate(valid)
 if e!=nil||normalized.Username!="example_420"{t.Fatal("canonical username rejected",e)}
 for _,name:=range []string{"","abc","first_42","A123","ab_"}{v:=valid;v.Username=name;if _,e=normalizeProfileUpdate(v);e!=nil{t.Fatal("valid username",name,e)}}
 for _,name:=range []string{"ab","1alice","_alice","alice-1","ali.ce","alice name","admin","ADMIN","support","420id","a__\n","pаypal","éclair",strings.Repeat("a",25)}{
  v:=valid;v.Username=name;if _,e=normalizeProfileUpdate(v);!errors.Is(e,ErrInvalid){t.Fatal("invalid username accepted",name,e)}
 }
 invalid:=[]ProfileUpdate{
  {DisplayName:strings.Repeat("a",81),Visibility:"private"},
  {DisplayName:"\u202eHidden",Visibility:"private"},
  {DisplayName:"Control\x00",Visibility:"private"},
  {DisplayName:" trailing ",Visibility:"private"},
  {Bio:strings.Repeat("x",501),Visibility:"private"},
  {Bio:"\x1bEscape",Visibility:"private"},
  {Bio:"\u200dInvisible",Visibility:"private"},
  {AvatarRef:"https://example.org/a.jpg",Visibility:"private"},
  {AvatarRef:"sha256:"+strings.Repeat("A",64),Visibility:"private"},
  {Visibility:"everyone"},{Visibility:"public",ExpectedRevision:-1},
 }
 for i,v:=range invalid{if _,e=normalizeProfileUpdate(v);!errors.Is(e,ErrInvalid){t.Fatalf("invalid profile %d accepted: %v",i,e)}}
 v:=valid;v.Visibility="public";if _,e=normalizeProfileUpdate(v);e!=nil{t.Fatal(e)}
}

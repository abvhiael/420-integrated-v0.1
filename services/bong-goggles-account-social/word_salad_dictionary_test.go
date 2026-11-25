package social

import (
 "encoding/json"
 "testing"
 "strings"
 "errors"
)

func TestWordSaladProductionDictionaryIntegrity(t *testing.T){
 a,e:=NewProductionWordSaladRulesAdapter();if e!=nil{t.Fatal(e)}
 g,c:=WordSaladDictionaryHashes();if g!=wordSaladEnglishSHA256||c!=wordSaladCannabisSHA256{t.Fatal("hash mismatch")}
 r:=a.module.(wordSaladRules)
 for _,w:=range []string{"CAT","HOUSE","WORD"}{if !r.general[w]{t.Fatal("missing English",w)}}
 for _,w:=range []string{"ACAPULCOGOLD","BONG","KUSH","SHATTER"}{if !r.cannabis[w]{t.Fatal("missing cannabis",w)}}
 for _,w:=range []string{"CULTIVATEFREEDOMTSHIRT","FARMFRIENDSSTICKERBUNDLE","MEPHISTOGENETICSGIFTCARD","ATLASSEEDBLUEDREAMSTRAINFEMPHOTO","AAA","BEACHTRUFFLEFSHIPSEARLYAPRIL","ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ","acapulcogold"}{if r.cannabis[w]{t.Fatal("unapproved key",w)}}
 if _,e=wordSaladPinnedCorpus(wordSaladEnglish+"ZZ\n",g,wordSaladEnglishCount,false);!errors.Is(e,ErrUnavailable){t.Fatal("English tamper accepted",e)}
 if _,e=wordSaladPinnedCorpus(strings.Replace(wordSaladCannabis,"ACAPULCOGOLD","ACAPULCOGOLX",1),c,wordSaladCannabisCount,true);!errors.Is(e,ErrUnavailable){t.Fatal("same-count cannabis tamper accepted",e)}
 for _,raw:=range []string{"AB\nAB\n","AC\nAB\n","ab\nAC\n","A\nAB\n","A-B\nAC\n","AB\nAC","AB\r\nAC\r\n","AB\nGIFTCARD\n"}{
  if _,e=wordSaladPinnedCorpus(raw,wordSaladRawHash(raw),2,true);e==nil{t.Fatal("noncanonical input accepted",raw)}
 }
}

func TestWordSaladDictionaryIdentity(t *testing.T){
 makeAdapter:=func(g,c []string)*RulesAdapter{t.Helper();a,e:=NewWordSaladRulesAdapter(g,c);if e!=nil{t.Fatal(e)};return a}
 a:=makeAdapter([]string{"CAT","DOG"},[]string{"BONG","KUSH"})
 reordered:=makeAdapter([]string{"DOG","CAT"},[]string{"KUSH","BONG"})
 changedG:=makeAdapter([]string{"CAT","COW"},[]string{"BONG","KUSH"})
 changedC:=makeAdapter([]string{"CAT","DOG"},[]string{"BONG","HASH"})
 v,h:=a.Identity();rv,rh:=reordered.Identity();if v!=rv||h!=rh{t.Fatal("identity depends on source order")}
 var seed [32]byte;raw,e:=a.initialConfigured(seed,2,"11:classic-salad");if e!=nil{t.Fatal(e)}
 f,e:=a.decode(raw);if e!=nil{t.Fatal(e)}
 move:=json.RawMessage(`{"type":"pass"}`)
 next,_,_,_,e:=a.Apply(raw,f.Turn,move);if e!=nil{t.Fatal(e)}
 trace:=[]RuleTrace{{Sequence:2,Seat:f.Turn,Action:move,BeforeHash:RuleHash(raw),AfterHash:RuleHash(next)}}
 if _,e=reordered.ReplayConfigured(seed,2,f.Variant,trace);e!=nil{t.Fatal("same corpus replay",e)}
 for _,other:=range []*RulesAdapter{changedG,changedC}{
  _,hash:=other.Identity();if hash==h{t.Fatal("changed corpus kept identity")}
  service:=&ClassicSessions{Rules:func(string)ClassicRule{return other}}
  if _,e=service.rule("scrabble",v,h);!errors.Is(e,ErrUnavailable){t.Fatal("historical resolution not fail closed",e)}
  if _,e=other.decode(raw);e==nil{t.Fatal("historical frame accepted")}
  if _,_,_,_,e=other.Apply(raw,f.Turn,move);e==nil{t.Fatal("historical action accepted")}
  if _,e=other.ReplayConfigured(seed,2,f.Variant,trace);e==nil{t.Fatal("historical trace accepted")}
 }
}

// Use the real placement scorer, physical tile IDs and centre premium.
// Controlled board/rack fixtures isolate exact membership and scoring.
func TestWordSaladDictionaryModes(t *testing.T){
 p:=saladProfiles[0];pack:=saladPack(p);mid:=p.size/2
 place:=func(g,c []string,mode,word string)(int64,error){
  t.Helper();a,e:=NewWordSaladRulesAdapter(g,c);if e!=nil{t.Fatal(e)}
  r:=a.module.(wordSaladRules);d:=saladData{Board:map[int]saladCell{},Racks:[][]int{{},{}}}
  used:=map[int]bool{};tiles:=[]saladPlacement{}
  for i,ch:=range word{
   id:=-1;for j,s:=range pack{if !used[j]&&saladSymbols[s]==string(ch){id=j;break}}
   if id<0{t.Fatal("fixture tile absent",word,string(ch))};used[id]=true;d.Racks[0]=append(d.Racks[0],id)
   row,col,tid:=mid,mid+i,id;tiles=append(tiles,saladPlacement{Row:&row,Col:&col,ID:&tid})
  }
  return r.place(&d,p,mode,0,tiles)
 }
 general:=[]string{"CAT","POT","CATS"};cannabis:=[]string{"POT","BONG"}
 straight,e:=place(general,cannabis,"straight-greens","POT");if e!=nil||straight<=0{t.Fatal(straight,e)}
 for _,mode:=range []string{"classic-salad","extra-dank"}{n,e:=place(general,cannabis,mode,"POT");if e!=nil||n!=straight*2{t.Fatal("overlap bonus",mode,n,straight,e)}}
 if _,e=place(general,cannabis,"straight-greens","BONG");e==nil{t.Fatal("cannabis-only accepted in straight greens")}
 for _,mode:=range []string{"classic-salad","extra-dank"}{if _,e=place(general,cannabis,mode,"BONG");e!=nil{t.Fatal("cannabis-only rejected",mode,e)}}
 if _,e=place(general,cannabis,"extra-dank","CAT");e==nil{t.Fatal("extra dank accepted general-only placement")}
 if _,e=place(general,cannabis,"classic-salad","CAT");e!=nil{t.Fatal(e)}
 for _,w:=range []string{"BO","POTS","ZAP"}{if _,e=place(general,cannabis,"classic-salad",w);e==nil{t.Fatal("nonmember accepted",w)}}
 // An existing cannabis word elsewhere on the board does not qualify a newly formed CAT.
 a,e:=NewWordSaladRulesAdapter([]string{"CAT","AC"},[]string{"POT"});if e!=nil{t.Fatal(e)}
 r:=a.module.(wordSaladRules);d:=saladData{Board:map[int]saladCell{},Racks:[][]int{{},{}}}
 used:=map[int]bool{}
 get:=func(ch string)int{for j,s:=range pack{if !used[j]&&saladSymbols[s]==ch{used[j]=true;return j}};t.Fatal("missing tile",ch);return -1}
 for i,ch:=range "POT"{d.Board[mid*p.size+mid+i]=saladCell{ID:get(string(ch))}}
 // Place CAT vertically ending at existing T, creating CAT only.
 tiles:=[]saladPlacement{}
 for i,ch:=range "CA"{row,col,id:=mid-2+i,mid+2,get(string(ch));d.Racks[0]=append(d.Racks[0],id);tiles=append(tiles,saladPlacement{Row:&row,Col:&col,ID:&id})}
 if _,e=r.place(&d,p,"extra-dank",0,tiles);e==nil{t.Fatal("existing cannabis word counted as newly formed")}
}

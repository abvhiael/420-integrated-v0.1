package social

import (
 "testing"
 "encoding/json"
 "strings"
 "reflect"
)
func saladTestAdapter(t *testing.T)*RulesAdapter{
 t.Helper()
 // Synthetic exhaustive two-letter alphabet fixture, never a production lexicon.
 words:=[]string{};for a:='A';a<='Z';a++{for b:='A';b<='Z';b++{words=append(words,string(a)+string(b))}}
 adapter,e:=NewWordSaladRulesAdapter(words,[]string{"SHATTER","HIGH","BONG","AB"});if e!=nil{t.Fatal(e)};return adapter
}
func TestWordSaladProfilesAndReplay(t *testing.T){
 a:=saladTestAdapter(t);var seed [32]byte
 for _,p:=range saladProfiles{
  v:=strconvForSalad(p.size)+":classic-salad"
  raw,e:=a.initialConfigured(seed,p.max,v);if e!=nil{t.Fatal(p.size,e)}
  f,e:=a.decode(raw);if e!=nil{t.Fatal(e)};d,e:=saladDecode(f);if e!=nil{t.Fatal(e)}
  if len(saladPack(p))!=p.bag||len(d.Bag)!=p.bag-p.max*p.rack{t.Fatal("bag conservation")}
  for i:=range d.Racks{view,e:=a.View(raw,i);if e!=nil{t.Fatal(e)};if strings.Contains(string(view),"\"bag\"")||strings.Contains(string(view),"\"racks\"")||strings.Contains(string(view),"\"seed\""){t.Fatal("secret leak")}}
  trace:=[]RuleTrace{};state:=raw
  for i:=0;i<6;i++{before,e:=a.decode(state);if e!=nil{t.Fatal(e)};move:=json.RawMessage(`{"type":"pass"}`);next,_,_,_,e:=a.Apply(state,before.Turn,move);if e!=nil{t.Fatal(e)}
   trace=append(trace,RuleTrace{Sequence:int64(i+2),Seat:before.Turn,Action:move,BeforeHash:RuleHash(state),AfterHash:RuleHash(next)});state=next}
  end,e:=a.decode(state);if e!=nil||!end.Terminal{t.Fatal("scoreless ending",e)}
  replay,e:=a.ReplayConfigured(seed,p.max,v,trace);if e!=nil||!reflect.DeepEqual(state,replay){t.Fatal("replay mismatch",e)}
 }
}
func strconvForSalad(n int)string{return string([]byte{byte('0'+n/10),byte('0'+n%10)})}
func TestWordSaladSubmittedPlacement(t *testing.T){
 // All possible two-symbol concatenations form a test-only lexicon.
 set:=map[string]bool{};for _,a:=range saladSymbols[:41]{for _,b:=range saladSymbols[:41]{set[a+b]=true}}
 words:=[]string{};for w:=range set{words=append(words,w)}
 a,e:=NewWordSaladRulesAdapter(words,[]string{"AB"});if e!=nil{t.Fatal(e)}
 var seed [32]byte;raw,e:=a.initialConfigured(seed,2,"17:classic-salad");if e!=nil{t.Fatal(e)}
 f,_:=a.decode(raw);d,_:=saladDecode(f);ids:=d.Racks[f.Turn];pack:=saladPack(saladProfiles[3]);tiles:=[]map[string]any{}
 for i,id:=range ids[:2]{cell:=map[string]any{"row":8,"col":8+i,"id":id};if pack[id]==41{cell["blank"]="A"};tiles=append(tiles,cell)}
 move,_:=json.Marshal(map[string]any{"type":"place","tiles":tiles})
 next,_,_,_,e:=a.Apply(raw,f.Turn,move);if e!=nil{t.Fatal(e)}
 nf,_:=a.decode(next);nd,_:=saladDecode(nf);if len(nd.Board)!=2||nf.Scores[f.Turn]<=0{t.Fatal("placement not applied")}
 if _,_,_,_,e=a.Apply(raw,1-f.Turn,move);e==nil{t.Fatal("wrong actor accepted")}
 tiles[1]["id"]=ids[0];bad,_:=json.Marshal(map[string]any{"type":"place","tiles":tiles});if _,_,_,_,e=a.Apply(raw,f.Turn,bad);e==nil{t.Fatal("duplicate tile accepted")}
 tiles[1]["id"]=ids[1];tiles[1]["col"]=10;bad,_=json.Marshal(map[string]any{"type":"place","tiles":tiles});if _,_,_,_,e=a.Apply(raw,f.Turn,bad);e==nil{t.Fatal("gap accepted")}
}

package social

import (
 "time"
 "bytes"
 "encoding/json"
 "reflect"
 "testing"
)

func saladBotTestPolicies(t *testing.T)(*RulesAdapter,ClassicBotPolicies){
 t.Helper();a,e:=NewProductionWordSaladRulesAdapter();if e!=nil{t.Fatal(e)}
 p,e:=NewWordSaladBotPolicies(a);if e!=nil{t.Fatal(e)};return a,p
}
func TestWordSaladBotGameplay(t *testing.T){
 a,p:=saladBotTestPolicies(t)
 for _,level:=range []string{"easy","medium","hard"}{t.Run(level,func(t *testing.T){
  policy,_:=p.policy(level);var placements int
  for i:=0;i<8;i++{
   var seed [32]byte;seed[0]=byte(i+1)
   raw,e:=a.initialConfigured(seed,2,"11:classic-salad:untimed");if e!=nil{t.Fatal(e)}
   for step:=0;step<8;step++{
    f,e:=a.decode(raw);if e!=nil{t.Fatal(e)};if f.Terminal{break}
    move,e:=a.ChooseMove(raw,f.Turn,level,policy);if e!=nil{t.Fatal(e)}
    var m saladMove;if !strictRuleJSON(move,&m){t.Fatal("invalid command")}
    if m.Type=="place"{placements++}else if m.Type!="exchange"&&m.Type!="pass"{t.Fatal("not a human gameplay command",m.Type)}
    next,_,_,_,e:=a.Apply(raw,f.Turn,move);if e!=nil{t.Fatal("authoritative rejection",e)}
    raw=next
   }
  }
  if placements==0{t.Fatal("policy never played a word")}
 })}
}
func TestWordSaladBotDifficulty(t *testing.T){
 // Controlled public rack has a short word, a longer higher-scoring word,
 // and a full-rack word. No hidden state is needed to compare strategies.
 a,e:=NewWordSaladRulesAdapter([]string{"AT","CART","CATER","CATERED"},[]string{"CATERED"});if e!=nil{t.Fatal(e)}
 policies,e:=NewWordSaladBotPolicies(a);if e!=nil{t.Fatal(e)}
 p,_,_:=saladVariant("11:classic-salad",2);pack:=saladPack(p)
 rack:=[]saladBotTile{};used:=map[int]bool{}
 for _,sym:=range []string{"C","A","T","E","R","E","D"}{
  found:=false;for id,index:=range pack{if !used[id]&&saladSymbols[index]==sym{used[id]=true;rack=append(rack,saladBotTile{id,sym,saladValues[index]});found=true;break}}
  if !found{t.Fatal("fixture tile",sym)}
 }
 v:=saladBotView{Variant:"11:classic-salad",Board:map[int]string{},Rack:rack,RackCounts:[]int{7,7},BagCount:66,Scores:[]int64{0,0},Turn:0,Forfeit:[]bool{false,false}}
 raw,_:=json.Marshal(v)
 sizes:=[]int{};scores:=[]int64{}
 for _,level:=range []string{"easy","medium","hard"}{
  policy,_:=policies.policy(level);move,e:=policy.ChooseMove(raw,level,[]json.RawMessage{json.RawMessage(`{"type":"pass"}`)},NewRuleBudget(100000));if e!=nil{t.Fatal(e)}
  var m saladMove;if !strictRuleJSON(move,&m)||m.Type!="place"{t.Fatal(level,string(move))}
  score,ok:=policy.(saladBotPolicy).lex.score(v,p,"classic-salad",m.Tiles);if !ok{t.Fatal("invalid candidate")}
  sizes=append(sizes,len(m.Tiles));scores=append(scores,score)
 }
 if !reflect.DeepEqual(sizes,[]int{2,4,7})||!(scores[0]<scores[1]&&scores[1]<scores[2]){t.Fatal("difficulty differentiation",sizes,scores)}
}
func TestWordSaladBotHiddenIndependence(t *testing.T){
 a,p:=saladBotTestPolicies(t);raw,e:=a.initialConfigured([32]byte{42},2,"17:classic-salad");if e!=nil{t.Fatal(e)}
 f,e:=a.decode(raw);if e!=nil{t.Fatal(e)};d,e:=saladDecode(f);if e!=nil{t.Fatal(e)}
 opponent:=1-f.Turn
 // Change opponent rack, bag order and seed without changing any public fact.
 d.Racks[opponent][0],d.Bag[0]=d.Bag[0],d.Racks[opponent][0]
 d.Bag[1],d.Bag[2]=d.Bag[2],d.Bag[1]
 f.Data,_=json.Marshal(d);f.Seed="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
 changed,e:=a.encode(f);if e!=nil{t.Fatal(e)}
 v1,e:=a.View(raw,f.Turn);if e!=nil{t.Fatal(e)};v2,e:=a.View(changed,f.Turn);if e!=nil||!bytes.Equal(v1,v2){t.Fatal("hidden state leaked",e)}
 for _,level:=range []string{"easy","medium","hard"}{policy,_:=p.policy(level);m1,e:=a.ChooseMove(raw,f.Turn,level,policy);if e!=nil{t.Fatal(e)};m2,e:=a.ChooseMove(changed,f.Turn,level,policy);if e!=nil||!bytes.Equal(m1,m2){t.Fatal("hidden information influenced decision",level,e)}}
}
type saladMaliciousPolicy struct{move json.RawMessage}
func(p saladMaliciousPolicy)ChooseMove(_ json.RawMessage,_ string,_ []json.RawMessage,b *RuleBudget)(json.RawMessage,error){if e:=b.Charge(1);e!=nil{return nil,e};return p.move,nil}
func TestWordSaladBotRejectsUnauthorizedActions(t *testing.T){
 a,_:=saladBotTestPolicies(t);raw,e:=a.initialConfigured([32]byte{12},2,"17:classic-salad");if e!=nil{t.Fatal(e)}
 f,_:=a.decode(raw);d,_:=saladDecode(f);id:=d.Racks[1-f.Turn][0]
 for _,move:=range []saladMove{{Type:"exchange",IDs:[]int{id}},{Type:"timeout"},{Type:"resign"},{Type:"place",Tiles:[]saladPlacement{}}}{
  data,_:=json.Marshal(move);if _,e=a.ChooseMove(raw,f.Turn,"easy",saladMaliciousPolicy{data});e==nil{t.Fatal("accepted unauthorized command",move)}
 }
}
func TestWordSaladBlankLockedAndZero(t *testing.T){
 a,e:=NewWordSaladRulesAdapter([]string{"AT","CAT"},[]string{"KUSH"});if e!=nil{t.Fatal(e)}
 r:=a.module.(wordSaladRules);p,_,_:=saladVariant("11:classic-salad",2);pack:=saladPack(p)
 find:=func(sym string)int{for id,index:=range pack{if saladSymbols[index]==sym{return id}};t.Fatal(sym);return -1}
 blank,aID,cID:=find("?"),find("A"),find("C")
 d:=saladData{Board:map[int]saladCell{},Racks:[][]int{{blank,aID},{cID}}}
 row,colA,colT:=5,5,6
 score,e:=r.place(&d,p,"classic-salad",0,[]saladPlacement{{Row:&row,Col:&colA,ID:&aID},{Row:&row,Col:&colT,ID:&blank,Blank:"T"}})
 if e!=nil||score!=2{t.Fatal("blank opening score",score,e)}
 colC:=4
 v:=saladBotView{Board:map[int]string{60:"A",61:"T"},BlankCells:[]int{61}}
 policies,_:=NewWordSaladBotPolicies(a);estimated,ok:=policies.Hard.(saladBotPolicy).lex.score(v,p,"classic-salad",[]saladPlacement{{Row:&row,Col:&colC,ID:&cID}})
 score,e=r.place(&d,p,"classic-salad",1,[]saladPlacement{{Row:&row,Col:&colC,ID:&cID}})
 if e!=nil||!ok||score!=estimated||d.Board[61].Blank!="T"{t.Fatal("blank value or assignment changed",score,estimated,e)}
 if _,e=r.place(&d,p,"classic-salad",1,[]saladPlacement{{Row:&row,Col:&colT,ID:&blank,Blank:"Z"}});e==nil{t.Fatal("blank reassignment allowed")}
}

func TestWordSaladBotExpiredSearchFallback(t *testing.T){
 a,p:=saladBotTestPolicies(t)
 raw,e:=a.initialConfigured([32]byte{42},2,"17:classic-salad:untimed");if e!=nil{t.Fatal(e)}
 f,e:=a.decode(raw);if e!=nil{t.Fatal(e)}
 move,e:=a.ChooseMoveBounded(raw,f.Turn,"hard",p.Hard,100000,time.Now().Add(-time.Second))
 if e!=nil||string(move)!=`{"type":"pass"}`{t.Fatal("deadline fallback",string(move),e)}
 if _,_,_,_,e=a.Apply(raw,f.Turn,move);e!=nil{t.Fatal("fallback must pass canonical rules",e)}
 if _,e=a.ChooseMoveBounded(raw,f.Turn,"hard",saladMaliciousPolicy{move},100000,time.Now().Add(-time.Second));e==nil{t.Fatal("untrusted policy received fallback")}
}

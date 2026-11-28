package social
import("testing";"encoding/json";"reflect")
func TestWordSaladFullPassRound(t *testing.T){
 a,e:=NewProductionWordSaladRulesAdapter();if e!=nil{t.Fatal(e)}
 old,e:=NewPreviousProductionWordSaladRulesAdapter();if e!=nil{t.Fatal(e)}
 _,h:=a.Identity();_,oh:=old.Identity();if h==oh{t.Fatal("historical identity changed")}
 for _,p:=range saladProfiles{for n:=p.min;n<=p.max;n++{for _,mode:=range []string{"classic-salad","extra-dank","straight-greens"}{
  variant:=strconvForSalad(p.size)+":"+mode;seed:=[32]byte{42}
  raw,e:=a.initialConfigured(seed,n,variant);if e!=nil{t.Fatal(e)}
  trace:=[]RuleTrace{}
  apply:=func(m any){t.Helper();f,e:=a.decode(raw);if e!=nil{t.Fatal(e)};action,e:=json.Marshal(m);if e!=nil{t.Fatal(e)};next,_,_,_,e:=a.Apply(raw,f.Turn,action);if e!=nil{t.Fatal(e)};trace=append(trace,RuleTrace{Sequence:int64(len(trace)+2),Seat:f.Turn,Action:action,BeforeHash:RuleHash(raw),AfterHash:RuleHash(next)});raw=next}
  pass:=map[string]string{"type":"pass"}
  apply(pass)
  f,_:=a.decode(raw);d,_:=saladDecode(f);apply(map[string]any{"type":"exchange","ids":[]int{d.Racks[f.Turn][0]}})
  f,_=a.decode(raw);d,_=saladDecode(f);if d.Streak!=0||f.Terminal{t.Fatal("exchange failed to reset")}
  expected:=append([]int64(nil),f.Scores...);for i,rack:=range d.Racks{expected[i]-=saladRackValue(rack,saladPack(p))}
  for i:=1;i<=n;i++{apply(pass);f,e=a.decode(raw);if e!=nil||f.Terminal!=(i==n){t.Fatal("wrong pass boundary",variant,n,i,e)}}
  if !reflect.DeepEqual(f.Scores,expected)||f.Turn!=-1{t.Fatal("wrong end scoring",f.Scores,expected)}
  d,_=saladDecode(f);if d.Ending!="scoreless"||len(d.Winners)==0{t.Fatal("missing result")}
  for _,move:=range []string{ `{"type":"pass"}`,`{"type":"exchange","ids":[0]}`,`{"type":"place","tiles":[]}`}{if _,_,_,_,e=a.Apply(raw,0,json.RawMessage(move));e==nil{t.Fatal("terminal action accepted")}}
  replay,e:=a.ReplayConfigured(seed,n,variant,trace);if e!=nil||!reflect.DeepEqual(raw,replay){t.Fatal("replay mismatch",e)}
 }}}
}

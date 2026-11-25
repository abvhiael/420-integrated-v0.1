package social

import (
 "bytes"
 "encoding/json"
 "fmt"
 "reflect"
 "testing"
 "time"
)

func TestWordSaladConfigurationMatrix(t *testing.T){
 a:=saladTestAdapter(t)
 profiles:=[][6]int{{11,2,80,7,2,15},{13,3,100,7,3,19},{15,4,120,8,3,23},{17,4,140,8,4,32},{19,4,180,8,5,42},{21,4,220,8,6,54}}
 count:=0;var seed [32]byte;now:=time.Unix(1700000000,0)
 for _,x:=range profiles{for seats:=1;seats<=5;seats++{for _,mode:=range []string{"classic-salad","straight-greens","extra-dank"}{for _,timing:=range []string{"untimed","live","async"}{
  v:=fmt.Sprintf("%d:%s:%s",x[0],mode,timing)
  raw,e:=a.initialConfigured(seed,seats,v)
  if seats<2||seats>x[1]{if e==nil{t.Fatal("invalid seats",v,seats)};continue}
  count++;if e!=nil{t.Fatal(v,seats,e)}
  f,e:=a.decode(raw);if e!=nil{t.Fatal(e)};d,e:=saladDecode(f);if e!=nil{t.Fatal(e)}
  p,_,e:=saladVariant(v,seats);if e!=nil{t.Fatal(e)}
  pack:=saladPack(p);blanks,hybrids:=0,0;for _,id:=range pack{if id==41{blanks++}else if id>=26{hybrids++}}
  if len(pack)!=x[2]||blanks!=x[4]||hybrids!=x[5]||len(d.Bag)!=x[2]-seats*x[3]||len(d.Board)!=0||f.Turn!=d.Order[0]{t.Fatal("profile mismatch",v,seats,blanks,hybrids)}
  for _,rack:=range d.Racks{if len(rack)!=x[3]{t.Fatal("rack",v,seats)}}
  for i,seat:=range d.Order{for j:=range d.Order{if i!=j&&seat==d.Order[j]{t.Fatal("seat duplication")}}}
  deadline:=wordSaladDeadline(v,now)
  switch timing{case "untimed":if deadline!=nil{t.Fatal("untimed")};case "live":if deadline==nil||!deadline.Equal(now.Add(120*time.Second)){t.Fatal("live")};case "async":if deadline==nil||!deadline.Equal(now.Add(24*time.Hour)){t.Fatal("async")}}
  next,turn,finished,_,e:=a.Apply(raw,f.Turn,json.RawMessage(`{"type":"pass"}`));if e!=nil||finished||turn!=d.Order[1]{t.Fatal("turn",v,seats,e)}
  nf,e:=a.decode(next);if e!=nil{t.Fatal(e)};nd,e:=saladDecode(nf);if e!=nil||nd.Streak!=1||!reflect.DeepEqual(nd.Racks,d.Racks)||!reflect.DeepEqual(nd.Bag,d.Bag){t.Fatal("pass mutation",v,seats,e)}
 }}}}
 if count!=135{t.Fatal("configuration coverage",count)}
 for _,v:=range []string{"12:classic-salad:live","11:unknown:live","11:classic-salad:fast","011:classic-salad:live"}{if _,e:=a.initialConfigured(seed,2,v);e==nil{t.Fatal("invalid variant",v)}}
}

type r5Fixture struct{p saladProfile;pack []int;data saladData;used map[int]bool}
func r5New(size int)*r5Fixture{p,_,_:=saladVariant(fmt.Sprintf("%d:classic-salad",size),2);return &r5Fixture{p:p,pack:saladPack(p),data:saladData{Board:map[int]saladCell{},Racks:[][]int{{},{}},Forfeit:[]bool{false,false},Order:[]int{0,1}},used:map[int]bool{}}}
func(x *r5Fixture)id(t *testing.T,s string)int{t.Helper();for i,k:=range x.pack{if !x.used[i]&&saladSymbols[k]==s{x.used[i]=true;return i}};t.Fatalf("missing physical tile %s",s);return -1}
func(x *r5Fixture)old(t *testing.T,r,c int,s,blank string){x.data.Board[r*x.p.size+c]=saladCell{ID:x.id(t,s),Blank:blank}}
func(x *r5Fixture)tile(t *testing.T,r,c int,s,blank string)saladPlacement{id:=x.id(t,s);x.data.Racks[0]=append(x.data.Racks[0],id);return saladPlacement{Row:&r,Col:&c,ID:&id,Blank:blank}}
func r5Rules(t *testing.T,g,c []string)wordSaladRules{t.Helper();a,e:=NewWordSaladRulesAdapter(g,c);if e!=nil{t.Fatal(e)};return a.module.(wordSaladRules)}
func TestWordSaladPlacementGeometryAndScoring(t *testing.T){
 rules:=r5Rules(t,[]string{"AT","CAT","CAR","ART","THA","ATH","TH","SHATTER","HIGH","AAAAAAA","AAAAAAAA"},[]string{"SHATTER","HIGH","CAT"})
 t.Run("opening",func(t *testing.T){
  for _,tc:=range []struct{name string;cells [][2]int;symbols []string;ok bool}{{"centre",[][2]int{{5,5},{5,6}},[]string{"A","T"},true},{"off-centre",[][2]int{{4,4},{4,5}},[]string{"A","T"},false},{"lone hybrid",[][2]int{{5,5}},[]string{"TH"},false},{"gap",[][2]int{{5,5},{5,7}},[]string{"A","T"},false},{"diagonal",[][2]int{{5,5},{6,6}},[]string{"A","T"},false}}{
   t.Run(tc.name,func(t *testing.T){x:=r5New(11);tiles:=[]saladPlacement{};for i,p:=range tc.cells{tiles=append(tiles,x.tile(t,p[0],p[1],tc.symbols[i],""))};n,e:=rules.place(&x.data,x.p,"straight-greens",0,tiles);if (e==nil)!=tc.ok||tc.ok&&n!=4{t.Fatal(n,e)}})
  }
 })
 t.Run("connection and overlaps",func(t *testing.T){
  for _,tc:=range []struct{r,c int;ok bool}{{5,4,true},{4,4,false},{5,5,false},{0,0,false}}{
   x:=r5New(11);x.old(t,5,5,"A","");x.old(t,5,6,"T","")
   _,e:=rules.place(&x.data,x.p,"straight-greens",0,[]saladPlacement{x.tile(t,tc.r,tc.c,"C","")});if (e==nil)!=tc.ok{t.Fatal(tc,e)}
  }
 })
 t.Run("crosswords and one-time centre",func(t *testing.T){
  // A at centre completes horizontal CAT and vertical CAR. Each run
  // receives its own new centre multiplier and only CAT is cannabis.
  x:=r5New(11);x.old(t,5,4,"C","");x.old(t,5,6,"T","");x.old(t,4,5,"C","");x.old(t,6,5,"R","")
  n,e:=rules.place(&x.data,x.p,"classic-salad",0,[]saladPlacement{x.tile(t,5,5,"A","")});if e!=nil||n!=30{t.Fatal("cross score",n,e)}
  y:=r5New(11);y.old(t,5,4,"C","");y.old(t,5,6,"T","");y.old(t,4,5,"C","");y.old(t,6,5,"R","")
  only:=r5Rules(t,[]string{"CAT"},[]string{"CAT"});if _,e=only.place(&y.data,y.p,"classic-salad",0,[]saladPlacement{y.tile(t,5,5,"A","")});e==nil{t.Fatal("invalid cross accepted")}
  z:=r5New(11);z.old(t,5,5,"A","");z.old(t,5,6,"T","")
  n,e=rules.place(&z.data,z.p,"straight-greens",0,[]saladPlacement{z.tile(t,5,4,"C","")});if e!=nil||n!=5{t.Fatal("reused centre",n,e)}
 })
 t.Run("hybrids and blanks",func(t *testing.T){
  for _,vertical:=range []bool{false,true}{x:=r5New(11);r,c:=5,6;if vertical{r,c=6,5};n,e:=rules.place(&x.data,x.p,"straight-greens",0,[]saladPlacement{x.tile(t,5,5,"TH",""),x.tile(t,r,c,"A","")});if e!=nil||n!=8{t.Fatal("hybrid face/orientation",n,e)}}
  x:=r5New(11);n,e:=rules.place(&x.data,x.p,"straight-greens",0,[]saladPlacement{x.tile(t,5,5,"?","A"),x.tile(t,5,6,"T","")});if e!=nil||n!=2{t.Fatal("blank centre",n,e)}
  cell:=x.data.Board[60];if cell.Blank!="A"{t.Fatal("blank assignment")}
  if _,e=rules.place(&x.data,x.p,"straight-greens",0,[]saladPlacement{x.tile(t,5,5,"C","")});e==nil{t.Fatal("blank replacement")}
  for _,assignment:=range []string{"","TH","a","1"}{z:=r5New(11);if _,e=rules.place(&z.data,z.p,"straight-greens",0,[]saladPlacement{z.tile(t,5,5,"?",assignment),z.tile(t,5,6,"T","")});e==nil{t.Fatal("invalid blank",assignment)}}
  z:=r5New(11);if _,e=rules.place(&z.data,z.p,"straight-greens",0,[]saladPlacement{z.tile(t,5,5,"A","B"),z.tile(t,5,6,"T","")});e==nil{t.Fatal("ordinary tile assignment")}
 })
 t.Run("all premium types",func(t *testing.T){
  for _,tc:=range []struct{kind int;want int64}{{1,3},{2,4},{3,5},{4,4},{5,6},{6,4}}{
   x:=r5New(11);prem:=saladPremium(x.p);found:=false
   for pos,k:=range prem{if k!=tc.kind{continue};for _,dir:=range [][2]int{{0,1},{1,0},{0,-1},{-1,0}}{q,ok:=saladNeighbor(pos,dir[0],dir[1],x.p.size);if !ok{continue};x.old(t,q/x.p.size,q%x.p.size,"A","");n,e:=r5Rules(t,[]string{"AA"},[]string{"BONG"}).place(&x.data,x.p,"straight-greens",0,[]saladPlacement{x.tile(t,pos/x.p.size,pos%x.p.size,"A","")});if e!=nil||n!=tc.want{t.Fatal(tc,n,e)};found=true;break};if found{break}}
   if !found{t.Fatal("premium missing",tc)}
  }
 })
 t.Run("full harvest",func(t *testing.T){
  for _,size:=range []int{11,15}{x:=r5New(size);n:=x.p.rack;word:="AEINORT";if n==8{word+="S"};r:=r5Rules(t,[]string{word},[]string{"BONG"});tiles:=[]saladPlacement{};mid:=size/2;start:=mid-n/2
   for i:=0;i<n;i++{tiles=append(tiles,x.tile(t,mid,start+i,string(word[i]),""))}
   var sum,mult int64=0,1;premium:=saladPremium(x.p)
   for i:=0;i<n;i++{switch premium[mid*size+start+i]{case 1:sum+=2;case 2:sum+=3;case 3:sum+=4;case 4,6:sum++;mult*=2;case 5:sum++;mult*=3;default:sum++}}
   want:=sum*mult+50;if n==8{want+=10}
   got,e:=r.place(&x.data,x.p,"straight-greens",0,tiles);if e!=nil||got!=want{t.Fatal(size,got,want,e)}
  }
 })
}

func TestWordSaladExchangeConservationAndStreak(t *testing.T){
 a:=saladTestAdapter(t);var seed [32]byte
 raw,e:=a.initialConfigured(seed,2,"11:classic-salad");if e!=nil{t.Fatal(e)}
 f,_:=a.decode(raw);d,_:=saladDecode(f);actor:=f.Turn;original:=append([]byte(nil),raw...)
 id:=d.Racks[actor][0];move,_:=json.Marshal(map[string]any{"type":"exchange","ids":[]int{id}})
 next,_,_,_,e:=a.Apply(raw,actor,move);if e!=nil{t.Fatal(e)}
 again,_,_,_,e:=a.Apply(raw,actor,move);if e!=nil||!bytes.Equal(next,again){t.Fatal("nondeterministic exchange",e)}
 nf,_:=a.decode(next);nd,_:=saladDecode(nf)
 if nd.Streak!=1||len(nd.Bag)!=len(d.Bag)||len(nd.Racks[actor])!=len(d.Racks[actor])||nd.Racks[actor][len(nd.Racks[actor])-1]!=d.Bag[0]||!reflect.DeepEqual(nf.Scores,f.Scores){t.Fatal("exchange accounting")}
 for _,ids:=range [][]int{{id,id},{d.Racks[1-actor][0]},{-1},{}}{bad,_:=json.Marshal(map[string]any{"type":"exchange","ids":ids});if _,_,_,_,e=a.Apply(raw,actor,bad);e==nil||!bytes.Equal(raw,original){t.Fatal("invalid exchange",ids,e)}}
 // Construct full conserved snapshots with reduced bag; never alter persisted sessions.
 for _,remaining:=range []int{0,1,6,7}{
  x:=r5New(11);x.data.Racks[0]=[]int{x.id(t,"A"),x.id(t,"T")};x.data.Racks[1]=[]int{x.id(t,"C")}
  for i:=range x.pack{if x.used[i]{continue};if len(x.data.Bag)<remaining{x.data.Bag=append(x.data.Bag,i)}else{x.data.Retired=append(x.data.Retired,i)}}
  frame:=f;frame.Turn=0;frame.Data,_=json.Marshal(x.data);snap,e:=a.encode(frame);if e!=nil{t.Fatal(e)}
  action,_:=json.Marshal(map[string]any{"type":"exchange","ids":[]int{x.data.Racks[0][0]}})
  _,_,_,_,e=a.Apply(snap,0,action);if (e==nil)!=(remaining>=7){t.Fatal("bag exchange threshold",remaining,e)}
 }
 // Validate independently corrupted physical inventories.
 for _,change:=range []func(*saladData){func(x *saladData){x.Bag=append(x.Bag,x.Bag[0])},func(x *saladData){x.Bag=x.Bag[1:]},func(x *saladData){x.Bag[0]=9999}}{
  x,_:=saladDecode(f);change(&x);bad:=f;bad.Data,_=json.Marshal(x);if _,e=a.encode(bad);e==nil{t.Fatal("corrupt inventory accepted")}
 }
}

func TestWordSaladPartialDrawAndScorelessReset(t *testing.T){
 a,e:=NewWordSaladRulesAdapter([]string{"AT","CAT","AA"},[]string{"BONG"});if e!=nil{t.Fatal(e)}
 var seed [32]byte;raw,e:=a.initialConfigured(seed,2,"11:classic-salad");if e!=nil{t.Fatal(e)}
 f,_:=a.decode(raw)
 for _,bagCount:=range []int{1,7}{
  x:=r5New(11);tiles:=[]saladPlacement{x.tile(t,5,5,"A",""),x.tile(t,5,6,"T","")}
  for _,sym:=range []string{"C","D","E","F","G"}{x.data.Racks[0]=append(x.data.Racks[0],x.id(t,sym))}
  x.data.Racks[1]=[]int{x.id(t,"H")};x.data.Streak=5
  for i:=range x.pack{if x.used[i]{continue};if len(x.data.Bag)<bagCount{x.data.Bag=append(x.data.Bag,i)}else{x.data.Retired=append(x.data.Retired,i)}}
  frame:=f;frame.Turn=0;frame.Data,_=json.Marshal(x.data);snap,e:=a.encode(frame);if e!=nil{t.Fatal(e)}
  move,_:=json.Marshal(saladMove{Type:"place",Tiles:tiles})
  next,_,done,_,e:=a.Apply(snap,0,move);if e!=nil||done{t.Fatal("positive placement",e)}
  nf,_:=a.decode(next);nd,_:=saladDecode(nf);draw:=2;if bagCount<draw{draw=bagCount}
  if nd.Streak!=0||len(nd.Racks[0])!=5+draw||len(nd.Bag)!=bagCount-draw||!reflect.DeepEqual(nd.Racks[0][5:],x.data.Bag[:draw])||nf.Scores[0]!=4{t.Fatal("draw or reset",nd,nf.Scores)}
 }
 // A legal two-blank opening has zero score and advances the streak.
 x:=r5New(11);tiles:=[]saladPlacement{x.tile(t,5,5,"?","A"),x.tile(t,5,6,"?","A")};x.data.Racks[1]=[]int{x.id(t,"C")}
 for i:=range x.pack{if !x.used[i]{x.data.Bag=append(x.data.Bag,i)}}
 f.Turn=0;f.Data,_=json.Marshal(x.data);snap,e:=a.encode(f);if e!=nil{t.Fatal(e)}
 move,_:=json.Marshal(saladMove{Type:"place",Tiles:tiles});next,_,_,_,e:=a.Apply(snap,0,move);if e!=nil{t.Fatal(e)}
 nf,_:=a.decode(next);nd,_:=saladDecode(nf);if nd.Streak!=1||nf.Scores[0]!=0{t.Fatal("zero score streak")}
}

func TestWordSaladTiedResultAndForfeit(t *testing.T){
 a:=saladTestAdapter(t);var seed [32]byte;raw,e:=a.initialConfigured(seed,2,"11:classic-salad");if e!=nil{t.Fatal(e)}
 f,_:=a.decode(raw);d,_:=saladDecode(f);p:=saladProfiles[0];pack:=saladPack(p)
 for i:=range f.Scores{f.Scores[i]=saladRackValue(d.Racks[i],pack)}
 d.Streak=5;f.Data,_=json.Marshal(d);snap,e:=a.encode(f);if e!=nil{t.Fatal(e)}
 next,turn,done,winner,e:=a.Apply(snap,f.Turn,json.RawMessage(`{"type":"pass"}`));if e!=nil||!done||turn!=-1||winner!=nil{t.Fatal("tie result",turn,done,winner,e)}
 nf,_:=a.decode(next);nd,_:=saladDecode(nf)
 if !reflect.DeepEqual(nd.Winners,[]int{0,1})||nd.Ending!="scoreless"||!reflect.DeepEqual(nf.Scores,[]int64{0,0}){t.Fatal("tie representation",nd,nf.Scores)}
 for i:=0;i<2;i++{view,e:=a.View(next,i);if e!=nil{t.Fatal(e)};var v struct{Winners []int};if e=json.Unmarshal(view,&v);e!=nil||!reflect.DeepEqual(v.Winners,[]int{0,1}){t.Fatal("private tie view",e,v)}}
 if _,_,_,_,e=a.Apply(next,0,json.RawMessage(`{"type":"pass"}`));e==nil{t.Fatal("terminal state changed")}
}

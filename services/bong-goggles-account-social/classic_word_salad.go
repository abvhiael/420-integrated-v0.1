package social

import (
 "encoding/json"
 "sort"
 "strings"
 "strconv"
 "crypto/sha256"
 "encoding/hex"
)

// The constructor accepts operator-supplied immutable, licensed dictionary
// snapshots. No client-supplied dictionary or score enters a move.
type wordSaladRules struct { general, cannabis map[string]bool; identity string }
type saladProfile struct { size,min,max,bag,rack int; hybrids []int; seeds [][3]int }
var saladProfiles=[]saladProfile{
 {11,2,2,80,7,[]int{2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1},[][3]int{{0,0,5},{0,5,4},{1,3,2},{2,2,4},{2,5,1},{3,4,3}}},
 {13,2,3,100,7,[]int{3,1,2,1,2,2,1,1,1,1,1,2,1,1,1,1},[][3]int{{0,3,4},{0,6,5},{1,1,2},{2,4,1},{3,3,3},{3,6,2},{4,5,4}}},
 {15,2,4,120,8,[]int{3,1,2,1,2,2,1,2,2,1,1,2,2,1,1,2},[][3]int{{0,4,5},{1,1,4},{1,6,2},{2,3,1},{3,5,3},{4,4,4},{5,6,1},{6,7,2}}},
 {17,2,4,140,8,[]int{4,2,3,2,3,3,2,2,2,1,1,3,2,2,2,2},[][3]int{{1,1,5},{1,8,4},{2,4,2},{2,6,1},{3,3,3},{3,7,2},{4,0,4},{4,5,1},{5,2,1},{5,6,4},{6,7,1},{8,3,3}}},
 {19,2,4,180,8,[]int{5,2,4,2,4,4,2,3,3,2,2,4,3,2,2,3},[][3]int{{0,0,5},{0,6,4},{1,3,2},{2,2,3},{2,8,1},{3,6,4},{4,4,5},{4,8,2},{5,7,1},{6,9,3},{7,8,4}}},
 {21,2,4,220,8,[]int{6,3,5,3,5,5,3,3,4,2,2,5,4,3,3,4},[][3]int{{0,0,5},{0,5,4},{0,10,5},{1,3,1},{2,2,3},{2,8,2},{3,6,4},{4,4,5},{4,9,1},{5,7,3},{6,6,4},{7,9,2},{8,10,1}}},
}
var saladSymbols=strings.Fields("A B C D E F G H I J K L M N O P Q R S T U V W X Y Z QU TH PH SH CH GH CK NG WH SC ST TR LL SS OO ?")
var saladValues=[]int64{1,3,3,2,1,3,3,2,1,6,4,2,3,1,1,3,8,1,1,1,2,4,4,6,3,8,8,3,5,3,5,4,4,3,4,4,2,2,3,2,2,0}
var saladWeights=[]int{12,3,4,6,16,3,4,4,12,1,2,5,4,9,10,3,1,9,7,8,5,2,2,1,3,1}
func saladPack(p saladProfile)[]int {
 counts:=make([]int,42); counts[41]=p.hybrids[0]; left:=p.bag-counts[41]-26
 for i,n:=range p.hybrids[1:] {counts[26+i]=n;left-=n}
 total:=0;for _,w:=range saladWeights{total+=w}
 order:=make([]int,26); used:=0
 for i,w:=range saladWeights{order[i]=i;counts[i]=1+w*left/total;used+=counts[i]-1}
 sort.SliceStable(order,func(i,j int)bool{return saladWeights[order[i]]*left%total>saladWeights[order[j]]*left%total})
 for _,i:=range order[:left-used]{counts[i]++}
 pack:=[]int{};for i,n:=range counts{for j:=0;j<n;j++{pack=append(pack,i)}};return pack
}
func saladPremium(p saladProfile)[]int {
 out:=make([]int,p.size*p.size);m:=p.size-1
 for _,s:=range p.seeds{r,c,t:=s[0],s[1],s[2];for _,xy:=range [][2]int{{r,c},{m-r,c},{r,m-c},{m-r,m-c},{c,r},{m-c,r},{c,m-r},{m-c,m-r}}{out[xy[0]*p.size+xy[1]]=t}}
 out[(m/2)*p.size+m/2]=6;return out
}
type saladCell struct { ID int `json:"id"`; Blank string `json:"blank,omitempty"` }
type saladData struct {
 Board map[int]saladCell `json:"board"`
 Bag []int `json:"bag"`
 Racks [][]int `json:"racks"`
 Retired []int `json:"retired"`
 Forfeit []bool `json:"forfeit"`
 Order []int `json:"order"`
 Streak int `json:"streak"`
 Winners []int `json:"winners"`
 Ending string `json:"ending,omitempty"`
}
type saladPlacement struct { Row *int `json:"row"`; Col *int `json:"col"`; ID *int `json:"id"`; Blank string `json:"blank,omitempty"` }
type saladMove struct { Type string `json:"type"`; Tiles []saladPlacement `json:"tiles,omitempty"`; IDs []int `json:"ids,omitempty"` }
func saladWordOK(w string)bool{if len(w)<2||len(w)>42{return false};for _,c:=range w{if c<'A'||c>'Z'{return false}};return true}
func NewWordSaladRulesAdapter(general,cannabis []string)(*RulesAdapter,error){
 r:=wordSaladRules{general:map[string]bool{},cannabis:map[string]bool{}}
 h:=sha256.New()
 for i,words:=range [][]string{general,cannabis}{
  if len(words)==0{return nil,ErrInvalid}
  keys:=append([]string(nil),words...);sort.Strings(keys)
  target:=r.general;if i==1{target=r.cannabis}
  h.Write([]byte{byte(i)})
  for _,w:=range keys{if !saladWordOK(w)||target[w]{return nil,ErrInvalid};target[w]=true;h.Write([]byte(w+"\n"))}
 }
 r.identity=hex.EncodeToString(h.Sum(nil));return NewRulesAdapter(r)
}
func(r wordSaladRules)MaxReplayActions()int{return 8192}
func(r wordSaladRules)Definition()RuleDefinition{return RuleDefinition{GameID:"scrabble",Version:"v1",Specification:"word-salad-v1;four-seat-cap;hybrid42;dictionary-sha256="+r.identity}}
func saladVariant(v string,n int)(saladProfile,string,error){
 parts:=strings.Split(v,":");if len(parts)!=2&&len(parts)!=3{return saladProfile{},"",ErrInvalid}
 size,e:=strconv.Atoi(parts[0]);if e!=nil||strconv.Itoa(size)!=parts[0]{return saladProfile{},"",ErrInvalid}
 if len(parts)==3&&parts[2]!="live"&&parts[2]!="async"&&parts[2]!="untimed"{return saladProfile{},"",ErrInvalid};mode:=parts[1];if mode!="classic-salad"&&mode!="extra-dank"&&mode!="straight-greens"{return saladProfile{},"",ErrInvalid}
 for _,p:=range saladProfiles{if p.size==size&&n>=p.min&&n<=p.max{return p,mode,nil}};return saladProfile{},"",ErrInvalid
}
func(r wordSaladRules)DefaultVariant(n int)(string,error){if n<2||n>4{return "",ErrInvalid};return "17:classic-salad",nil}
func(r wordSaladRules)VariantForSeats(room ClassicRoom,seats []ClassicSeat)(string,error){if room.Format==""{return r.DefaultVariant(room.SeatCount)};if _,_,e:=saladVariant(room.Format,room.SeatCount);e!=nil{return "",e};return room.Format,nil}
func(r wordSaladRules)Initial(seed [32]byte,n int,b *RuleBudget)(RuleFrame,error){return r.InitialVariant(seed,n,"17:classic-salad",b)}
func saladShuffle(a []int,rng *RuleRandom)error{for i:=len(a)-1;i>0;i--{j,e:=rng.Intn(uint64(i+1));if e!=nil{return e};a[i],a[j]=a[j],a[i]};return nil}
func(r wordSaladRules)InitialVariant(seed [32]byte,n int,v string,b *RuleBudget)(RuleFrame,error){
 p,_,e:=saladVariant(v,n);if e!=nil{return RuleFrame{},e};if e=b.Charge(p.bag+n);e!=nil{return RuleFrame{},e}
 d:=saladData{Board:map[int]saladCell{},Bag:make([]int,p.bag),Racks:make([][]int,n),Forfeit:make([]bool,n),Order:make([]int,n)}
 for i:=range d.Bag{d.Bag[i]=i};for i:=range d.Order{d.Order[i]=i}
 if e=saladShuffle(d.Bag,&RuleRandom{Seed:seed,Domain:"salad-bag"});e!=nil{return RuleFrame{},e}
 if e=saladShuffle(d.Order,&RuleRandom{Seed:seed,Domain:"salad-seats"});e!=nil{return RuleFrame{},e}
 for j:=0;j<p.rack;j++{for _,i:=range d.Order{d.Racks[i]=append(d.Racks[i],d.Bag[0]);d.Bag=d.Bag[1:]}}
 raw,e:=json.Marshal(d);return RuleFrame{Variant:v,SeatCount:n,Round:1,Phase:"play",Turn:d.Order[0],Scores:make([]int64,n),Data:raw},e
}
func saladDecode(f RuleFrame)(saladData,error){var d saladData;if !strictRuleJSON(f.Data,&d){return d,ErrInvalid};return d,nil}
func saladText(c saladCell,pack []int)(string,error){
 if c.ID<0||c.ID>=len(pack){return "",ErrInvalid};s:=saladSymbols[pack[c.ID]]
 if s=="?"{if len(c.Blank)!=1||c.Blank[0]<'A'||c.Blank[0]>'Z'{return "",ErrInvalid};return c.Blank,nil}
 if c.Blank!=""{return "",ErrInvalid};return s,nil
}
func(r wordSaladRules)Validate(f RuleFrame)error{
 p,_,e:=saladVariant(f.Variant,f.SeatCount);if e!=nil{return e}
 d,e:=saladDecode(f);if e!=nil{return e}
 if d.Board==nil||len(d.Racks)!=f.SeatCount||len(d.Forfeit)!=f.SeatCount||len(d.Order)!=f.SeatCount||d.Streak<0||d.Streak>6{return ErrInvalid}
 seen:=make([]bool,p.bag);add:=func(id int)bool{if id<0||id>=len(seen)||seen[id]{return false};seen[id]=true;return true}
 pack:=saladPack(p);for pos,c:=range d.Board{if pos<0||pos>=p.size*p.size||!add(c.ID){return ErrInvalid};if _,e:=saladText(c,pack);e!=nil{return e}}
 for _,id:=range d.Bag{if !add(id){return ErrInvalid}}
 for _,id:=range d.Retired{if !add(id){return ErrInvalid}}
 seats:=map[int]bool{};for _,s:=range d.Order{if s<0||s>=f.SeatCount||seats[s]{return ErrInvalid};seats[s]=true}
 for i,rack:=range d.Racks{if len(rack)>p.rack||d.Forfeit[i]&&len(rack)!=0{return ErrInvalid};for _,id:=range rack{if !add(id){return ErrInvalid}}}
 for _,v:=range seen{if !v{return ErrInvalid}}
 if f.Terminal {if f.Phase!="finished"||d.Ending==""||f.Turn!=-1{return ErrInvalid}}else if f.Phase!="play"||d.Ending!=""||f.Turn<0||f.Turn>=f.SeatCount||d.Forfeit[f.Turn]||d.Streak>=6||len(d.Winners)!=0{return ErrInvalid}
 return nil
}
func saladRemove(rack []int,id int)([]int,bool){for i,v:=range rack{if v==id{return append(rack[:i:i],rack[i+1:]...),true}};return rack,false}
func saladNeighbor(pos,dr,dc,n int)(int,bool){r,c:=pos/n+dr,pos%n+dc;if r<0||r>=n||c<0||c>=n{return 0,false};return r*n+c,true}
func(r wordSaladRules)place(d *saladData,p saladProfile,mode string,seat int,tiles []saladPlacement)(int64,error){
 if len(tiles)<1||len(tiles)>p.rack{return 0,ErrInvalid}
 opening:=len(d.Board)==0;fresh:=map[int]bool{};pack:=saladPack(p);sameRow,sameCol:=true,true
 connected:=false;row,col:=-1,-1
 for _,t:=range tiles{
  if t.Row==nil||t.Col==nil||t.ID==nil||*t.Row<0||*t.Row>=p.size||*t.Col<0||*t.Col>=p.size{return 0,ErrInvalid}
  y,x:=*t.Row,*t.Col;pos:=y*p.size+x
  if _,ok:=d.Board[pos];ok{return 0,ErrInvalid}
  if row<0{row,col=y,x};sameRow=sameRow&&row==y;sameCol=sameCol&&col==x
  cell:=saladCell{ID:*t.ID,Blank:t.Blank};if _,e:=saladText(cell,pack);e!=nil{return 0,e}
  rack,ok:=saladRemove(d.Racks[seat],cell.ID);if !ok{return 0,ErrInvalid};d.Racks[seat]=rack
  d.Board[pos]=cell;fresh[pos]=true
 }
 if !sameRow&&!sameCol{return 0,ErrInvalid}
 if opening&&!fresh[(p.size/2)*p.size+p.size/2]{return 0,ErrInvalid}
 for pos:=range fresh{for _,dir:=range [][2]int{{1,0},{-1,0},{0,1},{0,-1}}{if q,ok:=saladNeighbor(pos,dir[0],dir[1],p.size);ok&&!fresh[q]{if _,ok=d.Board[q];ok{connected=true}}}}
 if !opening&&!connected{return 0,ErrInvalid}
 // All newly occupied cells must lie in one contiguous main run.
 if len(fresh)>1{start:=p.size*p.size;end:=0;for pos:=range fresh{if pos<start{start=pos};if pos>end{end=pos}}
  stride:=1;if sameCol{stride=p.size};for pos:=start;pos<=end;pos+=stride{if _,ok:=d.Board[pos];!ok{return 0,ErrInvalid}}
 }
 premium:=saladPremium(p);seen:=map[[2]int]bool{};count:=0;bonus:=false;var points int64
 for pos:=range fresh{for axis,dir:=range [][2]int{{0,1},{1,0}}{
  start:=pos;for{q,ok:=saladNeighbor(start,-dir[0],-dir[1],p.size);if !ok{break};if _,ok=d.Board[q];!ok{break};start=q}
  key:=[2]int{axis,start};if seen[key]{continue};seen[key]=true
  var word strings.Builder;var sum int64;mult:=int64(1);cells:=0
  for q:=start;;{cell,ok:=d.Board[q];if !ok{break};s,e:=saladText(cell,pack);if e!=nil{return 0,e};word.WriteString(s);cells++
   val:=saladValues[pack[cell.ID]];if fresh[q]{switch premium[q]{case 1:val*=2;case 2:val*=3;case 3:val*=4;case 4,6:mult*=2;case 5:mult*=3}};sum+=val
   next,ok:=saladNeighbor(q,dir[0],dir[1],p.size);if !ok{break};q=next
  }
  if cells<2{continue};count++;w:=word.String();canna:=mode!="straight-greens"&&r.cannabis[w]
  if !r.general[w]&&!canna{return 0,ErrInvalid};if canna{mult*=2;bonus=true};points+=sum*mult
  if points>maxRuleScore{return 0,ErrInvalid}
 }}
 if count==0||mode=="extra-dank"&&!bonus{return 0,ErrInvalid}
 if len(tiles)==p.rack{if p.rack==7{points+=50}else{points+=60}}
 return points,nil
}
func(r wordSaladRules)Legal(f RuleFrame,seat int,b *RuleBudget)([]json.RawMessage,error){
 if e:=b.Charge(1);e!=nil{return nil,e};if f.Terminal||f.Turn!=seat{return nil,ErrForbidden}
 // Non-exhaustive actions for the shared interface. Placement and exchange
 // are checked by ValidateSubmitted, never by a truncated candidate list.
 return []json.RawMessage{json.RawMessage(`{"type":"pass"}`)},nil
}
func(r wordSaladRules)ValidateSubmitted(f RuleFrame,seat int,raw json.RawMessage,b *RuleBudget)error{_,e:=r.Step(f,seat,raw,b);return e}
func saladRackValue(rack,pack []int)int64{var n int64;for _,id:=range rack{n+=saladValues[pack[id]]};return n}
func saladFinish(f *RuleFrame,d *saladData,p saladProfile,ending string,finisher int){
 d.Ending=ending;f.Phase="finished";f.Terminal=true;f.Turn=-1;f.Winner=nil
 pack:=saladPack(p)
 if ending=="out"||ending=="scoreless"{for i,rack:=range d.Racks{if d.Forfeit[i]||ending=="out"&&i==finisher{continue};v:=saladRackValue(rack,pack);f.Scores[i]-=v;if ending=="out"{f.Scores[finisher]+=v}}}
 var best int64;for i,s:=range f.Scores{if d.Forfeit[i]{continue};if len(d.Winners)==0||s>best{d.Winners=[]int{i};best=s}else if s==best{d.Winners=append(d.Winners,i)}}
 if len(d.Winners)==1{w:=d.Winners[0];f.Winner=&w}
}
func(r wordSaladRules)Step(f RuleFrame,seat int,raw json.RawMessage,b *RuleBudget)(RuleFrame,error){
 if f.Terminal||seat<0||seat>=f.SeatCount{return RuleFrame{},ErrForbidden}
 p,mode,e:=saladVariant(f.Variant,f.SeatCount);if e!=nil{return RuleFrame{},e};if e=b.Charge(p.size*p.size*4);e!=nil{return RuleFrame{},e}
 d,e:=saladDecode(f);if e!=nil{return RuleFrame{},e};var m saladMove;if !strictRuleJSON(raw,&m){return RuleFrame{},ErrInvalid};if d.Forfeit[seat]||seat!=f.Turn&&m.Type!="resign"{return RuleFrame{},ErrForbidden}
 f.Scores=append([]int64(nil),f.Scores...);var points int64
 switch m.Type{
 case "place":
  if len(m.IDs)!=0{return RuleFrame{},ErrInvalid};points,e=r.place(&d,p,mode,seat,m.Tiles);if e!=nil{return RuleFrame{},e};f.Scores[seat]+=points
  for len(d.Racks[seat])<p.rack&&len(d.Bag)>0{d.Racks[seat]=append(d.Racks[seat],d.Bag[0]);d.Bag=d.Bag[1:]}
  if len(d.Bag)==0&&len(d.Racks[seat])==0{saladFinish(&f,&d,p,"out",seat)}
 case "exchange":
  if len(m.Tiles)!=0||len(m.IDs)<1||len(m.IDs)>p.rack||len(d.Bag)<p.rack{return RuleFrame{},ErrInvalid}
  for _,id:=range m.IDs{rack,ok:=saladRemove(d.Racks[seat],id);if !ok{return RuleFrame{},ErrInvalid};d.Racks[seat]=rack}
  n:=len(m.IDs);d.Racks[seat]=append(d.Racks[seat],d.Bag[:n]...);d.Bag=append(d.Bag[n:],m.IDs...)
  var seed [32]byte;bytes,e:=hex.DecodeString(f.Seed);if e!=nil||len(bytes)!=32{return RuleFrame{},ErrInvalid};copy(seed[:],bytes)
  if e=saladShuffle(d.Bag,&RuleRandom{Seed:seed,Domain:"salad-exchange-"+strconv.Itoa(f.Round)});e!=nil{return RuleFrame{},e}
 case "pass","timeout":
  if len(m.Tiles)!=0||len(m.IDs)!=0{return RuleFrame{},ErrInvalid}
 case "resign":
  if len(m.Tiles)!=0||len(m.IDs)!=0{return RuleFrame{},ErrInvalid}
  f.Scores[seat]-=saladRackValue(d.Racks[seat],saladPack(p));d.Retired=append(d.Retired,d.Racks[seat]...);d.Racks[seat]=nil;d.Forfeit[seat]=true
  active:=0;for _,v:=range d.Forfeit{if !v{active++}};if active<=1{saladFinish(&f,&d,p,"forfeit",-1)}
 default:return RuleFrame{},ErrInvalid
 }
 if !f.Terminal&&m.Type!="resign"{if points>0{d.Streak=0}else{d.Streak++};if d.Streak==6{saladFinish(&f,&d,p,"scoreless",-1)}}
 if !f.Terminal&&f.Turn==seat{for i,s:=range d.Order{if s==seat{for offset:=1;offset<=len(d.Order);offset++{next:=d.Order[(i+offset)%len(d.Order)];if !d.Forfeit[next]{f.Turn=next;break}};break}}}
 f.Round++;f.Data,e=json.Marshal(d);return f,e
}
func(r wordSaladRules)View(f RuleFrame,seat int)(json.RawMessage,error){
 if seat<0||seat>=f.SeatCount{return nil,ErrForbidden};p,_,e:=saladVariant(f.Variant,f.SeatCount);if e!=nil{return nil,e};d,e:=saladDecode(f);if e!=nil{return nil,e};pack:=saladPack(p)
 type visibleTile struct{ID int `json:"id"`;Symbol string `json:"symbol"`;Value int64 `json:"value"`}
 rack:=[]visibleTile{};for _,id:=range d.Racks[seat]{rack=append(rack,visibleTile{id,saladSymbols[pack[id]],saladValues[pack[id]]})}
 board:=map[int]string{};for pos,c:=range d.Board{s,e:=saladText(c,pack);if e!=nil{return nil,e};board[pos]=s}
 counts:=[]int{};for _,r:=range d.Racks{counts=append(counts,len(r))}
 return json.Marshal(map[string]any{"variant":f.Variant,"board":board,"rack":rack,"rackCounts":counts,"bagCount":len(d.Bag),"scores":f.Scores,"turn":f.Turn,"terminal":f.Terminal,"winners":d.Winners,"forfeit":d.Forfeit,"ending":d.Ending})
}

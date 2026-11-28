package social

import (
 "encoding/json"
 "sort"
 "strings"
 "sync"
)

// Policies contain only immutable public dictionaries, not match state.
// A trie traverses physical tile symbols (including indivisible hybrids).
// Compact immutable prefix index: sorted words, shared backing slices and
// allocation-free cursor traversal. No per-letter pointer trees.
type saladTrie struct{ words []string; lo,hi,depth int }
func (t saladTrie) valid()bool{return t.lo<t.hi}
func (t saladTrie) terminal()bool{return t.valid()&&len(t.words[t.lo])==t.depth}
func (t saladTrie) advance(s string)saladTrie{
 for _,c:=range s{
  if !t.valid()||c<'A'||c>'Z'{return saladTrie{}}
  char:=func(i int)int{w:=t.words[i];if len(w)<=t.depth{return -1};return int(w[t.depth])}
  lo:=t.lo+sort.Search(t.hi-t.lo,func(i int)bool{return char(t.lo+i)>=int(c)})
  hi:=lo+sort.Search(t.hi-lo,func(i int)bool{return char(lo+i)>int(c)})
  t.lo,t.hi,t.depth=lo,hi,t.depth+1
 };return t
}
type saladPrefixIndex struct{general,union saladTrie}
var saladIndexCache sync.Map // immutable production dictionary identity only
func buildSaladIndex(r wordSaladRules)saladPrefixIndex{
 g:=make([]string,0,len(r.general));u:=make([]string,0,len(r.general)+len(r.cannabis))
 for w:=range r.general{g=append(g,w);u=append(u,w)}
 for w:=range r.cannabis{if !r.general[w]{u=append(u,w)}}
 sort.Strings(g);sort.Strings(u)
 return saladPrefixIndex{saladTrie{words:g,hi:len(g)},saladTrie{words:u,hi:len(u)}}
}
var saladSearchSlots=make(chan struct{},2)
type saladBotLexicon struct{general,union saladTrie; rules wordSaladRules}
type saladBotPolicy struct{level string; lex *saladBotLexicon}
func NewWordSaladBotPolicies(a *RulesAdapter)(ClassicBotPolicies,error){
 if a==nil{return ClassicBotPolicies{},ErrInvalid};r,ok:=a.module.(wordSaladRules);if !ok{return ClassicBotPolicies{},ErrInvalid}
 var idx saladPrefixIndex
 if r.production{if cached,ok:=saladIndexCache.Load(r.identity);ok{idx=cached.(saladPrefixIndex)}else{cached,_:=saladIndexCache.LoadOrStore(r.identity,buildSaladIndex(r));idx=cached.(saladPrefixIndex)}}else{idx=buildSaladIndex(r)}
 l:=&saladBotLexicon{general:idx.general,union:idx.union,rules:r}
 return ClassicBotPolicies{saladBotPolicy{"easy",l},saladBotPolicy{"medium",l},saladBotPolicy{"hard",l}},nil
}
type saladBotTile struct{ID int;Symbol string;Value int64}
type saladBotView struct{
 Variant string
 Board map[int]string
 BlankCells []int
 Rack []saladBotTile
 RackCounts []int
 BagCount int
 Scores []int64
 Turn int
 Terminal bool
 Winners []int
 Forfeit []bool
 Ending string
}
// Score using public symbols, own tile values and the canonical premium and
// dictionary tables. No reconstruction of unseen physical tile identities.
func (l *saladBotLexicon) score(v saladBotView,p saladProfile,mode string,tiles []saladPlacement)(int64,bool){
 return l.scorePrepared(v,p,mode,tiles,saladPack(p),saladPremium(p))
}
func (l *saladBotLexicon) scorePrepared(v saladBotView,p saladProfile,mode string,tiles []saladPlacement,pack,premium []int)(int64,bool){
 board:=make(map[int]string,len(v.Board)+len(tiles));for q,s:=range v.Board{board[q]=s}
 fresh:=map[int]int64{}
 for _,t:=range tiles{q:=*t.Row*p.size+*t.Col;s:=saladSymbols[pack[*t.ID]];if s=="?"{s=t.Blank};board[q]=s;fresh[q]=saladValues[pack[*t.ID]]}
 blankCells:=map[int]bool{};for _,q:=range v.BlankCells{blankCells[q]=true}
 seen:=map[[2]int]bool{};var points int64;bonus:=false;count:=0
 for q:=range fresh{for axis,dir:=range [][2]int{{0,1},{1,0}}{
  start:=q;for{prev,ok:=saladNeighbor(start,-dir[0],-dir[1],p.size);if !ok||board[prev]==""{break};start=prev}
  key:=[2]int{axis,start};if seen[key]{continue};seen[key]=true
  var w strings.Builder;var sum int64;mult:=int64(1);cells:=0
  for at:=start;;{s:=board[at];if s==""{break};w.WriteString(s);cells++
   val,ok:=fresh[at];if ok{switch premium[at]{case 1:val*=2;case 2:val*=3;case 3:val*=4;case 4,6:mult*=2;case 5:mult*=3}}else if !blankCells[at]{
    for i,sym:=range saladSymbols{if sym==s{val=saladValues[i];break}}
   };sum+=val
   next,ok:=saladNeighbor(at,dir[0],dir[1],p.size);if !ok{break};at=next
  }
  if cells<2{continue};count++;word:=w.String();canna:=mode!="straight-greens"&&l.rules.cannabis[word]
  if !l.rules.general[word]&&!canna{return 0,false};if canna{mult*=2;bonus=true};points+=sum*mult
 }}
 if count==0||mode=="extra-dank"&&!bonus{return 0,false}
 if len(tiles)==p.rack{if p.rack==7{points+=50}else{points+=60}}
 return points,true
}
func (policy saladBotPolicy) ChooseMove(raw json.RawMessage,level string,legal []json.RawMessage,b *RuleBudget)(json.RawMessage,error){
 if policy.lex==nil||level!=policy.level||b.Charge(1)!=nil{return nil,ErrInvalid}
 select{case saladSearchSlots<-struct{}{}:defer func(){<-saladSearchSlots}();default:return nil,ErrUnavailable}
 var v saladBotView;if !strictRuleJSON(raw,&v)||v.Terminal||v.Turn<0||v.Turn>=len(v.Scores)||len(v.RackCounts)!=len(v.Scores)||len(v.Forfeit)!=len(v.Scores)||v.Forfeit[v.Turn]||v.Board==nil{return nil,ErrInvalid}
 p,mode,e:=saladVariant(v.Variant,len(v.Scores));if e!=nil||len(v.Rack)>p.rack||len(v.Rack)!=v.RackCounts[v.Turn]||v.BagCount<0||v.BagCount>p.bag{return nil,ErrInvalid}
 pack:=saladPack(p);premium:=saladPremium(p);seen:=map[int]bool{}
 for _,t:=range v.Rack{if t.ID<0||t.ID>=len(pack)||seen[t.ID]||t.Symbol!=saladSymbols[pack[t.ID]]||t.Value!=saladValues[pack[t.ID]]{return nil,ErrInvalid};seen[t.ID]=true}
 for q,s:=range v.Board{if q<0||q>=p.size*p.size{return nil,ErrInvalid};ok:=false;for _,sym:=range saladSymbols[:41]{if sym==s{ok=true;break}};if !ok{return nil,ErrInvalid}}
 blankSeen:=map[int]bool{};for _,q:=range v.BlankCells{sym:=v.Board[q];if len(sym)!=1||blankSeen[q]{return nil,ErrInvalid};blankSeen[q]=true}
 sort.Slice(v.Rack,func(i,j int)bool{return v.Rack[i].ID<v.Rack[j].ID})
 root:=policy.lex.union;if mode=="straight-greens"{root=policy.lex.general}
 // Easy: first legal short play. Medium: highest immediate score in a
 // bounded four-tile search. Hard: deeper search with rack-leave balance.
 depth,nodes:=2,650
 if level=="medium"{depth,nodes=4,5500};if level=="hard"{depth,nodes=p.rack,18000}
 var best []saladPlacement;bestValue:=int64(-1<<60);done:=false
 opening:=len(v.Board)==0;center:=(p.size/2)*p.size+p.size/2
 anchors:=make([]int,0)
 if opening{anchors=append(anchors,center)}else{for q:=0;q<p.size*p.size;q++{if v.Board[q]!=""{continue};for _,dir:=range [][2]int{{1,0},{-1,0},{0,1},{0,-1}}{if prev,ok:=saladNeighbor(q,dir[0],dir[1],p.size);ok&&v.Board[prev]!=""{anchors=append(anchors,q);break}}}}
 // Enumerate maximal runs covering a public anchor. Every candidate is
 // checked for all crosswords; the adapter independently validates again.
 for _,anchor:=range anchors{if done{break};for _,dir:=range [][2]int{{0,1},{1,0}}{if done{break}
  starts:=[]int{anchor};for q:=anchor;;{prev,ok:=saladNeighbor(q,-dir[0],-dir[1],p.size);if !ok{break};starts=append(starts,prev);q=prev}
  for _,start:=range starts{if done{break};if prev,ok:=saladNeighbor(start,-dir[0],-dir[1],p.size);ok&&v.Board[prev]!=""{continue}
   // At most depth empty cells before the anchor.
   empty:=0;for q:=start;q!=anchor;{if v.Board[q]==""{empty++};q,_=saladNeighbor(q,dir[0],dir[1],p.size)};if empty>=depth{continue}
   var walk func(int,saladTrie,uint16,[]saladPlacement,bool,int)
   walk=func(q int,node saladTrie,used uint16,tiles []saladPlacement,hit bool,cells int){
    if done||!node.valid(){return};if nodes<=0||b.Charge(1)!=nil{done=true;return};nodes--
    if node.terminal()&&hit&&cells>=2&&len(tiles)>0&&(q<0||v.Board[q]==""){
     if score,ok:=policy.lex.scorePrepared(v,p,mode,tiles,pack,premium);ok{
      value:=score*100
      if level=="hard"{vowels,consonants:=0,0;for i,t:=range v.Rack{if used&(1<<i)!=0{continue};if t.Symbol=="?"{value+=350}else if strings.ContainsAny(t.Symbol,"AEIOU"){vowels++}else{consonants++};value-=t.Value*8};diff:=vowels-consonants;if diff<0{diff=-diff};value-=int64(diff*35)}
      if best==nil||value>bestValue{bestValue=value;best=append([]saladPlacement(nil),tiles...)}
      if level=="easy"{done=true;return}
     }
    }
    if q<0{return}
    next,ok:=saladNeighbor(q,dir[0],dir[1],p.size);if !ok{next=-1}
    if sym:=v.Board[q];sym!=""{walk(next,node.advance(sym),used,tiles,hit,cells+1);return}
    if len(tiles)>=depth{return}
    duplicate:=map[string]bool{}
    for i,t:=range v.Rack{if done{return};if used&(1<<i)!=0||duplicate[t.Symbol]{continue};duplicate[t.Symbol]=true
     choices:=[]string{t.Symbol};if t.Symbol=="?"{choices=nil;for c:='A';c<='Z';c++{if node.advance(string(c)).valid(){choices=append(choices,string(c))}}}
     for _,sym:=range choices{n:=node.advance(sym);if !n.valid(){continue};row,col,id:=q/p.size,q%p.size,t.ID;blank:="";if t.Symbol=="?"{blank=sym}
      walk(next,n,used|(1<<i),append(tiles,saladPlacement{Row:&row,Col:&col,ID:&id,Blank:blank}),hit||q==anchor,cells+1)
     }
    }
   }
   walk(start,root,0,nil,false,0)
  }
 }}
 if b.expired(){return nil,ErrUnavailable}
 if best!=nil{return json.Marshal(saladMove{Type:"place",Tiles:best})}
 if v.BagCount>=p.rack&&len(v.Rack)>0{
  // Exchange only owned tiles; preserve blanks and common vowels.
  ids:=[]int{};for _,t:=range v.Rack{if t.Symbol!="?"&&(level=="easy"||t.Value>=3){ids=append(ids,t.ID)}}
  if len(ids)==0{for _,t:=range v.Rack{if t.Symbol!="?"{ids=append(ids,t.ID);break}}}
  if len(ids)>0{return json.Marshal(saladMove{Type:"exchange",IDs:ids})}
 }
 return json.Marshal(saladMove{Type:"pass"})
}
var _ RuleDecisionPolicy=saladBotPolicy{}

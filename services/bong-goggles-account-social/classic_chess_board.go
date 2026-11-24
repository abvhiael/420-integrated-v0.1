package social

import "strings"

type chessBoard struct {
 Squares [64]byte
 Turn int
 Castle byte
 EP int
 Half int
 Full int
}
type chessMove struct { From,To int; Promotion byte; Special byte }
func chessInitialBoard() chessBoard {
 var p chessBoard
 copy(p.Squares[:], "RNBQKBNRPPPPPPPP................................pppppppprnbqkbnr")
 p.Castle=15;p.EP=-1;p.Full=1
 return p
}
func chessColor(p byte)int{
 if p>='A'&&p<='Z'{return 0};if p>='a'&&p<='z'{return 1};return -1
}
func chessKind(p byte)byte{if p>='a'&&p<='z'{return p-32};return p}
func chessSquare(f,r int)int{if f<0||f>7||r<0||r>7{return -1};return r*8+f}
func chessName(s int)string{return string([]byte{byte('a'+s%8),byte('1'+s/8)})}
func (m chessMove) UCI()string{
 s:=chessName(m.From)+chessName(m.To);if m.Promotion!=0{s+=strings.ToLower(string(m.Promotion))};return s
}
var chessOrthogonal=[][2]int{{1,0},{-1,0},{0,1},{0,-1}}
var chessDiagonal=[][2]int{{1,1},{1,-1},{-1,1},{-1,-1}}
var chessKnight=[][2]int{{1,2},{2,1},{-1,2},{-2,1},{1,-2},{2,-1},{-1,-2},{-2,-1}}
var chessAllDirs=[][2]int{{1,0},{-1,0},{0,1},{0,-1},{1,1},{1,-1},{-1,1},{-1,-1}}
func (p chessBoard) attacked(target,by int)bool{
 for f,v:=range p.Squares{
  if chessColor(v)!=by{continue}
  dx,dy:=target%8-f%8,target/8-f/8
  k:=chessKind(v)
  if k=='P'{d:=1;if by==1{d=-1};if dy==d&&(dx==1||dx==-1){return true};continue}
  dirs:=chessAllDirs
  switch k{case 'N':dirs=chessKnight;case 'B':dirs=chessDiagonal;case 'R':dirs=chessOrthogonal}
  for _,d:=range dirs{
   for n:=1;n<=7;n++{
    t:=chessSquare(f%8+d[0]*n,f/8+d[1]*n);if t<0{break}
    if t==target{return true}
    if p.Squares[t]!='.'||k=='N'||k=='K'{break}
   }
  }
 }
 return false
}
func(p chessBoard) check(side int)bool{
 k:=byte('K');if side==1{k='k'}
 for i,v:=range p.Squares{if v==k{return p.attacked(i,1-side)}}
 return true
}
func(p chessBoard) apply(m chessMove)chessBoard{
 v,c:=p.Squares[m.From],p.Squares[m.To]
 p.Squares[m.From]='.';p.Squares[m.To]=v
 if m.Promotion!=0{q:=m.Promotion;if p.Turn==1{q+=32};p.Squares[m.To]=q}
 d:=8;if p.Turn==1{d=-8}
 if m.Special=='e'{p.Squares[m.To-d]='.'}
 if m.Special=='c'{rf,rt:=m.From+3,m.From+1;if m.To<m.From{rf,rt=m.From-4,m.From-1};p.Squares[rt]=p.Squares[rf];p.Squares[rf]='.'}
 if v=='K'{p.Castle&^=3};if v=='k'{p.Castle&^=12}
 for i,s:=range []int{7,0,63,56}{if (m.From==s&&chessKind(v)=='R')||(m.To==s&&chessKind(c)=='R'){p.Castle&^=1<<uint(i)}}
 p.EP=-1
 if chessKind(v)=='P'&&(m.To-m.From==2*d){p.EP=m.From+d}
 if chessKind(v)=='P'||c!='.'||m.Special=='e'{p.Half=0}else{p.Half++}
 if p.Turn==1{p.Full++};p.Turn=1-p.Turn
 return p
}
func(p chessBoard) legal()[]chessMove{return p.legalLimited(false)}
// The same generator can stop after the first legal move for terminal checks.
func(p chessBoard) legalLimited(first bool)[]chessMove{
 out:=[]chessMove{}
 for f,v:=range p.Squares{
  if chessColor(v)!=p.Turn{continue}
  k:=chessKind(v)
  add:=func(t int,special byte){
   if t<0||chessColor(p.Squares[t])==p.Turn||chessKind(p.Squares[t])=='K'{return}
   promos:=[]byte{0};if k=='P'&&(t/8==0||t/8==7){promos=[]byte{'Q','R','B','N'}}
   for _,q:=range promos{m:=chessMove{f,t,q,special};if !p.apply(m).check(p.Turn){out=append(out,m);if first{return}}}
  }
  if k=='P'{
   d,start:=1,1;if p.Turn==1{d,start=-1,6}
   t:=chessSquare(f%8,f/8+d)
   if t>=0&&p.Squares[t]=='.'{add(t,0);if f/8==start&&p.Squares[t+8*d]=='.'{add(t+8*d,0)}}
   for _,dx:=range []int{-1,1}{t=chessSquare(f%8+dx,f/8+d);if t<0{continue};if chessColor(p.Squares[t])==1-p.Turn{add(t,0)}else if t==p.EP&&p.Squares[t]=='.'&&chessKind(p.Squares[t-8*d])=='P'&&chessColor(p.Squares[t-8*d])==1-p.Turn{add(t,'e')}}
   if first&&len(out)>0{return out}
   continue
  }
  dirs:=chessAllDirs
  switch k{case 'N':dirs=chessKnight;case 'B':dirs=chessDiagonal;case 'R':dirs=chessOrthogonal}
  for _,d:=range dirs{for n:=1;n<=7;n++{
   t:=chessSquare(f%8+d[0]*n,f/8+d[1]*n);if t<0{break};add(t,0)
   if first&&len(out)>0{return out}
   if p.Squares[t]!='.'||k=='K'||k=='N'{break}
  }}
  if k=='K'&&f==4+56*p.Turn&&!p.check(p.Turn){
   rook:=byte('R');if p.Turn==1{rook='r'}
   for _,side:=range []int{1,-1}{
    bit:=byte(1<<uint(2*p.Turn));rf:=f+3;if side==-1{bit<<=1;rf=f-4}
    if p.Castle&bit==0||p.Squares[rf]!=rook||p.Squares[f+side]!='.'||p.Squares[f+2*side]!='.'||(side==-1&&p.Squares[f-3]!='.'){continue}
    transit:=p.apply(chessMove{From:f,To:f+side})
    if !transit.check(p.Turn){add(f+2*side,'c');if first&&len(out)>0{return out}}
   }
  }
 }
 return out
}
func(p chessBoard) identity()(chessPositionIdentity,error){
 var codes [64]byte
 for i,v:=range p.Squares{if v=='.'{continue};n:=strings.IndexByte("PNBRQKpnbrqk",v);if n<0{return chessPositionIdentity{},ErrInvalid};codes[i]=byte(n+1)}
 ep:=byte(0);if p.EP>=0{for _,m:=range p.legal(){if m.Special=='e'{ep=byte(p.EP%8+1);break}}}
 return chessPositionKey(codes,byte(p.Turn),p.Castle,ep)
}
func(p chessBoard) san(m chessMove)string{
 s:="";k:=chessKind(p.Squares[m.From]);capture:=p.Squares[m.To]!='.'||m.Special=='e'
 if m.Special=='c'{s="O-O";if m.To<m.From{s="O-O-O"}}else{
  if k!='P'{
   s=string(k);other,sameFile,sameRank:=false,false,false
   for _,v:=range p.legal(){if v.From!=m.From&&v.To==m.To&&chessKind(p.Squares[v.From])==k{other=true;sameFile=sameFile||v.From%8==m.From%8;sameRank=sameRank||v.From/8==m.From/8}}
   if other{n:=chessName(m.From);if !sameFile{s+=n[:1]}else if !sameRank{s+=n[1:]}else{s+=n}}
  }else if capture{s=chessName(m.From)[:1]}
  if capture{s+="x"};s+=chessName(m.To);if m.Promotion!=0{s+="="+string(m.Promotion)}
 }
 q:=p.apply(m);if q.check(q.Turn){if len(q.legal())==0{s+="#"}else{s+="+"}}
 return s
}

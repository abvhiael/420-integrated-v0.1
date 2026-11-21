package social

import (
 "bytes"
 "context"
 "strings"
 "testing"
 "time"
)

func TestAccountMessageEncryptionAndValidation(t *testing.T){
 key:=bytes.Repeat([]byte{73},32)
 s,e:=NewMessageService(&Store{},key)
 if e!=nil{t.Fatal(e)}
 if _,e=NewMessageService(nil,key);e==nil{t.Fatal("nil database authority accepted")}
 if _,e=NewMessageService(&Store{},[]byte("short"));e==nil{t.Fatal("weak message key accepted")}
 id:="12345678-1234-4123-8123-123456789abc"
 a:="23456789-1234-4234-8234-123456789abc"
 b:="34567890-1234-4345-8345-123456789abc"
 ciphertext,e:=s.protect(id,a,b,"private <script> encrypted body")
 if e!=nil||bytes.Contains(ciphertext,[]byte("private")){t.Fatal("message not encrypted",e)}
 if len(ciphertext)<29{t.Fatal("missing AES-GCM nonce/tag")}
 decoded,e:=s.reveal(id,a,b,ciphertext)
 if e!=nil||decoded!="private <script> encrypted body"{t.Fatal("message decryption failed",e)}
 if _,e=s.reveal(id,b,a,ciphertext);e==nil{t.Fatal("participant substitution decrypted private message")}
 if _,e=s.reveal(id,a,id,ciphertext);e==nil{t.Fatal("recipient substitution decrypted private message")}
 ciphertext[len(ciphertext)-1]^=1
 if _,e=s.reveal(id,a,b,ciphertext);e==nil{t.Fatal("tampered ciphertext decrypted")}
 if _,e=s.reveal(id,a,b,[]byte("bad"));e==nil{t.Fatal("truncated ciphertext decrypted")}
}
func TestAccountGameRulesDeterminismAndZeroWager(t *testing.T){
 if _,e:=NewAccountGames(nil);e==nil{t.Fatal("nil store allowed")}
 if freshBoard("tic_tac_toe")!="........."||len(freshBoard("connect_four"))!=42{t.Fatal("incorrect board")}
 if freshBoard("roulette")!=""{t.Fatal("wagered game accepted")}
 if _,_,_,e:=playBoard("wager",".........",0,0);e==nil{t.Fatal("unqualified game accepted")}
 board:=freshBoard("tic_tac_toe")
 sequence:=[]int{0,3,1,4,2}
 for n,pos:=range sequence{
  next,win,draw,e:=playBoard("tic_tac_toe",board,n,pos)
  if e!=nil{t.Fatalf("tic move %d: %v",n,e)}
  if win!=(n==4)||draw{t.Fatal("winner generated incorrectly",n,win,draw)}
  board=next
 }
 if board!="XXXOO...."{t.Fatal("unexpected tic board",board)}
 if _,_,_,e:=playBoard("tic_tac_toe",board,5,0);e==nil{t.Fatal("occupied square allowed")}
 // Tic-tac-toe draw must not invent a winner.
 board=freshBoard("tic_tac_toe")
 for n,pos:=range []int{0,1,2,4,3,5,7,6,8}{
  var win,draw bool;var e error
  board,win,draw,e=playBoard("tic_tac_toe",board,n,pos)
  if e!=nil||win||draw!=(n==8){t.Fatal("draw evaluation wrong",n,win,draw,e)}
 }
 board=freshBoard("connect_four")
 for n,pos:=range []int{0,1,0,1,0,1,0}{
  var win,draw bool;var e error
  board,win,draw,e=playBoard("connect_four",board,n,pos)
  if e!=nil||win!=(n==6)||draw{t.Fatal("vertical connect four",n,win,draw,e)}
 }
 if board[0]!='.'||board[14]!='X'||board[21]!='X'||board[28]!='X'||board[35]!='X'{t.Fatal("connect four gravity incorrect",board)}
 if _,_,_,e:=playBoard("connect_four",board,7,7);e==nil{t.Fatal("out-of-range column accepted")}
 if _,_,_,e:=playBoard("connect_four","bad",0,0);e==nil{t.Fatal("malformed board accepted")}
 if _,_,_,e:=playBoard("tic_tac_toe",strings.Repeat("X",9),9,0);e==nil{t.Fatal("invalid move index accepted")}
 if gameLines(".........",3,3,3,'X'){t.Fatal("empty board has winner")}
 if _,_,_,e:=playBoard("tic_tac_toe",".........",0,-1);e==nil{t.Fatal("negative position accepted")}
}
var _=context.Background
var _=time.Now

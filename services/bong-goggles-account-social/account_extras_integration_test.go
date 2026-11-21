//go:build account420_integration

package social

import (
 "bytes"
 "context"
 "encoding/json"
 "strings"
 "sync"
 "net/http"
 "net/http/httptest"
 "testing"
)
const extraThird="30000000-3333-4333-8333-333333333333"
func extras(t *testing.T)(*Store,*Handler,*fakeBroker,*http.Cookie,*http.Cookie){
 t.Helper()
 store,broker,signOn,handler:=fixture(t)
 key:=bytes.Repeat([]byte{44},32)
 messaging,e:=NewMessageService(store,key);if e!=nil{t.Fatal(e)}
 games,e:=NewAccountGames(store);if e!=nil{t.Fatal(e)}
 if e=handler.EnableAccountExtras(messaging,games);e!=nil{t.Fatal(e)}
 a:=login(t,handler,broker,memberA)
 b:=login(t,handler,broker,memberB)
 _=signOn
 return store,handler,broker,a,b
}
func readGame(t *testing.T,w *httptest.ResponseRecorder)Game{
 t.Helper()
 var got struct{Game Game}
 if e:=json.Unmarshal(w.Body.Bytes(),&got);e!=nil{t.Fatal(e)}
 if !uuid.MatchString(got.Game.ID){t.Fatal("missing game ID",w.Body.String())}
 return got.Game
}
func TestAUTH9EncryptedPrivateMessagingAndAudienceBlocks(t *testing.T){
 store,h,broker,a,b:=extras(t)
 t.Cleanup(func(){if e:=store.Relationship(context.Background(),memberB,memberA,"block",false);e!=nil{t.Error("block cleanup",e)}})
 if w:=request(h,"GET","/v1/messages","");w.Code!=401{t.Fatal("unauthenticated inbox",w.Code)}
 if w:=request(h,"POST","/v1/messages",body(map[string]string{"target":memberB,"body":"private"}));w.Code!=401{t.Fatal("unauthenticated send",w.Code)}
 if w:=request(h,"POST","/v1/messages",body(map[string]string{"target":memberB,"body":"private","sender":extraThird}),a);w.Code!=400{t.Fatal("sender injection accepted",w.Code)}
 if w:=request(h,"POST","/v1/messages",body(map[string]string{"target":memberA,"body":"self"}),a);w.Code!=400{t.Fatal("self message accepted",w.Code)}
 if w:=request(h,"POST","/v1/messages",body(map[string]string{"target":extraThird,"body":"unknown member"}),a);w.Code!=404{t.Fatal("unknown member accepted",w.Code)}
 msg:=request(h,"POST","/v1/messages",body(map[string]string{"target":memberB,"body":"Private\nhello <script>"}),a)
 if msg.Code!=201{t.Fatal("send",msg.Code,msg.Body.String())}
 var response struct{Message DirectMessage;OnChain bool}
 if e:=json.Unmarshal(msg.Body.Bytes(),&response);e!=nil{t.Fatal(e)}
 id:=response.Message.ID
 if response.OnChain||response.Message.Sender!=memberA||response.Message.Recipient!=memberB||!uuid.MatchString(id){t.Fatal("untrusted sender scope",response)}
 var cipher []byte
 if e:=store.DB.QueryRow("SELECT body_cipher FROM bg_account_social.direct_messages WHERE id=$1",id).Scan(&cipher);e!=nil||bytes.Contains(cipher,[]byte("Private")){t.Fatal("message plaintext persisted",e)}
 if w:=request(h,"GET","/v1/messages/"+memberA,"",b);w.Code!=200||!strings.Contains(w.Body.String(),"Private")||strings.Contains(w.Body.String(),"walletAddress"){t.Fatal("recipient inbox",w.Code,w.Body.String())}
 if w:=request(h,"GET","/v1/messages","",a);w.Code!=200||!strings.Contains(w.Body.String(),memberB){t.Fatal("sender inbox",w.Code)}
 if w:=request(h,"GET","/v1/messages","",b);w.Code!=200||!strings.Contains(w.Body.String(),memberA){t.Fatal("recipient inbox list",w.Code)}
 if w:=request(h,"DELETE","/v1/messages/item/"+id,"{}",b);w.Code!=200{t.Fatal("recipient deletion",w.Code)}
 if w:=request(h,"GET","/v1/messages/"+memberA,"",b);w.Code!=200||strings.Contains(w.Body.String(),"Private"){t.Fatal("deleted receiver copy leaked",w.Code)}
 if w:=request(h,"GET","/v1/messages/"+memberB,"",a);w.Code!=200||!strings.Contains(w.Body.String(),"Private"){t.Fatal("one-sided delete erased sender copy",w.Code)}
 if w:=request(h,"DELETE","/v1/messages/item/"+id,"{}",a);w.Code!=200{t.Fatal("sender deletion",w.Code)}
 if w:=request(h,"GET","/v1/messages/"+memberB,"",a);w.Code!=200||strings.Contains(w.Body.String(),"Private"){t.Fatal("deleted sender copy leaked",w.Code)}
 if w:=request(h,"DELETE","/v1/messages/item/"+id,"{}",a);w.Code!=404{t.Fatal("replay message delete",w.Code)}
 // Blocked subjects cannot send, view inbox entries, or fetch a thread.
 fresh:=request(h,"POST","/v1/messages",body(map[string]string{"target":memberB,"body":"restricted"}),a)
 if fresh.Code!=201{t.Fatal("fresh message",fresh.Code)}
 if w:=request(h,"PUT","/v1/relationships/block/"+memberA,"{}",b);w.Code!=200{t.Fatal("block",w.Code)}
 if w:=request(h,"POST","/v1/messages",body(map[string]string{"target":memberB,"body":"bypass"}),a);w.Code!=403{t.Fatal("blocked send",w.Code)}
 if w:=request(h,"GET","/v1/messages/"+memberA,"",b);w.Code!=403{t.Fatal("blocked thread",w.Code)}
 if w:=request(h,"GET","/v1/messages","",a);w.Code!=200||strings.Contains(w.Body.String(),memberB){t.Fatal("blocked inbox metadata leak",w.Code)}
 broker.mu.Lock();broker.offline=true;broker.mu.Unlock()
 if w:=request(h,"GET","/v1/messages","",a);w.Code!=503{t.Fatal("provider outage allowed cached messages",w.Code)}
}
func TestAUTH9GameInvitationsWinnerAndNoFinancialAuthority(t *testing.T){
 store,h,_,a,b:=extras(t)
 t.Cleanup(func(){if e:=store.Relationship(context.Background(),memberB,memberA,"block",false);e!=nil{t.Error("block cleanup",e)}})
 noWallet:=request(h,"GET","/v1/account-games","",a)
 if noWallet.Code!=200||!strings.Contains(noWallet.Body.String(),"\"wager\":false")||!strings.Contains(noWallet.Body.String(),"\"rewards\":false"){t.Fatal("not zero-wager",noWallet.Code)}
 if w:=request(h,"POST","/v1/account-games",body(map[string]any{"target":memberB,"kind":"tic_tac_toe","amount":100}),a);w.Code!=400{t.Fatal("stake injection accepted",w.Code)}
 if w:=request(h,"POST","/v1/account-games",body(map[string]string{"target":memberB,"kind":"roulette"}),a);w.Code!=400{t.Fatal("wager game accepted",w.Code)}
 inv:=request(h,"POST","/v1/account-games",body(map[string]string{"target":memberB,"kind":"tic_tac_toe"}),a)
 if inv.Code!=201{t.Fatal("invite",inv.Code,inv.Body.String())}
 game:=readGame(t,inv)
 if game.Inviter!=memberA||game.Invited!=memberB||game.Status!="invited"||game.Board!="........."{t.Fatal("invite authority",game)}
 if w:=request(h,"POST","/v1/account-games/"+game.ID+"/respond",body(map[string]bool{"accept":true}),a);w.Code!=404{t.Fatal("inviter self-accepted",w.Code)}
 if w:=request(h,"POST","/v1/account-games/"+game.ID+"/respond",body(map[string]bool{"accept":true}),b);w.Code!=200{t.Fatal("recipient accept",w.Code,w.Body.String())}
 if w:=request(h,"POST","/v1/account-games/"+game.ID+"/move",body(map[string]int{"position":0,"expectedMove":1}),b);w.Code!=409{t.Fatal("wrong turn accepted",w.Code)}
 order:=[]struct{actor *http.Cookie;pos int;winner bool}{{a,0,false},{b,3,false},{a,1,false},{b,4,false},{a,2,true}}
 for n,turn:=range order{
  response:=request(h,"POST","/v1/account-games/"+game.ID+"/move",body(map[string]int{"position":turn.pos,"expectedMove":n+1}),turn.actor)
  if response.Code!=200{t.Fatal("valid game move",n,response.Code,response.Body.String())}
  g:=readGame(t,response)
  if (g.Status=="won")!=turn.winner||g.Moves!=n+1{t.Fatal("incorrect server result",n,g)}
  if turn.winner&&g.Winner!=memberA{t.Fatal("user-picked game winner",g)}
  if n==0{
   if replay:=request(h,"POST","/v1/account-games/"+game.ID+"/move",body(map[string]int{"position":0,"expectedMove":1}),turn.actor);replay.Code!=409{t.Fatal("move replay accepted",replay.Code)}
  }
 }
 if w:=request(h,"POST","/v1/account-games/"+game.ID+"/move",body(map[string]int{"position":5,"expectedMove":6}),b);w.Code!=409{t.Fatal("terminal game moved",w.Code)}
 if w:=request(h,"GET","/v1/account-games/"+game.ID,"",b);w.Code!=200||!strings.Contains(w.Body.String(),"\"winner\":\""+memberA+"\"")||!strings.Contains(w.Body.String(),"\"history\""){t.Fatal("verified game history",w.Code,w.Body.String())}
 if w:=request(h,"GET","/v1/account-games","",a);w.Code!=200||!strings.Contains(w.Body.String(),game.ID){t.Fatal("game list",w.Code)}
 if w:=request(h,"PUT","/v1/relationships/block/"+memberA,"{}",b);w.Code!=200{t.Fatal("block",w.Code)}
 if w:=request(h,"GET","/v1/account-games/"+game.ID,"",b);w.Code!=404{t.Fatal("blocked game details exposed",w.Code)}
 if w:=request(h,"GET","/v1/account-games","",a);w.Code!=200||strings.Contains(w.Body.String(),game.ID){t.Fatal("blocked game list exposed",w.Code)}
}
func TestAUTH9ConcurrentMoveReplayAndConnectFour(t *testing.T){
 _,h,_,a,b:=extras(t)
 makeGame:=func(kind string)Game{
  t.Helper()
  created:=request(h,"POST","/v1/account-games",body(map[string]string{"target":memberB,"kind":kind}),a)
  if created.Code!=201{t.Fatal("game invite",created.Code,created.Body.String())}
  game:=readGame(t,created)
  if w:=request(h,"POST","/v1/account-games/"+game.ID+"/respond",body(map[string]bool{"accept":true}),b);w.Code!=200{t.Fatal("accept game",w.Code)}
  return game
 }
 game:=makeGame("tic_tac_toe")
 var wg sync.WaitGroup;results:=make(chan int,2)
 for i:=0;i<2;i++{wg.Add(1);go func(){defer wg.Done()
  w:=request(h,"POST","/v1/account-games/"+game.ID+"/move",body(map[string]int{"position":0,"expectedMove":1}),a)
  results<-w.Code
 }()}
 wg.Wait();close(results)
 valid,rejected:=0,0
 for status:=range results{if status==200{valid++}else if status==409{rejected++}else{t.Fatal("concurrent move",status)}}
 if valid!=1||rejected!=1{t.Fatal("lost update / double turn",valid,rejected)}
 four:=makeGame("connect_four")
 for i,pos:=range []int{0,1,0,1,0,1,0}{
  who:=a;if i%2==1{who=b}
  w:=request(h,"POST","/v1/account-games/"+four.ID+"/move",body(map[string]int{"position":pos,"expectedMove":i+1}),who)
  if w.Code!=200{t.Fatal("connect-four move",i,w.Code,w.Body.String())}
  end:=readGame(t,w)
  if i==6&&(end.Status!="won"||end.Winner!=memberA||end.Board[14]!='X'){t.Fatal("wrong vertical connect-four winner",end)}
 }
}
func TestAUTH9GameExpiryOutsiderAndRevocation(t *testing.T){
 store,h,broker,a,b:=extras(t)
 third:=login(t,h,broker,extraThird)
 invite:=readGame(t,request(h,"POST","/v1/account-games",body(map[string]string{"target":memberB,"kind":"tic_tac_toe"}),a))
 if w:=request(h,"GET","/v1/account-games/"+invite.ID,"",third);w.Code!=404{t.Fatal("outsider game disclosure",w.Code)}
 if w:=request(h,"POST","/v1/account-games/"+invite.ID+"/respond",body(map[string]bool{"accept":true}),third);w.Code!=404{t.Fatal("outsider game takeover",w.Code)}
 if _,e:=store.DB.Exec("UPDATE bg_account_social.account_games SET invite_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",invite.ID);e!=nil{t.Fatal(e)}
 if w:=request(h,"POST","/v1/account-games/"+invite.ID+"/respond",body(map[string]bool{"accept":true}),b);w.Code!=409{t.Fatal("expired invite accepted",w.Code)}
 if w:=request(h,"GET","/v1/account-games/"+invite.ID,"",a);w.Code!=200||!strings.Contains(w.Body.String(),"\"status\":\"expired\""){t.Fatal("expired status concealed",w.Code,w.Body.String())}
 broker.mu.Lock();broker.tokens=map[string]string{};broker.mu.Unlock()
 if w:=request(h,"GET","/v1/account-games","",a);w.Code!=401{t.Fatal("revoked account session used to read game",w.Code)}
}

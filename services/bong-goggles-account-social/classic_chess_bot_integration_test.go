//go:build account420_integration

package social

import (
 "context"
 "encoding/json"
 "testing"
 "sync"
 "runtime"
 "crypto/sha256"
)

func TestBC33PostgresHumanBotRecovery(t *testing.T){
 for i,level:=range []string{"easy","medium","hard"}{t.Run(level,func(t *testing.T){
  store,h,host,_:=bc06Fixture(t,[]string{"198.51.100.197","198.51.100.198","198.51.100.199"}[i])
  adapter,e:=NewChessRulesAdapter();if e!=nil{t.Fatal(e)}
  resolve:=func(game string)ClassicRule{if game=="chess"{return adapter};return nil}
  policies:=map[string]ClassicBotPolicies{"chess":NewChessBotPolicies()}
  h.Sessions.Rules=resolve
  if e=h.Sessions.EnableBots(policies);e!=nil{t.Fatal(e)}
  response:=request(h,"POST","/v1/classic-rooms",body(map[string]any{"gameId":"chess","visibility":"public","seatCount":2}),host)
  if response.Code!=201{t.Fatal(response.Code,response.Body.String())}
  room:=bc05Read(t,response.Body.Bytes())
  status,room:=bc05Change(t,h,host,room.ID,room.Revision,1,"bot",map[string]any{"difficulty":level})
  if status!=200||room.Status!="ready"{t.Fatal(status,room)}
  ctx:=context.Background()
  match,e:=h.Sessions.startWithClock(ctx,memberA,room.ID,[]string{"untimed","3+2","untimed"}[i])
  if e!=nil{t.Fatal(e)}
  get:=func()ClassicSessionView{
   r:=request(h,"GET","/v1/classic-sessions/"+match.ID,"",host)
   if r.Code!=200{t.Fatal(r.Code,r.Body.String())}
   var payload struct{Session ClassicSessionView}
   if e:=json.Unmarshal(r.Body.Bytes(),&payload);e!=nil{t.Fatal(e)}
   return payload.Session
  }
  if moved,e:=h.Sessions.RunBotTurn(ctx,match.ID);e!=nil||moved{t.Fatal("human turn consumed",e)}
  r:=bc06Act(t,h,host,match.ID,"move",2,map[string]string{"type":"move","uci":"e2e4"},bc06ActionID(t))
  if r.Code!=200{t.Fatal(r.Code,r.Body.String())}
  restarted,e:=NewClassicSessions(store,h.Rooms,resolve);if e!=nil{t.Fatal(e)}
  if e=restarted.EnableBots(policies);e!=nil{t.Fatal(e)}
  if e=restarted.VerifyRules(ctx,match.ID);e!=nil{t.Fatal(e)}
  old:=h.Sessions
  // Contend for a CPU while preserving the original concurrent-worker assertions.
  stop:=make(chan struct{});var load sync.WaitGroup
  if level=="hard"{
   load.Add(1);go func(){defer load.Done();var value [32]byte;for{select{case <-stop:return;default:for j:=0;j<128;j++{value=sha256.Sum256(value[:])};runtime.Gosched()}}}()
  }
  defer func(){close(stop);load.Wait()}()
  var wg sync.WaitGroup
  results:=make(chan bool,2);errs:=make(chan error,2)
  for _,worker:=range []*ClassicSessions{old,restarted}{
   wg.Add(1);go func(s *ClassicSessions){defer wg.Done();m,e:=s.RunBotTurn(ctx,match.ID);results<-m;errs<-e}(worker)
  }
  wg.Wait();close(results);close(errs)
  for e:=range errs{if e!=nil{t.Fatal(e)}}
  count:=0;for m:=range results{if m{count++}}
  if count!=1{t.Fatal("duplicate or missing bot move",count)}
  h.Sessions=restarted
  current:=get()
  if current.Sequence!=3||current.TurnSeat==nil||*current.TurnSeat!=0{t.Fatal(current)}
  if (current.Deadline!=nil)!=(i==1){t.Fatal("clock profile lost")}
  var view map[string]json.RawMessage
  if e=json.Unmarshal(current.PrivateView,&view);e!=nil{t.Fatal(e)}
  for _,key:=range []string{"seed","repetition","engineState","opponentPolicy"}{if _,ok:=view[key];ok{t.Fatal("private field leaked",key)}}
  if e=restarted.VerifyRules(ctx,match.ID);e!=nil{t.Fatal(e)}
  r=bc06Act(t,h,host,match.ID,"resign",4,nil,bc06ActionID(t))
  if r.Code!=200{t.Fatal(r.Code,r.Body.String())}
  if moved,e:=restarted.RunBotTurn(ctx,match.ID);e!=nil||moved{t.Fatal("terminal bot turn",e)}
  if e=restarted.VerifyRules(ctx,match.ID);e!=nil{t.Fatal(e)}
 })}
}

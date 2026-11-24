//go:build account420_integration

package social

import (
 "context"
 "encoding/json"
 "strings"
 "testing"
)

func TestBC35ChessConsentLifecycle(t *testing.T){
 store,h,a,b:=bc16Fixture(t)
 ctx:=context.Background()
 adapter,e:=NewChessRulesAdapter();if e!=nil{t.Fatal(e)}
 h.Sessions.Rules=func(game string)ClassicRule{if game=="chess"{return adapter};return nil}
 h.classicMatchSocialEnabled=false
 route:="/v1/classic-sessions/challenge-chess"
 nonce:=bc06ActionID(t)
 if code,_:=bc16Send(t,h,a,route,nonce,map[string]any{"target":memberB});code!=403{t.Fatal("nonfriend challenge",code)}
 for _,pair:=range [][2]string{{memberA,memberB},{memberB,memberA}}{if e=store.Relationship(ctx,pair[0],pair[1],"follow",true);e!=nil{t.Fatal(e)}}
 code,room:=bc16Send(t,h,a,route,nonce,map[string]any{"target":memberB})
 if code!=201||room.Status!="open"||room.Seats[0].Team!=0||room.Seats[1].Team!=1||room.Seats[1].Controller!="invited"{t.Fatal(code,room)}
 if code,retry:=bc16Send(t,h,a,route,nonce,map[string]any{"target":memberB});code!=201||retry.ID!=room.ID{t.Fatal("challenge replay",code)}
 if w:=request(h,"GET","/v1/classic-sessions/history-chess","",b);w.Code!=200||!strings.Contains(w.Body.String(),room.ID)||strings.Contains(w.Body.String(),"privateView"){t.Fatal("inbox",w.Code,w.Body.String())}
 if _,e=h.Sessions.startWithClock(ctx,memberA,room.ID,"untimed");e==nil{t.Fatal("start without consent")}
 code,room=bc05Change(t,h,b,room.ID,room.Revision,1,"accept",nil)
 if code!=200||room.Status!="ready"{t.Fatal("accept",code,room)}
 match,e:=h.Sessions.startWithClock(ctx,memberA,room.ID,"3+2");if e!=nil{t.Fatal(e)}
 if match.Deadline==nil{t.Fatal("missing authoritative deadline")}
 if code,_:=bc16Send(t,h,b,"/v1/classic-sessions/"+match.ID+"/rematch",bc06ActionID(t),nil);code!=409{t.Fatal("premature rematch",code)}
 if w:=bc06Act(t,h,a,match.ID,"move",2,map[string]string{"type":"move","uci":"e2e4"},bc06ActionID(t));w.Code!=200{t.Fatal(w.Code,w.Body.String())}
 restarted,e:=NewClassicSessions(store,h.Rooms,h.Sessions.Rules);if e!=nil{t.Fatal(e)}
 h.Sessions=restarted
 if e=restarted.VerifyRules(ctx,match.ID);e!=nil{t.Fatal(e)}
 w:=request(h,"GET","/v1/classic-sessions/"+match.ID,"",b)
 var current struct{Session ClassicSessionView}
 if w.Code!=200||json.Unmarshal(w.Body.Bytes(),&current)!=nil||current.Session.Sequence!=2||current.Session.ViewerSeat!=1||current.Session.TurnSeat==nil||*current.Session.TurnSeat!=1{t.Fatal("reconnect",w.Code,w.Body.String())}
 if w:=bc06Act(t,h,b,match.ID,"move",3,map[string]string{"type":"resign"},bc06ActionID(t));w.Code!=200{t.Fatal("resign",w.Code,w.Body.String())}
 path:="/v1/classic-sessions/"+match.ID+"/rematch";nonce2:=bc06ActionID(t)
 code,next:=bc16Send(t,h,b,path,nonce2,nil)
 if code!=201||next.ID==room.ID||next.Host!=memberB||next.Seats[0].Subject!=memberB||next.Seats[1].Subject!=memberA||next.Seats[1].Controller!="invited"{t.Fatal("rematch consent",code,next)}
 if code,retry:=bc16Send(t,h,b,path,nonce2,nil);code!=201||retry.ID!=next.ID{t.Fatal("rematch replay",code)}
 if code,_:=bc16Send(t,h,a,path,bc06ActionID(t),nil);code!=409{t.Fatal("duplicate rematch",code)}
 if code,next=bc05Change(t,h,a,next.ID,next.Revision,1,"accept",nil);code!=200||next.Status!="ready"{t.Fatal("rematch acceptance",code)}
 fresh,e:=restarted.startWithClock(ctx,memberB,next.ID,"untimed");if e!=nil||fresh.ID==match.ID||fresh.Sequence!=1||fresh.Deadline!=nil{t.Fatal("fresh match",fresh,e)}
 if e=restarted.VerifyRules(ctx,fresh.ID);e!=nil{t.Fatal(e)}
}

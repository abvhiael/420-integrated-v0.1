//go:build account420_integration

package social

import (
 "bytes"
 "context"
 "encoding/json"
 "strings"
 "testing"
 "net/http"
)

func bc07Sessions(t *testing.T,ip string)(*Store,*Handler,*http.Cookie,*http.Cookie,*RulesAdapter){
 t.Helper()
 store,h,host,peer:=bc06Fixture(t,ip)
 adapter:=bc07Adapter(t)
 h.Sessions.Rules=func(game string)ClassicRule{
  if game=="chess"{return adapter}
  return nil
 }
 return store,h,host,peer,adapter
}
func TestBC07DurableSeededReplayPrivateViewsAndSessionResults(t *testing.T){
 store,h,host,peer,adapter:=bc07Sessions(t,"198.51.100.141")
 room:=bc06Room(t,h,host,peer)
 match:=bc06Start(t,h,host,room.ID)
 if match.RulesHash!=adapter.hash||match.RulesVersion!="v1.0"||match.Sequence!=1{t.Fatal("unpinned versioned session",match)}
 if !bytes.Contains(match.PrivateView,[]byte("mine"))||bytes.Contains(match.PrivateView,[]byte("private0")){t.Fatal("seat-private view missing")}
 if e:=h.Sessions.VerifyRules(context.Background(),match.ID);e!=nil{t.Fatal("initial verified reconstruction",e)}
 var seed,initial string
 if e:=store.DB.QueryRow("SELECT seed_hex,initial_state::text FROM bg_account_social.classic_rule_genesis WHERE session_id=$1",match.ID).Scan(&seed,&initial);e!=nil{t.Fatal(e)}
 if len(seed)!=64||!strings.Contains(initial,"rulesHash"){t.Fatal("immutable genesis missing",seed)}
 for i,take:=range []int{2,1,2,1}{
  user:=host;if i%2==1{user=peer}
  reply:=bc06Act(t,h,user,match.ID,"move",int64(i+2),map[string]any{"take":take},bc06ActionID(t))
  if reply.Code!=200{t.Fatal("valid deterministic transition",i,reply.Code,reply.Body.String())}
  if e:=h.Sessions.VerifyRules(context.Background(),match.ID);e!=nil{t.Fatal("replay diverged",i,e)}
  if bytes.Contains(reply.Body.Bytes(),[]byte("private0"))||bytes.Contains(reply.Body.Bytes(),[]byte("private1"))||
   bytes.Contains(reply.Body.Bytes(),[]byte(seed)){t.Fatal("raw game state or seed leaked",reply.Body.String())}
 }
 final,e:=h.Sessions.Get(context.Background(),memberA,match.ID)
 if e!=nil||final.Status!="finished"||final.WinnerSeat==nil||*final.WinnerSeat!=0||final.Sequence!=5{t.Fatal("server-owned result",final,e)}
 if !bytes.Contains(final.PrivateView,[]byte(`"round":3`))||!bytes.Contains(final.PrivateView,[]byte(`"scores":[4,2]`)){t.Fatal("round/score missing",string(final.PrivateView))}
 var steps,events int
 if e=store.DB.QueryRow("SELECT count(*) FROM bg_account_social.classic_rule_moves WHERE session_id=$1",match.ID).Scan(&steps);e!=nil||steps!=4{t.Fatal("missing private transcript",steps,e)}
 if e=store.DB.QueryRow("SELECT count(*) FROM bg_account_social.classic_session_events WHERE session_id=$1",match.ID).Scan(&events);e!=nil||events!=5{t.Fatal("missing public journal",events,e)}
 reply:=request(h,"GET","/v1/classic-sessions/"+match.ID+"/events?after=0","",peer)
 if reply.Code!=200||bytes.Contains(reply.Body.Bytes(),[]byte(seed))||bytes.Contains(reply.Body.Bytes(),[]byte(`"take"`))||
  bytes.Contains(reply.Body.Bytes(),[]byte("private0")){t.Fatal("event journal leaks rules action or secret",reply.Code,reply.Body.String())}
 // Cold restart replay validation uses only committed DB rows and versioned adapter.
 resumed,e:=NewClassicSessions(store,h.Rooms,func(game string)ClassicRule{return adapter})
 if e!=nil{t.Fatal(e)}
 if e=resumed.VerifyRules(context.Background(),match.ID);e!=nil{t.Fatal("lost game history on restart",e)}
 recovered,e:=resumed.Get(context.Background(),memberB,match.ID)
 if e!=nil||recovered.Sequence!=5||recovered.ViewerSeat!=1{t.Fatal("failed opponent restore",recovered,e)}
 if bytes.Equal(recovered.PrivateView,final.PrivateView){t.Fatal("two players received identical concealed views")}
}
func TestBC07RejectTamperedSavedStateTranscriptAndRulesHash(t *testing.T){
 store,h,host,peer,adapter:=bc07Sessions(t,"198.51.100.142")
 room:=bc06Room(t,h,host,peer)
 match:=bc06Start(t,h,host,room.ID)
 reply:=bc06Act(t,h,host,match.ID,"move",2,map[string]int{"take":1},bc06ActionID(t))
 if reply.Code!=200{t.Fatal("first move",reply.Code,reply.Body.String())}
 var original string
 if e:=store.DB.QueryRow("SELECT engine_state::text FROM bg_account_social.classic_sessions WHERE id=$1",match.ID).Scan(&original);e!=nil{t.Fatal(e)}
 var frame RuleFrame
 if e:=json.Unmarshal([]byte(original),&frame);e!=nil{t.Fatal(e)}
 frame.Scores[0]=900
 corrupt,_:=json.Marshal(frame)
 if _,e:=store.DB.Exec("UPDATE bg_account_social.classic_sessions SET engine_state=$2 WHERE id=$1",match.ID,string(corrupt));e!=nil{t.Fatal(e)}
 if w:=request(h,"GET","/v1/classic-sessions/"+match.ID,"",peer);w.Code!=503{t.Fatal("corrupt saved state exposed",w.Code)}
 if w:=bc06Act(t,h,peer,match.ID,"move",3,map[string]int{"take":1},bc06ActionID(t));w.Code!=503{t.Fatal("corrupt state admitted action",w.Code)}
 if e:=h.Sessions.VerifyRules(context.Background(),match.ID);e==nil{t.Fatal("corrupt state passed recovery")}
 if _,e:=store.DB.Exec("UPDATE bg_account_social.classic_sessions SET engine_state=$2 WHERE id=$1",match.ID,original);e!=nil{t.Fatal(e)}
 if e:=h.Sessions.VerifyRules(context.Background(),match.ID);e!=nil{t.Fatal("restored saved state rejected",e)}
 var after string
 if e:=store.DB.QueryRow("SELECT after_hash FROM bg_account_social.classic_rule_moves WHERE session_id=$1 AND sequence=2",match.ID).Scan(&after);e!=nil{t.Fatal(e)}
 if _,e:=store.DB.Exec("UPDATE bg_account_social.classic_rule_moves SET after_hash=$2 WHERE session_id=$1 AND sequence=2",match.ID,strings.Repeat("0",64));e!=nil{t.Fatal(e)}
 if w:=request(h,"GET","/v1/classic-sessions/"+match.ID,"",host);w.Code!=503{t.Fatal("replay tamper passed read",w.Code)}
 if _,e:=store.DB.Exec("UPDATE bg_account_social.classic_rule_moves SET after_hash=$2 WHERE session_id=$1 AND sequence=2",match.ID,after);e!=nil{t.Fatal(e)}
 if e:=h.Sessions.VerifyRules(context.Background(),match.ID);e!=nil{t.Fatal("restored transcript rejected",e)}
 // A new rules binary cannot reinterpret an existing pinned session.
 altered:=&bc07ChangedSpec{}
 mismatch,e:=NewRulesAdapter(altered);if e!=nil{t.Fatal(e)}
 h.Sessions.Rules=func(game string)ClassicRule{return mismatch}
 if w:=request(h,"GET","/v1/classic-sessions/"+match.ID,"",peer);w.Code!=503{t.Fatal("unmatched rules version/hash accepted",w.Code)}
 h.Sessions.Rules=func(game string)ClassicRule{return adapter}
 if w:=request(h,"GET","/v1/classic-sessions/"+match.ID,"",peer);w.Code!=200{t.Fatal("valid version rejected",w.Code,w.Body.String())}
}
type bc07ChangedSpec struct{bc07FixtureModule}
func (*bc07ChangedSpec)Definition()RuleDefinition{
 d:=(bc07FixtureModule{}).Definition();d.Specification+=" altered v2 for rejection";return d
}

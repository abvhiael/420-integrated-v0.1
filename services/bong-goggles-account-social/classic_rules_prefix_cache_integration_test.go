//go:build account420_integration

package social

import (
 "context"
 "net/http"
 "strings"
 "testing"
)

// The actual HTTP rate limiter remains enabled in integration tests.
// A full 121-point automated match can issue >60 commands in seconds,
// whereas human turns span multiple real minutes. Advance only the
// isolated test database's rate-bucket window to model elapsed time;
// do not change server rate limits, authorization, or application clocks.
func bc15AdvanceRateWindow(t *testing.T,store *Store){
 t.Helper()
 if _,e:=store.DB.Exec(`UPDATE bg_account_social.rate_buckets
  SET started_at=clock_timestamp()-interval '61 seconds'
  WHERE action='social-write'`);e!=nil{t.Fatal("test-only rate-window advancement",e)}
}

// Exercise the optimized path against actual PostgreSQL, HTTP-only 420ID
// principals, stored opaque state and separately committed immutable journals.
func TestBC15VerifiedPrefixDetectsHistoricalTamperAndColdRestart(t *testing.T){
 store,h,host,peer,adapter:=bc07Sessions(t,"198.51.100.219")
 bc15AdvanceRateWindow(t,store)
 room:=bc06Room(t,h,host,peer)
 match:=bc06Start(t,h,host,room.ID)
 for i,move:=range []int{2,1}{
  who:=host;if i==1{who=peer}
  reply:=bc06Act(t,h,who,match.ID,"move",int64(i+2),
   map[string]int{"take":move},bc06ActionID(t))
  if reply.Code!=http.StatusOK{t.Fatalf("verified move %d failed: %d %s",i,reply.Code,reply.Body.String())}
 }
 for _,who:=range []*http.Cookie{host,peer}{
  if w:=request(h,"GET","/v1/classic-sessions/"+match.ID,"",who);w.Code!=200{
   t.Fatal("full-prefix cached replay rejected valid participant",w.Code,w.Body.String())
  }
 }
 cached,ok:=h.Sessions.verifiedPrefix(match.ID)
 if !ok||cached.moves!=2{t.Fatalf("not retaining verified durable move prefix: found=%v moves=%d",ok,cached.moves)}
 ctx:=context.Background()
 var before,genesis string
 if e:=store.DB.QueryRowContext(ctx,
  "SELECT before_hash FROM bg_account_social.classic_rule_moves WHERE session_id=$1 AND sequence=2",
  match.ID).Scan(&before);e!=nil{t.Fatal(e)}
 if e:=store.DB.QueryRowContext(ctx,
  "SELECT initial_hash FROM bg_account_social.classic_rule_genesis WHERE session_id=$1",
  match.ID).Scan(&genesis);e!=nil{t.Fatal(e)}
 // A corruption to an *already verified* prefix must invalidate the
 // digest and force a cold full replay; it must never pass by cache hit.
 if _,e:=store.DB.ExecContext(ctx,
  "UPDATE bg_account_social.classic_rule_moves SET before_hash=$2 WHERE session_id=$1 AND sequence=2",
  match.ID,strings.Repeat("f",64));e!=nil{t.Fatal(e)}
 if w:=request(h,"GET","/v1/classic-sessions/"+match.ID,"",peer);w.Code!=503{
  t.Fatal("old private move tamper accepted after cache hit",w.Code)
 }
 if e:=h.Sessions.VerifyRules(ctx,match.ID);e==nil{
  t.Fatal("tampered historical move passed standalone verifier")
 }
 if _,e:=store.DB.ExecContext(ctx,
  "UPDATE bg_account_social.classic_rule_moves SET before_hash=$2 WHERE session_id=$1 AND sequence=2",
  match.ID,before);e!=nil{t.Fatal(e)}
 if w:=request(h,"GET","/v1/classic-sessions/"+match.ID,"",peer);w.Code!=200{
  t.Fatal("restored immutable journal failed verification",w.Code,w.Body.String())
 }
 // Genesis corruption is independently rejected, even if the move
 // transcript matches a cached prefix.
 if _,e:=store.DB.ExecContext(ctx,
  "UPDATE bg_account_social.classic_rule_genesis SET initial_hash=$2 WHERE session_id=$1",
  match.ID,strings.Repeat("a",64));e!=nil{t.Fatal(e)}
 if w:=request(h,"GET","/v1/classic-sessions/"+match.ID,"",host);w.Code!=503{
  t.Fatal("tampered genesis bypassed cached history",w.Code)
 }
 if _,e:=store.DB.ExecContext(ctx,
  "UPDATE bg_account_social.classic_rule_genesis SET initial_hash=$2 WHERE session_id=$1",
  match.ID,genesis);e!=nil{t.Fatal(e)}
 // No cache survives a process restart. Reconstruct from canonical seed,
 // original module, event history, move hashes and persisted current state.
 fresh,e:=NewClassicSessions(store,h.Rooms,func(game string)ClassicRule{
  if game=="chess"{return adapter};return nil
 })
 if e!=nil{t.Fatal(e)}
 if _,ok:=fresh.verifiedPrefix(match.ID);ok{t.Fatal("cold process inherited private history cache")}
 resumed,e:=fresh.Get(ctx,memberB,match.ID)
 if e!=nil||resumed.Sequence!=3||resumed.ViewerSeat!=1{
  t.Fatal("cold replay failed",e,resumed.Sequence)
 }
 if e=fresh.VerifyRules(ctx,match.ID);e!=nil{t.Fatal("full verification after cold resume",e)}
}

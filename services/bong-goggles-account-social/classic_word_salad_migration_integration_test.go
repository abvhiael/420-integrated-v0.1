//go:build account420_integration

package social

import (
 "context"
 "database/sql"
 "encoding/json"
 "os"
 "strings"
 "testing"

 "github.com/lib/pq"
)

func TestBC42WordSaladMigration012(t *testing.T){
 dsn:=os.Getenv("ACCOUNT420_TEST_DSN");if dsn==""{t.Skip("requires PostgreSQL test DSN")}
 ctx:=context.Background()
 admin,e:=sql.Open("postgres",dsn);if e!=nil{t.Fatal(e)};defer admin.Close()
 // Isolate both scenarios in new databases. Never drop or alter the shared
 // integration database, even when an assertion fails.
 for _,legacy:=range []bool{false,true}{
  name:="fresh";if legacy{name="legacy"}
  t.Run(name,func(t *testing.T){
   id,e:=newID();if e!=nil{t.Fatal(e)}
   dbname:="bc42_r7_"+strings.ReplaceAll(id,"-","")
   if _,e=admin.ExecContext(ctx,"CREATE DATABASE "+pq.QuoteIdentifier(dbname));e!=nil{t.Fatal(e)}
   defer func(){if _,e=admin.ExecContext(ctx,"DROP DATABASE "+pq.QuoteIdentifier(dbname));e!=nil{t.Error(e)}}()
   // lib/pq accepts a URL converted to keyword DSN; the last dbname wins.
   conn,e:=pq.ParseURL(dsn);if e!=nil{t.Fatal(e)}
   db,e:=sql.Open("postgres",conn+" dbname="+dbname);if e!=nil{t.Fatal(e)};defer db.Close()
   if e=db.PingContext(ctx);e!=nil{t.Fatal(e)}
   var beforeRooms,beforeSessions string
   if legacy{
    paths,e:=migrations.ReadDir("migrations");if e!=nil{t.Fatal(e)}
    for _,p:=range paths{if p.Name()=="012_word_salad_room_format.sql"{break};raw,e:=migrations.ReadFile("migrations/"+p.Name());if e!=nil{t.Fatal(e)};if _,e=db.ExecContext(ctx,string(raw));e!=nil{t.Fatal(p.Name(),e)}}
    if _,e=db.Exec("INSERT INTO bg_account_social.members(subject) VALUES($1),($2)",memberA,memberB);e!=nil{t.Fatal(e)}
    for i,game:=range []string{"chess","cribbage","scrabble"}{
     room,_:=newID();session,_:=newID();status:="in_game";if i==2{status="completed"}
     if _,e=db.Exec("INSERT INTO bg_account_social.classic_rooms(id,host,game_id,visibility,seat_count,status) VALUES($1,$2,$3,'public',2,$4)",room,memberA,game,status);e!=nil{t.Fatal(e)}
     if _,e=db.Exec("INSERT INTO bg_account_social.classic_room_seats(room_id,seat_index,controller,subject,team) VALUES($1,0,'human',$2,0),($1,1,'human',$3,1)",room,memberA,memberB);e!=nil{t.Fatal(e)}
     if i==2{
      _,e=db.Exec("INSERT INTO bg_account_social.classic_sessions(id,room_id,game_id,seat_count,status,rules_version,rules_hash,engine_state,sequence,winner_seat,finished_reason) VALUES($1,$2,$3,2,'finished','legacy',$4,'{}',7,0,'completed')",session,room,game,strings.Repeat("a",64))
     }else{
      _,e=db.Exec("INSERT INTO bg_account_social.classic_sessions(id,room_id,game_id,seat_count,status,rules_version,rules_hash,engine_state,sequence,turn_seat,turn_deadline) VALUES($1,$2,$3,2,'active','legacy',$4,'{}',3,1,CASE WHEN $3='chess' THEN NULL ELSE clock_timestamp()+interval '1 day' END)",session,room,game,strings.Repeat("b",64))
     };if e!=nil{t.Fatal(e)}
    }
    if e=db.QueryRow("SELECT jsonb_agg(to_jsonb(r) ORDER BY id)::text FROM bg_account_social.classic_rooms r").Scan(&beforeRooms);e!=nil{t.Fatal(e)}
    if e=db.QueryRow("SELECT jsonb_agg(to_jsonb(s) ORDER BY id)::text FROM bg_account_social.classic_sessions s").Scan(&beforeSessions);e!=nil{t.Fatal(e)}
   }
   if e=Migrate(ctx,db);e!=nil{t.Fatal("install",e)}
   if legacy{
    var rooms,sessions string
    if e=db.QueryRow("SELECT jsonb_agg(to_jsonb(r)-'format' ORDER BY id)::text FROM bg_account_social.classic_rooms r").Scan(&rooms);e!=nil{t.Fatal(e)}
    if e=db.QueryRow("SELECT jsonb_agg(to_jsonb(s) ORDER BY id)::text FROM bg_account_social.classic_sessions s").Scan(&sessions);e!=nil{t.Fatal(e)}
    if rooms!=beforeRooms||sessions!=beforeSessions{t.Fatal("legacy state changed")}
    var count int;if e=db.QueryRow("SELECT count(*) FROM bg_account_social.classic_rooms WHERE format=''").Scan(&count);e!=nil||count!=3{t.Fatal("legacy defaults",count,e)}
   }else{if _,e=db.Exec("INSERT INTO bg_account_social.members(subject) VALUES($1),($2)",memberA,memberB);e!=nil{t.Fatal(e)}}
   // Schema-level acceptance and rejection independent of HTTP validation.
   for _,tc:=range []struct{game,format string;seats int;valid bool}{
    {"scrabble","11:classic-salad:live",2,true},{"scrabble","13:extra-dank:async",3,true},{"scrabble","21:straight-greens:untimed",4,true},{"scrabble","11:classic-salad",3,false},{"scrabble","13:classic-salad",4,false},{"scrabble","15:wrong",2,false},{"chess","15:classic-salad",2,false},{"chess","",2,true},
   }{
    room,_:=newID();_,e=db.Exec("INSERT INTO bg_account_social.classic_rooms(id,host,game_id,visibility,seat_count,format) VALUES($1,$2,$3,'public',$4,$5)",room,memberA,tc.game,tc.seats,tc.format)
    if (e==nil)!=tc.valid{t.Fatal("format constraint",tc,e)}
   }
   store,e:=NewStore(db);if e!=nil{t.Fatal(e)}
   rooms,e:=NewClassicRooms(store);if e!=nil{t.Fatal(e)}
   adapter,e:=NewProductionWordSaladRulesAdapter();if e!=nil{t.Fatal(e)}
   svc,e:=NewClassicSessions(store,rooms,func(game string)ClassicRule{if game=="scrabble"{return adapter};return nil});if e!=nil{t.Fatal(e)}
   room,e:=rooms.CreateWithFormat(ctx,memberA,"scrabble","public",2,"11:classic-salad:untimed");if e!=nil{t.Fatal(e)}
   room,e=rooms.Change(ctx,memberB,room.ID,RoomChange{Action:"join",Seat:1,ExpectedRevision:room.Revision});if e!=nil{t.Fatal(e)}
   match,e:=svc.Start(ctx,memberA,room.ID);if e!=nil||match.Deadline!=nil{t.Fatal("untimed startup",e)}
   // Real active session survives the full idempotent production migration.
   if e=Migrate(ctx,db);e!=nil{t.Fatal("repeat migration",e)}
   if e=svc.VerifyRules(ctx,match.ID);e!=nil{t.Fatal("replay after migration",e)}
   subjects:=[]string{memberA,memberB};nonce,_:=newID()
   next,e:=svc.Act(ctx,subjects[*match.TurnSeat],match.ID,ClassicSessionAction{RequestID:nonce,Action:"move",ExpectedSequence:2,Move:json.RawMessage(`{"type":"pass"}`)});if e!=nil||next.Sequence!=2||next.Deadline!=nil{t.Fatal("post migration action",e)}
  })
 }
}

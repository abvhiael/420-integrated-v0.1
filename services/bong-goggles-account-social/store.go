// Package social implements wallet-independent, app-owned BongGoggles
// social records. 420ID is only the source of app-scoped authentication;
// on-chain BongGoggles remains independently authoritative.
package social

import (
 "context"
 "crypto/rand"
 "database/sql"
 "embed"
 "encoding/hex"
 "errors"
 "fmt"
 "regexp"
 "strings"
 "time"
 "unicode"
 "unicode/utf8"
)

var (
 ErrInvalid=errors.New("invalid input")
 ErrForbidden=errors.New("not authorized")
 ErrNotFound=errors.New("record unavailable")
 ErrUnavailable=errors.New("dependency unavailable")
 ErrConflict=errors.New("conflict")
 uuid=regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$`)
)
//go:embed migrations/*.sql
var migrations embed.FS

type Store struct{DB *sql.DB}
func NewStore(db *sql.DB)(*Store,error){if db==nil{return nil,ErrInvalid};return &Store{db},nil}
func Migrate(ctx context.Context,db *sql.DB)error{
 if db==nil{return ErrInvalid}
 tx,e:=db.BeginTx(ctx,nil);if e!=nil{return e};defer tx.Rollback()
 if _,e=tx.ExecContext(ctx,"SELECT pg_advisory_xact_lock(420000008)");e!=nil{return e}
 for _,path:=range []string{"migrations/001_social.sql","migrations/002_account_messages_games.sql","migrations/003_contributions_xp.sql","migrations/004_classic_rooms.sql","migrations/005_classic_sessions.sql","migrations/006_classic_rules_replay.sql","migrations/007_chaos_multiplayer.sql"}{
  sqlText,e:=migrations.ReadFile(path);if e!=nil{return e}
  if _,e=tx.ExecContext(ctx,string(sqlText));e!=nil{return e}
 }
 return tx.Commit()
}
func (s *Store) Ready(ctx context.Context)error{
 var ok bool
 e:=s.DB.QueryRowContext(ctx,`SELECT
 (COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.members'),'SELECT'),false) AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.members'),'INSERT'),false))
 AND COALESCE(has_column_privilege(current_user,'bg_account_social.members','display_name','UPDATE'),false)
 AND COALESCE(has_column_privilege(current_user,'bg_account_social.members','bio','UPDATE'),false)
 AND (COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.posts'),'SELECT'),false) AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.posts'),'INSERT'),false))
 AND COALESCE(has_column_privilege(current_user,'bg_account_social.posts','deleted_at','UPDATE'),false)
 AND (COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.comments'),'SELECT'),false) AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.comments'),'INSERT'),false))
 AND (COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.reactions'),'SELECT'),false) AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.reactions'),'INSERT'),false) AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.reactions'),'DELETE'),false))
 AND (COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.follows'),'SELECT'),false) AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.follows'),'INSERT'),false) AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.follows'),'DELETE'),false))
 AND (COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.blocks'),'SELECT'),false) AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.blocks'),'INSERT'),false) AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.blocks'),'DELETE'),false))
 AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.reports'),'INSERT'),false)
 AND (COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.sessions'),'SELECT'),false) AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.sessions'),'INSERT'),false) AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.sessions'),'DELETE'),false))
 AND (COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.login_flows'),'SELECT'),false) AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.login_flows'),'INSERT'),false) AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.login_flows'),'DELETE'),false))
 AND (COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.rate_buckets'),'SELECT'),false) AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.rate_buckets'),'INSERT'),false) AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.rate_buckets'),'UPDATE'),false) AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.rate_buckets'),'DELETE'),false))
`).Scan(&ok)
 if e!=nil{return e}
 if !ok{return ErrUnavailable}
 return nil
}
// AUTH-12: the serving role may perform user actions but must never
// inspect private abuse reports or forge operator moderation events, and
// must not gain unapproved whole-table delete/update capabilities.
func (s *Store) ReadyRuntime(ctx context.Context)error{
 if e:=s.Ready(ctx);e!=nil{return e}
 var unsafe bool
 e:=s.DB.QueryRowContext(ctx,`SELECT
 COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.reports'),'SELECT'),false)
 OR COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.reports'),'UPDATE'),false)
 OR COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.reports'),'DELETE'),false)
 OR COALESCE(has_column_privilege(current_user,'bg_account_social.posts','hidden_at','UPDATE'),false)
 OR COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.moderation_events'),'INSERT'),false)
 OR COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.moderation_events'),'UPDATE'),false)
 OR COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.moderation_events'),'DELETE'),false)
 OR COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.members'),'DELETE'),false)
 OR COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.posts'),'DELETE'),false)
 OR COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.comments'),'DELETE'),false)
 OR COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.comments'),'UPDATE'),false)
 OR COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.posts'),'UPDATE'),false)`).Scan(&unsafe)
 if e!=nil{return e};if unsafe{return ErrUnavailable}
 return nil
}
func newID()(string,error){
 var b [16]byte
 if _,e:=rand.Read(b[:]);e!=nil{return "",e}
 b[6]=b[6]&15|0x40;b[8]=b[8]&63|0x80
 return fmt.Sprintf("%x-%x-%x-%x-%x",b[:4],b[4:6],b[6:8],b[8:10],b[10:]),nil
}
func random32()([]byte,error){v:=make([]byte,32);_,e:=rand.Read(v);return v,e}
func safeText(v string,max int,allowEmpty bool)bool{
 if !utf8.ValidString(v)||len(v)>max*4||utf8.RuneCountInString(v)>max{return false}
 if v==""{return allowEmpty}
 if strings.TrimSpace(v)!=v||strings.TrimSpace(v)==""{return false}
 for _,r:=range v{if unicode.IsControl(r)&&r!='\n'||unicode.Is(unicode.Cf,r){return false}}
 return true
}
func (s *Store) EnsureMember(ctx context.Context,subject string)error{
 if !uuid.MatchString(subject){return ErrInvalid}
 _,e:=s.DB.ExecContext(ctx,`INSERT INTO bg_account_social.members(subject) VALUES($1) ON CONFLICT DO NOTHING`,subject)
 return e
}
type Member struct{
 Subject string `json:"subject"`
 DisplayName string `json:"displayName"`
 Bio string `json:"bio"`
}
type Post struct {
 ID string `json:"id"`
 Author string `json:"author"`
 DisplayName string `json:"displayName"`
 Body string `json:"body"`
 CreatedAt time.Time `json:"createdAt"`
 Reactions int `json:"reactions"`
}
type Comment struct {
 ID string `json:"id"`
 PostID string `json:"postId"`
 Author string `json:"author"`
 DisplayName string `json:"displayName"`
 Body string `json:"body"`
 CreatedAt time.Time `json:"createdAt"`
}
func (s *Store) MyProfile(ctx context.Context,subject string)(Member,error){
 var m Member
 if !uuid.MatchString(subject){return m,ErrInvalid}
 e:=s.DB.QueryRowContext(ctx,"SELECT subject,display_name,bio FROM bg_account_social.members WHERE subject=$1",subject).Scan(&m.Subject,&m.DisplayName,&m.Bio)
 if errors.Is(e,sql.ErrNoRows){return m,ErrNotFound}
 return m,e
}
func (s *Store) SetProfile(ctx context.Context,subject,name,bio string)(Member,error){
 if !uuid.MatchString(subject)||!safeText(name,80,false)||!safeText(bio,500,true){return Member{},ErrInvalid}
 var m Member
 e:=s.DB.QueryRowContext(ctx,`UPDATE bg_account_social.members SET display_name=$2,bio=$3 WHERE subject=$1 RETURNING subject,display_name,bio`,subject,name,bio).Scan(&m.Subject,&m.DisplayName,&m.Bio)
 if errors.Is(e,sql.ErrNoRows){return m,ErrNotFound}
 return m,e
}
func (s *Store) NewPost(ctx context.Context,subject,body string)(Post,error){
 if !uuid.MatchString(subject)||!safeText(body,2000,false){return Post{},ErrInvalid}
 id,e:=newID();if e!=nil{return Post{},e}
 var p Post
 e=s.DB.QueryRowContext(ctx,`WITH inserted AS (
 INSERT INTO bg_account_social.posts(id,author,body) VALUES($1,$2,$3)
 RETURNING id,author,body,created_at)
 SELECT i.id,i.author,m.display_name,i.body,i.created_at FROM inserted i
 JOIN bg_account_social.members m ON m.subject=i.author`,id,subject,body).
 Scan(&p.ID,&p.Author,&p.DisplayName,&p.Body,&p.CreatedAt)
 if e!=nil{return p,e};return p,nil
}
func (s *Store) DeletePost(ctx context.Context,subject,id string)error{
 if !uuid.MatchString(subject)||!uuid.MatchString(id){return ErrInvalid}
 var result string
 e:=s.DB.QueryRowContext(ctx,`UPDATE bg_account_social.posts SET deleted_at=clock_timestamp()
 WHERE id=$1 AND author=$2 AND deleted_at IS NULL RETURNING id`,id,subject).Scan(&result)
 if errors.Is(e,sql.ErrNoRows){return ErrNotFound}
 return e
}
func (s *Store) Feed(ctx context.Context,viewer string,before time.Time,beforeID string,limit int)([]Post,error){
 if !uuid.MatchString(viewer)||limit<1||limit>30{return nil,ErrInvalid}
 if beforeID!=""&&!uuid.MatchString(beforeID){return nil,ErrInvalid}
 if before.IsZero(){before=time.Now().UTC().Add(time.Hour);beforeID="ffffffff-ffff-ffff-ffff-ffffffffffff"}
 rows,e:=s.DB.QueryContext(ctx,`SELECT p.id,p.author,m.display_name,p.body,p.created_at,
 (SELECT count(*) FROM bg_account_social.reactions re WHERE re.post_id=p.id)
 FROM bg_account_social.posts p JOIN bg_account_social.members m ON m.subject=p.author
 WHERE p.deleted_at IS NULL AND p.hidden_at IS NULL AND (p.created_at,p.id)<($2,$3)
 AND NOT EXISTS (SELECT 1 FROM bg_account_social.blocks b WHERE
  (b.blocker=$1 AND b.blocked=p.author) OR (b.blocker=p.author AND b.blocked=$1))
 ORDER BY p.created_at DESC,p.id DESC LIMIT $4`,viewer,before,beforeID,limit)
 if e!=nil{return nil,e};defer rows.Close()
 result:=[]Post{}
 for rows.Next(){var v Post;if e=rows.Scan(&v.ID,&v.Author,&v.DisplayName,&v.Body,&v.CreatedAt,&v.Reactions);e!=nil{return nil,e};result=append(result,v)}
 return result,rows.Err()
}
func (s *Store) Comments(ctx context.Context,viewer,postID string)([]Comment,error){
 if !uuid.MatchString(viewer)||!uuid.MatchString(postID){return nil,ErrInvalid}
 var exists bool
 e:=s.DB.QueryRowContext(ctx,`SELECT EXISTS(
 SELECT 1 FROM bg_account_social.posts p WHERE p.id=$1 AND p.deleted_at IS NULL AND p.hidden_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM bg_account_social.blocks b WHERE
 (b.blocker=$2 AND b.blocked=p.author) OR (b.blocker=p.author AND b.blocked=$2)))`,postID,viewer).Scan(&exists)
 if e!=nil{return nil,e};if !exists{return nil,ErrNotFound}
 rows,e:=s.DB.QueryContext(ctx,`SELECT c.id,c.post_id,c.author,m.display_name,c.body,c.created_at
 FROM bg_account_social.comments c JOIN bg_account_social.members m ON m.subject=c.author
 WHERE c.post_id=$1 AND c.deleted_at IS NULL
 AND NOT EXISTS (SELECT 1 FROM bg_account_social.blocks b WHERE
 (b.blocker=$2 AND b.blocked=c.author) OR (b.blocker=c.author AND b.blocked=$2))
 ORDER BY c.created_at,c.id LIMIT 100`,postID,viewer)
 if e!=nil{return nil,e};defer rows.Close()
 out:=[]Comment{}
 for rows.Next(){var c Comment;if e=rows.Scan(&c.ID,&c.PostID,&c.Author,&c.DisplayName,&c.Body,&c.CreatedAt);e!=nil{return nil,e};out=append(out,c)}
 return out,rows.Err()
}
func (s *Store) NewComment(ctx context.Context,viewer,postID,body string)(Comment,error){
 if !uuid.MatchString(viewer)||!uuid.MatchString(postID)||!safeText(body,500,false){return Comment{},ErrInvalid}
 id,e:=newID();if e!=nil{return Comment{},e}
 var c Comment
 e=s.DB.QueryRowContext(ctx,`WITH inserted AS (
 INSERT INTO bg_account_social.comments(id,post_id,author,body)
 SELECT $1,p.id,$2,$3 FROM bg_account_social.posts p
 WHERE p.id=$4 AND p.deleted_at IS NULL AND p.hidden_at IS NULL AND NOT EXISTS(
 SELECT 1 FROM bg_account_social.blocks b WHERE
 (b.blocker=$2 AND b.blocked=p.author) OR (b.blocker=p.author AND b.blocked=$2))
 RETURNING id,post_id,author,body,created_at)
 SELECT i.id,i.post_id,i.author,m.display_name,i.body,i.created_at FROM inserted i
 JOIN bg_account_social.members m ON m.subject=i.author`,id,viewer,body,postID).
 Scan(&c.ID,&c.PostID,&c.Author,&c.DisplayName,&c.Body,&c.CreatedAt)
 if errors.Is(e,sql.ErrNoRows){return c,ErrNotFound}
 return c,e
}
func (s *Store) React(ctx context.Context,viewer,postID string,add bool)error{
 if !uuid.MatchString(viewer)||!uuid.MatchString(postID){return ErrInvalid}
 if !add{
  _,e:=s.DB.ExecContext(ctx,"DELETE FROM bg_account_social.reactions WHERE post_id=$1 AND subject=$2",postID,viewer)
  return e
 }
 var result string
 e:=s.DB.QueryRowContext(ctx,`INSERT INTO bg_account_social.reactions(post_id,subject)
 SELECT p.id,$2 FROM bg_account_social.posts p WHERE p.id=$1 AND p.deleted_at IS NULL AND p.hidden_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM bg_account_social.blocks b WHERE
 (b.blocker=$2 AND b.blocked=p.author) OR (b.blocker=p.author AND b.blocked=$2))
 ON CONFLICT DO NOTHING RETURNING post_id`,postID,viewer).Scan(&result)
 if errors.Is(e,sql.ErrNoRows){return ErrConflict}
 return e
}
func (s *Store) Relationship(ctx context.Context,viewer,target,kind string,enable bool)error{
 if !uuid.MatchString(viewer)||!uuid.MatchString(target)||viewer==target||(kind!="follow"&&kind!="block"){return ErrInvalid}
 tx,e:=s.DB.BeginTx(ctx,nil);if e!=nil{return e};defer tx.Rollback()
 // Lock both subject rows in stable order to serialize block/follow races.
 first,second:=viewer,target;if first>second{first,second=second,first}
 var n int
 e=tx.QueryRowContext(ctx,`SELECT count(*) FROM (SELECT subject FROM bg_account_social.members
 WHERE subject IN ($1,$2) ORDER BY subject FOR UPDATE) x`,first,second).Scan(&n)
 if e!=nil{return e};if n!=2{return ErrNotFound}
 if kind=="follow"&&enable{
  var blocked bool
  e=tx.QueryRowContext(ctx,`SELECT EXISTS(SELECT 1 FROM bg_account_social.blocks
  WHERE (blocker=$1 AND blocked=$2) OR (blocker=$2 AND blocked=$1))`,viewer,target).Scan(&blocked)
  if e!=nil{return e};if blocked{return ErrForbidden}
  _,e=tx.ExecContext(ctx,`INSERT INTO bg_account_social.follows(follower,followed)
   VALUES($1,$2) ON CONFLICT DO NOTHING`,viewer,target)
 }else if kind=="follow"{
  _,e=tx.ExecContext(ctx,"DELETE FROM bg_account_social.follows WHERE follower=$1 AND followed=$2",viewer,target)
 }else if enable{
  _,e=tx.ExecContext(ctx,`INSERT INTO bg_account_social.blocks(blocker,blocked)
   VALUES($1,$2) ON CONFLICT DO NOTHING`,viewer,target)
  if e==nil{_,e=tx.ExecContext(ctx,`DELETE FROM bg_account_social.follows
  WHERE (follower=$1 AND followed=$2) OR (follower=$2 AND followed=$1)`,viewer,target)}
 }else{
  _,e=tx.ExecContext(ctx,"DELETE FROM bg_account_social.blocks WHERE blocker=$1 AND blocked=$2",viewer,target)
 }
 if e!=nil{return e}
 return tx.Commit()
}
func (s *Store) Report(ctx context.Context,viewer,postID,reason string)error{
 if !uuid.MatchString(viewer)||!uuid.MatchString(postID)||!map[string]bool{"spam":true,"harassment":true,"privacy":true,"other":true}[reason]{return ErrInvalid}
 id,e:=newID();if e!=nil{return e}
 var ret string
 e=s.DB.QueryRowContext(ctx,`INSERT INTO bg_account_social.reports(id,reporter,post_id,reason)
 SELECT $1,$2,p.id,$3 FROM bg_account_social.posts p WHERE p.id=$4 AND p.deleted_at IS NULL AND p.hidden_at IS NULL
 ON CONFLICT(reporter,post_id) DO NOTHING RETURNING id`,id,viewer,reason,postID).Scan(&ret)
 if errors.Is(e,sql.ErrNoRows){return ErrConflict}
 return e
}
func (s *Store) Purge(ctx context.Context)error{
 _,e:=s.DB.ExecContext(ctx,`DELETE FROM bg_account_social.login_flows WHERE expires_at<=clock_timestamp();
 DELETE FROM bg_account_social.sessions WHERE expires_at<=clock_timestamp();
 DELETE FROM bg_account_social.rate_buckets WHERE started_at<clock_timestamp()-interval '2 minutes'`)
 return e
}
var _=hex.EncodeToString

// Allow applies an atomic distributed one-minute write budget. Both rate-limit
// dependencies and safety checks fail closed; the browser cannot choose the
// principal hash or bypass the cap by sending another wallet/account ID.
func (s *Store) Allow(ctx context.Context,key []byte,action string,limit int)(bool,error){
 if len(key)!=32||action==""||len(action)>24||limit<1{return false,ErrInvalid}
 var count int
 e:=s.DB.QueryRowContext(ctx,`INSERT INTO bg_account_social.rate_buckets
 (principal_digest,action,started_at,requests)
 VALUES($1,$2,clock_timestamp(),1)
 ON CONFLICT(principal_digest,action) DO UPDATE SET
 requests=CASE WHEN bg_account_social.rate_buckets.started_at<clock_timestamp()-interval '1 minute'
 THEN 1 ELSE bg_account_social.rate_buckets.requests+1 END,
 started_at=CASE WHEN bg_account_social.rate_buckets.started_at<clock_timestamp()-interval '1 minute'
 THEN clock_timestamp() ELSE bg_account_social.rate_buckets.started_at END
 RETURNING requests`,key,action).Scan(&count)
 if e!=nil{return false,e}
 return count<=limit,nil
}

// Moderate is only for a separate operator credential/CLI, not the service
// runtime role. It records each decision atomically and never alters the
// canonical on-chain BongGoggles moderation system.
func (s *Store) Moderate(ctx context.Context,postID,action,reason,operator string)error{
 if !uuid.MatchString(postID)||(action!="hide"&&action!="restore")||
 !safeText(reason,120,false)||!safeText(operator,100,false){return ErrInvalid}
 tx,e:=s.DB.BeginTx(ctx,nil);if e!=nil{return e};defer tx.Rollback()
 // Lock the parent before checking any grants: concurrent XP-bearing
 // comments must commit before the legacy guard checks outstanding awards.
 if action=="hide"{
  var parent string
  e=tx.QueryRowContext(ctx,`SELECT id FROM bg_account_social.posts
  WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`,postID).Scan(&parent)
  if errors.Is(e,sql.ErrNoRows){return ErrNotFound}
  if e!=nil{return e}
 }
 // A legacy operator cannot hide already awarded content without writing
 // its compensating journal entries. Require the XP-aware moderation path.
 // Pre-AUTH-10 operator databases without migration 003 stay compatible.
 if action=="hide"{
  var xpTable bool
  e=tx.QueryRowContext(ctx,"SELECT to_regclass('bg_account_social.contribution_xp_events') IS NOT NULL").Scan(&xpTable)
  if e!=nil{return e}
  if xpTable{
   var outstanding bool
   e=tx.QueryRowContext(ctx,`SELECT EXISTS(
   SELECT 1 FROM bg_account_social.contribution_xp_events g
   WHERE g.action='grant' AND
   ((g.source_kind='post' AND g.source_id=$1) OR
    (g.source_kind='comment' AND g.source_id IN
    (SELECT id FROM bg_account_social.comments WHERE post_id=$1)))
   AND NOT EXISTS (SELECT 1 FROM bg_account_social.contribution_xp_events v
    WHERE v.source_kind=g.source_kind AND v.source_id=g.source_id AND v.action='revoke')
   )`,postID).Scan(&outstanding)
   if e!=nil{return e}
   if outstanding{return ErrForbidden}
  }
 }
 id,e:=newID();if e!=nil{return e}
 var affected string
 value:=action=="hide"
 e=tx.QueryRowContext(ctx,`UPDATE bg_account_social.posts SET hidden_at=
 CASE WHEN $2 THEN clock_timestamp() ELSE NULL END
 WHERE id=$1 AND deleted_at IS NULL RETURNING id`,postID,value).Scan(&affected)
 if errors.Is(e,sql.ErrNoRows){return ErrNotFound}
 if e!=nil{return e}
 _,e=tx.ExecContext(ctx,`INSERT INTO bg_account_social.moderation_events
 (id,post_id,action,reason,operator_ref) VALUES($1,$2,$3,$4,$5)`,id,postID,action,reason,operator)
 if e!=nil{return e}
 return tx.Commit()
}

// ReadyAccountExtras is opt-in so existing AUTH-8 restricted service never
// requires migration 002 or additional runtime privileges until activated.
func (s *Store) ReadyAccountExtras(ctx context.Context)error{
 var ok bool
 e:=s.DB.QueryRowContext(ctx,`SELECT
 (COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.direct_messages'),'SELECT'),false) AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.direct_messages'),'INSERT'),false))
 AND COALESCE(has_column_privilege(current_user,'bg_account_social.direct_messages','sender_deleted_at','UPDATE'),false)
 AND COALESCE(has_column_privilege(current_user,'bg_account_social.direct_messages','recipient_deleted_at','UPDATE'),false)
 AND (COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.account_games'),'SELECT'),false) AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.account_games'),'INSERT'),false) AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.account_games'),'UPDATE'),false))
 AND (COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.account_game_moves'),'SELECT'),false) AND COALESCE(has_table_privilege(current_user,to_regclass('bg_account_social.account_game_moves'),'INSERT'),false))`).Scan(&ok)
 if e!=nil{return e}
 if !ok{return ErrUnavailable}
 return nil
}

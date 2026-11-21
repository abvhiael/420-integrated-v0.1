package social

import (
 "context"
 "crypto/sha256"
 "database/sql"
 "errors"
 "strings"
 "time"
 "unicode/utf8"
)

// Community XP v1 is private off-chain engagement feedback, not a token,
// account entitlement, spendable credit, or canonical BongGoggles reward.
// Only the dedicated 420ID-authenticated account service may mint entries.
const (
 xpPolicyVersion=1
 xpPostPoints=5
 xpCommentPoints=2
 xpPostDailyCap=3
 xpCommentDailyCap=10
)
type Contributions struct{ Store *Store }
type XPEvent struct{
 Kind string `json:"kind"`
 SourceID string `json:"sourceId"`
 Action string `json:"action"`
 Points int `json:"points"`
 At time.Time `json:"at"`
}
type XPSummary struct{
 Subject string `json:"subject"`
 Total int `json:"total"`
 Level int `json:"level"`
 ToNextLevel int `json:"toNextLevel"`
 TodayPosts int `json:"todayPosts"`
 TodayComments int `json:"todayComments"`
 Events []XPEvent `json:"events"`
 PolicyVersion int `json:"policyVersion"`
 OnChain bool `json:"onChain"`
 Redeemable bool `json:"redeemable"`
 Source string `json:"source"`
}
func NewContributions(store *Store)(*Contributions,error){
 if store==nil||store.DB==nil{return nil,ErrInvalid}
 return &Contributions{Store:store},nil
}
func (s *Store) ReadyXP(ctx context.Context)error{
 var ok bool
 e:=s.DB.QueryRowContext(ctx,`SELECT COALESCE(
 has_table_privilege(current_user,to_regclass('bg_account_social.contribution_xp_events'),'SELECT,INSERT'),false)`).Scan(&ok)
 if e!=nil{return e};if !ok{return ErrUnavailable};return nil
}
func eligibleXP(kind,body string,ownThread bool)(int,int){
 runes:=utf8.RuneCountInString(strings.TrimSpace(body))
 switch {
 case kind=="post"&&runes>=25:return xpPostPoints,xpPostDailyCap
 case kind=="comment"&&!ownThread&&runes>=15:return xpCommentPoints,xpCommentDailyCap
 }
 return 0,0
}
func digestContribution(body string)[32]byte{
 return sha256.Sum256([]byte(strings.ToLower(strings.TrimSpace(body))))
}
func (x *Contributions) grant(ctx context.Context,tx *sql.Tx,subject,kind,source,body string,ownThread bool)error{
 points,cap:=eligibleXP(kind,body,ownThread)
 if points==0{return nil}
 // The caller MUST hold a row lock on the author's members record to
 // serialize daily caps even when multiple app workers submit concurrently.
 var count int
 e:=tx.QueryRowContext(ctx,`SELECT count(*) FROM bg_account_social.contribution_xp_events
 WHERE subject=$1 AND source_kind=$2 AND action='grant'
 AND (created_at AT TIME ZONE 'UTC')::date=(clock_timestamp() AT TIME ZONE 'UTC')::date`,
 subject,kind).Scan(&count)
 if e!=nil{return e};if count>=cap{return nil}
 id,e:=newID();if e!=nil{return e}
 digest:=digestContribution(body)
 _,e=tx.ExecContext(ctx,`INSERT INTO bg_account_social.contribution_xp_events
 (id,subject,source_kind,source_id,action,points,content_digest,policy_version)
 VALUES($1,$2,$3,$4,'grant',$5,$6,$7)
 ON CONFLICT DO NOTHING`,id,subject,kind,source,points,digest[:],xpPolicyVersion)
 return e
}
// revokePost reverses all grants attributable to a post, including comments
// from other authors, while the parent post is locked for deletion/moderation.
// It never deletes/re-writes history; restoring the post cannot farm XP again.
func (x *Contributions) revokePost(ctx context.Context,tx *sql.Tx,postID string)error{
 rows,e:=tx.QueryContext(ctx,`SELECT g.subject,g.source_kind,g.source_id,g.points,g.content_digest
 FROM bg_account_social.contribution_xp_events g
 WHERE g.action='grant' AND
 ((g.source_kind='post' AND g.source_id=$1) OR
 (g.source_kind='comment' AND g.source_id IN (
 SELECT c.id FROM bg_account_social.comments c WHERE c.post_id=$1)))
 AND NOT EXISTS (SELECT 1 FROM bg_account_social.contribution_xp_events v
 WHERE v.source_kind=g.source_kind AND v.source_id=g.source_id AND v.action='revoke')`,postID)
 if e!=nil{return e}
 type pending struct{subject,kind,source string;points int;digest []byte}
 items:=[]pending{}
 for rows.Next(){var v pending
  if e=rows.Scan(&v.subject,&v.kind,&v.source,&v.points,&v.digest);e!=nil{rows.Close();return e}
  items=append(items,v)
 }
 e=rows.Err();rows.Close();if e!=nil{return e}
 for _,v:=range items{
  id,e:=newID();if e!=nil{return e}
  _,e=tx.ExecContext(ctx,`INSERT INTO bg_account_social.contribution_xp_events
 (id,subject,source_kind,source_id,action,points,content_digest,policy_version)
 VALUES($1,$2,$3,$4,'revoke',$5,$6,$7) ON CONFLICT DO NOTHING`,
 id,v.subject,v.kind,v.source,-v.points,v.digest,xpPolicyVersion)
  if e!=nil{return e}
 }
 return nil
}
func (x *Contributions) PublishPost(ctx context.Context,subject,body string)(Post,error){
 if !uuid.MatchString(subject)||!safeText(body,2000,false){return Post{},ErrInvalid}
 tx,e:=x.Store.DB.BeginTx(ctx,nil);if e!=nil{return Post{},e};defer tx.Rollback()
 var member string
 e=tx.QueryRowContext(ctx,`SELECT subject FROM bg_account_social.members WHERE subject=$1 FOR UPDATE`,subject).Scan(&member)
 if errors.Is(e,sql.ErrNoRows){return Post{},ErrNotFound};if e!=nil{return Post{},e}
 id,e:=newID();if e!=nil{return Post{},e}
 var p Post
 e=tx.QueryRowContext(ctx,`WITH inserted AS (
 INSERT INTO bg_account_social.posts(id,author,body) VALUES($1,$2,$3)
 RETURNING id,author,body,created_at)
 SELECT i.id,i.author,m.display_name,i.body,i.created_at FROM inserted i
 JOIN bg_account_social.members m ON m.subject=i.author`,id,subject,body).
 Scan(&p.ID,&p.Author,&p.DisplayName,&p.Body,&p.CreatedAt)
 if e!=nil{return Post{},e}
 if e=x.grant(ctx,tx,subject,"post",id,body,false);e!=nil{return Post{},e}
 if e=tx.Commit();e!=nil{return Post{},e}
 return p,nil
}
func (x *Contributions) PublishComment(ctx context.Context,subject,postID,body string)(Comment,error){
 if !uuid.MatchString(subject)||!uuid.MatchString(postID)||!safeText(body,500,false){return Comment{},ErrInvalid}
 tx,e:=x.Store.DB.BeginTx(ctx,nil);if e!=nil{return Comment{},e};defer tx.Rollback()
 var parentAuthor string
 e=tx.QueryRowContext(ctx,`SELECT author FROM bg_account_social.posts
 WHERE id=$1 AND deleted_at IS NULL AND hidden_at IS NULL FOR UPDATE`,postID).Scan(&parentAuthor)
 if errors.Is(e,sql.ErrNoRows){return Comment{},ErrNotFound};if e!=nil{return Comment{},e}
 blocked,e:=blockedBetween(ctx,tx,subject,parentAuthor)
 if e!=nil{return Comment{},e}
 if blocked{return Comment{},ErrNotFound}
 var member string
 e=tx.QueryRowContext(ctx,`SELECT subject FROM bg_account_social.members WHERE subject=$1 FOR UPDATE`,subject).Scan(&member)
 if errors.Is(e,sql.ErrNoRows){return Comment{},ErrNotFound};if e!=nil{return Comment{},e}
 id,e:=newID();if e!=nil{return Comment{},e}
 var c Comment
 e=tx.QueryRowContext(ctx,`WITH inserted AS (
 INSERT INTO bg_account_social.comments(id,post_id,author,body)
 VALUES($1,$2,$3,$4) RETURNING id,post_id,author,body,created_at)
 SELECT i.id,i.post_id,i.author,m.display_name,i.body,i.created_at FROM inserted i
 JOIN bg_account_social.members m ON m.subject=i.author`,id,postID,subject,body).
 Scan(&c.ID,&c.PostID,&c.Author,&c.DisplayName,&c.Body,&c.CreatedAt)
 if e!=nil{return Comment{},e}
 if e=x.grant(ctx,tx,subject,"comment",id,body,subject==parentAuthor);e!=nil{return Comment{},e}
 if e=tx.Commit();e!=nil{return Comment{},e}
 return c,nil
}
func (x *Contributions) DeletePost(ctx context.Context,subject,postID string)error{
 if !uuid.MatchString(subject)||!uuid.MatchString(postID){return ErrInvalid}
 tx,e:=x.Store.DB.BeginTx(ctx,nil);if e!=nil{return e};defer tx.Rollback()
 var found string
 e=tx.QueryRowContext(ctx,`UPDATE bg_account_social.posts SET deleted_at=clock_timestamp()
 WHERE id=$1 AND author=$2 AND deleted_at IS NULL RETURNING id`,postID,subject).Scan(&found)
 if errors.Is(e,sql.ErrNoRows){return ErrNotFound};if e!=nil{return e}
 if e=x.revokePost(ctx,tx,postID);e!=nil{return e}
 return tx.Commit()
}
func (x *Contributions) Moderate(ctx context.Context,postID,action,reason,operator string)error{
 if !uuid.MatchString(postID)||(action!="hide"&&action!="restore")||
 !safeText(reason,120,false)||!safeText(operator,100,false){return ErrInvalid}
 tx,e:=x.Store.DB.BeginTx(ctx,nil);if e!=nil{return e};defer tx.Rollback()
 var found string
 e=tx.QueryRowContext(ctx,`UPDATE bg_account_social.posts SET hidden_at=
 CASE WHEN $2 THEN clock_timestamp() ELSE NULL END
 WHERE id=$1 AND deleted_at IS NULL RETURNING id`,postID,action=="hide").Scan(&found)
 if errors.Is(e,sql.ErrNoRows){return ErrNotFound};if e!=nil{return e}
 id,e:=newID();if e!=nil{return e}
 _,e=tx.ExecContext(ctx,`INSERT INTO bg_account_social.moderation_events
 (id,post_id,action,reason,operator_ref) VALUES($1,$2,$3,$4,$5)`,
 id,postID,action,reason,operator)
 if e!=nil{return e}
 if action=="hide"{if e=x.revokePost(ctx,tx,postID);e!=nil{return e}}
 return tx.Commit()
}
func (x *Contributions) Summary(ctx context.Context,subject string)(XPSummary,error){
 out:=XPSummary{Subject:subject,Level:1,ToNextLevel:100,Events:[]XPEvent{},
 PolicyVersion:xpPolicyVersion,OnChain:false,Redeemable:false,Source:"bonggoggles-account-xp"}
 if !uuid.MatchString(subject){return XPSummary{},ErrInvalid}
 e:=x.Store.DB.QueryRowContext(ctx,`SELECT COALESCE(sum(points),0)
 FROM bg_account_social.contribution_xp_events WHERE subject=$1`,subject).Scan(&out.Total)
 if e!=nil{return XPSummary{},e}
 if out.Total<0{return XPSummary{},ErrUnavailable}
 out.Level=out.Total/100+1
 out.ToNextLevel=100-(out.Total%100)
 rows,e:=x.Store.DB.QueryContext(ctx,`SELECT source_kind,source_id,action,points,created_at
 FROM bg_account_social.contribution_xp_events
 WHERE subject=$1 ORDER BY created_at DESC,id DESC LIMIT 30`,subject)
 if e!=nil{return XPSummary{},e}
 for rows.Next(){var event XPEvent
  if e=rows.Scan(&event.Kind,&event.SourceID,&event.Action,&event.Points,&event.At);e!=nil{rows.Close();return XPSummary{},e}
  out.Events=append(out.Events,event)
 }
 e=rows.Err();rows.Close();if e!=nil{return XPSummary{},e}
 e=x.Store.DB.QueryRowContext(ctx,`SELECT
 count(*) FILTER (WHERE source_kind='post'),
 count(*) FILTER (WHERE source_kind='comment')
 FROM bg_account_social.contribution_xp_events WHERE subject=$1 AND action='grant'
 AND (created_at AT TIME ZONE 'UTC')::date=(clock_timestamp() AT TIME ZONE 'UTC')::date`,
 subject).Scan(&out.TodayPosts,&out.TodayComments)
 if e!=nil{return XPSummary{},e}
 return out,nil
}

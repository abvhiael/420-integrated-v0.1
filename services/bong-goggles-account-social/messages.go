package social

import (
 "context"
 "crypto/aes"
 "crypto/cipher"
 "crypto/rand"
 "database/sql"
 "errors"
 "time"
)

// Direct messaging is an optional, independent off-chain 420ID app feature.
// It does NOT claim to be the canonical Messenger protocol or end-to-end
// encrypted. The private service encrypts content at rest; operators with
// service key custody are within the trusted computing boundary.
type MessageService struct {
 Store *Store
 key [32]byte
}
type DirectMessage struct {
 ID string `json:"id"`
 Sender string `json:"sender"`
 Recipient string `json:"recipient"`
 Body string `json:"body"`
 CreatedAt time.Time `json:"createdAt"`
}
type MessagePeer struct {
 Subject string `json:"subject"`
 DisplayName string `json:"displayName"`
 LastAt time.Time `json:"lastAt"`
}
func NewMessageService(s *Store,key []byte)(*MessageService,error){
 if s==nil||len(key)!=32{return nil,ErrInvalid}
 m:=&MessageService{Store:s};copy(m.key[:],key);return m,nil
}
func (m *MessageService) protect(id,from,to,body string)([]byte,error){
 block,e:=aes.NewCipher(m.key[:]);if e!=nil{return nil,e}
 g,e:=cipher.NewGCM(block);if e!=nil{return nil,e}
 nonce:=make([]byte,g.NonceSize());if _,e=rand.Read(nonce);e!=nil{return nil,e}
 associated:=[]byte("bg-account-messaging-v1|"+id+"|"+from+"|"+to)
 return g.Seal(nonce,nonce,[]byte(body),associated),nil
}
func (m *MessageService) reveal(id,from,to string,encrypted []byte)(string,error){
 block,e:=aes.NewCipher(m.key[:]);if e!=nil{return "",ErrUnavailable}
 g,e:=cipher.NewGCM(block);if e!=nil{return "",ErrUnavailable}
 if len(encrypted)<g.NonceSize()+g.Overhead(){return "",ErrUnavailable}
 associated:=[]byte("bg-account-messaging-v1|"+id+"|"+from+"|"+to)
 b,e:=g.Open(nil,encrypted[:g.NonceSize()],encrypted[g.NonceSize():],associated)
 if e!=nil{return "",ErrUnavailable}
 return string(b),nil
}
func lockPeerPair(ctx context.Context,tx *sql.Tx,a,b string)error{
 first,second:=a,b;if first>second{first,second=second,first}
 rows,e:=tx.QueryContext(ctx,`SELECT subject FROM bg_account_social.members
 WHERE subject IN ($1,$2) ORDER BY subject FOR UPDATE`,first,second)
 if e!=nil{return e};defer rows.Close()
 count:=0
 for rows.Next(){var subject string;if e=rows.Scan(&subject);e!=nil{return e};count++}
 if e=rows.Err();e!=nil{return e}
 if count!=2{return ErrNotFound}
 return nil
}
func blockedBetween(ctx context.Context,q interface{QueryRowContext(context.Context,string,...any)*sql.Row},a,b string)(bool,error){
 var blocked bool
 e:=q.QueryRowContext(ctx,`SELECT EXISTS(SELECT 1 FROM bg_account_social.blocks
 WHERE (blocker=$1 AND blocked=$2) OR (blocker=$2 AND blocked=$1))`,a,b).Scan(&blocked)
 return blocked,e
}
func (m *MessageService) Send(ctx context.Context,from,to,body string)(DirectMessage,error){
 var result DirectMessage
 if !uuid.MatchString(from)||!uuid.MatchString(to)||from==to||!safeText(body,2000,false){return result,ErrInvalid}
 id,e:=newID();if e!=nil{return result,e}
 cipherText,e:=m.protect(id,from,to,body);if e!=nil{return result,e}
 tx,e:=m.Store.DB.BeginTx(ctx,nil);if e!=nil{return result,e};defer tx.Rollback()
 if e=lockPeerPair(ctx,tx,from,to);e!=nil{return result,e}
 blocked,e:=blockedBetween(ctx,tx,from,to);if e!=nil{return result,e}
 if blocked{return result,ErrForbidden}
 e=tx.QueryRowContext(ctx,`INSERT INTO bg_account_social.direct_messages
 (id,sender,recipient,body_cipher) VALUES($1,$2,$3,$4)
 RETURNING id,sender,recipient,created_at`,id,from,to,cipherText).
 Scan(&result.ID,&result.Sender,&result.Recipient,&result.CreatedAt)
 if e!=nil{return DirectMessage{},e}
 if e=tx.Commit();e!=nil{return DirectMessage{},e}
 result.Body=body
 return result,nil
}
func (m *MessageService) Inbox(ctx context.Context,viewer string)([]MessagePeer,error){
 if !uuid.MatchString(viewer){return nil,ErrInvalid}
 rows,e:=m.Store.DB.QueryContext(ctx,`WITH messages AS (
 SELECT CASE WHEN d.sender=$1 THEN d.recipient ELSE d.sender END AS peer,
 d.created_at AS created
 FROM bg_account_social.direct_messages d
 WHERE (d.sender=$1 AND d.sender_deleted_at IS NULL)
 OR (d.recipient=$1 AND d.recipient_deleted_at IS NULL))
 SELECT msg.peer,member.display_name,max(msg.created) AS last_at
 FROM messages msg JOIN bg_account_social.members member ON member.subject=msg.peer
 WHERE NOT EXISTS(SELECT 1 FROM bg_account_social.blocks b
 WHERE (b.blocker=$1 AND b.blocked=msg.peer) OR (b.blocker=msg.peer AND b.blocked=$1))
 GROUP BY msg.peer,member.display_name ORDER BY last_at DESC,msg.peer LIMIT 50`,viewer)
 if e!=nil{return nil,e};defer rows.Close()
 result:=[]MessagePeer{}
 for rows.Next(){var p MessagePeer
  if e=rows.Scan(&p.Subject,&p.DisplayName,&p.LastAt);e!=nil{return nil,e}
  result=append(result,p)
 }
 return result,rows.Err()
}
func (m *MessageService) Thread(ctx context.Context,viewer,peer string)([]DirectMessage,error){
 if !uuid.MatchString(viewer)||!uuid.MatchString(peer)||viewer==peer{return nil,ErrInvalid}
 blocked,e:=blockedBetween(ctx,m.Store.DB,viewer,peer);if e!=nil{return nil,e}
 if blocked{return nil,ErrForbidden}
 rows,e:=m.Store.DB.QueryContext(ctx,`SELECT id,sender,recipient,body_cipher,created_at
 FROM bg_account_social.direct_messages
 WHERE ((sender=$1 AND recipient=$2 AND sender_deleted_at IS NULL)
 OR (sender=$2 AND recipient=$1 AND recipient_deleted_at IS NULL))
 ORDER BY created_at DESC,id DESC LIMIT 100`,viewer,peer)
 if e!=nil{return nil,e};defer rows.Close()
 messages:=[]DirectMessage{}
 for rows.Next(){
  var item DirectMessage;var encrypted []byte
  if e=rows.Scan(&item.ID,&item.Sender,&item.Recipient,&encrypted,&item.CreatedAt);e!=nil{return nil,e}
  item.Body,e=m.reveal(item.ID,item.Sender,item.Recipient,encrypted)
  if e!=nil{return nil,e}
  messages=append(messages,item)
 }
 if e=rows.Err();e!=nil{return nil,e}
 for i,j:=0,len(messages)-1;i<j;i,j=i+1,j-1{messages[i],messages[j]=messages[j],messages[i]}
 return messages,nil
}
func (m *MessageService) Delete(ctx context.Context,viewer,id string)error{
 if !uuid.MatchString(viewer)||!uuid.MatchString(id){return ErrInvalid}
 var found string
 e:=m.Store.DB.QueryRowContext(ctx,`UPDATE bg_account_social.direct_messages SET
 sender_deleted_at=CASE WHEN sender=$1 THEN clock_timestamp() ELSE sender_deleted_at END,
 recipient_deleted_at=CASE WHEN recipient=$1 THEN clock_timestamp() ELSE recipient_deleted_at END
 WHERE id=$2 AND (sender=$1 AND sender_deleted_at IS NULL
 OR recipient=$1 AND recipient_deleted_at IS NULL)
 RETURNING id`,viewer,id).Scan(&found)
 if errors.Is(e,sql.ErrNoRows){return ErrNotFound}
 return e
}

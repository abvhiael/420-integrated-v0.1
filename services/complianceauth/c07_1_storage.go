package complianceauth

import (
 "context"
 "crypto/aes"
 "crypto/cipher"
 "crypto/rand"
 "database/sql"
 "encoding/json"
 "errors"
 "io"
 "strconv"
 "time"
)

const C071MaxPrivateBytes = 128 * 1024
var ErrC071Storage = errors.New("compliance protected storage unavailable")

// C071Cipher uses externally supplied keys. Key IDs are public; key material is
// never stored in PostgreSQL, source, DSNs, evidence or logs. Historical keys
// may be supplied for controlled rotation; new writes use only the active key.
type C071EncryptionKeys interface{LoadEncryptionKeys(context.Context)(*C071Cipher,error)}
type C071Cipher struct { active string; keys map[string]cipher.AEAD; provider C071EncryptionKeys }
func(c *C071Cipher)usable(ctx context.Context)bool{if c==nil{return false};if c.provider!=nil{fresh,e:=c.provider.LoadEncryptionKeys(ctx);return e==nil&&fresh!=nil&&fresh.provider==nil&&fresh.keys[fresh.active]!=nil};return c.keys[c.active]!=nil}
type c071Envelope struct { Version int `json:"v"`; KeyID string `json:"kid"`; Nonce []byte `json:"nonce"`; Ciphertext []byte `json:"ciphertext"` }
func NewC071Cipher(active string, material map[string][]byte) (*C071Cipher,error) {
 if !c064ID.MatchString(active) || len(active)>64 || len(material)==0 || len(material)>8 { return nil,ErrC071Storage }
 c:=&C071Cipher{active:active,keys:map[string]cipher.AEAD{}}
 for id,key:=range material {
  if !c064ID.MatchString(id)||len(id)>64||len(key)!=32 {return nil,ErrC071Storage}
  var nonzero byte; for _,b:=range key {nonzero|=b}; if nonzero==0 {return nil,ErrC071Storage}
  block,err:=aes.NewCipher(append([]byte(nil),key...)); if err!=nil{return nil,ErrC071Storage}
  aead,err:=cipher.NewGCM(block); if err!=nil{return nil,ErrC071Storage}; c.keys[id]=aead
 }
 if c.keys[active]==nil{return nil,ErrC071Storage}; return c,nil
}
func c071AAD(kind string,s C064AuthorScope,id string,revision uint64) []byte {
 raw,_:=json.Marshal([]string{"420Compliance/C07.1/v1",kind,s.Tenant,s.Domain,s.Jurisdiction,id,strconv.FormatUint(revision,10)});return raw
}
func(c *C071Cipher) seal(plain,aad []byte)([]byte,error){return c.sealContext(context.Background(),plain,aad)}
func(c *C071Cipher)sealContext(ctx context.Context,plain,aad []byte)([]byte,error){
 if ctx==nil||ctx.Err()!=nil||c==nil{return nil,ErrC071Storage}
 if c.provider!=nil{fresh,e:=c.provider.LoadEncryptionKeys(ctx);if e!=nil||fresh==nil||fresh.provider!=nil{return nil,ErrC071Storage};return fresh.sealContext(ctx,plain,aad)}
 if c==nil||c.keys[c.active]==nil||len(plain)==0||len(plain)>C071MaxPrivateBytes||len(aad)==0 {return nil,ErrC071Storage}
 a:=c.keys[c.active]; nonce:=make([]byte,a.NonceSize()); if _,err:=io.ReadFull(rand.Reader,nonce);err!=nil{return nil,ErrC071Storage}
 return json.Marshal(c071Envelope{1,c.active,nonce,a.Seal(nil,nonce,plain,aad)})
}
func(c *C071Cipher) open(raw,aad []byte)([]byte,error){return c.openContext(context.Background(),raw,aad)}
func(c *C071Cipher)openContext(ctx context.Context,raw,aad []byte)([]byte,error){
 if ctx==nil||ctx.Err()!=nil||c==nil{return nil,ErrC071Storage}
 if c.provider!=nil{fresh,e:=c.provider.LoadEncryptionKeys(ctx);if e!=nil||fresh==nil||fresh.provider!=nil{return nil,ErrC071Storage};return fresh.openContext(ctx,raw,aad)}
 if c==nil||len(raw)>2*C071MaxPrivateBytes||len(aad)==0{return nil,ErrC071Storage}
 var e c071Envelope
 if json.Unmarshal(raw,&e)!=nil||e.Version!=1||c.keys[e.KeyID]==nil{return nil,ErrC071Storage}
 a:=c.keys[e.KeyID]; if len(e.Nonce)!=a.NonceSize(){return nil,ErrC071Storage}
 plain,err:=a.Open(nil,e.Nonce,e.Ciphertext,aad)
 if err!=nil||len(plain)==0||len(plain)>C071MaxPrivateBytes{return nil,ErrC071Storage}; return plain,nil
}
func c071Encode(c *C071Cipher,value any,aad []byte)([]byte,error){return c071EncodeContext(context.Background(),c,value,aad)}
func c071EncodeContext(ctx context.Context,c *C071Cipher,value any,aad []byte)([]byte,error){
 raw,err:=json.Marshal(value);if err!=nil||len(raw)>C071MaxPrivateBytes{return nil,ErrC071Storage}
 if c==nil{return raw,nil} // Legacy test/development store only; production factory requires a cipher.
 return c.sealContext(ctx,raw,aad)
}
func c071Decode(c *C071Cipher,raw,aad []byte,value any)error{return c071DecodeContext(context.Background(),c,raw,aad,value)}
func c071DecodeContext(ctx context.Context,c *C071Cipher,raw,aad []byte,value any)error{
 if len(raw)>2*C071MaxPrivateBytes{return ErrC071Storage}
 var err error;if c!=nil {raw,err=c.openContext(ctx,raw,aad);if err!=nil{return err}}
 if json.Unmarshal(raw,value)!=nil{return ErrC071Storage};return nil
}

// C071ProductionStores is the supported private production persistence entry.
// Migration credentials and runtime credentials must be separate.
type C071ProductionStores struct {
 DB *sql.DB
 Drafts C064PostgreSQLDrafts
 Reviews C065PostgreSQLReviews
 Audit C067PostgreSQLAccessLog
 Publication *PostgreSQLPublicationStore
}
func c071RuntimeBinding(ctx context.Context,db *sql.DB,s C064AuthorScope,publicationScope string)error{
 if ctx==nil||ctx.Err()!=nil||db==nil||!c051Scope(s.Tenant)||!c051Scope(s.Domain)||!c051Scope(s.Jurisdiction)||publicationScope=="" {return ErrC071Storage}
 var unsafe bool
 err:=db.QueryRowContext(ctx,`SELECT r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb OR pg_is_in_recovery()
 OR EXISTS (SELECT 1 FROM pg_class t WHERE t.relname LIKE 'compliance_%' AND t.relnamespace='public'::regnamespace AND t.relowner=r.oid)
 FROM pg_roles r WHERE r.rolname=current_user`).Scan(&unsafe)
 if err!=nil||unsafe{return ErrC071Storage}
 var n int
 err=db.QueryRowContext(ctx,`SELECT count(*) FROM public.compliance_database_bindings WHERE role_name=current_user
 AND tenant=$1 AND domain=$2 AND jurisdiction=$3 AND publication_scope=$4`,s.Tenant,s.Domain,s.Jurisdiction,publicationScope).Scan(&n)
 if err!=nil||n!=1{return ErrC071Storage}
 err=db.QueryRowContext(ctx,`SELECT count(*) FROM pg_class WHERE relnamespace='public'::regnamespace AND relname IN
 ('compliance_author_heads','compliance_author_versions','compliance_review_heads','compliance_review_versions','compliance_auditor_access','compliance_publication_fences','compliance_job_leaders','compliance_durable_jobs','compliance_durable_halts','compliance_activations','compliance_impact_outbox','compliance_capacity')
 AND relrowsecurity AND relforcerowsecurity`).Scan(&n)
 if err!=nil||n!=12{return ErrC071Storage}
 if db.QueryRowContext(ctx,"SELECT has_schema_privilege(current_user,'public','CREATE') OR has_table_privilege(current_user,'public.compliance_database_bindings','INSERT,UPDATE,DELETE') OR has_table_privilege(current_user,'public.compliance_schema_migrations','INSERT,UPDATE,DELETE')").Scan(&unsafe)!=nil||unsafe{return ErrC071Storage}
 scripts:=[]string{PublicationSchemaSQL,C064AuthorSchemaSQL,C065ReviewSchemaSQL,C067AuditSchemaSQL,c071HardeningSQL,c072DurableSQL,c074CapacitySQL}
 for i,script:=range scripts{
  var checksum string
  if db.QueryRowContext(ctx,"SELECT checksum FROM public.compliance_schema_migrations WHERE version=$1",i+1).Scan(&checksum)!=nil||checksum!=Digest([]byte(script)){return ErrC071Storage}
 }
 var version int
 if db.QueryRowContext(ctx,"SELECT max(version) FROM public.compliance_schema_migrations").Scan(&version)!=nil||version!=7{return ErrC071Storage}
 for _,table:=range []string{"compliance_author_versions","compliance_review_versions","compliance_auditor_access","compliance_durable_halts","compliance_activations"}{
  if db.QueryRowContext(ctx,"SELECT has_table_privilege(current_user,$1,'UPDATE') OR has_table_privilege(current_user,$1,'DELETE') OR has_table_privilege(current_user,$1,'TRUNCATE')", "public."+table).Scan(&unsafe)!=nil||unsafe{return ErrC071Storage}
 }
 return nil
}
func OpenC071ProductionStores(ctx context.Context,dsn string,s C064AuthorScope,publicationScope string,c *C071Cipher)(*C071ProductionStores,error){
 if ctx==nil||ctx.Err()!=nil||!c.usable(ctx)||ValidProductionDSN(dsn)!=nil{return nil,ErrC071Storage}
 p,err:=OpenPostgreSQLPublicationStore(dsn);if err!=nil{return nil,ErrC071Storage}
 probe,cancel:=context.WithTimeout(ctx,5*time.Second);defer cancel()
 if p.DB.PingContext(probe)!=nil||c071RuntimeBinding(probe,p.DB,s,publicationScope)!=nil {p.DB.Close();return nil,ErrC071Storage}
 var tls bool
 if p.DB.QueryRowContext(probe,"SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()").Scan(&tls)!=nil||!tls {p.DB.Close();return nil,ErrC071Storage}
 return &C071ProductionStores{p.DB,C064PostgreSQLDrafts{DB:p.DB,Cipher:c},C065PostgreSQLReviews{DB:p.DB,Cipher:c},C067PostgreSQLAccessLog{DB:p.DB,Cipher:c},p},nil
}
func(s *C071ProductionStores)Close()error{if s==nil||s.DB==nil{return nil};return s.DB.Close()}

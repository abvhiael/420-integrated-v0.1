package complianceauth

import (
 "bytes"
 "context"
 "crypto/ed25519"
 "database/sql"
 "encoding/json"
 "errors"
 "strings"
 "time"
 "github.com/lib/pq"
)

var ErrC075Denied=errors.New("compliance privacy operation unavailable")
type C075Ref struct { Kind,ID string }
func c075Ref(r C075Ref,hold bool)bool{return c064ID.MatchString(r.ID)&&(r.Kind=="DRAFT"||r.Kind=="AUDIT"||r.Kind=="JOB"||hold&&r.Kind=="ALL"&&r.ID=="scope")}

// Signed retention is configuration supplied by two independent authorities.
// No repository default is a legal retention schedule or deletion permission.
type C075Policy struct {
 Scope C064AuthorScope
 Kind string
 Version uint64
 RetainDays int
 ApprovalDigest,OwnerID,ReviewerID string
 ExpiresAt time.Time
 Revoked bool
 OwnerSignature,ReviewerSignature []byte
}
type C075PolicyAuthority interface{VerifyRetentionPolicy(context.Context,C075Policy)error}
type C075SignedPolicies struct{Owners,Reviewers map[string]ed25519.PublicKey}
func c075PolicyBytes(p C075Policy)[]byte{p.OwnerSignature=nil;p.ReviewerSignature=nil;b,_:=json.Marshal(p);return b}
func(a C075SignedPolicies)VerifyRetentionPolicy(ctx context.Context,p C075Policy)error{
 owner,reviewer:=a.Owners[p.OwnerID],a.Reviewers[p.ReviewerID]
 if ctx==nil||ctx.Err()!=nil||p.OwnerID==p.ReviewerID||!c064ID.MatchString(p.OwnerID)||!c064ID.MatchString(p.ReviewerID)||
 !c051Scope(p.Scope.Tenant)||!c051Scope(p.Scope.Domain)||!c051Scope(p.Scope.Jurisdiction)||
 !c075Ref(C075Ref{p.Kind,"policy"},false)||p.Version<1||p.Version>9223372036854775807||p.RetainDays<1||p.RetainDays>3650||!digestValid(p.ApprovalDigest)||
 !time.Now().Before(p.ExpiresAt)||p.ExpiresAt.After(time.Now().Add(366*24*time.Hour))||len(owner)!=32||len(reviewer)!=32||bytes.Equal(owner,reviewer)||
 !ed25519.Verify(owner,c075PolicyBytes(p),p.OwnerSignature)||!ed25519.Verify(reviewer,c075PolicyBytes(p),p.ReviewerSignature){return ErrC075Denied};return nil
}
func InstallC075RetentionPolicy(ctx context.Context,db *sql.DB,scope string,p C075Policy,authority C075PolicyAuthority)error{
 if db==nil||authority==nil||ctx==nil||ctx.Err()!=nil||!c051Scope(scope)||scope!=controlScope("production",p.Scope.Domain,p.Scope.Jurisdiction)||authority.VerifyRetentionPolicy(ctx,p)!=nil{return ErrC075Denied}
 tx,e:=db.BeginTx(ctx,nil);if e!=nil{return ErrC075Denied};defer tx.Rollback()
 if _,e=tx.ExecContext(ctx,"SELECT pg_advisory_xact_lock(hashtextextended($1,420075))",scope);e!=nil{return ErrC075Denied}
 var owner bool
 if tx.QueryRowContext(ctx,"SELECT has_table_privilege(current_user,'public.compliance_retention_policies','INSERT')").Scan(&owner)!=nil||!owner{return ErrC075Denied}
 var bound bool
 if tx.QueryRowContext(ctx,"SELECT EXISTS(SELECT 1 FROM public.compliance_database_bindings WHERE publication_scope=$1 AND tenant=$2 AND domain=$3 AND jurisdiction=$4)",scope,p.Scope.Tenant,p.Scope.Domain,p.Scope.Jurisdiction).Scan(&bound)!=nil||!bound{return ErrC075Denied}
 var version uint64;var days int
 var policies int;if tx.QueryRowContext(ctx,"SELECT count(*) FROM public.compliance_retention_policies WHERE scope=$1",scope).Scan(&policies)!=nil||policies>=10000{return ErrC075Denied}
 e=tx.QueryRowContext(ctx,"SELECT version,retain_days FROM public.compliance_retention_policies WHERE scope=$1 AND kind=$2 ORDER BY version DESC LIMIT 1",scope,p.Kind).Scan(&version,&days)
 if e!=nil&&e!=sql.ErrNoRows||e==nil&&(p.Version<=version||p.RetainDays<days){return ErrC075Denied}
 if authority.VerifyRetentionPolicy(ctx,p)!=nil{return ErrC075Denied}
 _,e=tx.ExecContext(ctx,"INSERT INTO public.compliance_retention_policies(scope,kind,version,retain_days,approval_digest,reviewer,owner,valid_until,revoked) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)",scope,p.Kind,p.Version,p.RetainDays,p.ApprovalDigest,p.ReviewerID,p.OwnerID,p.ExpiresAt,p.Revoked)
 if e!=nil{return ErrC075Denied}
 // Legacy audit rows have no trusted insertion clock: begin retention now.
 if p.Kind=="AUDIT"{_,e=tx.ExecContext(ctx,"INSERT INTO public.compliance_privacy_terminal(scope,kind,ref) SELECT $1,'AUDIT',id::text FROM public.compliance_auditor_access WHERE tenant=$2 AND domain=$3 AND jurisdiction=$4 ON CONFLICT DO NOTHING",scope,p.Scope.Tenant,p.Scope.Domain,p.Scope.Jurisdiction);if e!=nil{return ErrC075Denied}}
 if ctx.Err()!=nil||tx.Commit()!=nil{return ErrC075Denied};return nil
}

// This binds already-provisioned isolated privacy roles; it creates no account,
// credential, schema ownership, broad DELETE or application data privilege.
func BindC075PrivacyRole(ctx context.Context,db *sql.DB,role,scope string,s C064AuthorScope,principal,capability string,expires time.Time)error{
 if db==nil||ctx==nil||ctx.Err()!=nil||!c064ID.MatchString(role)||!c064ID.MatchString(principal)||!c051Scope(scope)||scope!=controlScope("production",s.Domain,s.Jurisdiction)||!time.Now().Before(expires)||expires.After(time.Now().Add(24*time.Hour)){return ErrC075Denied}
 fn:=map[string]string{"purge":"c075_purge(text,text,text)","hold":"c075_hold(text,text,text,text,bigint,boolean)","release":"c075_hold(text,text,text,text,bigint,boolean)","retire":"c075_retire(text,text,bigint)"}[capability];if fn==""{return ErrC075Denied}
 tx,e:=db.BeginTx(ctx,nil);if e!=nil{return ErrC075Denied};defer tx.Rollback();var unsafe bool
 if tx.QueryRowContext(ctx,"SELECT rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR EXISTS(SELECT 1 FROM pg_auth_members WHERE member=pg_roles.oid) FROM pg_roles WHERE rolname=$1",role).Scan(&unsafe)!=nil||unsafe{return ErrC075Denied}
 if tx.QueryRowContext(ctx,"SELECT has_schema_privilege($1,'public','CREATE') OR has_database_privilege($1,current_database(),'CREATE')",role).Scan(&unsafe)!=nil||unsafe{return ErrC075Denied}
 var bound bool
 if tx.QueryRowContext(ctx,"SELECT EXISTS(SELECT 1 FROM public.compliance_database_bindings WHERE publication_scope=$1 AND tenant=$2 AND domain=$3 AND jurisdiction=$4) AND NOT EXISTS(SELECT 1 FROM public.compliance_database_bindings WHERE role_name=$5)",scope,s.Tenant,s.Domain,s.Jurisdiction,role).Scan(&bound)!=nil||!bound{return ErrC075Denied}
 for _,table:=range []string{"compliance_author_versions","compliance_review_versions","compliance_auditor_access","compliance_durable_jobs"}{if tx.QueryRowContext(ctx,"SELECT has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE')",role,"public."+table).Scan(&unsafe)!=nil||unsafe{return ErrC075Denied}}
 _,e=tx.ExecContext(ctx,"INSERT INTO public.compliance_privacy_roles(role_name,scope,tenant,domain,jurisdiction,principal,capability,valid_until) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",role,scope,s.Tenant,s.Domain,s.Jurisdiction,principal,capability,expires);if e!=nil{return ErrC075Denied}
 q:=pq.QuoteIdentifier(role)
 for _,stmt:=range []string{"GRANT USAGE ON SCHEMA public TO "+q,"GRANT SELECT ON public.compliance_schema_migrations TO "+q,"GRANT EXECUTE ON FUNCTION public.c075_identity() TO "+q,"GRANT EXECUTE ON FUNCTION public."+fn+" TO "+q}{if _,e=tx.ExecContext(ctx,stmt);e!=nil{return ErrC075Denied}}
 if capability=="purge"{if _,e=tx.ExecContext(ctx,"GRANT EXECUTE ON FUNCTION public.c075_due(text,integer) TO "+q);e!=nil{return ErrC075Denied}}
 if tx.Commit()!=nil{return ErrC075Denied};return nil
}

type C075Grant struct {
 Scope C064AuthorScope
 PrincipalID,SessionID,Capability,Operation string
 Ref C075Ref
 CaseID string
 ExpectedRevision uint64
 OwnerFinalized bool
 ExpiresAt time.Time
 Revoked bool
}
// External issuer must verify current role, scoped owner/case mandate and live
// revocation on EVERY call. Caller fields never create a mandate.
type C075GrantAuthority interface{VerifyPrivacyGrant(context.Context,string)(C075Grant,error)}
type C075Store struct{DB *sql.DB;Scope C064AuthorScope;PublicationScope string;Authority C075GrantAuthority;Identity C072ServiceIdentity}
func(s *C075Store)authorize(ctx context.Context,token,cap string,ref C075Ref)(C075Grant,error){
 if s==nil||s.DB==nil||s.Authority==nil||ctx==nil||ctx.Err()!=nil||len(token)<16||len(token)>4096||!c075Ref(ref,cap=="hold"||cap=="release")||s.Identity!=nil&&s.Identity.VerifyServiceIdentity(ctx)!=nil{return C075Grant{},ErrC075Denied}
 grant,e:=s.Authority.VerifyPrivacyGrant(ctx,token)
 roleCap:=cap;if cap=="scan"{roleCap="purge"}
 if e!=nil||grant.Revoked||grant.Scope!=s.Scope||grant.Capability!=roleCap||grant.Operation!=strings.ToUpper(cap)||grant.Ref!=ref||!c064ID.MatchString(grant.PrincipalID)||!c064ID.MatchString(grant.SessionID)||!time.Now().Before(grant.ExpiresAt)||grant.ExpiresAt.After(time.Now().Add(5*time.Minute))||(cap=="purge"||cap=="retire")&&!grant.OwnerFinalized{return C075Grant{},ErrC075Denied}
 var scope,tenant,domain,jurisdiction,principal,capability string
 if s.DB.QueryRowContext(ctx,"SELECT scope,tenant,domain,jurisdiction,principal,capability FROM public.c075_identity()").Scan(&scope,&tenant,&domain,&jurisdiction,&principal,&capability)!=nil||scope!=s.PublicationScope||(C064AuthorScope{tenant,domain,jurisdiction})!=s.Scope||principal!=grant.PrincipalID||capability!=roleCap{return C075Grant{},ErrC075Denied}
 fresh,e:=s.Authority.VerifyPrivacyGrant(ctx,token);if e!=nil||fresh!=grant{return C075Grant{},ErrC075Denied};return grant,nil
}
func(s *C075Store)execute(ctx context.Context,token,cap string,ref C075Ref)(int64,error){
 bounded,cancel:=context.WithTimeout(ctx,2*time.Second);defer cancel()
 grant,e:=s.authorize(bounded,token,cap,ref);if e!=nil{return 0,ErrC075Denied}
 tx,e:=s.DB.BeginTx(bounded,nil);if e!=nil{return 0,ErrC075Denied};defer tx.Rollback()
 if _,e=tx.ExecContext(bounded,"SET LOCAL lock_timeout='250ms'");e!=nil{return 0,ErrC075Denied}
 var n int64
 switch cap{
 case "purge":e=tx.QueryRowContext(bounded,"SELECT public.c075_purge($1,$2,$3)",grant.PrincipalID,ref.Kind,ref.ID).Scan(&n)
 case "retire":if ref.Kind!="DRAFT"||grant.ExpectedRevision==0||grant.ExpectedRevision>9223372036854775807{return 0,ErrC075Denied};e=tx.QueryRowContext(bounded,"SELECT public.c075_retire($1,$2,$3)",grant.PrincipalID,ref.ID,grant.ExpectedRevision).Scan(&n)
 case "hold","release":if !c064ID.MatchString(grant.CaseID)||grant.ExpectedRevision>1{return 0,ErrC075Denied};e=tx.QueryRowContext(bounded,"SELECT public.c075_hold($1,$2,$3,$4,$5,$6)",grant.PrincipalID,ref.Kind,ref.ID,grant.CaseID,grant.ExpectedRevision,cap=="release").Scan(&n)
 default:return 0,ErrC075Denied
 }
 if e!=nil||n<1||bounded.Err()!=nil{return 0,ErrC075Denied}
 fresh,e:=s.Authority.VerifyPrivacyGrant(bounded,token);if e!=nil||fresh!=grant||!time.Now().Before(grant.ExpiresAt){return 0,ErrC075Denied}
 if tx.Commit()!=nil{return 0,ErrC075Denied};return n,nil
}
func(s *C075Store)Purge(ctx context.Context,token string,ref C075Ref)(int64,error){if ctx==nil{return 0,ErrC075Denied};return s.execute(ctx,token,"purge",ref)}
func(s *C075Store)Hold(ctx context.Context,token string,ref C075Ref)(int64,error){if ctx==nil{return 0,ErrC075Denied};return s.execute(ctx,token,"hold",ref)}
func(s *C075Store)Release(ctx context.Context,token string,ref C075Ref)(int64,error){if ctx==nil{return 0,ErrC075Denied};return s.execute(ctx,token,"release",ref)}
func(s *C075Store)Retire(ctx context.Context,token string,ref C075Ref)(int64,error){if ctx==nil{return 0,ErrC075Denied};return s.execute(ctx,token,"retire",ref)}
func(s *C075Store)Due(ctx context.Context,token string)([]C075Ref,error){
 if ctx==nil{return nil,ErrC075Denied};bounded,cancel:=context.WithTimeout(ctx,2*time.Second);defer cancel()
 grant,e:=s.authorize(bounded,token,"scan",C075Ref{"JOB","retention-scan"});if e!=nil{return nil,e}
 rows,e:=s.DB.QueryContext(bounded,"SELECT kind,ref FROM public.c075_due($1,32)",grant.PrincipalID);if e!=nil{return nil,ErrC075Denied};defer rows.Close()
 var refs []C075Ref;for rows.Next(){var ref C075Ref;if rows.Scan(&ref.Kind,&ref.ID)!=nil||!c075Ref(ref,false)||len(refs)>=32{return nil,ErrC075Denied};refs=append(refs,ref)}
 if rows.Err()!=nil{return nil,ErrC075Denied};fresh,e:=s.Authority.VerifyPrivacyGrant(bounded,token);if e!=nil||fresh!=grant||bounded.Err()!=nil||!time.Now().Before(grant.ExpiresAt){return nil,ErrC075Denied};return refs,nil
}
type C075RecordGrantTokens interface{TokenForPrivacyRef(context.Context,C075Ref)(string,error)}
func(s *C075Store)RunRetention(ctx context.Context,scanToken string,tokens C075RecordGrantTokens)(int,error){
 if tokens==nil{return 0,ErrC075Denied};refs,e:=s.Due(ctx,scanToken);if e!=nil{return 0,e};completed:=0
 for _,ref:=range refs{token,e:=tokens.TokenForPrivacyRef(ctx,ref);if e!=nil{return completed,ErrC075Denied};if _,e=s.Purge(ctx,token,ref);e!=nil{return completed,e};completed++};return completed,nil
}

func OpenC075ManagedPrivacy(ctx context.Context,p *C073Client,authority C075GrantAuthority)(*C075Store,error){
 if p==nil||authority==nil||p.config.Environment!="production"{return nil,ErrC075Denied}
 credentials,e:=p.read(ctx,"database-credential");if e!=nil{return nil,ErrC075Denied}
 db,e:=OpenPostgreSQLPublicationStore(credentials.DatabaseDSN);if e!=nil{return nil,ErrC075Denied}
 closeFail:=func()(*C075Store,error){db.DB.Close();return nil,ErrC075Denied}
 probe,cancel:=context.WithTimeout(ctx,2*time.Second);defer cancel();var tls bool;var scope,tenant,domain,jurisdiction string
 if db.DB.QueryRowContext(probe,"SELECT ssl FROM pg_stat_ssl WHERE pid=pg_backend_pid()").Scan(&tls)!=nil||!tls||db.DB.QueryRowContext(probe,"SELECT scope,tenant,domain,jurisdiction FROM public.c075_identity()").Scan(&scope,&tenant,&domain,&jurisdiction)!=nil||(C064AuthorScope{tenant,domain,jurisdiction})!=p.config.Scope||scope!=controlScope("production",domain,jurisdiction){return closeFail()}
 scripts:=[]string{PublicationSchemaSQL,C064AuthorSchemaSQL,C065ReviewSchemaSQL,C067AuditSchemaSQL,c071HardeningSQL,c072DurableSQL,c074CapacitySQL,c075PrivacySQL}
 var count int;if db.DB.QueryRowContext(probe,"SELECT count(*) FROM public.compliance_schema_migrations").Scan(&count)!=nil||count!=len(scripts){return closeFail()}
 for i,script:=range scripts{var hash string;if db.DB.QueryRowContext(probe,"SELECT checksum FROM public.compliance_schema_migrations WHERE version=$1",i+1).Scan(&hash)!=nil||hash!=Digest([]byte(script)){return closeFail()}}
 return &C075Store{DB:db.DB,Scope:p.config.Scope,PublicationScope:scope,Authority:authority,Identity:p},nil
}

// Retention guard adds record/case purpose enforcement to the existing redacted
// auditor pipeline. Original source bytes remain under their canonical owner.
type C075EvidenceMapping interface{PrivacyRef(context.Context,C064AuthorScope,string,string)(C075Ref,error)}
type C075AuditorRepository struct{DB *sql.DB;Scope C064AuthorScope;PublicationScope string;Mapping C075EvidenceMapping;Repository C067EvidenceRepository}
func(r C075AuditorRepository)Inspect(context.Context,C064AuthorScope,string,string)(C067EvidenceItem,error){return C067EvidenceItem{},ErrC075Denied}
func(r C075AuditorRepository)CheckCase(ctx context.Context,a C067AuditorSession,source,evidence,purpose string)error{
 if r.DB==nil||r.Mapping==nil||r.Repository==nil||ctx==nil||ctx.Err()!=nil||a.Scope!=r.Scope||a.Revoked||a.Role!="auditor"||!time.Now().Before(a.ExpiresAt)||!c064ID.MatchString(a.CaseID)||purpose!="LEGAL_AUDIT"&&purpose!="INCIDENT_REVIEW"&&purpose!="SOURCE_VERIFICATION"{return ErrC075Denied}
 ref,e:=r.Mapping.PrivacyRef(ctx,a.Scope,source,evidence);if e!=nil||!c075Ref(ref,false){return ErrC075Denied}
 var denied bool
 e=r.DB.QueryRowContext(ctx,`WITH policy AS (
 SELECT * FROM public.compliance_retention_policies WHERE scope=$1 AND kind=$2 ORDER BY version DESC LIMIT 1
 ), clock AS (
 SELECT retired_at due FROM public.compliance_privacy_retired WHERE scope=$1 AND ref=$3 AND $2='DRAFT'
 UNION ALL SELECT closed_at FROM public.compliance_privacy_terminal WHERE scope=$1 AND kind=$2 AND ref=$3
 ) SELECT pg_is_in_recovery()
 OR NOT EXISTS(SELECT 1 FROM policy WHERE NOT revoked AND valid_until>clock_timestamp())
 OR EXISTS(SELECT 1 FROM public.compliance_privacy_receipts WHERE scope=$1 AND kind=$2 AND ref=$3)
 OR EXISTS(SELECT 1 FROM public.compliance_legal_holds WHERE scope=$1 AND revision=1 AND ((kind=$2 AND ref=$3) OR kind='ALL') AND (case_id<>$4 OR $5='SOURCE_VERIFICATION'))
 OR NOT EXISTS(SELECT 1 FROM public.compliance_database_bindings WHERE role_name=current_user AND tenant=$6 AND domain=$7 AND jurisdiction=$8 AND publication_scope=$1)
 OR NOT (
  ($2='DRAFT' AND EXISTS(SELECT 1 FROM public.compliance_author_heads WHERE tenant=$6 AND domain=$7 AND jurisdiction=$8 AND draft_id=$3))
  OR ($2='AUDIT' AND EXISTS(SELECT 1 FROM public.compliance_auditor_access WHERE tenant=$6 AND domain=$7 AND jurisdiction=$8 AND id::text=$3))
  OR ($2='JOB' AND EXISTS(SELECT 1 FROM public.compliance_durable_jobs WHERE scope=$1 AND id=$3))
 )
 OR (EXISTS(SELECT 1 FROM clock c,policy p WHERE c.due+p.retain_days*interval '24 hours'<=clock_timestamp())
 AND NOT EXISTS(SELECT 1 FROM public.compliance_legal_holds WHERE scope=$1 AND revision=1 AND ((kind=$2 AND ref=$3) OR kind='ALL') AND case_id=$4 AND $5<>'SOURCE_VERIFICATION'))`,r.PublicationScope,ref.Kind,ref.ID,a.CaseID,purpose,a.Scope.Tenant,a.Scope.Domain,a.Scope.Jurisdiction).Scan(&denied)
 if e!=nil||denied{return ErrC075Denied};return nil
}
func(r C075AuditorRepository)InspectForCase(ctx context.Context,a C067AuditorSession,source,evidence,purpose string)(C067EvidenceItem,error){
 if r.CheckCase(ctx,a,source,evidence,purpose)!=nil{return C067EvidenceItem{},ErrC075Denied}
 item,e:=r.Repository.Inspect(ctx,a.Scope,source,evidence);if e!=nil||r.CheckCase(ctx,a,source,evidence,purpose)!=nil{return C067EvidenceItem{},ErrC075Denied};return item,nil
}
func(r C075AuditorRepository)RevalidateCase(ctx context.Context,a C067AuditorSession,source,evidence,purpose string)error{return r.CheckCase(ctx,a,source,evidence,purpose)}
func NewC075AuditorService(authority C067AuditorAuthority,repository C075AuditorRepository,log C067AccessLog)(C067AuditorService,error){
 if authority==nil||log==nil||repository.DB==nil||repository.Mapping==nil||repository.Repository==nil||!c051Scope(repository.Scope.Tenant)||repository.PublicationScope!=controlScope("production",repository.Scope.Domain,repository.Scope.Jurisdiction){return C067AuditorService{},ErrC075Denied}
 return C067AuditorService{Authority:authority,Repository:repository,Log:log},nil
}

package complianceauth

import (
 "context"
 "database/sql"
 "errors"
 "net/url"
 "os"
 "strconv"
 "strings"
 "time"
)

// ProductionPublicationRuntime is the only supported production wiring entry point.
// The database is authoritative on each read, never a local memory fallback.
type ProductionPublicationRuntime struct {
 Store *PostgreSQLPublicationStore
 Cache *PublicationCache
 Durable *C072Store
 Publisher IndependentPublicationAuthority
}
type IndependentPublicationAuthority interface{
 VerifyPublication(context.Context,PublicationFence,PublicationFence)error
}
func ValidProductionDSN(raw string)error{
 u,err:=url.Parse(raw)
 if err!=nil||u.Scheme!="postgres"&&u.Scheme!="postgresql"||u.Hostname()==""||u.User==nil{return ErrPublicationStale}
 password,ok:=u.User.Password()
 if !ok||password==""||u.Query().Get("sslmode")!="verify-full"||u.Query().Get("sslrootcert")==""||u.Query().Get("connect_timeout")==""||
 strings.ContainsAny(raw,"\n\r") {return ErrPublicationStale}
 if u.User.Username()==""||len(raw)>8192||len(password)>4096||strings.ContainsAny(password,"\x00\r\n")||strings.ContainsAny(u.Hostname(),",%\\"){return ErrPublicationStale}
 query,err:=url.ParseQuery(u.RawQuery);if err!=nil{return ErrPublicationStale}
 allowed:=map[string]bool{"sslmode":true,"sslrootcert":true,"connect_timeout":true,"application_name":true,"sslcert":true,"sslkey":true,"target_session_attrs":true}
 for key,values:=range query{if !allowed[key]||len(values)!=1{return ErrPublicationStale}}
 seconds,err:=strconv.Atoi(query.Get("connect_timeout"));if err!=nil||seconds<1||seconds>10{return ErrPublicationStale}
 if mode:=query.Get("target_session_attrs");mode!=""&&mode!="read-write"{return ErrPublicationStale}
 if name:=query.Get("application_name");name!=""&&!c051Scope(name){return ErrPublicationStale}
 root,err:=os.Stat(query.Get("sslrootcert"));if err!=nil||!root.Mode().IsRegular(){return ErrPublicationStale}
 if (query.Get("sslcert")=="")!=(query.Get("sslkey")==""){return ErrPublicationStale}
 for _,name:=range []string{"sslcert","sslkey"}{if path:=query.Get(name);path!=""{f,e:=os.Stat(path);if e!=nil||!f.Mode().IsRegular()||(name=="sslkey"&&f.Mode().Perm()&0077!=0){return ErrPublicationStale}}}
 return nil
}
func OpenProductionPublicationRuntime(ctx context.Context,dsn string,authority IndependentPublicationAuthority)(*ProductionPublicationRuntime,error){
 if ctx==nil||ctx.Err()!=nil||authority==nil||ValidProductionDSN(dsn)!=nil{return nil,ErrPublicationStale}
 store,err:=OpenPostgreSQLPublicationStore(dsn)
 if err!=nil{return nil,ErrPublicationStale}
 probe,stop:=context.WithTimeout(ctx,5*time.Second);defer stop()
 if err=store.DB.PingContext(probe);err!=nil{store.DB.Close();return nil,ErrPublicationStale}
 var recovery bool
 if err=store.DB.QueryRowContext(probe,"SELECT NOT pg_is_in_recovery()").Scan(&recovery);err!=nil||!recovery{store.DB.Close();return nil,ErrPublicationStale}
 var scope C064AuthorScope
 var publicationScope string
 if store.DB.QueryRowContext(probe,"SELECT tenant,domain,jurisdiction,publication_scope FROM public.compliance_database_bindings WHERE role_name=current_user").Scan(&scope.Tenant,&scope.Domain,&scope.Jurisdiction,&publicationScope)!=nil || c071RuntimeBinding(probe,store.DB,scope,publicationScope)!=nil {store.DB.Close();return nil,ErrPublicationStale}
 return &ProductionPublicationRuntime{Store:store,Cache:&PublicationCache{},Publisher:authority,Durable:&C072Store{DB:store.DB,Scope:scope,PublicationScope:publicationScope}},nil
}
func(rt *ProductionPublicationRuntime) Close()error{
 if rt==nil||rt.Store==nil||rt.Store.DB==nil{return nil}
 return rt.Store.DB.Close()
}
func(rt *ProductionPublicationRuntime) Current(ctx context.Context,expected PublicationFence,now time.Time)(PublicationFence,error){
 if rt==nil||rt.Store==nil||rt.Cache==nil{return PublicationFence{},ErrPublicationStale}
 if rt.Durable!=nil{p,err:=rt.Durable.Load(ctx,expected.Scope);if err!=nil||p!=expected||!ValidPublicationFence(p,now){return PublicationFence{},ErrPublicationStale};return p,nil}
 return rt.Cache.ReadCurrent(ctx,rt.Store,expected,now)
}
func(rt *ProductionPublicationRuntime) Publish(ctx context.Context,old,next PublicationFence,now time.Time)error{
 if rt==nil||rt.Store==nil||rt.Publisher==nil||ctx==nil||ctx.Err()!=nil{return ErrPublicationStale}
 if rt.Durable!=nil{return ErrPublicationStale} // Production uses durable activation/outbox; no legacy standalone publish.
 if err:=rt.Publisher.VerifyPublication(ctx,old,next);err!=nil{return errors.Join(ErrPublicationStale,err)}
 if err:=AdvancePublication(ctx,rt.Store,old,next,now);err!=nil{return err}
 rt.Cache.Invalidate(next.Scope)
 return nil
}
var _ PublicationStore=(*PostgreSQLPublicationStore)(nil)
var _ = sql.ErrNoRows

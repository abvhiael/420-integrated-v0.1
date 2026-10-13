package complianceauth

import (
 "context"
 "database/sql"
 "errors"
 "net/url"
 "os"
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
 if _,err:=os.Stat(u.Query().Get("sslrootcert"));err!=nil{return ErrPublicationStale}
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

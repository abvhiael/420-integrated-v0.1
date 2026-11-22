package store

import (
 "context"
 "database/sql"
 "encoding/json"
 "errors"
 "fmt"
 "net/url"
 "strings"
 "time"

 _ "github.com/lib/pq"
)

const postgresCanonicalTable420 = "idx_go_canonical_state_v1"

// NewPostgresStore implements the same canonical bundle, rollback and finality
// invariants as the file backend. Every mutation is one PostgreSQL JSONB update
// with an optimistic-version compare; no uncheckpointed half-bundle can leak
// across crashes. Two competing writers fail closed until the loser reopens.
func NewPostgresStore(dsn string) (*FileStore,error) {
 parsed,err:=url.Parse(dsn)
 if err!=nil || parsed==nil || (parsed.Scheme!="postgres" && parsed.Scheme!="postgresql") {
  return nil,errors.New("PostgreSQL Indexer requires a valid postgres:// DSN")
 }
 host:=strings.ToLower(parsed.Hostname())
 local:=host=="127.0.0.1" || host=="localhost" || host=="::1"
 if !local && parsed.Query().Get("sslmode")!="verify-full" {
  return nil,errors.New("remote Indexer PostgreSQL requires sslmode=verify-full")
 }
 db,err:=sql.Open("postgres",dsn)
 if err!=nil{return nil,err}
 fail:=func(err error)(*FileStore,error){db.Close();return nil,err}
 db.SetMaxOpenConns(2)
 ctx,cancel:=context.WithTimeout(context.Background(),12*time.Second)
 defer cancel()
 if err:=db.PingContext(ctx);err!=nil{return fail(fmt.Errorf("connect canonical PostgreSQL index: %w",err))}
 _,err=db.ExecContext(ctx,`CREATE TABLE IF NOT EXISTS idx_go_canonical_state_v1 (
   singleton smallint PRIMARY KEY CHECK(singleton = 1),
   mutation_version bigint NOT NULL CHECK(mutation_version >= 0),
   snapshot jsonb NOT NULL,
   updated_at timestamptz NOT NULL DEFAULT now()
 )`)
 if err!=nil{return fail(fmt.Errorf("create canonical PostgreSQL index: %w",err))}
 initial,err:=json.Marshal(emptyFileState())
 if err!=nil{return fail(err)}
 _,err=db.ExecContext(ctx,`INSERT INTO idx_go_canonical_state_v1(singleton,mutation_version,snapshot)
 VALUES(1,0,$1::jsonb) ON CONFLICT(singleton) DO NOTHING`,string(initial))
 if err!=nil{return fail(fmt.Errorf("initialize canonical PostgreSQL index: %w",err))}
 var version int64
 var stateBytes []byte
 err=db.QueryRowContext(ctx,`SELECT mutation_version,snapshot FROM idx_go_canonical_state_v1 WHERE singleton=1`).Scan(&version,&stateBytes)
 if err!=nil{return fail(fmt.Errorf("read canonical PostgreSQL snapshot: %w",err))}
 s:=&FileStore{data:fileState{}}
 if err:=json.Unmarshal(stateBytes,&s.data);err!=nil{
  return fail(fmt.Errorf("decode canonical PostgreSQL snapshot: %w",err))
 }
 if err:=s.validateLoadedState();err!=nil{
  return fail(fmt.Errorf("validate canonical PostgreSQL snapshot: %w",err))
 }
 s.persistFn=func(serialized []byte)error{
  ctx,cancel:=context.WithTimeout(context.Background(),12*time.Second)
  defer cancel()
  result,err:=db.ExecContext(ctx,`UPDATE idx_go_canonical_state_v1
    SET snapshot=$1::jsonb, mutation_version=mutation_version+1, updated_at=now()
    WHERE singleton=1 AND mutation_version=$2`,string(serialized),version)
  if err!=nil{return fmt.Errorf("persist canonical PostgreSQL snapshot: %w",err)}
  affected,err:=result.RowsAffected()
  if err!=nil{return err}
  if affected!=1{
   return errors.New("canonical PostgreSQL checkpoint writer conflict: reopen and reconcile")
  }
  version++
  return nil
 }
 s.closeFn=db.Close
 return s,nil
}

package main

import (
 "net/url"
 "testing"
)

func TestPostgresPoolerProtocol(t *testing.T) {
 for _,host:=range []string{"db.example.org","db-pooler.example.org"} {
  raw:="postgresql://runtime:secret@"+host+"/social?sslmode=verify-full&connect_timeout=5"
  dsn,err:=postgresConnectionURL(raw)
  if err!=nil {t.Fatal(err)}
  u,err:=url.Parse(dsn)
  if err!=nil || u.Hostname()!=host || u.Query().Get("binary_parameters")!="yes" || u.Query().Get("sslmode")!="verify-full" || u.Query().Get("connect_timeout")!="5" {t.Fatal("pooler protocol or TLS settings not preserved")}
 }
 for _,q:=range []string{"sslmode=require","sslmode=verify-full&binary_parameters=no","sslmode=verify-full&sslmode=disable","sslmode=verify-full&options=-c"} {
  if _,err:=postgresConnectionURL("postgres://runtime:secret@db.example.org/social?"+q);err==nil {t.Fatal("unsafe or unapproved input accepted",q)}
 }
}

package service

import (
 "context"
 "errors"
 "path/filepath"
 "testing"
 "time"
 "github.com/420integrated/420-integrated/location/model"
 "github.com/420integrated/420-integrated/location/repository"
)

type publicationAuth struct{allowed bool}
func(a publicationAuth)AuthorizePlacePublication(_ context.Context,operator,id string)error{if !a.allowed||operator!="trusted"||id==""{return errors.New("denied")};return nil}
func TestPublicationPlaceWriterFailClosed(t *testing.T){
 ctx:=context.Background();store,err:=repository.OpenFileStore(filepath.Join(t.TempDir(),"places.json"));if err!=nil{t.Fatal(err)}
 if _,err:=NewPublicationWriter(store,nil,time.Now);err==nil{t.Fatal("nil authority accepted")}
 now:=time.Date(2026,9,21,1,0,0,0,time.UTC)
 clock:=func()time.Time{return now.Add(time.Minute)}
 denied,_:=NewPublicationWriter(store,publicationAuth{},clock)
 p:=model.Place{ID:"place-1",Name:"Test venue",Category:model.CategoryVenue,Visibility:model.VisibilityPrivate,Precision:model.PrecisionPrivate,Source:"verified-source",Owner:model.SubjectRef{Type:"operator",ID:"existing-owner"},Version:1,CreatedAt:now,UpdatedAt:now}
 if _,err:=denied.Create(ctx,"trusted",p);err==nil{t.Fatal("unauthorized place created")}
 writer,_:=NewPublicationWriter(store,publicationAuth{true},clock)
 if _,err:=writer.Create(ctx,"trusted",p);err!=nil{t.Fatal(err)}
 pub:=p;pub.Version=2;pub.Visibility=model.VisibilityPublic;pub.Precision=model.PrecisionApproximate;pub.UpdatedAt=clock()
 pub.Owner.ID="hijack"
 if _,err:=writer.ApproveVisible(ctx,"trusted",pub,1);err==nil{t.Fatal("publisher stole ownership")}
 pub.Owner=p.Owner
 if _,err:=writer.ApproveVisible(ctx,"spoofed",pub,1);err==nil{t.Fatal("spoofed publisher accepted")}
 if _,err:=writer.ApproveVisible(ctx,"trusted",pub,42);err==nil{t.Fatal("stale version accepted")}
 if _,err:=writer.ApproveVisible(ctx,"trusted",pub,1);err!=nil{t.Fatal(err)}
 withdrawn,err:=writer.Withdraw(ctx,"trusted",p.ID,2);if err!=nil{t.Fatal(err)}
 if withdrawn.Visibility!=model.VisibilityPrivate||withdrawn.Precision!=model.PrecisionPrivate||withdrawn.Version!=3{t.Fatal("withdrawal leaked public place")}
 if _,err:=writer.Withdraw(ctx,"trusted",p.ID,2);err==nil{t.Fatal("stale withdrawal accepted")}
}

package service

import (
 "context"
 "errors"
 "time"

 "github.com/420integrated/420-integrated/location/model"
)

// PublicationPlaceRepository uses existing canonical validation/versioning.
// These operations must never be exposed through the public GEN-SVC-2 API.
type PublicationPlaceRepository interface {
 Create(model.Place)(model.Place,error)
 Get(string)(model.Place,error)
 Update(model.Place,uint32)(model.Place,error)
}

// PublicationAuthorizer authenticates the operator independently of the place
// payload. It must reject external source labels as proof of authority.
type PublicationAuthorizer interface {
 AuthorizePlacePublication(context.Context,string,string)error
}

type PublicationWriter struct {store PublicationPlaceRepository;authority PublicationAuthorizer;clock func()time.Time}
func NewPublicationWriter(store PublicationPlaceRepository,authority PublicationAuthorizer,clock func()time.Time)(*PublicationWriter,error){
 if store==nil||authority==nil||clock==nil{return nil,errors.New("place publication dependencies required")}
 return &PublicationWriter{store:store,authority:authority,clock:clock},nil
}
func(w *PublicationWriter) Create(ctx context.Context,operator string,p model.Place)(model.Place,error){
 if w==nil{return model.Place{},errors.New("place writer unavailable")}
 if err:=w.authority.AuthorizePlacePublication(ctx,operator,p.ID);err!=nil{return model.Place{},err}
 if p.Visibility!=model.VisibilityPrivate{return model.Place{},errors.New("new imported places must begin private")}
 if err:=p.Validate();err!=nil{return model.Place{},err}
 return w.store.Create(p)
}
// ApproveVisible is the only publisher-facing path that changes the visibility
// of an imported place. The caller must independently bind an approval digest.
func(w *PublicationWriter) ApproveVisible(ctx context.Context,operator string,p model.Place,expected uint32)(model.Place,error){
 if w==nil{return model.Place{},errors.New("place writer unavailable")}
 if err:=w.authority.AuthorizePlacePublication(ctx,operator,p.ID);err!=nil{return model.Place{},err}
 if p.Visibility!=model.VisibilityPublic||p.Precision==model.PrecisionPrivate{return model.Place{},errors.New("invalid public place projection")}
 current,err:=w.store.Get(p.ID);if err!=nil{return model.Place{},err}
 if current.Version!=expected||p.Version!=expected+1{return model.Place{},errors.New("place version conflict")}
 if p.Owner!=current.Owner||p.RegistryRecordID!=current.RegistryRecordID||p.OrganizationID!=current.OrganizationID{return model.Place{},errors.New("publisher cannot grant owner or registry identity")}
 return w.store.Update(p,expected)
}
func(w *PublicationWriter) Withdraw(ctx context.Context,operator,id string,expected uint32)(model.Place,error){
 if w==nil{return model.Place{},errors.New("place writer unavailable")}
 if err:=w.authority.AuthorizePlacePublication(ctx,operator,id);err!=nil{return model.Place{},err}
 current,err:=w.store.Get(id);if err!=nil{return model.Place{},err}
 if current.Version!=expected{return model.Place{},errors.New("place version conflict")}
 current.Visibility=model.VisibilityPrivate
 current.Precision=model.PrecisionPrivate
 current.Version++
 now:=w.clock().UTC();if !now.After(current.UpdatedAt){now=current.UpdatedAt.Add(time.Nanosecond)}
 current.UpdatedAt=now
 return w.store.Update(current,expected)
}

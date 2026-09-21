package service

import "github.com/420integrated/420-integrated/location/model"

// ReadCanonical is a private in-process recovery probe, not an HTTP route.
// Callers must authenticate and authorize themselves before using it to make
// any publication decision. No public route may serialize its raw result.
func (w *PublicationWriter) ReadCanonical(id string)(model.Place,error){
 if w==nil||w.store==nil{return model.Place{},ErrPublicationWriterUnavailable}
 return w.store.Get(id)
}

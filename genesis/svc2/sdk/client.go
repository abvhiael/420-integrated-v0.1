// Package sdk provides a typed read-only HTTP client for GEN-SVC-2 v1.
package sdk

import (
 "context"
 "encoding/json"
 "errors"
 "fmt"
 "io"
 "net/http"
 "net/url"
 "strconv"
 "strings"
 "time"

 eventuikit "github.com/420integrated/420-integrated/events/uikit"
 locationuikit "github.com/420integrated/420-integrated/location/uikit"
)

const Version = "v1"
const maxResponseBytes = 2 << 20

type Client struct { BaseURL string; HTTP *http.Client }
type envelope[T any] struct { Version string `json:"version"`; Data T `json:"data"` }
type APIError struct { Status int; Message string }
func(e *APIError)Error()string{return fmt.Sprintf("GEN-SVC-2 API %d: %s",e.Status,e.Message)}

func(c Client)get(ctx context.Context,path string,target any)error{
 base,err:=url.Parse(c.BaseURL);if err!=nil||base==nil||base.Scheme==""||base.Host==""||base.User!=nil||base.RawQuery!=""||base.Fragment!="" {return errors.New("invalid GEN-SVC-2 base URL")}
 if base.Scheme!="https"&&base.Scheme!="http" {return errors.New("unsupported GEN-SVC-2 URL scheme")}
 if strings.HasSuffix(base.Path,"/"){base.Path=strings.TrimSuffix(base.Path,"/")}
 endpoint,err:=url.Parse(path);if err!=nil{return err}
 base.Path+=endpoint.Path;base.RawQuery=endpoint.RawQuery
 request,err:=http.NewRequestWithContext(ctx,http.MethodGet,base.String(),nil);if err!=nil{return err}
 request.Header.Set("Accept","application/json")
 transport:=c.HTTP;if transport==nil {transport=http.DefaultClient}
 response,err:=transport.Do(request);if err!=nil{return err};defer response.Body.Close()
 decoder:=json.NewDecoder(io.LimitReader(response.Body,maxResponseBytes+1))
 if response.StatusCode!=http.StatusOK {
  var failure struct { Error string `json:"error"` };_ = decoder.Decode(&failure)
  return &APIError{Status:response.StatusCode,Message:failure.Error}
 }
 if !strings.HasPrefix(response.Header.Get("Content-Type"),"application/json") {return errors.New("unexpected GEN-SVC-2 response content type")}
 if response.ContentLength>maxResponseBytes {return errors.New("GEN-SVC-2 response too large")}
 if err:=decoder.Decode(target);err!=nil{return fmt.Errorf("decode GEN-SVC-2 response: %w",err)}
 if decoder.More(){return errors.New("unexpected trailing GEN-SVC-2 response")}
 return nil
}

func(c Client)Places(ctx context.Context)(locationuikit.View,error){
 var result envelope[locationuikit.View]
 if err:=c.get(ctx,"/v1/places",&result);err!=nil{return locationuikit.View{},err}
 if result.Version!=Version{return locationuikit.View{},errors.New("unsupported GEN-SVC-2 API version")}
 return result.Data,nil
}

type EventQuery struct { From,To time.Time; Limit,Offset int; PlaceID string }
func(c Client)Events(ctx context.Context,q EventQuery)(eventuikit.View,error){
 if q.From.IsZero()||q.To.IsZero()||q.To.Before(q.From)||q.To.Sub(q.From)>366*24*time.Hour {return eventuikit.View{},errors.New("invalid events time window")}
 if q.Limit<1||q.Limit>100||q.Offset<0 {return eventuikit.View{},errors.New("invalid events pagination")}
 values:=url.Values{"from":{q.From.Format(time.RFC3339)},"to":{q.To.Format(time.RFC3339)},"limit":{strconv.Itoa(q.Limit)},"offset":{strconv.Itoa(q.Offset)}}
 if q.PlaceID!=""{values.Set("placeId",q.PlaceID)}
 var result envelope[eventuikit.View]
 if err:=c.get(ctx,"/v1/events?"+values.Encode(),&result);err!=nil{return eventuikit.View{},err}
 if result.Version!=Version{return eventuikit.View{},errors.New("unsupported GEN-SVC-2 API version")}
 return result.Data,nil
}

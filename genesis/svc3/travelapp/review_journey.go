package travelapp

import (
 "context"
 "html/template"
 "net/http"
 "time"

 "github.com/420integrated/420-integrated/reputation/model"
)

// TravelReviewReader must use the authoritative 420Reputation service, apply
// its current moderation/publication rules and independently revalidate the
// interaction proof. It must not trust a browser-supplied verification flag.
// Default public Handler() does not configure or expose this journey.
type TravelReviewReader interface {
 PublicTravelReviews(context.Context,string)([]model.Review,error)
 VerifiedInteraction(context.Context,model.Review)(bool,error)
}

type publicReviewCard struct { Rating uint8; OccurredAt time.Time }
type publicReviewPage struct { PlaceID string; PlaceName string; Cards []publicReviewCard; Message string }
var publicReviewsTemplate=template.Must(template.New("travelReviews").Parse(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Travel reviews | 420Travel</title></head><body><nav><a href="/travel">Travel</a> · <a href="/travel/place/{{.PlaceID}}">Place</a></nav><main><h1>Verified travel reviews for {{.PlaceName}}</h1><p>Verification refers to independently confirmed interaction evidence, not endorsement or a guarantee about the venue.</p>{{if .Message}}<p role="status">{{.Message}}</p>{{end}}{{range .Cards}}<article><h2>Rating: {{.Rating}} / 5</h2><p>Verified interaction</p><p><time datetime="{{.OccurredAt.Format "2006-01-02T15:04:05Z07:00"}}">{{.OccurredAt.Format "2 Jan 2006"}}</time></p></article>{{end}}</main></body></html>`))

func renderPublicReviews(w http.ResponseWriter,status int,page publicReviewPage){
 w.Header().Set("Content-Type","text/html; charset=utf-8")
 w.Header().Set("Cache-Control","no-store")
 w.Header().Set("X-Content-Type-Options","nosniff")
 w.WriteHeader(status);_=publicReviewsTemplate.Execute(w,page)
}

// HandlerWithReviewReader exposes the actual place -> verified review link
// only when a trusted review adapter is injected; otherwise it preserves the
// default public page without a broken/false review affordance.
func HandlerWithReviewReader(reader PublicReader,reviews TravelReviewReader)http.Handler {
 base:=HandlerWithReader(reader)
 if reviews==nil{return base}
 mux:=http.NewServeMux()
 mux.HandleFunc("GET /travel/place/{place_id}",func(w http.ResponseWriter,r *http.Request){servePublicPlaceWithReviews(w,r,reader,true)})
 mux.HandleFunc("/travel/place/{place_id}/reviews",func(w http.ResponseWriter,r *http.Request){ServePublicTravelReviews(w,r,reader,reviews)})
 mux.Handle("/",base)
 return mux
}

// ServePublicTravelReviews never looks up canonical/private places and never
// claims verification without an independently trusted provenance verdict.
func ServePublicTravelReviews(w http.ResponseWriter,r *http.Request,reader PublicReader,reviews TravelReviewReader){
 if r.Method!=http.MethodGet {w.Header().Set("Allow","GET");http.Error(w,"method not allowed",http.StatusMethodNotAllowed);return}
 id:=r.PathValue("place_id")
 if !validPlaceID(id) {http.NotFound(w,r);return}
 if reader==nil||reviews==nil {renderPublicReviews(w,http.StatusServiceUnavailable,publicReviewPage{Message:"Verified travel reviews are not connected"});return}
 feed,err:=publicJourneyFeed(r,reader)
 if err!=nil {renderPublicReviews(w,http.StatusBadGateway,publicReviewPage{Message:"Public places are temporarily unavailable"});return}
 page:=publicReviewPage{PlaceID:id}
 found:=false
 for _,v:=range feed.Travel {if v.Place.ID==id {page.PlaceName=v.Place.Name;found=true;break}}
 if !found {http.NotFound(w,r);return}
 ctx,cancel:=context.WithTimeout(r.Context(),5*time.Second);defer cancel()
 list,err:=reviews.PublicTravelReviews(ctx,id)
 if err!=nil||len(list)>100 {renderPublicReviews(w,http.StatusBadGateway,publicReviewPage{PlaceID:id,Message:"Verified travel reviews are temporarily unavailable"});return}
 for _,review:=range list {
  if review.Status!=model.ReviewActive||review.Domain!=model.DomainTravel||review.Subject.Type!="PLACE"||review.Subject.ID!=id||review.Verification!=model.VerificationVerified {continue}
  if err:=review.Validate();err!=nil {renderPublicReviews(w,http.StatusBadGateway,publicReviewPage{PlaceID:id,Message:"Verified travel reviews are temporarily unavailable"});return}
  ok,err:=reviews.VerifiedInteraction(ctx,review)
  if err!=nil {renderPublicReviews(w,http.StatusBadGateway,publicReviewPage{PlaceID:id,Message:"Verified travel reviews are temporarily unavailable"});return}
  if ok {page.Cards=append(page.Cards,publicReviewCard{Rating:review.Rating,OccurredAt:review.VerifiedOccurredAt})}
 }
 if len(page.Cards)==0 {page.Message="No currently verified public travel reviews are available"}
 renderPublicReviews(w,http.StatusOK,page)
}

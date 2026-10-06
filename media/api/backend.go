package api

import "context"

type Backend interface {
	ListAssets(context.Context, string, int) (Page[Asset], error)
	GetAsset(context.Context, string) (Asset, error)
	PrepareUpload(context.Context, PrepareUploadRequest, string) (UploadPlan, error)

	CreateLivestream(context.Context, CreateLivestreamRequest, string) (Livestream, error)
	GetLivestream(context.Context, string, string) (Livestream, error)
	StartLivestream(context.Context, string, LivestreamActionRequest, string) (Livestream, error)
	StopLivestream(context.Context, string, LivestreamActionRequest, string) (Livestream, error)

	Search(context.Context, string, int) (Page[SearchItem], error)
	CreateSubscription(context.Context, CreateSubscriptionRequest, string) (Subscription, error)
	DeleteSubscription(context.Context, string, string) error

	PrepareSigningIntent(context.Context, SigningIntentRequest, string) (SigningIntent, error)
	Capabilities(context.Context) (Capabilities, error)
	Compatibility(context.Context) (Compatibility, error)
}

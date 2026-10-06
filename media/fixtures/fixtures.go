package fixtures

type Persona struct {
	Name   string
	Wallet string
}

var (
	User = Persona{
		Name: "USER",
		Wallet: "0x1000000000000000000000000000000000000001",
	}
	Creator = Persona{
		Name: "CREATOR",
		Wallet: "0x1000000000000000000000000000000000000002",
	}
	Moderator = Persona{
		Name: "MODERATOR",
		Wallet: "0x1000000000000000000000000000000000000003",
	}
)

const (
	JourneyCreatorPublishesMedia      = "SVC-JOURNEY-001"
	JourneyScheduledLivestream        = "SVC-JOURNEY-008"
	JourneyPrivateAbsentFromSearch    = "SVC-JOURNEY-009"
	JourneyProjectionRebuild          = "SVC-JOURNEY-010"

	MediaAssetID = "fixture-media-asset-001"
	StreamID     = "fixture-media-stream-001"
	ReportID     = "fixture-media-report-001"
)

type MediaJourney struct {
	Creator   Persona
	Follower  Persona
	Moderator Persona
	AssetID   string
	StreamID  string
	ReportID  string
	Journeys  []string
}

func CanonicalMediaJourney() MediaJourney {
	return MediaJourney{
		Creator: Creator,
		Follower: User,
		Moderator: Moderator,
		AssetID: MediaAssetID,
		StreamID: StreamID,
		ReportID: ReportID,
		Journeys: []string{
			JourneyCreatorPublishesMedia,
			JourneyScheduledLivestream,
			JourneyPrivateAbsentFromSearch,
			JourneyProjectionRebuild,
		},
	}
}

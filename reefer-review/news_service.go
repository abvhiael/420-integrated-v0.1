package reeferreview

import "context"

type NewsService struct {
	Store   NewsRepository
	Sources NewsSourceRegistry
}

func (s NewsService) validate() error {
	if s.Store == nil {
		return ErrInvalidInput
	}
	if err := ValidateNewsSourceRegistry(s.Sources); err != nil {
		return err
	}
	return nil
}

func (s NewsService) List(ctx context.Context, opts NewsListOptions) (NewsPage, error) {
	if err := s.validate(); err != nil {
		return NewsPage{}, err
	}
	return s.Store.List(ctx, opts)
}

func (s NewsService) Get(ctx context.Context, id string) (ExternalNewsItem, error) {
	if err := s.validate(); err != nil {
		return ExternalNewsItem{}, err
	}
	return s.Store.Get(ctx, id)
}

func (s NewsService) Topics(ctx context.Context) ([]string, error) {
	if err := s.validate(); err != nil {
		return nil, err
	}
	return s.Store.Topics(ctx)
}

func (s NewsService) PublicSources() ([]map[string]any, error) {
	if err := s.validate(); err != nil {
		return nil, err
	}
	return s.Sources.PublicSources(), nil
}

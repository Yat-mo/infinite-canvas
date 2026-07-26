package service

import (
	"net/http"
	"strings"

	"github.com/tigerowo/infinite-canvas/model"
)

// AIProvider is a minimal adapter surface for channel-specific AI proxy behavior.
// Existing handlers can migrate onto this interface incrementally.
type AIProvider interface {
	Name() string
	Match(channel model.ModelChannel, modelName string) bool
	ResolvePath(channel model.ModelChannel, modelName string, path string) string
}

var registeredAIProviders []AIProvider

// RegisterAIProvider appends a provider implementation.
func RegisterAIProvider(provider AIProvider) {
	if provider == nil {
		return
	}
	registeredAIProviders = append(registeredAIProviders, provider)
}

// MatchAIProvider finds the first registered provider for a channel/model pair.
func MatchAIProvider(channel model.ModelChannel, modelName string) AIProvider {
	for _, provider := range registeredAIProviders {
		if provider.Match(channel, modelName) {
			return provider
		}
	}
	return nil
}

// OpenAICompatibleProvider is the default path-passthrough provider.
type OpenAICompatibleProvider struct{}

func (OpenAICompatibleProvider) Name() string { return "openai-compatible" }

func (OpenAICompatibleProvider) Match(channel model.ModelChannel, modelName string) bool {
	_ = channel
	_ = modelName
	return true
}

func (OpenAICompatibleProvider) ResolvePath(channel model.ModelChannel, modelName string, path string) string {
	_ = channel
	_ = modelName
	if strings.TrimSpace(path) == "" {
		return "/"
	}
	if strings.HasPrefix(path, "/") {
		return path
	}
	return "/" + path
}

// DefaultAIHTTPClient returns a channel-aware HTTP client for upstream calls.
func DefaultAIHTTPClient(channel model.ModelChannel) *http.Client {
	return HTTPClientForChannel(channel)
}

func init() {
	RegisterAIProvider(OpenAICompatibleProvider{})
}

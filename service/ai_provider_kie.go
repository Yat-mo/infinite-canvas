package service

import (
	"net/url"
	"strings"

	"github.com/tigerowo/infinite-canvas/model"
)

// KIEProvider maps OpenAI-compatible image/video paths to KIE job APIs.
type KIEProvider struct{}

func (KIEProvider) Name() string { return "kie" }

func (KIEProvider) Match(channel model.ModelChannel, modelName string) bool {
	return IsKIEChannel(channel, modelName)
}

// IsKIEChannel reports whether a channel/model pair targets KIE.
func IsKIEChannel(channel model.ModelChannel, modelName string) bool {
	protocol := strings.ToLower(strings.TrimSpace(channel.Protocol))
	baseURL := strings.ToLower(strings.TrimSpace(channel.BaseURL))
	modelName = strings.ToLower(strings.TrimSpace(modelName))
	return protocol == "kie" ||
		strings.Contains(baseURL, "kie.ai") ||
		strings.Contains(modelName, "kie/")
}

func (KIEProvider) ResolvePath(channel model.ModelChannel, modelName string, path string) string {
	_ = channel
	_ = modelName
	if path == "/videos" || path == "/images/generations" || path == "/images/edits" {
		return "/jobs/createTask"
	}
	if strings.HasPrefix(path, "/videos/") && !strings.HasSuffix(path, "/content") {
		taskID := strings.TrimSpace(strings.TrimPrefix(path, "/videos/"))
		if taskID != "" && !strings.Contains(taskID, "/") {
			return "/jobs/recordInfo?taskId=" + url.QueryEscape(taskID)
		}
	}
	return path
}

func init() {
	// Register before the catch-all OpenAI-compatible provider.
	registeredAIProviders = append([]AIProvider{KIEProvider{}}, registeredAIProviders...)
}

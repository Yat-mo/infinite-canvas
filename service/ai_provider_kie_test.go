package service

import (
	"testing"

	"github.com/tigerowo/infinite-canvas/model"
)

func TestKIEProviderResolvePath(t *testing.T) {
	provider := KIEProvider{}
	channel := model.ModelChannel{Protocol: "kie", BaseURL: "https://api.kie.ai"}
	cases := map[string]string{
		"/videos":                 "/jobs/createTask",
		"/images/generations":     "/jobs/createTask",
		"/images/edits":           "/jobs/createTask",
		"/videos/task-123":        "/jobs/recordInfo?taskId=task-123",
		"/videos/task-123/content": "/videos/task-123/content",
		"/chat/completions":       "/chat/completions",
	}
	for in, want := range cases {
		if got := provider.ResolvePath(channel, "kie/flux", in); got != want {
			t.Fatalf("ResolvePath(%q)=%q want %q", in, got, want)
		}
	}
}

func TestMatchAIProviderPrefersKIE(t *testing.T) {
	channel := model.ModelChannel{Protocol: "kie", BaseURL: "https://api.kie.ai"}
	provider := MatchAIProvider(channel, "flux")
	if provider == nil || provider.Name() != "kie" {
		t.Fatalf("expected kie provider, got %#v", provider)
	}
}

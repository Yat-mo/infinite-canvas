package service

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/tigerowo/infinite-canvas/repository"
)

// CanvasProjectSummary is a lightweight list item without full project_data.
type CanvasProjectSummary struct {
	ID              string `json:"id"`
	Title           string `json:"title"`
	CreatedAt       string `json:"createdAt"`
	UpdatedAt       string `json:"updatedAt"`
	NodeCount       int    `json:"nodeCount"`
	ConnectionCount int    `json:"connectionCount"`
}

type canvasProjectListMeta struct {
	ID          string          `json:"id"`
	Title       string          `json:"title"`
	CreatedAt   string          `json:"createdAt"`
	UpdatedAt   string          `json:"updatedAt"`
	Nodes       json.RawMessage `json:"nodes"`
	Connections json.RawMessage `json:"connections"`
}

// CurrentUserCanvasProjectSummaries returns metadata only for list views.
func CurrentUserCanvasProjectSummaries(ctx context.Context) ([]CanvasProjectSummary, error) {
	user, ok := UserFromContext(ctx)
	if !ok || user.ID == "" {
		return nil, errors.New("请先登录")
	}
	projects, err := repository.ListUserCanvasProjects(user.ID)
	if err != nil {
		return nil, err
	}
	result := make([]CanvasProjectSummary, 0, len(projects))
	for _, project := range projects {
		summary := CanvasProjectSummary{
			ID:        project.ID,
			CreatedAt: project.CreatedAt,
			UpdatedAt: project.UpdatedAt,
			Title:     "未命名画布",
		}
		var meta canvasProjectListMeta
		if strings.TrimSpace(project.ProjectData) != "" && json.Unmarshal([]byte(project.ProjectData), &meta) == nil {
			if strings.TrimSpace(meta.Title) != "" {
				summary.Title = strings.TrimSpace(meta.Title)
			}
			if strings.TrimSpace(meta.ID) != "" {
				summary.ID = strings.TrimSpace(meta.ID)
			}
			if len(meta.Nodes) > 0 {
				var nodes []json.RawMessage
				if json.Unmarshal(meta.Nodes, &nodes) == nil {
					summary.NodeCount = len(nodes)
				}
			}
			if len(meta.Connections) > 0 {
				var connections []json.RawMessage
				if json.Unmarshal(meta.Connections, &connections) == nil {
					summary.ConnectionCount = len(connections)
				}
			}
		}
		result = append(result, summary)
	}
	return result, nil
}

// CurrentUserCanvasProject returns one full project document.
func CurrentUserCanvasProject(ctx context.Context, projectID string) (json.RawMessage, error) {
	user, ok := UserFromContext(ctx)
	if !ok || user.ID == "" {
		return nil, errors.New("请先登录")
	}
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return nil, errors.New("画布项目不存在")
	}
	project, err := repository.GetUserCanvasProject(user.ID, projectID)
	if err != nil {
		return nil, err
	}
	if project.DeletedAt != "" || strings.TrimSpace(project.ProjectData) == "" {
		return nil, errors.New("画布项目不存在")
	}
	return json.RawMessage(project.ProjectData), nil
}

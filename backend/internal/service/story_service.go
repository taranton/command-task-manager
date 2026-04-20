package service

import (
	"context"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/qrt/command/internal/model"
	"github.com/qrt/command/internal/repository"
)

type StoryService struct {
	storyRepo *repository.StoryRepository
}

func NewStoryService(storyRepo *repository.StoryRepository) *StoryService {
	return &StoryService{storyRepo: storyRepo}
}

func (s *StoryService) Create(ctx context.Context, input model.CreateStoryInput, userID uuid.UUID) (*model.Story, error) {
	story := &model.Story{
		Title:       input.Title,
		Description: input.Description,
		Status:      model.StoryStatusBacklog,
		Priority:    input.Priority,
		ProjectID:   input.ProjectID,
		Tags:        input.Tags,
		StartDate:   parseDate(input.StartDate),
		Deadline:    parseDate(input.Deadline),
		CreatedBy:   userID,
	}

	if story.Tags == nil {
		story.Tags = []string{}
	}

	if !story.Priority.IsValid() {
		story.Priority = model.PriorityMedium
	}

	if input.AssignedLead != nil {
		id, err := uuid.Parse(*input.AssignedLead)
		if err == nil {
			story.AssignedLead = &id
		}
	}

	if err := s.storyRepo.Create(ctx, story); err != nil {
		return nil, err
	}
	return story, nil
}

func (s *StoryService) GetByID(ctx context.Context, id uuid.UUID) (*model.Story, error) {
	return s.storyRepo.GetByID(ctx, id)
}

func (s *StoryService) List(ctx context.Context, filter model.StoryFilter) ([]model.Story, int, error) {
	return s.storyRepo.List(ctx, filter)
}

func (s *StoryService) Update(ctx context.Context, id uuid.UUID, input model.UpdateStoryInput) (*model.Story, error) {
	if input.Status != nil && !input.Status.IsValid() {
		return nil, errors.New("invalid story status")
	}
	if input.Priority != nil && !input.Priority.IsValid() {
		return nil, errors.New("invalid priority")
	}
	return s.storyRepo.Update(ctx, id, input)
}

func (s *StoryService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.storyRepo.Delete(ctx, id)
}

func (s *StoryService) Archive(ctx context.Context, id uuid.UUID) error {
	return s.storyRepo.Archive(ctx, id)
}

func (s *StoryService) Unarchive(ctx context.Context, id uuid.UUID, newDeadline *time.Time) error {
	return s.storyRepo.Unarchive(ctx, id, newDeadline)
}

func (s *StoryService) EarliestOngoingStartDate(ctx context.Context, regionID *uuid.UUID) (*time.Time, error) {
	return s.storyRepo.EarliestOngoingStartDate(ctx, regionID)
}

func parseDate(s *string) *time.Time {
	if s == nil || *s == "" {
		return nil
	}
	for _, layout := range []string{"2006-01-02", time.RFC3339, "2006-01-02T15:04:05Z"} {
		if t, err := time.Parse(layout, *s); err == nil {
			return &t
		}
	}
	return nil
}

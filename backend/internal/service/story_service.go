package service

import (
	"context"

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
		Status:      model.StatusBacklog,
		Priority:    input.Priority,
		ProjectID:   input.ProjectID,
		CreatedBy:   userID,
	}

	if !story.Priority.IsValid() {
		story.Priority = model.PriorityMedium
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
		return nil, ErrInvalidCredentials
	}
	if input.Priority != nil && !input.Priority.IsValid() {
		return nil, ErrInvalidCredentials
	}
	return s.storyRepo.Update(ctx, id, input)
}

func (s *StoryService) Delete(ctx context.Context, id uuid.UUID) error {
	return s.storyRepo.Delete(ctx, id)
}

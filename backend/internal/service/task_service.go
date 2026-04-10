package service

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/qrt/command/internal/model"
	"github.com/qrt/command/internal/repository"
)

func parseDate(s *string) *time.Time {
	if s == nil || *s == "" {
		return nil
	}
	// Try multiple formats
	for _, layout := range []string{"2006-01-02", time.RFC3339, "2006-01-02T15:04:05Z"} {
		if t, err := time.Parse(layout, *s); err == nil {
			return &t
		}
	}
	return nil
}

type TaskService struct {
	taskRepo    *repository.TaskRepository
	subtaskRepo *repository.SubtaskRepository
}

func NewTaskService(taskRepo *repository.TaskRepository, subtaskRepo *repository.SubtaskRepository) *TaskService {
	return &TaskService{
		taskRepo:    taskRepo,
		subtaskRepo: subtaskRepo,
	}
}

// Task operations

func (s *TaskService) CreateTask(ctx context.Context, storyID uuid.UUID, input model.CreateTaskInput, userID uuid.UUID) (*model.Task, error) {
	// Get last position for ordering
	lastPos, _ := s.taskRepo.GetLastPosition(ctx, storyID)
	newPos := nextPosition(lastPos)

	task := &model.Task{
		StoryID:     storyID,
		Title:       input.Title,
		Description: input.Description,
		Status:      model.StatusBacklog,
		Priority:    input.Priority,
		AssigneeID:  input.AssigneeID,
		StartDate:   parseDate(input.StartDate),
		Deadline:    parseDate(input.Deadline),
		Position:    newPos,
		CreatedBy:   userID,
	}

	if !task.Priority.IsValid() {
		task.Priority = model.PriorityMedium
	}

	if err := s.taskRepo.Create(ctx, task); err != nil {
		return nil, err
	}

	return s.taskRepo.GetByID(ctx, task.ID)
}

func (s *TaskService) GetTask(ctx context.Context, id uuid.UUID) (*model.Task, error) {
	task, err := s.taskRepo.GetByID(ctx, id)
	if err != nil || task == nil {
		return task, err
	}

	// Load subtasks
	subtasks, err := s.subtaskRepo.ListByTask(ctx, id)
	if err != nil {
		return task, nil // return task without subtasks if error
	}
	task.Subtasks = subtasks
	return task, nil
}

func (s *TaskService) ListByStory(ctx context.Context, storyID uuid.UUID) ([]model.Task, error) {
	return s.taskRepo.ListByStory(ctx, storyID)
}

func (s *TaskService) ListMyTasks(ctx context.Context, userID uuid.UUID) ([]model.Task, error) {
	return s.taskRepo.ListByAssignee(ctx, userID)
}

func (s *TaskService) UpdateTask(ctx context.Context, id uuid.UUID, input model.UpdateTaskInput) (*model.Task, error) {
	return s.taskRepo.Update(ctx, id, input)
}

func (s *TaskService) UpdateTaskStatus(ctx context.Context, id uuid.UUID, status model.Status) error {
	if !status.IsValid() {
		return ErrInvalidCredentials
	}
	return s.taskRepo.UpdateStatus(ctx, id, status)
}

func (s *TaskService) UpdateTaskPosition(ctx context.Context, id uuid.UUID, position string) error {
	return s.taskRepo.UpdatePosition(ctx, id, position)
}

func (s *TaskService) DeleteTask(ctx context.Context, id uuid.UUID) error {
	return s.taskRepo.Delete(ctx, id)
}

// Board

func (s *TaskService) GetBoard(ctx context.Context, filter model.TaskFilter) (*model.Board, error) {
	tasks, err := s.taskRepo.ListForBoard(ctx, filter)
	if err != nil {
		return nil, err
	}

	statusOrder := []model.Status{
		model.StatusBacklog,
		model.StatusTodo,
		model.StatusInProgress,
		model.StatusInReview,
		model.StatusDone,
	}

	tasksByStatus := make(map[model.Status][]model.Task)
	for _, t := range tasks {
		tasksByStatus[t.Status] = append(tasksByStatus[t.Status], t)
	}

	var columns []model.BoardColumn
	for _, status := range statusOrder {
		statusTasks := tasksByStatus[status]
		if statusTasks == nil {
			statusTasks = []model.Task{}
		}
		columns = append(columns, model.BoardColumn{
			Status: status,
			Tasks:  statusTasks,
			Count:  len(statusTasks),
		})
	}

	return &model.Board{Columns: columns}, nil
}

// Subtask operations

func (s *TaskService) CreateSubtask(ctx context.Context, taskID uuid.UUID, input model.CreateSubtaskInput, userID uuid.UUID) (*model.Subtask, error) {
	lastPos, _ := s.subtaskRepo.GetLastPosition(ctx, taskID)
	newPos := nextPosition(lastPos)

	subtask := &model.Subtask{
		TaskID:      taskID,
		Title:       input.Title,
		Description: input.Description,
		Status:      model.StatusBacklog,
		AssigneeID:  input.AssigneeID,
		StartDate:   parseDate(input.StartDate),
		Deadline:    parseDate(input.Deadline),
		Position:    newPos,
		CreatedBy:   userID,
	}

	if err := s.subtaskRepo.Create(ctx, subtask); err != nil {
		return nil, err
	}

	return s.subtaskRepo.GetByID(ctx, subtask.ID)
}

func (s *TaskService) ListSubtasks(ctx context.Context, taskID uuid.UUID) ([]model.Subtask, error) {
	return s.subtaskRepo.ListByTask(ctx, taskID)
}

func (s *TaskService) UpdateSubtask(ctx context.Context, id uuid.UUID, input model.UpdateSubtaskInput) (*model.Subtask, error) {
	return s.subtaskRepo.Update(ctx, id, input)
}

func (s *TaskService) UpdateSubtaskStatus(ctx context.Context, id uuid.UUID, status model.Status) error {
	if !status.IsValid() {
		return ErrInvalidCredentials
	}
	return s.subtaskRepo.UpdateStatus(ctx, id, status)
}

func (s *TaskService) DeleteSubtask(ctx context.Context, id uuid.UUID) error {
	return s.subtaskRepo.Delete(ctx, id)
}

// nextPosition generates the next position after the given one
func nextPosition(lastPos string) string {
	if lastPos == "" {
		return "U" // midpoint
	}
	// Simple approach: append a midpoint character
	chars := "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"
	lastChar := lastPos[len(lastPos)-1]
	idx := -1
	for i, c := range chars {
		if byte(c) == lastChar {
			idx = i
			break
		}
	}
	if idx >= 0 && idx < len(chars)-2 {
		return lastPos[:len(lastPos)-1] + string(chars[idx+1])
	}
	return lastPos + "U"
}

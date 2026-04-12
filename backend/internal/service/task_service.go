package service

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/qrt/command/internal/model"
	"github.com/qrt/command/internal/repository"
)

type TaskService struct {
	taskRepo    *repository.TaskRepository
	subtaskRepo *repository.SubtaskRepository
	storyRepo   *repository.StoryRepository
	changelog   *ChangeLogger
}

func NewTaskService(taskRepo *repository.TaskRepository, subtaskRepo *repository.SubtaskRepository, storyRepo *repository.StoryRepository, changelog *ChangeLogger) *TaskService {
	return &TaskService{
		taskRepo:    taskRepo,
		subtaskRepo: subtaskRepo,
		storyRepo:   storyRepo,
		changelog:   changelog,
	}
}

// ============================================================
// Progress Calculation
// ============================================================

func calculateTaskProgress(subtasks []model.Subtask) int {
	if len(subtasks) == 0 {
		return 0 // manual — leave as-is
	}
	sum := 0
	for _, s := range subtasks {
		sum += s.Status.AutoProgress(s.Progress)
	}
	return sum / len(subtasks)
}

func calculateStoryProgress(tasks []model.Task) int {
	if len(tasks) == 0 {
		return 0
	}
	sum := 0
	for _, t := range tasks {
		sum += t.Progress
	}
	return sum / len(tasks)
}

// ============================================================
// Cascade Logic (child → parent, upward only)
// ============================================================

// cascadeFromSubtask recalculates task progress/status after a subtask change
func (s *TaskService) cascadeFromSubtask(ctx context.Context, taskID uuid.UUID) (*model.CascadeResult, error) {
	result := &model.CascadeResult{}

	// Get all subtasks for this task
	subtasks, err := s.subtaskRepo.GetAllByTask(ctx, taskID)
	if err != nil {
		return result, err
	}

	// Recalculate task progress
	newProgress := calculateTaskProgress(subtasks)
	s.taskRepo.UpdateProgress(ctx, taskID, newProgress)

	// Get current task
	task, err := s.taskRepo.GetByID(ctx, taskID)
	if err != nil || task == nil {
		return result, err
	}

	// Cascade rule 1: First subtask → In Progress → Task auto-moves to In Progress
	if len(subtasks) > 0 {
		anyInProgress := false
		allDone := true
		for _, sub := range subtasks {
			if sub.Status == model.SubtaskStatusInProgress {
				anyInProgress = true
			}
			if sub.Status != model.SubtaskStatusDone {
				allDone = false
			}
		}

		// Rule 1: any subtask in_progress → task should be in_progress (if backlog or to_do)
		if anyInProgress && (task.Status == model.TaskStatusBacklog || task.Status == model.TaskStatusToDo) {
			s.taskRepo.UpdateStatus(ctx, taskID, model.TaskStatusInProgress)
			task.Status = model.TaskStatusInProgress
			result.TaskUpdated = task
		}

		// Rule 2: all subtasks done → task auto-done
		if allDone && task.Status != model.TaskStatusDone {
			s.taskRepo.UpdateStatus(ctx, taskID, model.TaskStatusDone)
			task.Status = model.TaskStatusDone
			task.Progress = 100
			result.TaskUpdated = task
		}
	}

	// Now cascade up to story
	storyCascade, err := s.cascadeFromTask(ctx, task.StoryID)
	if err == nil && storyCascade != nil {
		result.StoryUpdated = storyCascade.StoryUpdated
	}

	return result, nil
}

// cascadeFromTask recalculates story progress/status after a task change
func (s *TaskService) cascadeFromTask(ctx context.Context, storyID uuid.UUID) (*model.CascadeResult, error) {
	result := &model.CascadeResult{}

	tasks, err := s.taskRepo.GetAllByStory(ctx, storyID)
	if err != nil {
		return result, err
	}

	// Recalculate story progress
	newProgress := calculateStoryProgress(tasks)
	s.storyRepo.UpdateProgress(ctx, storyID, newProgress)

	// Get current story
	story, err := s.storyRepo.GetByID(ctx, storyID)
	if err != nil || story == nil {
		return result, err
	}

	if len(tasks) > 0 {
		anyBeyondBacklog := false
		allDone := true
		for _, t := range tasks {
			if t.Status.IsBeyondBacklog() {
				anyBeyondBacklog = true
			}
			if t.Status != model.TaskStatusDone {
				allDone = false
			}
		}

		// Rule 3: first task beyond backlog → story auto-activates
		if anyBeyondBacklog && story.Status == model.StoryStatusBacklog {
			s.storyRepo.UpdateStatus(ctx, storyID, model.StoryStatusActive)
			story.Status = model.StoryStatusActive
			result.StoryUpdated = story
		}

		// Rule 4: all tasks done → story auto-done
		if allDone && story.Status != model.StoryStatusDone && story.Status != model.StoryStatusClosed {
			s.storyRepo.UpdateStatus(ctx, storyID, model.StoryStatusDone)
			story.Status = model.StoryStatusDone
			story.Progress = 100
			result.StoryUpdated = story
		}
	}

	return result, nil
}

// ============================================================
// Task CRUD
// ============================================================

func (s *TaskService) CreateTask(ctx context.Context, storyID uuid.UUID, input model.CreateTaskInput, userID uuid.UUID) (*model.Task, error) {
	if err := ValidateTitle(input.Title); err != nil {
		return nil, err
	}
	if err := ValidateDescription(input.Description); err != nil {
		return nil, err
	}
	if err := ValidateEstimatedHours(input.EstimatedHours); err != nil {
		return nil, err
	}

	maxOrder, _ := s.taskRepo.GetMaxSortOrder(ctx, storyID)

	task := &model.Task{
		StoryID:        storyID,
		Title:          input.Title,
		Description:    input.Description,
		Status:         model.TaskStatusBacklog,
		Priority:       input.Priority,
		AssigneeID:     input.AssigneeID,
		StartDate:      parseDate(input.StartDate),
		Deadline:       parseDate(input.Deadline),
		EstimatedHours: input.EstimatedHours,
		SortOrder:      maxOrder + 1000,
		CreatedBy:      userID,
	}

	if !task.Priority.IsValid() {
		task.Priority = model.PriorityMedium
	}

	if err := s.taskRepo.Create(ctx, task); err != nil {
		return nil, err
	}

	// Cascade: recalculate story progress
	s.cascadeFromTask(ctx, storyID)

	return s.taskRepo.GetByID(ctx, task.ID)
}

func (s *TaskService) GetTask(ctx context.Context, id uuid.UUID) (*model.Task, error) {
	task, err := s.taskRepo.GetByID(ctx, id)
	if err != nil || task == nil {
		return task, err
	}
	subtasks, err := s.subtaskRepo.ListByTask(ctx, id)
	if err != nil {
		return task, nil
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

func (s *TaskService) UpdateTaskStatus(ctx context.Context, id uuid.UUID, status model.TaskStatus) (*model.CascadeResult, error) {
	if !status.IsValid() {
		return nil, errors.New("invalid task status")
	}

	// Get old status for changelog
	task, err := s.taskRepo.GetByID(ctx, id)
	if err != nil || task == nil {
		return nil, err
	}
	oldStatus := task.Status

	if err := s.taskRepo.UpdateStatus(ctx, id, status); err != nil {
		return nil, err
	}

	// Log status change
	if s.changelog != nil && oldStatus != status {
		s.changelog.LogStatusChange(ctx, "task", id, oldStatus, status, task.CreatedBy)
	}

	return s.cascadeFromTask(ctx, task.StoryID)
}

func (s *TaskService) UpdateTaskSortOrder(ctx context.Context, id uuid.UUID, sortOrder int) error {
	return s.taskRepo.UpdateSortOrder(ctx, id, sortOrder)
}

func (s *TaskService) DeleteTask(ctx context.Context, id uuid.UUID) error {
	// Get task before deleting for cascade
	task, err := s.taskRepo.GetByID(ctx, id)
	if err != nil || task == nil {
		return err
	}

	if err := s.taskRepo.Delete(ctx, id); err != nil {
		return err
	}

	// Cascade: recalculate story progress after deletion
	s.cascadeFromTask(ctx, task.StoryID)
	return nil
}

// ============================================================
// Board
// ============================================================

func (s *TaskService) GetBoard(ctx context.Context, filter model.TaskFilter) (*model.Board, error) {
	tasks, err := s.taskRepo.ListForBoard(ctx, filter)
	if err != nil {
		return nil, err
	}

	tasksByStatus := make(map[model.TaskStatus][]model.Task)
	for _, t := range tasks {
		tasksByStatus[t.Status] = append(tasksByStatus[t.Status], t)
	}

	var columns []model.BoardColumn
	for _, status := range model.TaskStatusOrder {
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

// ============================================================
// Subtask CRUD
// ============================================================

func (s *TaskService) CreateSubtask(ctx context.Context, taskID uuid.UUID, input model.CreateSubtaskInput, userID uuid.UUID) (*model.Subtask, error) {
	if err := ValidateTitle(input.Title); err != nil {
		return nil, err
	}

	maxOrder, _ := s.subtaskRepo.GetMaxSortOrder(ctx, taskID)

	subtask := &model.Subtask{
		TaskID:     taskID,
		Title:      input.Title,
		Description: input.Description,
		Status:     model.SubtaskStatusToDo,
		Progress:   0,
		AssigneeID: input.AssigneeID,
		StartDate:  parseDate(input.StartDate),
		Deadline:   parseDate(input.Deadline),
		SortOrder:  maxOrder + 1000,
		CreatedBy:  userID,
	}

	if err := s.subtaskRepo.Create(ctx, subtask); err != nil {
		return nil, err
	}

	// Cascade: recalculate task and story progress
	s.cascadeFromSubtask(ctx, taskID)

	return s.subtaskRepo.GetByID(ctx, subtask.ID)
}

func (s *TaskService) ListSubtasks(ctx context.Context, taskID uuid.UUID) ([]model.Subtask, error) {
	return s.subtaskRepo.ListByTask(ctx, taskID)
}

func (s *TaskService) UpdateSubtask(ctx context.Context, id uuid.UUID, input model.UpdateSubtaskInput) (*model.Subtask, error) {
	result, err := s.subtaskRepo.Update(ctx, id, input)
	if err != nil || result == nil {
		return result, err
	}

	// If status or progress changed, cascade
	if input.Status != nil || input.Progress != nil {
		s.cascadeFromSubtask(ctx, result.TaskID)
	}

	return s.subtaskRepo.GetByID(ctx, id)
}

func (s *TaskService) UpdateSubtaskStatus(ctx context.Context, id uuid.UUID, status model.SubtaskStatus) (*model.CascadeResult, error) {
	if !status.IsValid() {
		return nil, errors.New("invalid subtask status")
	}

	subtask, err := s.subtaskRepo.GetByID(ctx, id)
	if err != nil || subtask == nil {
		return nil, err
	}
	oldStatus := subtask.Status

	progress := status.AutoProgress(subtask.Progress)

	if err := s.subtaskRepo.UpdateStatus(ctx, id, status, progress); err != nil {
		return nil, err
	}

	// Log status change
	if s.changelog != nil && oldStatus != status {
		s.changelog.LogStatusChange(ctx, "subtask", id, oldStatus, status, subtask.CreatedBy)
	}

	return s.cascadeFromSubtask(ctx, subtask.TaskID)
}

func (s *TaskService) UpdateSubtaskSortOrder(ctx context.Context, id uuid.UUID, sortOrder int) error {
	_, err := s.subtaskRepo.GetByID(ctx, id)
	if err != nil {
		return err
	}
	return s.subtaskRepo.UpdateSortOrder(ctx, id, sortOrder)
}

func (s *TaskService) DeleteSubtask(ctx context.Context, id uuid.UUID) error {
	subtask, err := s.subtaskRepo.GetByID(ctx, id)
	if err != nil || subtask == nil {
		return err
	}

	if err := s.subtaskRepo.Delete(ctx, id); err != nil {
		return err
	}

	// Cascade: recalculate after deletion
	s.cascadeFromSubtask(ctx, subtask.TaskID)
	return nil
}

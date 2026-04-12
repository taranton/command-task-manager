package service

import (
	"errors"
	"strings"
)

var (
	ErrTitleRequired    = errors.New("title is required (min 3 chars, max 255)")
	ErrTitleTooShort    = errors.New("title must be at least 3 characters")
	ErrTitleTooLong     = errors.New("title must be at most 255 characters")
	ErrDescTooLong      = errors.New("description must be at most 10,000 characters")
	ErrInvalidPriority  = errors.New("priority must be critical, high, medium, or low")
	ErrDateOrder        = errors.New("start_date must be before or equal to deadline")
	ErrEstimatedHours   = errors.New("estimated_hours must be greater than 0")
	ErrTooManyTags      = errors.New("maximum 10 tags allowed")
	ErrTagTooLong       = errors.New("each tag must be at most 50 characters")
	ErrInvalidStatus    = errors.New("invalid status for this entity type")
)

func ValidateTitle(title string) error {
	title = strings.TrimSpace(title)
	if title == "" {
		return ErrTitleRequired
	}
	if len(title) < 3 {
		return ErrTitleTooShort
	}
	if len(title) > 255 {
		return ErrTitleTooLong
	}
	return nil
}

func ValidateDescription(desc *string) error {
	if desc != nil && len(*desc) > 10000 {
		return ErrDescTooLong
	}
	return nil
}

func ValidateTags(tags []string) error {
	if len(tags) > 10 {
		return ErrTooManyTags
	}
	for _, t := range tags {
		if len(t) > 50 {
			return ErrTagTooLong
		}
	}
	return nil
}

func ValidateEstimatedHours(hours *float64) error {
	if hours != nil && *hours <= 0 {
		return ErrEstimatedHours
	}
	return nil
}

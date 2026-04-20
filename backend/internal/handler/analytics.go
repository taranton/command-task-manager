package handler

import (
	"net/http"
	"strconv"

	"github.com/google/uuid"

	"github.com/qrt/command/internal/service"
)

type AnalyticsHandler struct {
	svc *service.AnalyticsService
}

func NewAnalyticsHandler(svc *service.AnalyticsService) *AnalyticsHandler {
	return &AnalyticsHandler{svc: svc}
}

// parseRegion parses the ?region= query param.
// "all" or empty → nil (all regions)
// valid UUID → filter by that region
// anything else → nil (silently)
func parseRegion(r *http.Request) *uuid.UUID {
	v := r.URL.Query().Get("region")
	if v == "" || v == "all" {
		return nil
	}
	id, err := uuid.Parse(v)
	if err != nil {
		return nil
	}
	return &id
}

// parseDays returns the timeframe days — 14, 30, or 90. Default 14.
func parseDays(r *http.Request) int {
	v := r.URL.Query().Get("timeframe")
	switch v {
	case "30d":
		return 30
	case "90d":
		return 90
	case "", "14d":
		return 14
	}
	// Numeric fallback
	if n, err := strconv.Atoi(v); err == nil && n > 0 && n <= 365 {
		return n
	}
	return 14
}

func (h *AnalyticsHandler) KPI(w http.ResponseWriter, r *http.Request) {
	resp, err := h.svc.KPI(r.Context(), parseRegion(r), parseDays(r))
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, resp)
}

func (h *AnalyticsHandler) Burndown(w http.ResponseWriter, r *http.Request) {
	resp, err := h.svc.Burndown(r.Context(), parseRegion(r), parseDays(r))
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, resp)
}

func (h *AnalyticsHandler) Offices(w http.ResponseWriter, r *http.Request) {
	resp, err := h.svc.Offices(r.Context(), parseRegion(r))
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if resp == nil {
		resp = []service.OfficeRollupRow{}
	}
	respondJSON(w, http.StatusOK, resp)
}

func (h *AnalyticsHandler) PeriodCompare(w http.ResponseWriter, r *http.Request) {
	resp, err := h.svc.PeriodCompare(r.Context(), parseRegion(r), parseDays(r))
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, resp)
}

func (h *AnalyticsHandler) PeopleRisk(w http.ResponseWriter, r *http.Request) {
	resp, err := h.svc.PeopleRisk(r.Context(), parseRegion(r))
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	respondJSON(w, http.StatusOK, resp)
}

func (h *AnalyticsHandler) Risks(w http.ResponseWriter, r *http.Request) {
	resp, err := h.svc.Risks(r.Context(), parseRegion(r))
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if resp == nil {
		resp = []service.Risk{}
	}
	respondJSON(w, http.StatusOK, resp)
}

func (h *AnalyticsHandler) Drill(w http.ResponseWriter, r *http.Request) {
	kpi := r.URL.Query().Get("kpi")
	limit := 12
	if n, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil && n > 0 && n <= 100 {
		limit = n
	}
	resp, err := h.svc.Drill(r.Context(), parseRegion(r), kpi, limit)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if resp == nil {
		resp = []service.DrillRow{}
	}
	respondJSON(w, http.StatusOK, resp)
}

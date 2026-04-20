import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';

export type Timeframe = '14d' | '30d' | '90d';

export interface KPIValue {
  completion: number;
  velocity: number;
  cycle_days: number;
  overdue_pct: number;
  utilization: number;
}

export interface KPISpark {
  dates: string[];
  completion: number[];
  velocity: number[];
  cycle_days: number[];
  overdue_pct: number[];
  utilization: number[];
  prior_completion: number[];
  prior_velocity: number[];
  prior_cycle_days: number[];
  prior_overdue_pct: number[];
  prior_utilization: number[];
}

export interface KPIResponse {
  current: KPIValue;
  prior: KPIValue;
  spark: KPISpark;
  timeframe_days: number;
}

export interface BurndownResponse {
  dates: string[];
  open: number[];
  ideal: number[];
  throughput: number[];
}

export interface OfficeRollupRow {
  office: string;
  total: number;
  done: number;
  in_progress: number;
  in_review: number;
  to_do: number;
  backlog: number;
  overdue: number;
  people_count: number;
  completion_pct: number;
}

export interface PeriodCompareResp {
  current: KPIValue;
  prior: KPIValue;
  days: number;
}

export interface DrillRow {
  id: string;
  title: string;
  status: string;
  priority: string;
  deadline: string | null;
  story_id: string;
  team_id: string | null;
  team_name: string | null;
  office: string | null;
  assignee: string | null;
  assignee_id: string | null;
}

const REFRESH_MS = 60_000;

function qs(region: string, timeframe?: Timeframe) {
  const p = new URLSearchParams();
  p.set('region', region);
  if (timeframe) p.set('timeframe', timeframe);
  return p.toString();
}

export function useKPI(region: string, timeframe: Timeframe) {
  return useQuery<KPIResponse>({
    queryKey: ['analytics', 'kpi', region, timeframe],
    queryFn: () => api.get(`/api/v1/analytics/kpi?${qs(region, timeframe)}`),
    staleTime: REFRESH_MS,
  });
}

export function useBurndown(region: string, timeframe: Timeframe) {
  return useQuery<BurndownResponse>({
    queryKey: ['analytics', 'burndown', region, timeframe],
    queryFn: () => api.get(`/api/v1/analytics/burndown?${qs(region, timeframe)}`),
    staleTime: REFRESH_MS,
  });
}

export function useOffices(region: string) {
  return useQuery<OfficeRollupRow[]>({
    queryKey: ['analytics', 'offices', region],
    queryFn: () => api.get(`/api/v1/analytics/offices?${qs(region)}`),
    staleTime: REFRESH_MS,
  });
}

export function usePeriodCompare(region: string, timeframe: Timeframe) {
  return useQuery<PeriodCompareResp>({
    queryKey: ['analytics', 'period', region, timeframe],
    queryFn: () => api.get(`/api/v1/analytics/period-compare?${qs(region, timeframe)}`),
    staleTime: REFRESH_MS,
  });
}

export interface Risk {
  task_id: string;
  title: string;
  severity: 'critical' | 'high' | 'medium';
  reason: string;
  office: string | null;
  team_name: string | null;
  priority: string;
  status: string;
  deadline: string | null;
  assignee: string | null;
  assignee_id: string | null;
}

export interface PersonRisk {
  id: string;
  name: string;
  team_id: string | null;
  team_name: string | null;
  workload: number;
  overdue: number;
  criticals: number;
  burnout: number;
}

export interface BusFactorTeam {
  team_id: string;
  team_name: string;
  office: string | null;
  bus: number;
  top_share: number;
  top_person: string | null;
}

export interface PeopleRiskResponse {
  top_burnout: PersonRisk[];
  bus_factor: BusFactorTeam[];
  counts: { high: number; elevated: number; healthy: number };
}

export function usePeopleRisk(region: string) {
  return useQuery<PeopleRiskResponse>({
    queryKey: ['analytics', 'people-risk', region],
    queryFn: () => api.get(`/api/v1/analytics/people-risk?${qs(region)}`),
    staleTime: REFRESH_MS,
  });
}

export function useRisks(region: string) {
  return useQuery<Risk[]>({
    queryKey: ['analytics', 'risks', region],
    queryFn: () => api.get(`/api/v1/analytics/risks?${qs(region)}`),
    staleTime: REFRESH_MS,
  });
}

export function useDrill(region: string, kpi: string | null) {
  return useQuery<DrillRow[]>({
    queryKey: ['analytics', 'drill', region, kpi],
    queryFn: () => api.get(`/api/v1/analytics/drill?region=${region}&kpi=${kpi}`),
    enabled: !!kpi,
    staleTime: REFRESH_MS,
  });
}

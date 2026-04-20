import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { useQuery } from '@tanstack/react-query';
import { FiExternalLink, FiX } from 'react-icons/fi';
import { theme } from '../../styles/theme';
import { api } from '../../lib/api';
import { useRegions } from '../../hooks/useRegions';
import { usePersistedState } from '../../hooks/usePersistedState';
import {
  useKPI,
  useBurndown,
  useOffices,
  usePeriodCompare,
  useDrill,
  useRisks,
  usePeopleRisk,
  type Timeframe,
} from '../../hooks/useAnalytics';
import type { Story, Team } from '../../types';
import {
  Card,
  SectionHeader,
  Segmented,
  LegendDot,
  StatusPill,
} from '../../components/clevel/primitives';
import { KpiHero, type KpiConfig, type KpiKey } from '../../components/clevel/KpiHero';
import { BurndownChart } from '../../components/clevel/BurndownChart';
import { OfficeComparison } from '../../components/clevel/OfficeComparison';
import { RiskWatchlist } from '../../components/clevel/RiskWatchlist';
import { PeriodCompareTable } from '../../components/clevel/PeriodCompareTable';
import { ActiveStories } from '../../components/clevel/sections';
import { PeopleRiskSection } from '../../components/clevel/PeopleRiskSection';
import { ReleaseCalendar } from '../../components/clevel/ReleaseCalendar';
import { DependencyGraph } from '../../components/clevel/DependencyGraph';
import { useReleases, useStoryDeps, useBlockers, useEvents } from '../../hooks/useEntities';
import { Avatar } from '../../components/ui/Avatar';
import { TaskDetail } from '../../components/board/TaskDetail';
import { StoryDetail } from '../../components/board/StoryDetail';

const PageWrap = styled.div`
  flex: 1;
  overflow-y: auto;
  background: ${theme.colors.background};
`;

const PageInner = styled.div`
  padding: 24px;
  max-width: 1480px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const TitleBar = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  row-gap: 12px;
`;

const Title = styled.h1`
  font-family: ${theme.typography.fontFamily.primary};
  font-size: 30px;
  font-weight: 800;
  color: ${theme.colors.charcoal};
  letter-spacing: -0.6px;
  margin: 2px 0 0 0;
`;

const Eyebrow = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: ${theme.colors.cadetGray};
  letter-spacing: 0.8px;
  text-transform: uppercase;
`;

const Subtitle = styled.div`
  font-size: 13px;
  color: ${theme.colors.cadetGray};
  margin-top: 4px;
`;

const ExportBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: ${theme.colors.white};
  color: ${theme.colors.charcoal};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
`;

const Toolbar = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
`;

const RegionSelect = styled.select`
  padding: 7px 12px;
  background: ${theme.colors.white};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  font-size: 12px;
  font-weight: 600;
  color: ${theme.colors.charcoal};
  cursor: pointer;
  font-family: ${theme.typography.fontFamily.secondary};
`;

// 2-column grid with auto rows: cards in the same row stretch to equal height.
// Layout: [Throughput | ActiveStories] / [OfficeComparison | PeriodOverPeriod]
const MainGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
  grid-auto-rows: minmax(0, auto);
  align-items: stretch;
  gap: 18px;

  > * {
    min-width: 0;
  }

  @media (max-width: 1100px) {
    grid-template-columns: 1fr;
  }
`;

const DrillGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 10px;
`;

const DrawerBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 1900;
`;

const Drawer = styled.div`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: 520px;
  max-width: 100vw;
  background: ${theme.colors.white};
  box-shadow: -8px 0 24px rgba(0, 0, 0, 0.15);
  z-index: 2000;
  display: flex;
  flex-direction: column;
  /* overflow: visible so the inline panel's collapse chevron (left: -14px) isn't clipped */
  overflow: visible;

  @media (max-width: 600px) {
    width: 100vw;
  }
`;

const DrillRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  cursor: pointer;
  background: ${theme.colors.white};
  transition: ${theme.transitions.default};

  &:hover {
    border-color: ${theme.colors.vividOrange}80;
    background: ${theme.colors.warningLight}40;
  }
`;

export default function CLevelBoardPage() {
  const [region, setRegion] = usePersistedState<string>('clevel:region', 'all');
  const [timeframe, setTimeframe] = usePersistedState<Timeframe>('clevel:timeframe', '14d');
  const [officeView, setOfficeView] = usePersistedState<'list' | 'map'>('clevel:officeView', 'list');
  const [riskView, setRiskView] = usePersistedState<'list' | 'triage'>('clevel:riskView', 'list');
  const [activeKpi, setActiveKpi] = useState<KpiKey | null>(null);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const [openStoryId, setOpenStoryId] = useState<string | null>(null);

  const { data: regions } = useRegions();
  const { data: kpiData } = useKPI(region, timeframe);
  const { data: burndown } = useBurndown(region, timeframe);
  const { data: offices } = useOffices(region);
  const { data: period } = usePeriodCompare(region, timeframe);
  const { data: drillTasks } = useDrill(region, activeKpi);
  const { data: risks } = useRisks(region);
  const { data: peopleRisk } = usePeopleRisk(region);
  const { data: releases } = useReleases(region);
  const { data: deps } = useStoryDeps(region);
  const { data: blockers } = useBlockers(region, true);
  const { data: events } = useEvents(region);

  const { data: stories } = useQuery<Story[]>({
    queryKey: ['stories', region],
    queryFn: async () => {
      const res = await api.get<{ data?: Story[] } | Story[]>('/api/v1/stories');
      if (Array.isArray(res)) return res;
      return res?.data ?? [];
    },
    staleTime: 60_000,
  });
  const { data: teams } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: () => api.get('/api/v1/teams'),
    staleTime: 60_000,
  });

  // Filter stories to region via their team
  const filteredStories = useMemo<Story[]>(() => {
    if (!Array.isArray(stories) || !Array.isArray(teams)) return [];
    if (region === 'all') return stories;
    const teamIds = new Set(teams.filter((t) => t.region_id === region).map((t) => t.id));
    return stories.filter((s) => (s.team_id ? teamIds.has(s.team_id) : false));
  }, [stories, teams, region]);

  const regionOptions = useMemo(() => {
    const base = [{ id: 'all', code: 'ALL', name: 'All Regions' }];
    if (regions) {
      for (const r of regions) base.push({ id: r.id, code: r.code, name: r.name });
    }
    return base;
  }, [regions]);

  const regionName = regionOptions.find((r) => r.id === region)?.name || 'All Regions';
  const teamCount = teams
    ? teams.filter((t) => region === 'all' || t.region_id === region).length
    : 0;

  // Build KPI configs from real data
  const kpiConfigs: KpiConfig[] = useMemo(() => {
    if (!kpiData) return [];
    const cur = kpiData.current;
    const pr = kpiData.prior;
    const sp = kpiData.spark;
    const safeDelta = (c: number, p: number) => (p ? +(((c - p) / p) * 100).toFixed(1) : 0);
    // Map dates → index in the current spark window
    const dateIdx = new Map(sp.dates.map((d, i) => [d, i]));
    const markersFor = (kpiKey: string) =>
      (events || [])
        .filter((e) => (e.affected_kpis || []).includes(kpiKey))
        .map((e) => ({ idx: dateIdx.get(e.event_date), kind: e.kind, label: e.label }))
        .filter((m): m is { idx: number; kind: 'release' | 'incident' | 'hire' | 'launch' | 'milestone'; label: string } =>
          typeof m.idx === 'number',
        )
        .map((m) => ({
          idx: m.idx,
          kind: m.kind === 'release' || m.kind === 'incident' || m.kind === 'hire'
            ? m.kind
            : 'release',
          label: m.label,
        }));
    return [
      {
        key: 'completion',
        label: 'Completion',
        value: cur.completion,
        unit: '%',
        delta: safeDelta(cur.completion, pr.completion),
        color: theme.colors.success,
        inverse: false,
        spark: sp.completion,
        priorSpark: sp.prior_completion,
        events: markersFor('completion'),
      },
      {
        key: 'velocity',
        label: 'Team Velocity',
        value: cur.velocity,
        unit: '/wk',
        delta: safeDelta(cur.velocity, pr.velocity),
        color: theme.colors.vividOrange,
        inverse: false,
        spark: sp.velocity,
        priorSpark: sp.prior_velocity,
        events: markersFor('velocity'),
      },
      {
        key: 'cycle',
        label: 'Cycle',
        value: cur.cycle_days,
        unit: 'd',
        delta: safeDelta(cur.cycle_days, pr.cycle_days),
        color: theme.colors.info,
        inverse: true,
        spark: sp.cycle_days,
        priorSpark: sp.prior_cycle_days,
        events: markersFor('cycle'),
      },
      {
        key: 'overdue',
        label: 'Overdue',
        value: cur.overdue_pct,
        unit: '%',
        delta: safeDelta(cur.overdue_pct, pr.overdue_pct),
        color: theme.colors.error,
        inverse: true,
        spark: sp.overdue_pct,
        priorSpark: sp.prior_overdue_pct,
        events: markersFor('overdue'),
      },
      {
        key: 'utilization',
        label: 'Utilization',
        value: cur.utilization,
        unit: '%',
        delta: safeDelta(cur.utilization, pr.utilization),
        color: theme.colors.status.in_review,
        inverse: false,
        spark: sp.utilization,
        priorSpark: sp.prior_utilization,
        events: markersFor('utilization'),
      },
    ];
  }, [kpiData, events]);

  const priorDays = kpiData?.timeframe_days || 14;

  const totalTasks = useMemo(() => {
    if (!offices) return 0;
    return offices.reduce((a, r) => a + r.total, 0);
  }, [offices]);

  const activeKpiLabel = kpiConfigs.find((k) => k.key === activeKpi)?.label;

  return (
    <PageWrap>
      <PageInner>
      <TitleBar>
        <div>
          <Eyebrow>Executive</Eyebrow>
          <Title>C-Level Board</Title>
          <Subtitle>
            {regionName} · {filteredStories.length} stories · {totalTasks} tasks across {teamCount} teams
          </Subtitle>
        </div>
        <Toolbar>
          <RegionSelect value={region} onChange={(e) => setRegion(e.target.value)}>
            {regionOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name} ({r.code})
              </option>
            ))}
          </RegionSelect>
          <Segmented
            options={[
              { value: '14d', label: '14d' },
              { value: '30d', label: '30d' },
              { value: '90d', label: '90d' },
            ]}
            value={timeframe}
            onChange={setTimeframe}
          />
          <ExportBtn>
            <FiExternalLink size={13} /> Export
          </ExportBtn>
        </Toolbar>
      </TitleBar>

      {kpiConfigs.length > 0 ? (
        <KpiHero kpiConfigs={kpiConfigs} activeKpi={activeKpi} setActiveKpi={setActiveKpi} priorDays={priorDays} />
      ) : (
        <Card>
          <div style={{ padding: 20, textAlign: 'center', color: theme.colors.cadetGray }}>Loading KPIs…</div>
        </Card>
      )}

      {activeKpi && (
        <Card>
          <SectionHeader
            title={`Tasks contributing to ${activeKpiLabel}`}
            subtitle={`${drillTasks?.length || 0} tasks · click any to open details`}
            action={
              <button
                onClick={() => setActiveKpi(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: theme.colors.cadetGray,
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <FiX size={12} /> Clear
              </button>
            }
          />
          <DrillGrid>
            {(!drillTasks || drillTasks.length === 0) && (
              <div style={{ gridColumn: '1/-1', color: theme.colors.cadetGray, fontSize: 13, padding: 14 }}>
                No tasks match this metric in the current scope.
              </div>
            )}
            {drillTasks?.map((t) => (
              <DrillRow key={t.id} onClick={() => setOpenTaskId(t.id)}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: theme.colors.charcoal,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t.title}
                  </div>
                  <div style={{ fontSize: 11, color: theme.colors.cadetGray, marginTop: 2 }}>
                    {t.office || '—'} · {t.team_name || '—'}
                  </div>
                </div>
                <StatusPill status={t.status} />
                {t.assignee && <Avatar name={t.assignee} size={22} />}
              </DrillRow>
            ))}
          </DrillGrid>
        </Card>
      )}

      <MainGrid>
        {/* Row 1 left: Throughput & burndown */}
        <Card>
          <SectionHeader
            title="Throughput & burndown"
            subtitle={`Open vs. ideal · last ${timeframe === '14d' ? '14 days' : timeframe === '30d' ? '30 days' : '90 days'}`}
            action={
              <div style={{ display: 'flex', gap: 14, fontSize: 11, color: theme.colors.cadetGray }}>
                <LegendDot color={theme.colors.vividOrange} label="Actual" />
                <LegendDot color={theme.colors.cadetGray} label="Ideal" dashed />
                <LegendDot color={theme.colors.charcoal} label="Completed/day" solid />
              </div>
            }
          />
          {burndown ? (
            <BurndownChart data={burndown} />
          ) : (
            <div style={{ padding: 60, textAlign: 'center', color: theme.colors.cadetGray }}>Loading…</div>
          )}
        </Card>

        {/* Row 1 right: Active stories */}
        <Card>
          <SectionHeader
            title="Active stories"
            subtitle={`${filteredStories.filter((s) => s.status === 'active').length} in flight`}
          />
          <ActiveStories
            stories={filteredStories}
            teams={teams || []}
            showWipLimits={false}
            onOpenStory={(id) => setOpenStoryId(id)}
          />
        </Card>

        {/* Row 2 left: Office comparison */}
        <Card>
          <SectionHeader
            title="Office comparison"
            subtitle="Status breakdown per office"
            action={
              <Segmented
                options={[
                  { value: 'list', label: 'List' },
                  { value: 'map', label: 'World map' },
                ]}
                value={officeView}
                onChange={setOfficeView}
              />
            }
          />
          <OfficeComparison rows={offices || []} view={officeView} />
        </Card>

        {/* Row 2 right: Period over period */}
        <Card>
          <SectionHeader title="Period over period" subtitle={`This ${timeframe} vs prior`} />
          {period ? (
            <PeriodCompareTable current={period.current} prior={period.prior} days={period.days} />
          ) : (
            <div style={{ padding: 20, textAlign: 'center', color: theme.colors.cadetGray }}>Loading…</div>
          )}
        </Card>
      </MainGrid>

      <Card>
        <SectionHeader
          title="Risk watchlist"
          subtitle={
            riskView === 'triage'
              ? `${risks?.length || 0} flagged · grouped by urgency — Act now (deadline or critical ≤48h), This week (≤7d), Monitor (longer horizon)`
              : `${risks?.length || 0} flagged · ranked by severity (rule-based)`
          }
          action={
            <Segmented
              options={[
                { value: 'list', label: 'List' },
                { value: 'triage', label: 'Triage' },
              ]}
              value={riskView}
              onChange={setRiskView}
            />
          }
        />
        <RiskWatchlist risks={risks || []} view={riskView} onOpenTask={(r) => setOpenTaskId(r.task_id)} />
      </Card>

      <Card>
        <SectionHeader title="Release calendar" subtitle="Next 12 weeks across offices" />
        <ReleaseCalendar releases={releases || []} />
      </Card>

      <Card>
        <SectionHeader
          title="Dependencies & blockers"
          subtitle={
            region === 'all'
              ? `All regions · columns = region · ${filteredStories.filter((s) => s.status === 'active').length} active stories`
              : `${regionName} only · columns = office · ${filteredStories.filter((s) => s.status === 'active').length} active stories`
          }
        />
        <DependencyGraph
          stories={filteredStories}
          teams={teams || []}
          regions={regions || []}
          deps={deps || []}
          blockers={blockers || []}
          onOpenStory={(id) => setOpenStoryId(id)}
          onOpenTask={(id) => setOpenTaskId(id)}
        />
      </Card>

      <Card>
        <SectionHeader title="People risk" subtitle="Burnout + bus factor" />
        <PeopleRiskSection data={peopleRisk} />
      </Card>
      </PageInner>

      {openTaskId && (
        <>
          <DrawerBackdrop onClick={() => setOpenTaskId(null)} />
          <Drawer>
            <TaskDetail
              taskId={openTaskId}
              onClose={() => setOpenTaskId(null)}
              onOpenStory={(id) => {
                setOpenTaskId(null);
                setOpenStoryId(id);
              }}
              inline
            />
          </Drawer>
        </>
      )}

      {openStoryId && (
        <>
          <DrawerBackdrop onClick={() => setOpenStoryId(null)} />
          <Drawer>
            <StoryDetail
              storyId={openStoryId}
              onClose={() => setOpenStoryId(null)}
              onTaskClick={(taskId) => {
                setOpenStoryId(null);
                setOpenTaskId(taskId);
              }}
              onOpenStory={(id) => setOpenStoryId(id)}
              inline
            />
          </Drawer>
        </>
      )}
    </PageWrap>
  );
}

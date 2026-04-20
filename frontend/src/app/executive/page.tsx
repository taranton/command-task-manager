import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { usePersistedState } from '../../hooks/usePersistedState';
import { useQuery } from '@tanstack/react-query';
import { FiPlus, FiTrash2, FiCheck } from 'react-icons/fi';
import { theme } from '../../styles/theme';
import { api } from '../../lib/api';
import { useAuth } from '../../hooks/useAuth';
import { useRegions } from '../../hooks/useRegions';
import { Card, SectionHeader, Segmented } from '../../components/clevel/primitives';
import type { Story } from '../../types';
import {
  useReleases,
  useCreateRelease,
  useDeleteRelease,
  useStoryDeps,
  useCreateDep,
  useDeleteDep,
  useBlockers,
  useCreateBlocker,
  useResolveBlocker,
  useDeleteBlocker,
  useEvents,
  useCreateEvent,
  useDeleteEvent,
  useTasksByStory,
} from '../../hooks/useEntities';

// ---------- layout primitives ----------

const PageScroll = styled.div`
  flex: 1;
  overflow-y: auto;
  background: ${theme.colors.background};
`;
const Page = styled.div`
  padding: 24px;
  max-width: 1100px;
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
`;
const Eyebrow = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: ${theme.colors.cadetGray};
  letter-spacing: 0.8px;
  text-transform: uppercase;
`;
const Title = styled.h1`
  font-family: ${theme.typography.fontFamily.primary};
  font-size: 30px;
  font-weight: 800;
  color: ${theme.colors.charcoal};
  letter-spacing: -0.6px;
  margin: 2px 0 0 0;
`;
const Subtitle = styled.div`
  font-size: 13px;
  color: ${theme.colors.cadetGray};
  margin-top: 4px;
`;

// Sub-section "form" container — nested, light bg, to visually separate form from list.
const FormBox = styled.div`
  background: ${theme.colors.background};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  padding: 16px;
  margin-bottom: 16px;
`;
const FormBoxHeader = styled.div`
  font-size: 11px;
  font-weight: 700;
  color: ${theme.colors.cadetGray};
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin-bottom: 12px;
`;

// Grid inside FormBox — 3 columns max, natural widths, wraps at ~600px.
const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;

  @media (max-width: 720px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const FullRow = styled.div`
  grid-column: 1 / -1;
`;

const ListHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 700;
  color: ${theme.colors.cadetGray};
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin: 4px 2px 10px;
`;

const RowList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;
const Row = styled.div`
  display: grid;
  grid-template-columns: var(--cols, 1fr);
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
  background: ${theme.colors.white};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  font-size: 13px;
`;
const Empty = styled.div`
  padding: 24px;
  text-align: center;
  color: ${theme.colors.cadetGray};
  font-size: 13px;
  background: ${theme.colors.background};
  border-radius: ${theme.borderRadius.md};
`;

const Btn = styled.button<{ $primary?: boolean; $danger?: boolean; $small?: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: ${(p) => (p.$small ? '5px 10px' : '8px 16px')};
  border-radius: ${theme.borderRadius.md};
  font-size: ${(p) => (p.$small ? '11px' : '13px')};
  font-weight: 600;
  transition: ${theme.transitions.default};
  white-space: nowrap;
  cursor: pointer;
  ${(p) =>
    p.$primary
      ? `background: ${theme.colors.vividOrange}; color: white; border: 1px solid ${theme.colors.vividOrange}; &:hover:not(:disabled) { background: ${theme.colors.deepOrange}; }`
      : p.$danger
        ? `background: ${theme.colors.errorLight}; color: ${theme.colors.error}; border: 1px solid ${theme.colors.error}30; &:hover:not(:disabled) { background: ${theme.colors.error}; color: white; }`
        : `background: white; border: 1px solid ${theme.colors.border}; color: ${theme.colors.charcoal}; &:hover:not(:disabled) { background: ${theme.colors.background}; }`}

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const FieldLabel = styled.label`
  font-size: 10px;
  font-weight: 700;
  color: ${theme.colors.cadetGray};
  text-transform: uppercase;
  letter-spacing: 0.4px;
  display: block;
  margin-bottom: 4px;
`;
const Input = styled.input`
  padding: 8px 12px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  font-size: 13px;
  width: 100%;
  background: white;
  &:focus {
    border-color: ${theme.colors.vividOrange};
    outline: none;
  }
`;
const Select = styled.select`
  padding: 8px 12px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  font-size: 13px;
  background: white;
  cursor: pointer;
  width: 100%;
`;
const Textarea = styled.textarea`
  padding: 8px 12px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  font-size: 13px;
  width: 100%;
  min-height: 56px;
  resize: vertical;
  background: white;
  font-family: ${theme.typography.fontFamily.secondary};
  &:focus {
    border-color: ${theme.colors.vividOrange};
    outline: none;
  }
`;

// Chip-style toggle — used for multi-selecting stories or KPIs.
const Chip = styled.button<{ $active: boolean }>`
  font-size: 11px;
  font-weight: 600;
  padding: 5px 10px;
  border-radius: ${theme.borderRadius.pill};
  border: 1px solid ${(p) => (p.$active ? theme.colors.vividOrange : theme.colors.border)};
  background: ${(p) => (p.$active ? theme.colors.vividOrange + '18' : 'white')};
  color: ${(p) => (p.$active ? theme.colors.vividOrange : theme.colors.davysGray)};
  cursor: pointer;
  transition: ${theme.transitions.default};
  white-space: nowrap;
  max-width: 280px;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const ChipRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
`;

// ============================================================
type Tab = 'releases' | 'events' | 'relations';

const today = () => new Date().toISOString().slice(0, 10);

export default function ExecutivePage() {
  const { user } = useAuth();
  const [tab, setTab] = usePersistedState<Tab>('executive:tab', 'releases');
  const [region] = useState('all');
  const { data: regions } = useRegions();
  const { data: stories } = useQuery<Story[]>({
    queryKey: ['stories', 'all'],
    queryFn: async () => {
      const res = await api.get<{ data?: Story[] } | Story[]>('/api/v1/stories');
      if (Array.isArray(res)) return res;
      return res?.data ?? [];
    },
  });
  const storyById = useMemo(() => {
    const m = new Map<string, Story>();
    (stories || []).forEach((s) => m.set(s.id, s));
    return m;
  }, [stories]);

  if (user?.role !== 'clevel') {
    return (
      <PageScroll>
        <Page>
          <Card>
            <div style={{ color: theme.colors.cadetGray, padding: 48, textAlign: 'center' }}>
              Only C-Level users can access Executive admin.
            </div>
          </Card>
        </Page>
      </PageScroll>
    );
  }

  return (
    <PageScroll>
      <Page>
        <TitleBar>
          <div>
            <Eyebrow>Administration</Eyebrow>
            <Title>Executive admin</Title>
            <Subtitle>Manage releases, dependencies, external blockers and timeline events.</Subtitle>
          </div>
          <Segmented
            options={[
              { value: 'releases', label: 'Releases' },
              { value: 'events', label: 'Events' },
              { value: 'relations', label: 'Dependencies & blockers' },
            ]}
            value={tab}
            onChange={(v) => setTab(v as Tab)}
          />
        </TitleBar>

        {tab === 'releases' && <ReleasesAdmin region={region} regions={regions || []} stories={stories || []} />}
        {tab === 'events' && <EventsAdmin region={region} regions={regions || []} />}
        {tab === 'relations' && <RelationsAdmin region={region} stories={stories || []} storyById={storyById} />}
      </Page>
    </PageScroll>
  );
}

// ============================================================
// RELEASES
// ============================================================
function ReleasesAdmin({
  region,
  regions,
  stories,
}: {
  region: string;
  regions: { id: string; name: string; code: string }[];
  stories: Story[];
}) {
  const { data: releases } = useReleases(region);
  const create = useCreateRelease();
  const del = useDeleteRelease();
  const [form, setForm] = useState({
    label: '',
    release_date: today(),
    release_type: 'minor' as 'major' | 'minor' | 'patch',
    region_id: '',
    office: '',
    description: '',
    story_ids: new Set<string>(),
  });

  const toggleStory = (id: string) => {
    const s = new Set(form.story_ids);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setForm({ ...form, story_ids: s });
  };

  const submit = () => {
    if (!form.label || !form.release_date) return;
    create.mutate(
      {
        label: form.label,
        release_date: form.release_date,
        release_type: form.release_type,
        region_id: form.region_id || null,
        office: form.office || null,
        description: form.description || null,
        story_ids: Array.from(form.story_ids),
      },
      {
        onSuccess: () =>
          setForm({ label: '', release_date: today(), release_type: 'minor', region_id: '', office: '', description: '', story_ids: new Set() }),
      },
    );
  };

  return (
    <Card>
      <SectionHeader title="Releases" subtitle={`${releases?.length || 0} scheduled`} />

      <FormBox>
        <FormBoxHeader>+ New release</FormBoxHeader>
        <FormGrid>
          <div>
            <FieldLabel>Label *</FieldLabel>
            <Input placeholder="v3.0 — Platform" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </div>
          <div>
            <FieldLabel>Date *</FieldLabel>
            <Input type="date" value={form.release_date} onChange={(e) => setForm({ ...form, release_date: e.target.value })} />
          </div>
          <div>
            <FieldLabel>Type</FieldLabel>
            <Select value={form.release_type} onChange={(e) => setForm({ ...form, release_type: e.target.value as typeof form.release_type })}>
              <option value="minor">Minor</option>
              <option value="major">Major</option>
              <option value="patch">Patch</option>
            </Select>
          </div>
          <div>
            <FieldLabel>Office</FieldLabel>
            <Input placeholder="Sussex / Kraków / …" value={form.office} onChange={(e) => setForm({ ...form, office: e.target.value })} />
          </div>
          <div>
            <FieldLabel>Region</FieldLabel>
            <Select value={form.region_id} onChange={(e) => setForm({ ...form, region_id: e.target.value })}>
              <option value="">Global</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.code})
                </option>
              ))}
            </Select>
          </div>
          <FullRow>
            <FieldLabel>Stories ({form.story_ids.size} selected)</FieldLabel>
            {stories.length === 0 ? (
              <div style={{ fontSize: 12, color: theme.colors.cadetGray }}>No stories available.</div>
            ) : (
              <ChipRow>
                {stories.map((s) => (
                  <Chip key={s.id} $active={form.story_ids.has(s.id)} onClick={() => toggleStory(s.id)} type="button" title={s.title}>
                    {s.title}
                  </Chip>
                ))}
              </ChipRow>
            )}
          </FullRow>
          <FullRow>
            <FieldLabel>Description (optional)</FieldLabel>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </FullRow>
          <FullRow>
            <Btn $primary onClick={submit} disabled={create.isPending || !form.label}>
              <FiPlus size={14} /> Add release
            </Btn>
          </FullRow>
        </FormGrid>
      </FormBox>

      <ListHeader>
        <span>Scheduled ({releases?.length || 0})</span>
      </ListHeader>
      <RowList>
        {(releases || []).map((r) => (
          <Row key={r.id} style={{ ['--cols' as string]: '100px 1fr 70px 120px 40px' }}>
            <div style={{ fontFamily: theme.typography.fontFamily.primary, fontWeight: 700, fontSize: 12 }}>
              {new Date(r.release_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </div>
            <div style={{ color: theme.colors.charcoal, fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {r.label}
            </div>
            <div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: r.release_type === 'major' ? theme.colors.warningLight : theme.colors.lightGray,
                  color: r.release_type === 'major' ? theme.colors.warning : theme.colors.davysGray,
                }}
              >
                {r.release_type}
              </span>
            </div>
            <div style={{ fontSize: 11, color: theme.colors.cadetGray }}>
              {r.office || '—'} · {r.story_ids.length} stories
            </div>
            <div style={{ textAlign: 'right' }}>
              <Btn $danger $small onClick={() => del.mutate(r.id)}>
                <FiTrash2 size={11} />
              </Btn>
            </div>
          </Row>
        ))}
        {(!releases || releases.length === 0) && <Empty>No releases yet.</Empty>}
      </RowList>
    </Card>
  );
}

// ============================================================
// EVENTS
// ============================================================
function EventsAdmin({ region, regions }: { region: string; regions: { id: string; name: string; code: string }[] }) {
  const { data: events } = useEvents(region);
  const create = useCreateEvent();
  const del = useDeleteEvent();
  const [form, setForm] = useState({
    label: '',
    event_date: today(),
    kind: 'release' as 'release' | 'incident' | 'hire' | 'launch' | 'milestone',
    region_id: '',
    affected: new Set<string>(),
    description: '',
  });

  const toggleKpi = (k: string) => {
    const s = new Set(form.affected);
    if (s.has(k)) s.delete(k);
    else s.add(k);
    setForm({ ...form, affected: s });
  };

  const submit = () => {
    if (!form.label || !form.event_date) return;
    create.mutate(
      {
        label: form.label,
        event_date: form.event_date,
        kind: form.kind,
        region_id: form.region_id || null,
        affected_kpis: Array.from(form.affected),
        description: form.description || null,
      },
      {
        onSuccess: () =>
          setForm({ label: '', event_date: today(), kind: 'release', region_id: '', affected: new Set(), description: '' }),
      },
    );
  };

  const KPIS = ['completion', 'velocity', 'cycle', 'overdue', 'utilization'];

  return (
    <Card>
      <SectionHeader title="Timeline events" subtitle={`${events?.length || 0} events in window`} />

      <FormBox>
        <FormBoxHeader>+ New event</FormBoxHeader>
        <FormGrid>
          <div>
            <FieldLabel>Label *</FieldLabel>
            <Input placeholder="v2.15 ship" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
          </div>
          <div>
            <FieldLabel>Date *</FieldLabel>
            <Input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
          </div>
          <div>
            <FieldLabel>Kind</FieldLabel>
            <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as typeof form.kind })}>
              <option value="release">Release</option>
              <option value="incident">Incident</option>
              <option value="hire">Hire</option>
              <option value="launch">Launch</option>
              <option value="milestone">Milestone</option>
            </Select>
          </div>
          <div>
            <FieldLabel>Region</FieldLabel>
            <Select value={form.region_id} onChange={(e) => setForm({ ...form, region_id: e.target.value })}>
              <option value="">Global</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.code})
                </option>
              ))}
            </Select>
          </div>
          <FullRow>
            <FieldLabel>Mark on which KPI sparklines?</FieldLabel>
            <ChipRow>
              {KPIS.map((k) => (
                <Chip key={k} $active={form.affected.has(k)} onClick={() => toggleKpi(k)} type="button">
                  <span style={{ textTransform: 'capitalize' }}>{k}</span>
                </Chip>
              ))}
            </ChipRow>
          </FullRow>
          <FullRow>
            <FieldLabel>Description (optional)</FieldLabel>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </FullRow>
          <FullRow>
            <Btn $primary onClick={submit} disabled={create.isPending || !form.label}>
              <FiPlus size={14} /> Add event
            </Btn>
          </FullRow>
        </FormGrid>
      </FormBox>

      <ListHeader>
        <span>All events ({events?.length || 0})</span>
      </ListHeader>
      <RowList>
        {(events || []).map((e) => (
          <Row key={e.id} style={{ ['--cols' as string]: '90px 1fr 90px 40px' }}>
            <div style={{ fontFamily: theme.typography.fontFamily.primary, fontWeight: 700, fontSize: 12 }}>
              {new Date(e.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: theme.colors.charcoal, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {e.label}
              </div>
              {e.affected_kpis.length > 0 && (
                <div style={{ fontSize: 11, color: theme.colors.cadetGray, marginTop: 2 }}>marks: {e.affected_kpis.join(', ')}</div>
              )}
            </div>
            <div>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  padding: '2px 8px',
                  borderRadius: 10,
                  background:
                    e.kind === 'incident' ? theme.colors.errorLight : e.kind === 'release' ? theme.colors.successLight : theme.colors.lightGray,
                  color: e.kind === 'incident' ? theme.colors.error : e.kind === 'release' ? theme.colors.success : theme.colors.davysGray,
                }}
              >
                {e.kind}
              </span>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Btn $danger $small onClick={() => del.mutate(e.id)}>
                <FiTrash2 size={11} />
              </Btn>
            </div>
          </Row>
        ))}
        {(!events || events.length === 0) && (
          <Empty>No events yet — add releases/incidents to see markers on KPI sparklines.</Empty>
        )}
      </RowList>
    </Card>
  );
}


// ============================================================
// DEPENDENCIES & BLOCKERS — unified tab
// ============================================================

type RelationKind = 'dep' | 'blocker_internal' | 'blocker_external';

function RelationsAdmin({
  region,
  stories,
  storyById,
}: {
  region: string;
  stories: Story[];
  storyById: Map<string, Story>;
}) {
  const { data: deps } = useStoryDeps(region);
  const { data: blockers } = useBlockers(region, false);
  const createDep = useCreateDep();
  const delDep = useDeleteDep();
  const createBlocker = useCreateBlocker();
  const resolveBlocker = useResolveBlocker();
  const delBlocker = useDeleteBlocker();

  const [kind, setKind] = useState<RelationKind>('dep');
  const [form, setForm] = useState({
    from_story: '',
    to_story: '',
    to_task: '',
    reason: '',
    // blocker fields
    blocking_task_story: '',
    blocking_task_id: '',
    description: '',
    severity: 'high' as 'critical' | 'high' | 'medium' | 'low',
    since_date: today(),
  });
  const { data: depTargetTasks } = useTasksByStory(form.to_story || null);
  const { data: blockerTargetTasks } = useTasksByStory(form.blocking_task_story || null);

  const reset = () =>
    setForm({
      from_story: '',
      to_story: '',
      to_task: '',
      reason: '',
      blocking_task_story: '',
      blocking_task_id: '',
      description: '',
      severity: 'high',
      since_date: today(),
    });

  const submit = () => {
    if (!form.from_story) return;
    if (kind === 'dep') {
      if (!form.to_story || form.from_story === form.to_story) return;
      createDep.mutate(
        {
          from_story: form.from_story,
          to_story: form.to_story,
          to_task: form.to_task || null,
          reason: form.reason || null,
        },
        { onSuccess: reset },
      );
      return;
    }
    if (kind === 'blocker_external') {
      if (!form.description) return;
      createBlocker.mutate(
        {
          story_id: form.from_story,
          blocker_description: form.description,
          severity: form.severity,
          since_date: form.since_date,
        },
        { onSuccess: reset },
      );
      return;
    }
    // blocker_internal
    if (!form.blocking_task_id) return;
    createBlocker.mutate(
      {
        story_id: form.from_story,
        blocking_task_id: form.blocking_task_id,
        blocker_description: form.description,
        severity: form.severity,
        since_date: form.since_date,
      },
      { onSuccess: reset },
    );
  };

  // Merge deps + blockers into one list, sorted newest-first
  const rows = useMemo(() => {
    type Row =
      | { kind: 'dep'; id: string; sort: string; fromStoryID: string; data: NonNullable<typeof deps>[number] }
      | { kind: 'blocker'; id: string; sort: string; fromStoryID: string; data: NonNullable<typeof blockers>[number] };
    const r: Row[] = [];
    (deps || []).forEach((d) =>
      r.push({ kind: 'dep', id: d.id, sort: d.id, fromStoryID: d.from_story, data: d }),
    );
    (blockers || []).forEach((b) =>
      r.push({ kind: 'blocker', id: b.id, sort: b.since_date + b.id, fromStoryID: b.story_id, data: b }),
    );
    return r.sort((a, b) => (a.sort > b.sort ? -1 : 1));
  }, [deps, blockers]);

  const isSubmitDisabled =
    createDep.isPending ||
    createBlocker.isPending ||
    !form.from_story ||
    (kind === 'dep' && (!form.to_story || form.from_story === form.to_story)) ||
    (kind === 'blocker_external' && !form.description) ||
    (kind === 'blocker_internal' && !form.blocking_task_id);

  return (
    <Card>
      <SectionHeader
        title="Dependencies & blockers"
        subtitle={`${deps?.length || 0} deps · ${(blockers || []).filter((b) => !b.resolved_at).length} unresolved blockers · task-linked items auto-resolve when the task is done`}
      />

      <FormBox>
        <FormBoxHeader>+ New relationship</FormBoxHeader>
        <FormGrid>
          <FullRow>
            <FieldLabel>Type</FieldLabel>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Chip type="button" $active={kind === 'dep'} onClick={() => setKind('dep')}>
                Dependency (story → story/task)
              </Chip>
              <Chip type="button" $active={kind === 'blocker_internal'} onClick={() => setKind('blocker_internal')}>
                Blocker — internal task
              </Chip>
              <Chip type="button" $active={kind === 'blocker_external'} onClick={() => setKind('blocker_external')}>
                Blocker — external (text)
              </Chip>
            </div>
          </FullRow>

          <div>
            <FieldLabel>{kind === 'dep' ? 'Story (dependent)' : 'Blocked story'} *</FieldLabel>
            <Select value={form.from_story} onChange={(e) => setForm({ ...form, from_story: e.target.value })}>
              <option value="">Pick story…</option>
              {stories.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </Select>
          </div>

          {kind === 'dep' && (
            <>
              <div>
                <FieldLabel>Depends on (story) *</FieldLabel>
                <Select
                  value={form.to_story}
                  onChange={(e) => setForm({ ...form, to_story: e.target.value, to_task: '' })}
                >
                  <option value="">Pick story…</option>
                  {stories.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <FieldLabel>On specific task (optional)</FieldLabel>
                <Select
                  value={form.to_task}
                  onChange={(e) => setForm({ ...form, to_task: e.target.value })}
                  disabled={!form.to_story || !depTargetTasks || depTargetTasks.length === 0}
                >
                  <option value="">Whole story (resolves when story done)</option>
                  {(depTargetTasks || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.status})
                    </option>
                  ))}
                </Select>
              </div>
              <FullRow>
                <FieldLabel>Reason (optional)</FieldLabel>
                <Input
                  placeholder="Needs SSO first"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                />
              </FullRow>
            </>
          )}

          {kind === 'blocker_internal' && (
            <>
              <div>
                <FieldLabel>Blocking task — source story *</FieldLabel>
                <Select
                  value={form.blocking_task_story}
                  onChange={(e) => setForm({ ...form, blocking_task_story: e.target.value, blocking_task_id: '' })}
                >
                  <option value="">Pick story…</option>
                  {stories.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <FieldLabel>Blocking task *</FieldLabel>
                <Select
                  value={form.blocking_task_id}
                  onChange={(e) => setForm({ ...form, blocking_task_id: e.target.value })}
                  disabled={!form.blocking_task_story || !blockerTargetTasks || blockerTargetTasks.length === 0}
                >
                  <option value="">Pick task…</option>
                  {(blockerTargetTasks || []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.status})
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <FieldLabel>Severity</FieldLabel>
                <Select
                  value={form.severity}
                  onChange={(e) => setForm({ ...form, severity: e.target.value as typeof form.severity })}
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </Select>
              </div>
              <div>
                <FieldLabel>Since</FieldLabel>
                <Input
                  type="date"
                  value={form.since_date}
                  onChange={(e) => setForm({ ...form, since_date: e.target.value })}
                />
              </div>
              <FullRow>
                <FieldLabel>Comment (optional)</FieldLabel>
                <Input
                  placeholder="Why is this task blocking?"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </FullRow>
            </>
          )}

          {kind === 'blocker_external' && (
            <>
              <div>
                <FieldLabel>Severity</FieldLabel>
                <Select
                  value={form.severity}
                  onChange={(e) => setForm({ ...form, severity: e.target.value as typeof form.severity })}
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </Select>
              </div>
              <div>
                <FieldLabel>Since</FieldLabel>
                <Input
                  type="date"
                  value={form.since_date}
                  onChange={(e) => setForm({ ...form, since_date: e.target.value })}
                />
              </div>
              <FullRow>
                <FieldLabel>Description *</FieldLabel>
                <Input
                  placeholder="Waiting on Legal review / WhatsApp verification"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </FullRow>
            </>
          )}

          <FullRow>
            <Btn $primary onClick={submit} disabled={isSubmitDisabled}>
              <FiPlus size={14} /> Add
            </Btn>
          </FullRow>
        </FormGrid>
      </FormBox>

      <ListHeader>
        <span>All relationships ({rows.length})</span>
      </ListHeader>
      <RowList>
        {rows.map((r) => {
          if (r.kind === 'dep') {
            const from = storyById.get(r.data.from_story);
            const to = storyById.get(r.data.to_story);
            return (
              <Row key={`dep-${r.id}`} style={{ ['--cols' as string]: '110px 1fr 24px 1fr 1.2fr 40px' }}>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 10,
                    background: theme.colors.vividOrange + '18',
                    color: theme.colors.vividOrange,
                    textTransform: 'uppercase',
                    letterSpacing: 0.3,
                    textAlign: 'center',
                  }}
                >
                  Dep
                </span>
                <div
                  style={{
                    fontWeight: 600,
                    color: theme.colors.charcoal,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {from?.title || '(deleted)'}
                </div>
                <div style={{ color: theme.colors.cadetGray, textAlign: 'center' }}>→</div>
                <div
                  style={{
                    color: theme.colors.charcoal,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {to?.title || '(deleted)'}
                  {r.data.to_task && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '1px 6px',
                        marginLeft: 6,
                        borderRadius: 10,
                        background: theme.colors.info + '18',
                        color: theme.colors.info,
                      }}
                    >
                      task-linked
                    </span>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: theme.colors.davysGray,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.data.reason || '—'}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Btn $danger $small onClick={() => delDep.mutate(r.id)}>
                    <FiTrash2 size={11} />
                  </Btn>
                </div>
              </Row>
            );
          }
          // blocker
          const b = r.data;
          const story = storyById.get(b.story_id);
          const sevCol =
            b.severity === 'critical'
              ? theme.colors.error
              : b.severity === 'high'
                ? theme.colors.warning
                : theme.colors.info;
          const isInternal = !!b.blocking_task_id;
          return (
            <Row key={`blk-${r.id}`} style={{ ['--cols' as string]: '110px 1fr 24px 1fr 100px 140px' }}>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: sevCol + '18',
                  color: sevCol,
                  textTransform: 'uppercase',
                  letterSpacing: 0.3,
                  textAlign: 'center',
                }}
                title={b.severity}
              >
                Blocker · {b.severity}
              </span>
              <div
                style={{
                  fontWeight: 600,
                  color: theme.colors.charcoal,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {story?.title || '(deleted story)'}
              </div>
              <div style={{ color: theme.colors.cadetGray, textAlign: 'center' }}>⚠</div>
              <div
                style={{
                  color: theme.colors.davysGray,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: '1px 6px',
                    borderRadius: 10,
                    background: isInternal ? theme.colors.info + '18' : theme.colors.lightGray,
                    color: isInternal ? theme.colors.info : theme.colors.davysGray,
                    flexShrink: 0,
                  }}
                >
                  {isInternal ? 'task-linked' : 'external'}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {b.blocker_description || (isInternal ? 'Waiting for task' : '—')}
                </span>
              </div>
              <div style={{ fontSize: 11, color: theme.colors.cadetGray }}>
                since {new Date(b.since_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {b.resolved_at && ' · ✓ resolved'}
              </div>
              <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                {!b.resolved_at && (
                  <Btn $small onClick={() => resolveBlocker.mutate(b.id)}>
                    <FiCheck size={11} /> Resolve
                  </Btn>
                )}
                <Btn $danger $small onClick={() => delBlocker.mutate(b.id)}>
                  <FiTrash2 size={11} />
                </Btn>
              </div>
            </Row>
          );
        })}
        {rows.length === 0 && <Empty>No dependencies or blockers yet.</Empty>}
      </RowList>
    </Card>
  );
}

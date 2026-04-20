import { useMemo, useState } from 'react';
import styled from 'styled-components';
import { useNavigate } from 'react-router-dom';
import { FiSearch, FiPlus, FiUsers, FiClock, FiLayers } from 'react-icons/fi';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { theme } from '../../styles/theme';
import { api } from '../../lib/api';
import { useBoardsOverview, type BoardOverview } from '../../hooks/useBoardsOverview';
import { useRegions } from '../../hooks/useRegions';
import { useAuth } from '../../hooks/useAuth';
import { usePersistedState } from '../../hooks/usePersistedState';
import { Avatar } from '../../components/ui/Avatar';

// ---------- layout ----------
const PageScroll = styled.div`
  flex: 1;
  overflow-y: auto;
  background: ${theme.colors.background};
`;

const Page = styled.div`
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

const ToolBar = styled.div`
  display: flex;
  gap: 10px;
  align-items: center;
  flex-wrap: wrap;
`;

const SearchWrap = styled.div`
  position: relative;
  flex: 1;
  min-width: 240px;
  max-width: 420px;

  svg {
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: ${theme.colors.cadetGray};
    pointer-events: none;
  }

  input {
    width: 100%;
    padding: 10px 14px 10px 38px;
    border: 1px solid ${theme.colors.border};
    border-radius: ${theme.borderRadius.md};
    font-size: 13px;
    background: ${theme.colors.white};

    &:focus {
      outline: none;
      border-color: ${theme.colors.vividOrange};
    }
  }
`;

const Checkbox = styled.label`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: ${theme.colors.davysGray};
  cursor: pointer;
  user-select: none;
`;

const NewBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  background: ${theme.colors.vividOrange};
  color: ${theme.colors.white};
  border: 1px solid ${theme.colors.vividOrange};
  border-radius: ${theme.borderRadius.md};
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    background: ${theme.colors.deepOrange};
    border-color: ${theme.colors.deepOrange};
  }
`;

// ---------- region tabs ----------
const RegionTabs = styled.div`
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  background: ${theme.colors.white};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  padding: 6px;
`;

const RegionTab = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: ${theme.borderRadius.md};
  background: ${(p) => (p.$active ? theme.colors.vividOrange + '18' : 'transparent')};
  border: 1px solid ${(p) => (p.$active ? theme.colors.vividOrange + '40' : 'transparent')};
  font-size: 13px;
  font-weight: 600;
  color: ${(p) => (p.$active ? theme.colors.charcoal : theme.colors.davysGray)};
  cursor: pointer;
  transition: ${theme.transitions.default};

  &:hover {
    background: ${(p) => (p.$active ? theme.colors.vividOrange + '18' : theme.colors.background)};
  }

  .count {
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 10px;
    background: ${(p) => (p.$active ? theme.colors.vividOrange : theme.colors.lightGray)};
    color: ${(p) => (p.$active ? 'white' : theme.colors.davysGray)};
  }
`;

// ---------- scope summary bar ----------
const ScopeBar = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 12px 16px;
  background: ${theme.colors.white};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  font-size: 13px;
`;

// ---------- board cards grid ----------
const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
`;

const Card = styled.div`
  background: ${theme.colors.white};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.lg};
  padding: 16px;
  cursor: pointer;
  transition: ${theme.transitions.default};
  display: flex;
  flex-direction: column;
  gap: 12px;

  &:hover {
    border-color: ${theme.colors.vividOrange}80;
    box-shadow: ${theme.shadows.card};
  }
`;

const CardHeader = styled.div`
  display: grid;
  grid-template-columns: 44px 1fr auto;
  gap: 12px;
  align-items: start;
`;

const BoardIcon = styled.div<{ $bg: string }>`
  width: 44px;
  height: 44px;
  border-radius: ${theme.borderRadius.md};
  background: ${(p) => p.$bg};
  color: ${theme.colors.charcoal};
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: ${theme.typography.fontFamily.primary};
  font-size: 14px;
  font-weight: 800;
  letter-spacing: 0.5px;
`;

const BoardTitle = styled.div`
  font-family: ${theme.typography.fontFamily.primary};
  font-size: 16px;
  font-weight: 700;
  color: ${theme.colors.charcoal};
  line-height: 1.25;
`;

const BoardDesc = styled.div`
  font-size: 12px;
  color: ${theme.colors.cadetGray};
  margin-top: 3px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
`;

const RolePill = styled.span<{ $color: string; $bg: string }>`
  display: inline-flex;
  align-items: center;
  padding: 3px 9px;
  border-radius: 10px;
  background: ${(p) => p.$bg};
  color: ${(p) => p.$color};
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-transform: uppercase;
  flex-shrink: 0;
`;

const RegionLabel = styled.div`
  font-size: 10px;
  font-weight: 700;
  color: ${theme.colors.cadetGray};
  letter-spacing: 0.6px;
  text-transform: uppercase;
`;

const StatsRow = styled.div`
  display: flex;
  gap: 20px;
`;

const Stat = styled.div<{ $accent?: string }>`
  display: flex;
  flex-direction: column;
  gap: 2px;

  .num {
    font-family: ${theme.typography.fontFamily.primary};
    font-size: 22px;
    font-weight: 800;
    line-height: 1;
    color: ${(p) => p.$accent || theme.colors.charcoal};
  }
  .label {
    font-size: 11px;
    color: ${theme.colors.cadetGray};
  }
`;

const ProgressRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
`;

const ProgressBar = styled.div`
  flex: 1;
  height: 6px;
  background: ${theme.colors.lightGray};
  border-radius: 3px;
  overflow: hidden;
`;

const ProgressFill = styled.div<{ $pct: number; $color: string }>`
  width: ${(p) => p.$pct}%;
  height: 100%;
  background: ${(p) => p.$color};
  transition: width 0.3s ease;
`;

const ProgressPct = styled.div`
  font-size: 11px;
  font-weight: 600;
  color: ${theme.colors.davysGray};
  min-width: 34px;
  text-align: right;
`;

const CardFooter = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-top: 1px solid ${theme.colors.border};
  padding-top: 10px;
  gap: 10px;
`;

const TimeAgo = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: ${theme.colors.cadetGray};
`;

const AvatarStack = styled.div`
  display: inline-flex;
  align-items: center;

  > * {
    margin-left: -6px;
    border: 2px solid ${theme.colors.white};
  }
  > :first-child {
    margin-left: 0;
  }
`;

const MoreAvatar = styled.div`
  margin-left: -6px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${theme.colors.lightGray};
  color: ${theme.colors.davysGray};
  font-size: 10px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid ${theme.colors.white};
`;

const CreateCard = styled.button`
  background: transparent;
  border: 2px dashed ${theme.colors.border};
  border-radius: ${theme.borderRadius.lg};
  padding: 32px 16px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: ${theme.transitions.default};
  min-height: 240px;
  color: ${theme.colors.cadetGray};

  &:hover {
    border-color: ${theme.colors.vividOrange};
    color: ${theme.colors.vividOrange};
  }

  .plus {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    border: 2px solid currentColor;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
  }

  .label {
    font-size: 14px;
    font-weight: 600;
  }
  .hint {
    font-size: 11px;
  }
`;

// ---------- create modal (reused from admin) ----------
const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
`;
const Modal = styled.div`
  background: white;
  border-radius: ${theme.borderRadius.xl};
  box-shadow: ${theme.shadows.xl};
  width: 92%;
  max-width: 440px;
`;
const ModalHeader = styled.div`
  padding: 16px 24px;
  border-bottom: 1px solid ${theme.colors.border};
  font-family: ${theme.typography.fontFamily.primary};
  font-size: 18px;
  font-weight: 700;
`;
const ModalBody = styled.div`padding: 20px 24px;`;
const ModalFooter = styled.div`
  padding: 12px 24px 20px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid ${theme.colors.border};
`;
const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 14px;
`;
const Label = styled.label`
  font-size: 12px;
  font-weight: 600;
  color: ${theme.colors.davysGray};
  text-transform: uppercase;
  letter-spacing: 0.3px;
`;
const Input = styled.input`
  padding: 10px 14px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  font-size: 13px;
`;
const Select = styled.select`
  padding: 10px 14px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  font-size: 13px;
  background: white;
`;
const Textarea = styled.textarea`
  padding: 10px 14px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  min-height: 68px;
`;
const Hint = styled.div`
  font-size: 11px;
  color: ${theme.colors.cadetGray};
  margin-top: 2px;
`;
const ModalBtn = styled.button<{ $primary?: boolean }>`
  padding: 8px 16px;
  border-radius: ${theme.borderRadius.md};
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  ${(p) =>
    p.$primary
      ? `background: ${theme.colors.vividOrange}; color: white; border: 1px solid ${theme.colors.vividOrange};`
      : `background: white; border: 1px solid ${theme.colors.border}; color: ${theme.colors.charcoal};`}
`;

// ---------- helpers ----------
function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Deterministic soft color per board name
function iconBg(name: string): string {
  const hues = ['#E8EAF6', '#E0F2F1', '#FFF3E0', '#FCE4EC', '#F3E5F5', '#E1F5FE', '#F1F8E9'];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return hues[h % hues.length];
}

function timeAgo(iso: string | null): string {
  if (!iso) return 'no activity';
  const ms = Date.now() - new Date(iso).getTime();
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  return `${mo}mo ago`;
}

function roleColors(role: string | null): { color: string; bg: string; label: string } {
  switch (role) {
    case 'team_lead':
      return { color: theme.colors.vividOrange, bg: theme.colors.vividOrange + '18', label: 'Admin' };
    case 'trainee':
      return { color: '#9C27B0', bg: '#9C27B018', label: 'Trainee' };
    case 'member':
      return { color: theme.colors.info, bg: theme.colors.info + '18', label: 'Member' };
    default:
      return { color: theme.colors.cadetGray, bg: theme.colors.lightGray, label: 'Viewer' };
  }
}

function progressColor(pct: number): string {
  if (pct >= 70) return theme.colors.success;
  if (pct >= 40) return theme.colors.vividOrange;
  if (pct >= 20) return theme.colors.warning;
  return theme.colors.info;
}

// ============================================================
export default function YourBoardsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isCLevel = user?.role === 'clevel';
  const { data: overview, isLoading } = useBoardsOverview();
  const { data: regions } = useRegions();

  const [search, setSearch] = usePersistedState<string>('yourBoards:search', '');
  const [includeArchived, setIncludeArchived] = usePersistedState<boolean>('yourBoards:archived', false);
  const [activeRegion, setActiveRegion] = usePersistedState<string>('yourBoards:region', 'all');
  const [showCreate, setShowCreate] = useState(false);
  const [newBoard, setNewBoard] = useState<{
    name: string;
    description: string;
    region_id: string;
    office: string;
  }>({ name: '', description: '', region_id: '', office: '' });

  const qc = useQueryClient();
  const createTeam = useMutation({
    mutationFn: (input: {
      name: string;
      description?: string;
      region_id?: string;
      office?: string;
    }) => api.post('/api/v1/teams', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['boards-overview'] });
      qc.invalidateQueries({ queryKey: ['teams'] });
      setShowCreate(false);
      setNewBoard({ name: '', description: '', region_id: '', office: '' });
    },
  });

  // When user picks a region in the create modal, pre-select the first office of that region
  const selectedRegion = regions?.find((r) => r.id === newBoard.region_id);
  const regionOffices = selectedRegion?.offices || [];

  // Only active boards when "archived" is off. Board rows have `is_active` flag.
  const visibleBoards = useMemo<BoardOverview[]>(() => {
    if (!overview) return [];
    return overview.filter((b) => (includeArchived ? true : b.is_active));
  }, [overview, includeArchived]);

  // Counts per region for tabs
  const regionCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of visibleBoards) {
      const key = b.region_id || 'unassigned';
      map.set(key, (map.get(key) || 0) + 1);
    }
    return map;
  }, [visibleBoards]);

  // Filter by active region + search
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visibleBoards.filter((b) => {
      if (activeRegion !== 'all' && (b.region_id || 'unassigned') !== activeRegion) return false;
      if (q && !b.name.toLowerCase().includes(q) && !(b.description || '').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [visibleBoards, activeRegion, search]);

  const totalStories = filtered.reduce((a, b) => a + b.stories_count, 0);
  const totalTasks = filtered.reduce((a, b) => a + b.tasks_count, 0);

  const activeRegionLabel =
    activeRegion === 'all'
      ? 'all regions'
      : regions?.find((r) => r.id === activeRegion)
        ? `${regions.find((r) => r.id === activeRegion)!.code} · ${regions.find((r) => r.id === activeRegion)!.name}`
        : 'unassigned';

  return (
    <PageScroll>
      <Page>
        <TitleBar>
          <div>
            <Title>Your boards</Title>
            <Subtitle>Organised by region across QRT's global offices</Subtitle>
          </div>
        </TitleBar>

        <ToolBar>
          <SearchWrap>
            <FiSearch size={14} />
            <input
              placeholder="Search boards…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              type="search"
            />
          </SearchWrap>
          <Checkbox>
            <input
              type="checkbox"
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
            Archived
          </Checkbox>
          {isCLevel && (
            <NewBtn onClick={() => setShowCreate(true)}>
              <FiPlus size={14} /> New board
            </NewBtn>
          )}
        </ToolBar>

        {/* Region tabs */}
        <RegionTabs>
          <RegionTab $active={activeRegion === 'all'} onClick={() => setActiveRegion('all')}>
            All regions
            <span className="count">{visibleBoards.length}</span>
          </RegionTab>
          {(regions || [])
            .filter((r) => r.is_active)
            .map((r) => {
              const count = regionCounts.get(r.id) || 0;
              if (count === 0 && activeRegion !== r.id) return null; // hide empty regions unless active
              return (
                <RegionTab
                  key={r.id}
                  $active={activeRegion === r.id}
                  onClick={() => setActiveRegion(r.id)}
                >
                  <span>{r.code}</span>
                  <span style={{ color: theme.colors.cadetGray, fontWeight: 500, fontSize: 11 }}>{r.name}</span>
                  <span className="count">{count}</span>
                </RegionTab>
              );
            })}
          {(regionCounts.get('unassigned') || 0) > 0 && (
            <RegionTab
              $active={activeRegion === 'unassigned'}
              onClick={() => setActiveRegion('unassigned')}
            >
              Unassigned
              <span className="count">{regionCounts.get('unassigned') || 0}</span>
            </RegionTab>
          )}
        </RegionTabs>

        <ScopeBar>
          <div>
            Showing boards in <b>{activeRegionLabel}</b>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ color: theme.colors.cadetGray }}>
              {filtered.length} boards · {totalStories} stories · {totalTasks} tasks
            </span>
            {isCLevel && activeRegion !== 'all' && activeRegion !== 'unassigned' && (
              <button
                onClick={() => navigate(`/board/region/${activeRegion}`)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  background: theme.colors.white,
                  border: `1px solid ${theme.colors.vividOrange}`,
                  color: theme.colors.vividOrange,
                  borderRadius: theme.borderRadius.md,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <FiLayers size={13} /> Open region board
              </button>
            )}
          </div>
        </ScopeBar>

        <Grid>
          {isLoading && (
            <div style={{ gridColumn: '1/-1', padding: 40, textAlign: 'center', color: theme.colors.cadetGray }}>
              Loading…
            </div>
          )}
          {!isLoading &&
            filtered.map((b) => {
              const rc = roleColors(b.my_role);
              return (
                <Card key={b.id} onClick={() => navigate(`/board/${b.id}`)}>
                  <CardHeader>
                    <BoardIcon $bg={iconBg(b.name)}>{initials(b.name)}</BoardIcon>
                    <div style={{ minWidth: 0 }}>
                      <BoardTitle>{b.name}</BoardTitle>
                      {b.description && <BoardDesc>{b.description}</BoardDesc>}
                    </div>
                    <RolePill $color={rc.color} $bg={rc.bg}>
                      {rc.label}
                    </RolePill>
                  </CardHeader>

                  {(b.region_code || b.office) && (
                    <RegionLabel>
                      {b.region_code || '—'}
                      {b.office ? ` · ${b.office}` : ''}
                    </RegionLabel>
                  )}

                  <StatsRow>
                    <Stat>
                      <span className="num">{b.stories_count}</span>
                      <span className="label">Stories</span>
                    </Stat>
                    <Stat>
                      <span className="num">{b.tasks_count}</span>
                      <span className="label">Tasks</span>
                    </Stat>
                    <Stat $accent={b.overdue_count > 0 ? theme.colors.error : undefined}>
                      <span className="num">{b.overdue_count}</span>
                      <span className="label">Overdue</span>
                    </Stat>
                  </StatsRow>

                  <ProgressRow>
                    <ProgressPct>{b.progress_pct}%</ProgressPct>
                    <ProgressBar>
                      <ProgressFill $pct={b.progress_pct} $color={progressColor(b.progress_pct)} />
                    </ProgressBar>
                  </ProgressRow>

                  <CardFooter>
                    <AvatarStack>
                      {b.members_preview.slice(0, 3).map((name, i) => (
                        <Avatar key={i} name={name} size={24} />
                      ))}
                      {b.member_count > 3 && <MoreAvatar>+{b.member_count - 3}</MoreAvatar>}
                      {b.members_preview.length === 0 && (
                        <span style={{ fontSize: 11, color: theme.colors.cadetGray }}>
                          <FiUsers size={11} /> no members
                        </span>
                      )}
                    </AvatarStack>
                    <TimeAgo>
                      <FiClock size={11} />
                      {timeAgo(b.last_activity_at)}
                    </TimeAgo>
                  </CardFooter>
                </Card>
              );
            })}
          {!isLoading && isCLevel && (
            <CreateCard onClick={() => setShowCreate(true)}>
              <span className="plus">+</span>
              <span className="label">Create new board</span>
              <span className="hint">{activeRegionLabel}</span>
            </CreateCard>
          )}
          {!isLoading && filtered.length === 0 && !isCLevel && (
            <div style={{ gridColumn: '1/-1', padding: 40, textAlign: 'center', color: theme.colors.cadetGray }}>
              No boards match.
            </div>
          )}
        </Grid>
      </Page>

      {showCreate && (
        <Overlay onClick={(e) => e.target === e.currentTarget && setShowCreate(false)}>
          <Modal>
            <ModalHeader>Create board</ModalHeader>
            <ModalBody>
              <FormGroup>
                <Label>Name *</Label>
                <Input
                  autoFocus
                  placeholder="e.g. Platform v3"
                  value={newBoard.name}
                  onChange={(e) => setNewBoard((p) => ({ ...p, name: e.target.value }))}
                />
              </FormGroup>
              <FormGroup>
                <Label>Description</Label>
                <Textarea
                  placeholder="What is this board for? (optional)"
                  value={newBoard.description}
                  onChange={(e) => setNewBoard((p) => ({ ...p, description: e.target.value }))}
                />
              </FormGroup>
              <FormGroup>
                <Label>Region *</Label>
                <Select
                  value={newBoard.region_id}
                  onChange={(e) => {
                    const rid = e.target.value;
                    const r = regions?.find((x) => x.id === rid);
                    setNewBoard((p) => ({
                      ...p,
                      region_id: rid,
                      // pre-select the first office of the newly chosen region
                      office: r?.offices?.[0] || '',
                    }));
                  }}
                >
                  <option value="">Choose a region…</option>
                  {(regions || [])
                    .filter((r) => r.is_active)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.code} — {r.name}
                      </option>
                    ))}
                </Select>
                {!newBoard.region_id && (
                  <Hint>All boards belong to a region — pick one so people in that region can see it.</Hint>
                )}
              </FormGroup>
              <FormGroup>
                <Label>Office</Label>
                {regionOffices.length > 0 ? (
                  <Select
                    value={newBoard.office}
                    onChange={(e) => setNewBoard((p) => ({ ...p, office: e.target.value }))}
                  >
                    {regionOffices.map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <>
                    <Input
                      placeholder={newBoard.region_id ? 'Region has no offices yet' : 'Pick a region first'}
                      value={newBoard.office}
                      onChange={(e) => setNewBoard((p) => ({ ...p, office: e.target.value }))}
                      disabled={!newBoard.region_id}
                    />
                    {newBoard.region_id && (
                      <Hint>
                        No offices defined for this region. Add offices in Organization → Regions.
                      </Hint>
                    )}
                  </>
                )}
              </FormGroup>
            </ModalBody>
            <ModalFooter>
              <ModalBtn onClick={() => setShowCreate(false)}>Cancel</ModalBtn>
              <ModalBtn
                $primary
                onClick={() =>
                  createTeam.mutate({
                    name: newBoard.name.trim(),
                    description: newBoard.description.trim() || undefined,
                    region_id: newBoard.region_id || undefined,
                    office: newBoard.office.trim() || undefined,
                  })
                }
                disabled={!newBoard.name.trim() || !newBoard.region_id || createTeam.isPending}
              >
                {createTeam.isPending ? 'Creating…' : 'Create'}
              </ModalBtn>
            </ModalFooter>
          </Modal>
        </Overlay>
      )}
    </PageScroll>
  );
}

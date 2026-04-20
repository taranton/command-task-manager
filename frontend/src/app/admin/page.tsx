import { useState, useMemo } from 'react';
import { usePersistedState } from '../../hooks/usePersistedState';
import styled from 'styled-components';
import { FiPlus, FiUsers, FiUserPlus, FiUserCheck, FiUserX, FiShield, FiGlobe, FiTrash2, FiEdit2 } from 'react-icons/fi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { theme } from '../../styles/theme';
import { api } from '../../lib/api';
import { Avatar } from '../../components/ui/Avatar';
import { useAuth } from '../../hooks/useAuth';
import {
  useRegions,
  useCreateRegion,
  useUpdateRegion,
  useDeleteRegion,
  useRegionArchives,
  useRegionArchive,
  type RegionArchiveDetail,
} from '../../hooks/useRegions';
import type { Team, User, Region } from '../../types';
import { REGION_PRESETS, findPresetByLabel } from '../../lib/regionPresets';
import { Card, SectionHeader, Segmented } from '../../components/clevel/primitives';
import { StatTile, StatGrid } from '../../components/clevel/StatTile';

// ---- Layout ----
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
  row-gap: 12px;
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

// ---- Board grid ----
const BoardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
`;

const BoardCard = styled.div<{ $selected: boolean }>`
  background: ${theme.colors.white};
  border: 1px solid ${(p) => (p.$selected ? theme.colors.vividOrange : theme.colors.border)};
  outline: ${(p) => (p.$selected ? `2px solid ${theme.colors.vividOrange}20` : 'none')};
  border-radius: ${theme.borderRadius.md};
  cursor: pointer;
  transition: ${theme.transitions.default};
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  &:hover {
    border-color: ${theme.colors.vividOrange}80;
    box-shadow: ${theme.shadows.card};
  }
`;

const BoardHeader = styled.div`
  padding: 14px 16px 10px;
`;

const BoardName = styled.div`
  font-family: ${theme.typography.fontFamily.primary};
  font-size: 16px;
  font-weight: 700;
  color: ${theme.colors.charcoal};
  line-height: 1.3;
`;

const BoardSubtitle = styled.div`
  font-size: 11px;
  color: ${theme.colors.cadetGray};
  margin-top: 3px;
  display: flex;
  align-items: center;
  gap: 6px;
`;

// Compact settings block: label/value grid, separated from header
const BoardSettings = styled.div`
  padding: 10px 16px;
  border-top: 1px solid ${theme.colors.border};
  background: ${theme.colors.background};
  display: grid;
  grid-template-columns: auto 1fr;
  row-gap: 6px;
  column-gap: 10px;
  font-size: 11px;
`;

const SettingLabel = styled.div`
  color: ${theme.colors.cadetGray};
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  font-size: 10px;
  display: flex;
  align-items: center;
  gap: 4px;

  svg {
    color: ${theme.colors.silver};
  }
`;

// Value selects should not bleed outside the card
const SettingSelect = styled.select`
  background: white;
  border: 1px solid ${theme.colors.border};
  border-radius: 4px;
  font-size: 11px;
  padding: 3px 6px;
  width: 100%;
  min-width: 0;
  cursor: pointer;
  color: ${theme.colors.charcoal};

  &:disabled {
    background: ${theme.colors.background};
    color: ${theme.colors.cadetGray};
    cursor: not-allowed;
  }
`;

const BoardFooter = styled.div`
  padding: 10px 16px 12px;
`;

const LeadRow = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px 4px 4px;
  background: ${theme.colors.vividOrange}15;
  border-radius: ${theme.borderRadius.pill};
  font-size: 12px;
  color: ${theme.colors.vividOrange};
  font-weight: 600;
  max-width: 100%;
  overflow: hidden;

  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

// ---- Data rows (unified for members / users / pending) ----
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
  transition: ${theme.transitions.default};

  &:hover {
    border-color: ${theme.colors.vividOrange}40;
  }
`;

const RowHeader = styled.div`
  display: grid;
  grid-template-columns: var(--cols, 1fr);
  gap: 12px;
  align-items: center;
  padding: 4px 12px;
  font-size: 10px;
  font-weight: 700;
  color: ${theme.colors.cadetGray};
  text-transform: uppercase;
  letter-spacing: 0.6px;
`;

const UserCell = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
`;

const UserInfo = styled.div`
  min-width: 0;
  span {
    display: block;
  }
  span:first-child {
    font-weight: 600;
    color: ${theme.colors.charcoal};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  span:last-child {
    font-size: 11px;
    color: ${theme.colors.cadetGray};
  }
`;

const Select = styled.select`
  padding: 6px 10px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.sm};
  font-size: 12px;
  background: white;
  cursor: pointer;
  color: ${theme.colors.charcoal};
  font-family: ${theme.typography.fontFamily.secondary};

  &:focus {
    border-color: ${theme.colors.vividOrange};
    outline: none;
  }
`;

// ---- Buttons ----
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
      ? `background: ${theme.colors.vividOrange}; color: white; border: 1px solid ${theme.colors.vividOrange}; &:hover { background: ${theme.colors.deepOrange}; border-color: ${theme.colors.deepOrange}; }`
      : p.$danger
        ? `background: ${theme.colors.errorLight}; color: ${theme.colors.error}; border: 1px solid ${theme.colors.error}30; &:hover { background: ${theme.colors.error}; color: white; border-color: ${theme.colors.error}; }`
        : `background: white; border: 1px solid ${theme.colors.border}; color: ${theme.colors.charcoal}; &:hover { background: ${theme.colors.background}; }`}
`;

// ---- Board-role badge ----
const RolePill = styled.span<{ $role: string }>`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: ${theme.borderRadius.pill};
  font-size: 11px;
  font-weight: 600;
  background: ${(p) =>
    p.$role === 'team_lead'
      ? theme.colors.vividOrange + '18'
      : p.$role === 'trainee'
        ? '#9C27B018'
        : theme.colors.info + '18'};
  color: ${(p) =>
    p.$role === 'team_lead'
      ? theme.colors.vividOrange
      : p.$role === 'trainee'
        ? '#9C27B0'
        : theme.colors.info};
`;

// ---- Modal ----
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
  width: 90%;
  max-width: 440px;
`;
const ModalHeader = styled.div`
  padding: 16px 24px;
  border-bottom: 1px solid ${theme.colors.border};
  font-family: ${theme.typography.fontFamily.primary};
  font-size: 18px;
  font-weight: 700;
`;
const ModalBody = styled.div`
  padding: 20px 24px;
`;
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
  &:focus {
    border-color: ${theme.colors.vividOrange};
    outline: none;
  }
`;

// ---- Add member ----
const SearchInput = styled.input`
  padding: 8px 12px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  font-size: 13px;
  width: 100%;
  margin-bottom: 8px;
  &:focus {
    border-color: ${theme.colors.vividOrange};
    outline: none;
  }
`;
const AddList = styled.div`
  max-height: 260px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;
const AddRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: ${theme.borderRadius.md};
  &:hover {
    background: ${theme.colors.background};
  }
`;

const ROLES: Record<string, string> = { team_lead: 'Team Lead', member: 'Member', trainee: 'Trainee' };

function AddMemberSearch({
  users,
  teams,
  currentMembers,
  onAdd,
}: {
  users: User[];
  teams: Team[];
  currentMembers: User[];
  onAdd: (userId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const memberIds = new Set(currentMembers.map((m) => m.id));
  const available = users
    .filter((u) => !memberIds.has(u.id) && u.role !== 'clevel')
    .filter(
      (u) =>
        !search ||
        u.full_name.toLowerCase().includes(search.toLowerCase()) ||
        u.email.toLowerCase().includes(search.toLowerCase()),
    );
  const getTeamName = (teamId?: string) => teams.find((t) => t.id === teamId)?.name;

  return (
    <div>
      <SearchInput placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <AddList>
        {available.length > 0 ? (
          available.map((u) => {
            const fromTeam = getTeamName(u.team_id);
            return (
              <AddRow key={u.id}>
                <Avatar name={u.full_name} size={28} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: theme.colors.charcoal }}>{u.full_name}</div>
                  <div style={{ fontSize: 11, color: theme.colors.cadetGray }}>{fromTeam ? `Currently in ${fromTeam}` : 'Unassigned'}</div>
                </div>
                <Btn $primary $small onClick={() => onAdd(u.id)}>
                  +
                </Btn>
              </AddRow>
            );
          })
        ) : (
          <div style={{ textAlign: 'center', color: theme.colors.cadetGray, padding: 16, fontSize: 12 }}>
            {search ? 'No users found' : 'No available users'}
          </div>
        )}
      </AddList>
    </div>
  );
}

type TabKey = 'boards' | 'users' | 'pending' | 'regions';

export default function AdminPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const isCLevel = me?.role === 'clevel';
  const isLead = me?.role === 'team_lead';
  const [tab, setTab] = usePersistedState<TabKey>('admin:tab', 'boards');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [boardsSearch, setBoardsSearch] = usePersistedState<string>('admin:boardsSearch', '');
  const [boardsFilterRegion, setBoardsFilterRegion] = usePersistedState<string>('admin:boardsFilterRegion', '');
  const [boardsFilterOffice, setBoardsFilterOffice] = usePersistedState<string>('admin:boardsFilterOffice', '');
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: '', office: '' });

  const { data: teams } = useQuery<Team[]>({ queryKey: ['teams'], queryFn: () => api.get('/api/v1/teams') });
  const { data: users } = useQuery<User[]>({ queryKey: ['users'], queryFn: () => api.get('/api/v1/users') });
  const { data: regions } = useRegions();
  const { data: pending } = useQuery<User[]>({
    queryKey: ['users-pending'],
    queryFn: () => api.get('/api/v1/users/pending'),
    enabled: isCLevel,
  });
  const { data: members } = useQuery<User[]>({
    queryKey: ['team-members', selectedTeamId],
    queryFn: () => api.get(`/api/v1/teams/${selectedTeamId}/members`),
    enabled: !!selectedTeamId,
  });

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => api.patch(`/api/v1/users/${id}/role`, { role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['team-members'] });
    },
  });
  const changeBoardRole = useMutation({
    mutationFn: ({ boardId, userId, role }: { boardId: string; userId: string; role: string }) =>
      api.patch(`/api/v1/teams/${boardId}/members/${userId}/role`, { role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-members'] });
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['teams'] });
    },
  });
  const assignTeam = useMutation({
    mutationFn: ({ id, teamId }: { id: string; teamId: string | null }) =>
      api.patch(`/api/v1/users/${id}/team`, { team_id: teamId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
      qc.invalidateQueries({ queryKey: ['team-members'] });
      qc.invalidateQueries({ queryKey: ['teams'] });
    },
  });
  const createTeam = useMutation({
    mutationFn: (input: { name: string; office?: string }) => api.post('/api/v1/teams', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      setShowCreateTeam(false);
      setNewTeam({ name: '', office: '' });
    },
  });
  const assignRegion = useMutation({
    mutationFn: ({ userId, regionId }: { userId: string; regionId: string | null }) =>
      api.patch(`/api/v1/users/${userId}/region`, { region_id: regionId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
  const assignBoardRegion = useMutation({
    mutationFn: ({ boardId, regionId }: { boardId: string; regionId: string | null }) =>
      api.patch(`/api/v1/teams/${boardId}/region`, { region_id: regionId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
    },
  });
  const updateBoardOffice = useMutation({
    mutationFn: ({ boardId, office }: { boardId: string; office: string }) =>
      api.patch(`/api/v1/teams/${boardId}`, { office }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      qc.invalidateQueries({ queryKey: ['analytics'] });
    },
  });
  const approveUser = useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/users/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users-pending'] });
      qc.invalidateQueries({ queryKey: ['users'] });
    },
  });
  const rejectUser = useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/users/${id}/reject`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['users-pending'] });
    },
  });

  if (!isCLevel && !isLead) {
    return (
      <PageScroll>
        <Page>
          <Card>
            <div style={{ color: theme.colors.cadetGray, padding: 48, textAlign: 'center' }}>
              Only C-Level and Team Leads can access this page.
            </div>
          </Card>
        </Page>
      </PageScroll>
    );
  }

  const baseTeams = isLead ? teams?.filter((t) => t.id === me?.team_id) : teams;
  const allOffices = useMemo(() => {
    const s = new Set<string>();
    (baseTeams || []).forEach((t) => {
      if (t.office) s.add(t.office);
    });
    return Array.from(s).sort();
  }, [baseTeams]);
  const visibleTeams = useMemo(() => {
    let list = baseTeams || [];
    if (boardsSearch.trim()) {
      const q = boardsSearch.trim().toLowerCase();
      list = list.filter((t) => t.name.toLowerCase().includes(q));
    }
    if (boardsFilterRegion) {
      list = list.filter((t) => t.region_id === boardsFilterRegion);
    }
    if (boardsFilterOffice) {
      list = list.filter((t) => (t.office || '') === boardsFilterOffice);
    }
    return list;
  }, [baseTeams, boardsSearch, boardsFilterRegion, boardsFilterOffice]);
  const selectedTeam = teams?.find((t) => t.id === selectedTeamId);
  const pendingCount = pending?.length || 0;

  // Stats
  const boardCount = teams?.length || 0;
  const userCount = users?.length || 0;
  const clevelCount = users?.filter((u) => u.role === 'clevel').length || 0;
  const leadCount = teams?.filter((t) => t.lead).length || 0;

  const tabOptions: { value: TabKey; label: string }[] = [
    { value: 'boards', label: 'Boards' },
    ...(isCLevel ? ([{ value: 'users', label: 'All Users' }] as const) : []),
    ...(isCLevel ? ([{ value: 'regions', label: 'Regions' }] as const) : []),
    ...(isCLevel
      ? ([{ value: 'pending', label: pendingCount > 0 ? `Pending · ${pendingCount}` : 'Pending' }] as const)
      : []),
  ];

  return (
    <PageScroll>
    <Page>
      <TitleBar>
        <div>
          <Eyebrow>Administration</Eyebrow>
          <Title>Organization</Title>
          <Subtitle>Manage boards, membership, regions and user access.</Subtitle>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Segmented options={tabOptions} value={tab} onChange={(v) => setTab(v as TabKey)} />
          {isCLevel && (
            <Btn $primary onClick={() => setShowCreateTeam(true)}>
              <FiPlus size={14} /> New Board
            </Btn>
          )}
        </div>
      </TitleBar>

      {/* KPI strip */}
      {isCLevel && (
        <StatGrid>
          <StatTile label="Boards" value={boardCount} hint={`${leadCount} with a lead`} accent={theme.colors.vividOrange} />
          <StatTile label="Users" value={userCount} hint={`${clevelCount} C-Level`} accent={theme.colors.info} />
          <StatTile
            label="Pending"
            value={pendingCount}
            hint={pendingCount === 0 ? 'Nothing to review' : 'Awaiting approval'}
            accent={pendingCount > 0 ? theme.colors.error : theme.colors.success}
          />
          <StatTile
            label="Regions"
            value={regions?.length || 0}
            hint="Data isolation zones"
            accent={theme.colors.status.in_review}
          />
        </StatGrid>
      )}

      {/* ---- Boards tab ---- */}
      {tab === 'boards' && (
        <Card>
          <SectionHeader
            title="Boards"
            subtitle={`${visibleTeams.length} of ${baseTeams?.length || 0} · click a board to manage its members`}
          />

          {/* Filters */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 180px 180px',
              gap: 10,
              marginBottom: 16,
            }}
          >
            <input
              type="search"
              placeholder="Search boards by name…"
              value={boardsSearch}
              onChange={(e) => setBoardsSearch(e.target.value)}
              style={{
                padding: '8px 12px',
                border: `1px solid ${theme.colors.border}`,
                borderRadius: theme.borderRadius.md,
                fontSize: 13,
                background: 'white',
              }}
            />
            <Select value={boardsFilterRegion} onChange={(e) => setBoardsFilterRegion(e.target.value)}>
              <option value="">All regions</option>
              {(regions || []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.code})
                </option>
              ))}
            </Select>
            <Select value={boardsFilterOffice} onChange={(e) => setBoardsFilterOffice(e.target.value)}>
              <option value="">All offices</option>
              {allOffices.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          </div>

          <BoardGrid>
            {visibleTeams.map((t) => {
              const reg = regions?.find((r) => r.id === t.region_id);
              const officeList = reg?.offices || [];
              const currentOffice = t.office || '';
              const officeInList = !!currentOffice && officeList.includes(currentOffice);
              return (
                <BoardCard key={t.id} $selected={selectedTeamId === t.id} onClick={() => setSelectedTeamId(t.id)}>
                    <BoardHeader>
                      <BoardName>{t.name}</BoardName>
                      <BoardSubtitle>
                        <FiUsers size={12} /> {t.member_count} {t.member_count === 1 ? 'member' : 'members'}
                      </BoardSubtitle>
                    </BoardHeader>

                    <BoardSettings onClick={(e) => e.stopPropagation()}>
                      <SettingLabel>
                        <FiGlobe size={11} /> Region
                      </SettingLabel>
                      <SettingSelect
                        value={t.region_id || ''}
                        onChange={(e) => assignBoardRegion.mutate({ boardId: t.id, regionId: e.target.value || null })}
                      >
                        <option value="">No region</option>
                        {(regions || []).map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name}
                          </option>
                        ))}
                      </SettingSelect>

                      <SettingLabel>Office</SettingLabel>
                      <SettingSelect
                        value={currentOffice}
                        disabled={!reg}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v !== currentOffice) updateBoardOffice.mutate({ boardId: t.id, office: v });
                        }}
                      >
                        <option value="">{reg ? '— Not assigned —' : '— Set region first —'}</option>
                        {officeList.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                        {currentOffice && !officeInList && (
                          <option value={currentOffice}>{currentOffice} (legacy)</option>
                        )}
                      </SettingSelect>
                    </BoardSettings>

                    <BoardFooter>
                      {t.lead ? (
                        <LeadRow title={t.lead.full_name}>
                          <Avatar name={t.lead.full_name} size={18} />
                          <span>{t.lead.full_name}</span>
                        </LeadRow>
                      ) : (
                        <span style={{ fontSize: 11, color: theme.colors.cadetGray, fontStyle: 'italic' }}>
                          No team lead
                        </span>
                      )}
                    </BoardFooter>
                </BoardCard>
              );
            })}
          </BoardGrid>
          {visibleTeams.length === 0 && (
            <div
              style={{
                padding: 24,
                textAlign: 'center',
                color: theme.colors.cadetGray,
                fontSize: 13,
                background: theme.colors.background,
                borderRadius: theme.borderRadius.md,
              }}
            >
              No boards match your filters.
            </div>
          )}
        </Card>
      )}

      {tab === 'boards' && selectedTeam && (
        <Card>
          <SectionHeader
            title={`${selectedTeam.name} — members`}
            subtitle={`${members?.length || 0} ${members?.length === 1 ? 'member' : 'members'}`}
            action={
              <Btn $small onClick={() => setSelectedTeamId(null)}>
                Close
              </Btn>
            }
          />
          <RowList>
            <RowHeader style={{ ['--cols' as string]: '2fr 1.5fr 1fr 80px' }}>
              <div>User</div>
              <div>Email</div>
              <div>Role on board</div>
              <div />
            </RowHeader>
            {members?.map((m) => {
              const hasOtherLead = members?.some((x) => x.role === 'team_lead' && x.id !== m.id);
              const boardRoles = [
                ...(!hasOtherLead || m.role === 'team_lead' ? [['team_lead', 'Team Lead']] : []),
                ['member', 'Member'],
                ['trainee', 'Trainee'],
              ] as [string, string][];
              return (
                <Row key={m.id} style={{ ['--cols' as string]: '2fr 1.5fr 1fr 80px' }}>
                  <UserCell>
                    <Avatar name={m.full_name} size={30} />
                    <UserInfo>
                      <span>{m.full_name}</span>
                    </UserInfo>
                  </UserCell>
                  <div style={{ color: theme.colors.davysGray, fontSize: 12 }}>{m.email}</div>
                  <div>
                    {isCLevel || isLead ? (
                      <Select
                        value={m.role}
                        onChange={(e) => selectedTeamId && changeBoardRole.mutate({ boardId: selectedTeamId, userId: m.id, role: e.target.value })}
                      >
                        {boardRoles.map(([k, v]) => (
                          <option key={k} value={k}>
                            {v}
                          </option>
                        ))}
                      </Select>
                    ) : (
                      <RolePill $role={m.role}>{ROLES[m.role]}</RolePill>
                    )}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <Btn $danger $small onClick={() => assignTeam.mutate({ id: m.id, teamId: null })}>
                      Remove
                    </Btn>
                  </div>
                </Row>
              );
            })}
            {(!members || members.length === 0) && (
              <div style={{ padding: 24, textAlign: 'center', color: theme.colors.cadetGray, fontSize: 13 }}>
                No members yet — add someone below.
              </div>
            )}
          </RowList>

          {(isCLevel || isLead) && (
            <div style={{ marginTop: 22 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: theme.colors.cadetGray,
                  textTransform: 'uppercase',
                  letterSpacing: 0.6,
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <FiUserPlus size={12} /> Add to board
              </div>
              <AddMemberSearch
                users={users || []}
                teams={teams || []}
                currentMembers={members || []}
                onAdd={(userId) => assignTeam.mutate({ id: userId, teamId: selectedTeam.id })}
              />
            </div>
          )}
        </Card>
      )}

      {/* ---- Users tab ---- */}
      {tab === 'users' && isCLevel && (
        <Card>
          <SectionHeader title="All users" subtitle="Per-board roles, region, and C-Level access" />
          <RowList>
            <RowHeader style={{ ['--cols' as string]: '2fr 2.2fr 1fr 1fr' }}>
              <div>User</div>
              <div>Boards & roles</div>
              <div>Region</div>
              <div>Access</div>
            </RowHeader>
            {users?.map((u) => (
              <Row key={u.id} style={{ ['--cols' as string]: '2fr 2.2fr 1fr 1fr' }}>
                <UserCell>
                  <Avatar name={u.full_name} size={30} />
                  <UserInfo>
                    <span>{u.full_name}</span>
                    <span>{u.email}</span>
                  </UserInfo>
                </UserCell>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {u.boards && u.boards.length > 0 ? (
                    u.boards.map((b) => (
                      <RolePill key={b.id} $role={b.role}>
                        <FiShield size={10} />
                        {b.name} · {b.role === 'team_lead' ? 'Lead' : b.role === 'trainee' ? 'Trainee' : 'Member'}
                      </RolePill>
                    ))
                  ) : (
                    <span style={{ fontSize: 11, color: theme.colors.cadetGray, fontStyle: 'italic' }}>No boards</span>
                  )}
                </div>
                <div>
                  <Select
                    value={u.region_id || ''}
                    onChange={(e) => assignRegion.mutate({ userId: u.id, regionId: e.target.value || null })}
                  >
                    <option value="">No region</option>
                    {regions?.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.code})
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Select
                    value={u.role === 'clevel' ? 'clevel' : 'regular'}
                    onChange={(e) =>
                      changeRole.mutate({ id: u.id, role: e.target.value === 'clevel' ? 'clevel' : 'member' })
                    }
                  >
                    <option value="regular">Regular</option>
                    <option value="clevel">C-Level</option>
                  </Select>
                </div>
              </Row>
            ))}
          </RowList>
        </Card>
      )}

      {/* ---- Pending tab ---- */}
      {tab === 'regions' && isCLevel && (
        <RegionsPanel />
      )}

      {tab === 'pending' && isCLevel && (
        <Card>
          <SectionHeader
            title="Pending registrations"
            subtitle={pendingCount === 0 ? 'Nothing to review' : `${pendingCount} awaiting approval`}
          />
          {pendingCount === 0 ? (
            <div
              style={{
                textAlign: 'center',
                color: theme.colors.cadetGray,
                padding: 40,
                background: theme.colors.successLight,
                borderRadius: theme.borderRadius.md,
                fontSize: 13,
              }}
            >
              All caught up — no pending registrations.
            </div>
          ) : (
            <RowList>
              {pending?.map((u) => (
                <Row key={u.id} style={{ ['--cols' as string]: '2fr 1fr 140px' }}>
                  <UserCell>
                    <Avatar name={u.full_name} size={34} />
                    <UserInfo>
                      <span>{u.full_name}</span>
                      <span>{u.email}</span>
                    </UserInfo>
                  </UserCell>
                  <div style={{ fontSize: 12, color: theme.colors.cadetGray }}>
                    Registered {new Date(u.created_at).toLocaleDateString()}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                    <Btn $primary $small onClick={() => approveUser.mutate(u.id)}>
                      <FiUserCheck size={12} /> Approve
                    </Btn>
                    <Btn $danger $small onClick={() => rejectUser.mutate(u.id)}>
                      <FiUserX size={12} /> Reject
                    </Btn>
                  </div>
                </Row>
              ))}
            </RowList>
          )}
        </Card>
      )}

      {showCreateTeam && (
        <Overlay onClick={(e) => e.target === e.currentTarget && setShowCreateTeam(false)}>
          <Modal>
            <ModalHeader>Create board</ModalHeader>
            <ModalBody>
              <FormGroup>
                <Label>Board name *</Label>
                <Input
                  value={newTeam.name}
                  onChange={(e) => setNewTeam((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. EU Development"
                  autoFocus
                />
              </FormGroup>
              <FormGroup>
                <Label>Office</Label>
                <Input
                  value={newTeam.office}
                  onChange={(e) => setNewTeam((p) => ({ ...p, office: e.target.value }))}
                  placeholder="e.g. Sussex, Kraków"
                />
              </FormGroup>
            </ModalBody>
            <ModalFooter>
              <Btn onClick={() => setShowCreateTeam(false)}>Cancel</Btn>
              <Btn
                $primary
                onClick={() => createTeam.mutate({ name: newTeam.name, office: newTeam.office || undefined })}
                disabled={!newTeam.name.trim()}
              >
                Create
              </Btn>
            </ModalFooter>
          </Modal>
        </Overlay>
      )}
    </Page>
    </PageScroll>
  );
}

// ============================================================
// REGIONS PANEL — create / rename / deactivate / delete
// ============================================================
function RegionsPanel() {
  const { data: regions } = useRegions();
  const create = useCreateRegion();
  const update = useUpdateRegion();
  const del = useDeleteRegion();
  const [form, setForm] = useState({ name: '', code: '', description: '' });
  const [editing, setEditing] = useState<{ id: string; name: string; code: string; description: string } | null>(null);

  const submitCreate = () => {
    if (!form.name.trim() || !form.code.trim()) return;
    create.mutate(
      { name: form.name.trim(), code: form.code.trim().toUpperCase(), description: form.description || undefined },
      {
        onSuccess: () => setForm({ name: '', code: '', description: '' }),
        onError: (e: unknown) => {
          const msg = (e as { message?: string })?.message || 'Failed to create region';
          alert(msg);
        },
      },
    );
  };

  const saveEdit = () => {
    if (!editing) return;
    update.mutate(
      {
        id: editing.id,
        name: editing.name,
        code: editing.code.toUpperCase(),
        description: editing.description,
      },
      { onSuccess: () => setEditing(null) },
    );
  };

  const confirmDelete = (id: string, name: string) => {
    if (
      !confirm(
        `Archive region "${name}"?\n\n` +
          `All users, boards, stories, tasks, releases and events in this region will be snapshot into Archives.\n` +
          `Users and boards stay in the system (they just lose this region tag). Aggregate snapshots for the region are removed.\n` +
          `You can browse the archive any time from the Archive section below.`,
      )
    )
      return;
    del.mutate(id, {
      onError: (e: unknown) => {
        const msg = (e as { message?: string })?.message || 'Archive failed';
        alert(msg);
      },
    });
  };

  return (
    <Card>
      <SectionHeader
        title="Regions"
        subtitle="Geographic scopes for data isolation. Users and boards belong to a region."
      />

      {/* Create form */}
      <div
        style={{
          background: theme.colors.background,
          border: `1px solid ${theme.colors.border}`,
          borderRadius: theme.borderRadius.md,
          padding: 16,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: theme.colors.cadetGray,
            textTransform: 'uppercase',
            letterSpacing: 0.6,
            marginBottom: 12,
          }}
        >
          + New region
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 3fr auto', gap: 10, alignItems: 'end' }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: theme.colors.cadetGray, textTransform: 'uppercase', marginBottom: 4 }}>
              Name *
            </div>
            <Input
              list="region-presets"
              placeholder="Start typing — Europe, Germany, APAC…"
              value={form.name}
              onChange={(e) => {
                const v = e.target.value;
                const preset = findPresetByLabel(v);
                if (preset) {
                  // Chosen from the list — auto-fill code
                  setForm({ ...form, name: preset.label, code: preset.code });
                } else {
                  // Free-form typing — keep name, leave code alone unless empty
                  setForm({ ...form, name: v });
                }
              }}
            />
            <datalist id="region-presets">
              {REGION_PRESETS.map((p) => (
                <option key={p.code} value={p.label}>
                  {p.code} — {p.group === 'macro' ? 'region' : 'country'}
                </option>
              ))}
            </datalist>
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: theme.colors.cadetGray, textTransform: 'uppercase', marginBottom: 4 }}>
              Code *
            </div>
            <Input
              placeholder="auto"
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              maxLength={20}
            />
          </div>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: theme.colors.cadetGray, textTransform: 'uppercase', marginBottom: 4 }}>
              Description
            </div>
            <Input placeholder="Optional" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <Btn $primary onClick={submitCreate} disabled={create.isPending || !form.name.trim() || !form.code.trim()}>
            <FiPlus size={14} /> Add
          </Btn>
        </div>
      </div>

      {/* List */}
      <RowList>
        {(regions || []).map((r) => (
          <RegionRow
            key={r.id}
            region={r}
            editing={editing}
            setEditing={setEditing}
            saveEdit={saveEdit}
            update={update}
            confirmDelete={confirmDelete}
          />
        ))}
        {(!regions || regions.length === 0) && (
          <div style={{ padding: 24, textAlign: 'center', color: theme.colors.cadetGray, fontSize: 13 }}>
            No regions yet.
          </div>
        )}
      </RowList>

      <div style={{ marginTop: 28 }}>
        <ArchivesList />
      </div>
    </Card>
  );
}

// One region row: top line (name, code, status, edit/delete), bottom line (offices chips editor).
function RegionRow({
  region,
  editing,
  setEditing,
  saveEdit,
  update,
  confirmDelete,
}: {
  region: Region;
  editing: { id: string; name: string; code: string; description: string } | null;
  setEditing: (v: { id: string; name: string; code: string; description: string } | null) => void;
  saveEdit: () => void;
  update: ReturnType<typeof useUpdateRegion>;
  confirmDelete: (id: string, name: string) => void;
}) {
  const [officeDraft, setOfficeDraft] = useState('');
  const isEditing = editing?.id === region.id;

  const addOffice = () => {
    const v = officeDraft.trim();
    if (!v) return;
    if ((region.offices || []).includes(v)) {
      setOfficeDraft('');
      return;
    }
    update.mutate({ id: region.id, offices: [...(region.offices || []), v] });
    setOfficeDraft('');
  };

  const removeOffice = (o: string) => {
    update.mutate({ id: region.id, offices: (region.offices || []).filter((x) => x !== o) });
  };

  return (
    <div
      style={{
        background: theme.colors.white,
        border: `1px solid ${theme.colors.border}`,
        borderRadius: theme.borderRadius.md,
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* Top line */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 80px 3fr 80px auto',
          gap: 12,
          alignItems: 'center',
        }}
      >
        {isEditing ? (
          <>
            <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            <Input
              value={editing.code}
              onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
              maxLength={20}
            />
            <Input
              value={editing.description}
              onChange={(e) => setEditing({ ...editing, description: e.target.value })}
              placeholder="Description"
            />
            <div style={{ fontSize: 11, color: theme.colors.cadetGray }}>{region.is_active ? 'active' : 'inactive'}</div>
            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
              <Btn $primary $small onClick={saveEdit} disabled={update.isPending}>
                Save
              </Btn>
              <Btn $small onClick={() => setEditing(null)}>
                Cancel
              </Btn>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontWeight: 600, color: theme.colors.charcoal, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FiGlobe size={13} color={theme.colors.cadetGray} />
              {region.name}
            </div>
            <div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: theme.colors.lightGray,
                  color: theme.colors.davysGray,
                }}
              >
                {region.code}
              </span>
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
              {region.description || '—'}
            </div>
            <button
              onClick={() => update.mutate({ id: region.id, is_active: !region.is_active })}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: theme.borderRadius.pill,
                background: region.is_active ? theme.colors.successLight : theme.colors.lightGray,
                color: region.is_active ? theme.colors.success : theme.colors.cadetGray,
                border: 'none',
                cursor: 'pointer',
                justifySelf: 'start',
              }}
            >
              {region.is_active ? 'active' : 'inactive'}
            </button>
            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
              <Btn
                $small
                onClick={() =>
                  setEditing({
                    id: region.id,
                    name: region.name,
                    code: region.code,
                    description: region.description || '',
                  })
                }
              >
                <FiEdit2 size={11} />
              </Btn>
              <Btn $danger $small onClick={() => confirmDelete(region.id, region.name)}>
                <FiTrash2 size={11} />
              </Btn>
            </div>
          </>
        )}
      </div>

      {/* Offices chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: theme.colors.cadetGray,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Offices
        </span>
        {(region.offices || []).map((o) => (
          <span
            key={o}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: theme.borderRadius.pill,
              background: theme.colors.vividOrange + '18',
              color: theme.colors.vividOrange,
              fontSize: 11,
              fontWeight: 600,
            }}
          >
            {o}
            <button
              onClick={() => removeOffice(o)}
              title="Remove office"
              style={{
                background: 'none',
                border: 'none',
                color: theme.colors.vividOrange,
                cursor: 'pointer',
                padding: 0,
                fontSize: 12,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </span>
        ))}
        {(region.offices || []).length === 0 && (
          <span style={{ fontSize: 11, color: theme.colors.cadetGray, fontStyle: 'italic' }}>
            No offices — add one below
          </span>
        )}
        <input
          placeholder="+ add office"
          value={officeDraft}
          onChange={(e) => setOfficeDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') addOffice();
          }}
          style={{
            fontSize: 11,
            padding: '3px 8px',
            border: `1px solid ${theme.colors.border}`,
            borderRadius: theme.borderRadius.pill,
            background: 'white',
            outline: 'none',
            width: 130,
          }}
        />
        {officeDraft.trim() && (
          <Btn $small onClick={addOffice}>
            <FiPlus size={10} /> Add
          </Btn>
        )}
      </div>
    </div>
  );
}

// ============================================================
// REGION ARCHIVES — read-only snapshots of deleted regions
// ============================================================
function ArchivesList() {
  const { data: archives } = useRegionArchives();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: theme.colors.cadetGray,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 10,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        Archive ({archives?.length || 0})
        <span style={{ fontSize: 11, fontWeight: 500, color: theme.colors.cadetGray, textTransform: 'none', letterSpacing: 0 }}>
          · snapshots of deleted regions
        </span>
      </div>
      <RowList>
        {(archives || []).map((a) => (
          <Row key={a.id} style={{ ['--cols' as string]: '2fr 60px 2fr 150px 120px 80px' }}>
            <div style={{ fontWeight: 600, color: theme.colors.charcoal, display: 'flex', alignItems: 'center', gap: 6 }}>
              <FiGlobe size={13} color={theme.colors.cadetGray} />
              {a.name}
            </div>
            <div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: 10,
                  background: theme.colors.lightGray,
                  color: theme.colors.davysGray,
                }}
              >
                {a.code}
              </span>
            </div>
            <div style={{ fontSize: 11, color: theme.colors.cadetGray, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {Object.entries(a.counts || {})
                .filter(([, v]) => v > 0)
                .map(([k, v]) => (
                  <span key={k}>
                    <b style={{ color: theme.colors.charcoal }}>{v}</b> {k}
                  </span>
                ))}
            </div>
            <div style={{ fontSize: 11, color: theme.colors.cadetGray }}>
              {new Date(a.archived_at).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
            <div style={{ fontSize: 11, color: theme.colors.cadetGray, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {a.archived_by || 'System'}
            </div>
            <div style={{ textAlign: 'right' }}>
              <Btn $small onClick={() => setOpenId(a.id)}>View</Btn>
            </div>
          </Row>
        ))}
        {(!archives || archives.length === 0) && (
          <div
            style={{
              padding: 20,
              textAlign: 'center',
              color: theme.colors.cadetGray,
              fontSize: 12,
              background: theme.colors.background,
              borderRadius: theme.borderRadius.md,
            }}
          >
            No archives yet.
          </div>
        )}
      </RowList>

      {openId && <ArchiveDetail id={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function ArchiveDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { data } = useRegionArchive(id);

  return (
    <Overlay onClick={(e) => e.target === e.currentTarget && onClose()}>
      <Modal style={{ maxWidth: 780, width: '92%', maxHeight: '86vh', display: 'flex', flexDirection: 'column' }}>
        <ModalHeader style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Archive · {data?.name || '…'}</span>
          <Btn $small onClick={onClose}>Close</Btn>
        </ModalHeader>
        <div style={{ overflowY: 'auto', padding: '16px 24px' }}>
          {!data && <div style={{ color: theme.colors.cadetGray, padding: 24 }}>Loading…</div>}
          {data && <ArchiveBody data={data} />}
        </div>
      </Modal>
    </Overlay>
  );
}

function ArchiveBody({ data }: { data: RegionArchiveDetail }) {
  const sections: { key: keyof RegionArchiveDetail['payload']; label: string; render: (items: Record<string, unknown>[]) => React.ReactNode }[] = [
    {
      key: 'users',
      label: 'Users',
      render: (items) => items.map((u, i) => (
        <ArchRow key={i}>
          <strong>{String(u.full_name || '—')}</strong>
          <span>{String(u.email || '')}</span>
          <span style={{ color: theme.colors.cadetGray }}>{String(u.role || '')}</span>
        </ArchRow>
      )),
    },
    {
      key: 'teams',
      label: 'Boards',
      render: (items) => items.map((t, i) => (
        <ArchRow key={i}>
          <strong>{String(t.name || '—')}</strong>
          <span>{String(t.office || '—')}</span>
          <span style={{ color: theme.colors.cadetGray }}>
            {t.lead_name ? `lead: ${t.lead_name}` : 'no lead'} · {Number(t.member_count || 0)} members
          </span>
        </ArchRow>
      )),
    },
    {
      key: 'stories',
      label: 'Stories',
      render: (items) => items.map((s, i) => (
        <ArchRow key={i}>
          <strong>{String(s.title || '—')}</strong>
          <span style={{ color: theme.colors.cadetGray }}>{String(s.team_name || '—')}</span>
          <span>
            {String(s.status || '')} · {String(s.priority || '')}
            {s.progress != null && ` · ${s.progress}%`}
          </span>
        </ArchRow>
      )),
    },
    {
      key: 'tasks',
      label: 'Tasks',
      render: (items) => items.map((t, i) => (
        <ArchRow key={i}>
          <strong>{String(t.title || '—')}</strong>
          <span style={{ color: theme.colors.cadetGray }}>{String(t.team_name || '—')}</span>
          <span>
            {String(t.status || '')} · {String(t.priority || '')}
            {t.assignee_name ? ` · ${t.assignee_name}` : ''}
          </span>
        </ArchRow>
      )),
    },
    {
      key: 'releases',
      label: 'Releases',
      render: (items) => items.map((r, i) => (
        <ArchRow key={i}>
          <strong>{String(r.label || '—')}</strong>
          <span>{String(r.release_date || '—')}</span>
          <span style={{ color: theme.colors.cadetGray }}>{String(r.release_type || '')}</span>
        </ArchRow>
      )),
    },
    {
      key: 'events',
      label: 'Events',
      render: (items) => items.map((e, i) => (
        <ArchRow key={i}>
          <strong>{String(e.label || '—')}</strong>
          <span>{String(e.event_date || '—')}</span>
          <span style={{ color: theme.colors.cadetGray }}>{String(e.kind || '')}</span>
        </ArchRow>
      )),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 10 }}>
        {Object.entries(data.counts || {}).map(([k, v]) => (
          <div
            key={k}
            style={{
              background: theme.colors.background,
              padding: 10,
              borderRadius: theme.borderRadius.md,
              border: `1px solid ${theme.colors.border}`,
              textAlign: 'center',
            }}
          >
            <div style={{ fontFamily: theme.typography.fontFamily.primary, fontSize: 20, fontWeight: 800 }}>{v}</div>
            <div style={{ fontSize: 10, color: theme.colors.cadetGray, textTransform: 'uppercase', letterSpacing: 0.4 }}>{k}</div>
          </div>
        ))}
      </div>

      {sections.map((s) => {
        const items = (data.payload?.[s.key] as Record<string, unknown>[] | undefined) || [];
        if (items.length === 0) return null;
        return (
          <div key={s.key}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: theme.colors.cadetGray,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                marginBottom: 8,
              }}
            >
              {s.label} ({items.length})
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{s.render(items)}</div>
          </div>
        );
      })}
    </div>
  );
}

const ArchRow = styled.div`
  display: grid;
  grid-template-columns: 2fr 1fr 1.5fr;
  gap: 10px;
  padding: 6px 10px;
  background: ${theme.colors.background};
  border-radius: ${theme.borderRadius.sm};
  font-size: 12px;
  align-items: center;

  strong {
    color: ${theme.colors.charcoal};
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
`;

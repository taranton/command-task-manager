import { useState } from 'react';
import styled from 'styled-components';
import { FiPlus, FiUsers, FiUserPlus, FiUserCheck, FiUserX, FiShield } from 'react-icons/fi';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { theme } from '../../styles/theme';
import { api } from '../../lib/api';
import { Avatar } from '../../components/ui/Avatar';
import { useAuth } from '../../hooks/useAuth';
import { useRegions } from '../../hooks/useRegions';
import type { Team, User } from '../../types';

// ---- Layout ----
const Page = styled.div`height: 100%; overflow-y: auto;`;
const TopBar = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  padding: ${theme.spacing.lg} ${theme.spacing.xl};
  border-bottom: 1px solid ${theme.colors.border}; background: ${theme.colors.white};
`;
const Title = styled.h1`
  font-family: ${theme.typography.fontFamily.primary};
  font-size: ${theme.typography.fontSize['2xl']};
  font-weight: ${theme.typography.fontWeight.bold};
`;
const Content = styled.div`padding: ${theme.spacing.lg} ${theme.spacing.xl}; max-width: 1200px;`;

// ---- Tabs ----
const Tabs = styled.div`
  display: flex; gap: 0; border-bottom: 1px solid ${theme.colors.border};
  margin-bottom: ${theme.spacing.lg}; background: ${theme.colors.white};
  padding: 0 ${theme.spacing.xl};
`;
const Tab = styled.button<{ $active: boolean }>`
  padding: ${theme.spacing.md} ${theme.spacing.lg};
  font-size: ${theme.typography.fontSize.sm}; font-weight: ${theme.typography.fontWeight.medium};
  color: ${(p) => p.$active ? theme.colors.vividOrange : theme.colors.cadetGray};
  border-bottom: 2px solid ${(p) => p.$active ? theme.colors.vividOrange : 'transparent'};
  background: none; transition: ${theme.transitions.default};
  &:hover { color: ${theme.colors.vividOrange}; }
`;

// ---- Cards ----
const Grid = styled.div`
  display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: ${theme.spacing.md};
`;
const TeamCard = styled.div<{ $selected: boolean }>`
  background: ${theme.colors.white};
  border: 2px solid ${(p) => p.$selected ? theme.colors.vividOrange : theme.colors.border};
  border-radius: ${theme.borderRadius.lg}; padding: ${theme.spacing.lg};
  cursor: pointer; transition: ${theme.transitions.default};
  &:hover { box-shadow: ${theme.shadows.cardHover}; transform: translateY(-2px); }
`;
const TeamName = styled.div`
  font-size: ${theme.typography.fontSize.lg}; font-weight: ${theme.typography.fontWeight.bold};
  font-family: ${theme.typography.fontFamily.primary}; margin-bottom: ${theme.spacing.xs};
`;
const TeamMeta = styled.div`
  display: flex; align-items: center; gap: ${theme.spacing.md};
  font-size: ${theme.typography.fontSize.sm}; color: ${theme.colors.cadetGray};
  margin-bottom: ${theme.spacing.md};
`;
const MetaChip = styled.span`
  display: inline-flex; align-items: center; gap: 4px;
  svg { width: 14px; height: 14px; }
`;
const LeadBadge = styled.div`
  display: inline-flex; align-items: center; gap: ${theme.spacing.sm};
  padding: 6px 12px; background: ${theme.colors.vividOrange}15;
  border-radius: ${theme.borderRadius.pill}; font-size: ${theme.typography.fontSize.sm};
  color: ${theme.colors.vividOrange}; font-weight: ${theme.typography.fontWeight.medium};
`;

// ---- Member table ----
const Section = styled.div`margin-top: ${theme.spacing.xl};`;
const SectionHeader = styled.div`
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: ${theme.spacing.md};
`;
const SectionTitle = styled.h2`
  font-family: ${theme.typography.fontFamily.primary};
  font-size: ${theme.typography.fontSize.xl}; font-weight: ${theme.typography.fontWeight.semibold};
  display: flex; align-items: center; gap: ${theme.spacing.sm};
`;
const Table = styled.div`
  background: ${theme.colors.white}; border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.lg}; overflow: hidden;
`;
const TableRow = styled.div<{ $header?: boolean }>`
  display: grid; grid-template-columns: 2fr 1.5fr 1fr 1fr;
  align-items: center; padding: ${theme.spacing.sm} ${theme.spacing.lg};
  border-bottom: 1px solid ${theme.colors.border};
  background: ${(p) => p.$header ? theme.colors.background : theme.colors.white};
  font-size: ${(p) => p.$header ? theme.typography.fontSize.xs : theme.typography.fontSize.sm};
  font-weight: ${(p) => p.$header ? '600' : '400'};
  color: ${(p) => p.$header ? theme.colors.cadetGray : theme.colors.charcoal};
  text-transform: ${(p) => p.$header ? 'uppercase' : 'none'};
  letter-spacing: ${(p) => p.$header ? '0.5px' : '0'};
  &:last-child { border-bottom: none; }
`;
const UserCell = styled.div`display: flex; align-items: center; gap: ${theme.spacing.sm};`;
const UserInfo = styled.div`
  span { display: block; }
  span:last-child { font-size: ${theme.typography.fontSize.xs}; color: ${theme.colors.cadetGray}; }
`;
const RoleBadge = styled.span<{ $role: string }>`
  display: inline-block; padding: 3px 10px; border-radius: ${theme.borderRadius.pill};
  font-size: ${theme.typography.fontSize.xs}; font-weight: ${theme.typography.fontWeight.medium};
  background: ${(p) =>
    p.$role === 'clevel' ? '#2196F320' :
    p.$role === 'team_lead' ? theme.colors.vividOrange + '20' :
    p.$role === 'trainee' ? '#9C27B020' : theme.colors.lightGray};
  color: ${(p) =>
    p.$role === 'clevel' ? '#2196F3' :
    p.$role === 'team_lead' ? theme.colors.vividOrange :
    p.$role === 'trainee' ? '#9C27B0' : theme.colors.davysGray};
`;
const Select = styled.select`
  padding: 5px 8px; border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.sm}; font-size: ${theme.typography.fontSize.xs};
  background: white; cursor: pointer;
  &:focus { border-color: ${theme.colors.vividOrange}; outline: none; }
`;

// ---- Pending row ----
const PendingCard = styled.div`
  display: flex; align-items: center; gap: ${theme.spacing.md};
  padding: ${theme.spacing.md} ${theme.spacing.lg};
  background: ${theme.colors.white}; border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.lg}; margin-bottom: ${theme.spacing.sm};
`;
const PendingActions = styled.div`display: flex; gap: ${theme.spacing.sm}; margin-left: auto;`;

// ---- Buttons ----
const Btn = styled.button<{ $primary?: boolean; $danger?: boolean; $small?: boolean }>`
  display: inline-flex; align-items: center; gap: 6px;
  padding: ${(p) => p.$small ? '6px 12px' : '10px 20px'};
  border-radius: ${theme.borderRadius.md};
  font-size: ${(p) => p.$small ? theme.typography.fontSize.xs : theme.typography.fontSize.sm};
  font-weight: ${theme.typography.fontWeight.semibold}; transition: ${theme.transitions.default};
  ${(p) => p.$primary
    ? `background: ${theme.colors.vividOrange}; color: white; &:hover { background: ${theme.colors.deepOrange}; }`
    : p.$danger
    ? `background: ${theme.colors.errorLight}; color: ${theme.colors.error}; &:hover { background: ${theme.colors.error}; color: white; }`
    : `background: white; border: 1px solid ${theme.colors.border}; color: ${theme.colors.charcoal}; &:hover { background: ${theme.colors.lightGray}; }`}
`;

// ---- Modal ----
const Overlay = styled.div`
  position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 2000;
  display: flex; align-items: center; justify-content: center;
`;
const Modal = styled.div`
  background: white; border-radius: ${theme.borderRadius.xl};
  box-shadow: ${theme.shadows.xl}; width: 90%; max-width: 440px;
`;
const ModalHeader = styled.div`
  padding: ${theme.spacing.lg} ${theme.spacing.xl}; border-bottom: 1px solid ${theme.colors.border};
  font-family: ${theme.typography.fontFamily.primary}; font-size: ${theme.typography.fontSize.lg};
  font-weight: ${theme.typography.fontWeight.semibold};
`;
const ModalBody = styled.div`padding: ${theme.spacing.lg} ${theme.spacing.xl};`;
const ModalFooter = styled.div`
  padding: ${theme.spacing.md} ${theme.spacing.xl} ${theme.spacing.lg};
  display: flex; justify-content: flex-end; gap: ${theme.spacing.sm};
  border-top: 1px solid ${theme.colors.border};
`;
const FormGroup = styled.div`display: flex; flex-direction: column; gap: 6px; margin-bottom: ${theme.spacing.md};`;
const Label = styled.label`font-size: ${theme.typography.fontSize.sm}; font-weight: 500; color: ${theme.colors.mediumGray};`;
const Input = styled.input`
  padding: 10px 14px; border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md}; font-size: ${theme.typography.fontSize.sm};
  &:focus { border-color: ${theme.colors.vividOrange}; outline: none; }
`;

const ROLES: Record<string, string> = { clevel: 'C-Level', team_lead: 'Team Lead', member: 'Member', trainee: 'Trainee' };

const SearchInput = styled.input`
  padding: 8px 14px; border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md}; font-size: ${theme.typography.fontSize.sm};
  width: 100%; margin-bottom: ${theme.spacing.sm};
  &:focus { border-color: ${theme.colors.vividOrange}; outline: none; }
`;
const AddList = styled.div`
  max-height: 240px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;
`;
const AddRow = styled.div`
  display: flex; align-items: center; gap: ${theme.spacing.sm};
  padding: 8px ${theme.spacing.md}; border-radius: ${theme.borderRadius.md};
  &:hover { background: ${theme.colors.background}; }
`;
const AddRowInfo = styled.div`flex: 1;`;
const AddRowName = styled.span`font-size: ${theme.typography.fontSize.sm}; font-weight: 500;`;
const AddRowMeta = styled.span`font-size: ${theme.typography.fontSize.xs}; color: ${theme.colors.cadetGray}; margin-left: 8px;`;

function AddMemberSearch({ users, teams, currentMembers, onAdd }: {
  users: User[]; teams: Team[]; currentMembers: User[];
  onAdd: (userId: string) => void;
}) {
  const [search, setSearch] = useState('');
  const memberIds = new Set(currentMembers.map((m) => m.id));

  // Show all users NOT in this team (including those in other teams)
  const available = users
    .filter((u) => !memberIds.has(u.id) && u.role !== 'clevel')
    .filter((u) => !search || u.full_name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  const getTeamName = (teamId?: string) => {
    if (!teamId) return null;
    return teams.find((t) => t.id === teamId)?.name;
  };

  return (
    <div>
      <SearchInput
        placeholder="Search by name or email..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <AddList>
        {available.length > 0 ? available.map((u) => {
          const fromTeam = getTeamName(u.team_id);
          return (
            <AddRow key={u.id}>
              <Avatar name={u.full_name} size={28} />
              <AddRowInfo>
                <AddRowName>{u.full_name}</AddRowName>
                <AddRowMeta>
                  {fromTeam ? `Currently in ${fromTeam}` : 'Unassigned'}
                </AddRowMeta>
              </AddRowInfo>
              <Btn $primary $small onClick={() => onAdd(u.id)}>
                +
              </Btn>
            </AddRow>
          );
        }) : (
          <div style={{ textAlign: 'center', color: theme.colors.cadetGray, padding: theme.spacing.md }}>
            {search ? 'No users found' : 'No available users'}
          </div>
        )}
      </AddList>
    </div>
  );
}

export default function AdminPage() {
  const { user: me } = useAuth();
  const qc = useQueryClient();
  const isCLevel = me?.role === 'clevel';
  const isLead = me?.role === 'team_lead';
  const [tab, setTab] = useState<'teams' | 'users' | 'pending'>('teams');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: '', office: '' });

  const { data: teams } = useQuery<Team[]>({ queryKey: ['teams'], queryFn: () => api.get('/api/v1/teams') });
  const { data: users } = useQuery<User[]>({ queryKey: ['users'], queryFn: () => api.get('/api/v1/users') });
  const { data: regions } = useRegions();
  const { data: pending } = useQuery<User[]>({
    queryKey: ['users-pending'], queryFn: () => api.get('/api/v1/users/pending'), enabled: isCLevel,
  });
  const { data: members } = useQuery<User[]>({
    queryKey: ['team-members', selectedTeamId],
    queryFn: () => api.get(`/api/v1/teams/${selectedTeamId}/members`),
    enabled: !!selectedTeamId,
  });

  const changeRole = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) => api.patch(`/api/v1/users/${id}/role`, { role }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); qc.invalidateQueries({ queryKey: ['team-members'] }); },
  });
  const assignTeam = useMutation({
    mutationFn: ({ id, teamId }: { id: string; teamId: string | null }) => api.patch(`/api/v1/users/${id}/team`, { team_id: teamId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); qc.invalidateQueries({ queryKey: ['team-members'] }); qc.invalidateQueries({ queryKey: ['teams'] }); },
  });
  const createTeam = useMutation({
    mutationFn: (input: { name: string; office?: string }) => api.post('/api/v1/teams', input),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['teams'] }); setShowCreateTeam(false); setNewTeam({ name: '', office: '' }); },
  });
  const assignRegion = useMutation({
    mutationFn: ({ userId, regionId }: { userId: string; regionId: string | null }) =>
      api.patch(`/api/v1/users/${userId}/region`, { region_id: regionId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); },
  });
  const assignBoardRegion = useMutation({
    mutationFn: ({ boardId, regionId }: { boardId: string; regionId: string | null }) =>
      api.patch(`/api/v1/teams/${boardId}/region`, { region_id: regionId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['teams'] }); },
  });
  const approveUser = useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/users/${id}/approve`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users-pending'] }); qc.invalidateQueries({ queryKey: ['users'] }); },
  });
  const rejectUser = useMutation({
    mutationFn: (id: string) => api.post(`/api/v1/users/${id}/reject`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users-pending'] }); },
  });

  if (!isCLevel && !isLead) {
    return <Page><Content><p style={{ color: theme.colors.cadetGray, padding: '48px', textAlign: 'center' }}>Only C-Level and Team Leads can access this page.</p></Content></Page>;
  }

  const visibleTeams = isLead ? teams?.filter((t) => t.id === me?.team_id) : teams;
  const selectedTeam = teams?.find((t) => t.id === selectedTeamId);
  const pendingCount = pending?.length || 0;

  return (
    <Page>
      <TopBar>
        <Title>Board Management</Title>
        {isCLevel && <Btn $primary onClick={() => setShowCreateTeam(true)}><FiPlus size={16} /> New Board</Btn>}
      </TopBar>

      <Tabs>
        <Tab $active={tab === 'teams'} onClick={() => setTab('teams')}>
          <FiUsers size={14} style={{ marginRight: 6 }} /> Boards
        </Tab>
        {isCLevel && (
          <Tab $active={tab === 'users'} onClick={() => setTab('users')}>
            <FiShield size={14} style={{ marginRight: 6 }} /> All Users
          </Tab>
        )}
        {isCLevel && (
          <Tab $active={tab === 'pending'} onClick={() => setTab('pending')}>
            <FiUserCheck size={14} style={{ marginRight: 6 }} /> Pending
            {pendingCount > 0 && (
              <span style={{
                marginLeft: 6, background: theme.colors.error, color: 'white',
                borderRadius: '10px', padding: '1px 7px', fontSize: '11px', fontWeight: 700,
              }}>{pendingCount}</span>
            )}
          </Tab>
        )}
      </Tabs>

      <Content>
        {/* ---- Teams tab ---- */}
        {tab === 'teams' && (
          <>
            <Grid>
              {visibleTeams?.map((t) => (
                <TeamCard key={t.id} $selected={selectedTeamId === t.id} onClick={() => setSelectedTeamId(t.id)}>
                  <TeamName>{t.name}</TeamName>
                  <TeamMeta>
                    <MetaChip><FiUsers /> {t.member_count} members</MetaChip>
                    {regions && (
                      <Select value={t.region_id || ''} onClick={(e) => e.stopPropagation()}
                        onChange={(e) => { e.stopPropagation(); assignBoardRegion.mutate({ boardId: t.id, regionId: e.target.value || null }); }}>
                        <option value="">No Region</option>
                        {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </Select>
                    )}
                  </TeamMeta>
                  {t.lead && <LeadBadge><Avatar name={t.lead.full_name} size={20} /> {t.lead.full_name}</LeadBadge>}
                </TeamCard>
              ))}
            </Grid>

            {selectedTeam && (
              <Section>
                <SectionHeader>
                  <SectionTitle>{selectedTeam.name} — Members</SectionTitle>
                </SectionHeader>
                <Table>
                  <TableRow $header><div>User</div><div>Email</div><div>Role</div><div>Actions</div></TableRow>
                  {members?.map((m) => (
                    <TableRow key={m.id}>
                      <UserCell>
                        <Avatar name={m.full_name} size={32} />
                        <UserInfo><span>{m.full_name}</span></UserInfo>
                      </UserCell>
                      <div>{m.email}</div>
                      <div>
                        {(() => {
                          const hasLead = members?.some((x) => x.role === 'team_lead' && x.id !== m.id);
                          return isCLevel ? (
                            <Select value={m.role} onChange={(e) => changeRole.mutate({ id: m.id, role: e.target.value })}>
                              {Object.entries(ROLES).filter(([k]) => k !== 'clevel' && (k !== 'team_lead' || !hasLead || m.role === 'team_lead')).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </Select>
                          ) : isLead ? (
                            <Select value={m.role} onChange={(e) => changeRole.mutate({ id: m.id, role: e.target.value })}>
                              <option value="member">Member</option>
                              <option value="trainee">Trainee</option>
                            </Select>
                          ) : (
                          <RoleBadge $role={m.role}>{ROLES[m.role]}</RoleBadge>
                        );
                        })()}
                      </div>
                      <div>
                        <Btn $danger $small onClick={() => assignTeam.mutate({ id: m.id, teamId: null })}>
                          Remove
                        </Btn>
                      </div>
                    </TableRow>
                  ))}
                  {(!members || members.length === 0) && (
                    <TableRow><div style={{ gridColumn: '1/-1', textAlign: 'center', color: theme.colors.cadetGray, padding: theme.spacing.md }}>No members</div></TableRow>
                  )}
                </Table>

                {(isCLevel || isLead) && (
                  <div style={{ marginTop: theme.spacing.lg }}>
                    <SectionTitle style={{ fontSize: theme.typography.fontSize.md }}><FiUserPlus size={16} /> Add to board</SectionTitle>
                    <AddMemberSearch
                      users={users || []}
                      teams={teams || []}
                      currentMembers={members || []}
                      onAdd={(userId) => assignTeam.mutate({ id: userId, teamId: selectedTeam.id })}
                    />
                  </div>
                )}
              </Section>
            )}
          </>
        )}

        {/* ---- All Users tab ---- */}
        {tab === 'users' && isCLevel && (
          <Table>
            <TableRow $header><div>User</div><div>Board</div><div>Region</div><div>Role</div><div>Actions</div></TableRow>
            {users?.map((u) => (
              <TableRow key={u.id} style={{ gridTemplateColumns: '2fr 1.2fr 1fr 1fr 1fr' }}>
                <UserCell>
                  <Avatar name={u.full_name} size={32} />
                  <UserInfo>
                    <span>{u.full_name}</span>
                    <span>{u.email}</span>
                  </UserInfo>
                </UserCell>
                <div>
                  <Select value={u.team_id || ''} onChange={(e) => assignTeam.mutate({ id: u.id, teamId: e.target.value || null })}>
                    <option value="">No Board</option>
                    {teams?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                </div>
                <div>
                  <Select value={u.region_id || ''} onChange={(e) => assignRegion.mutate({ userId: u.id, regionId: e.target.value || null })}>
                    <option value="">No Region</option>
                    {regions?.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
                  </Select>
                </div>
                <div><RoleBadge $role={u.role}>{ROLES[u.role]}</RoleBadge></div>
                <div>
                  <Select value={u.role} onChange={(e) => changeRole.mutate({ id: u.id, role: e.target.value })}>
                    {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </Select>
                </div>
              </TableRow>
            ))}
          </Table>
        )}

        {/* ---- Pending tab ---- */}
        {tab === 'pending' && isCLevel && (
          <>
            {pendingCount === 0 ? (
              <div style={{ textAlign: 'center', color: theme.colors.cadetGray, padding: '48px' }}>
                No pending registrations
              </div>
            ) : (
              pending?.map((u) => (
                <PendingCard key={u.id}>
                  <Avatar name={u.full_name} size={40} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{u.full_name}</div>
                    <div style={{ fontSize: theme.typography.fontSize.sm, color: theme.colors.cadetGray }}>{u.email}</div>
                    <div style={{ fontSize: theme.typography.fontSize.xs, color: theme.colors.cadetGray }}>
                      Registered: {new Date(u.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <PendingActions>
                    <Btn $primary $small onClick={() => approveUser.mutate(u.id)}>
                      <FiUserCheck size={14} /> Approve
                    </Btn>
                    <Btn $danger $small onClick={() => rejectUser.mutate(u.id)}>
                      <FiUserX size={14} /> Reject
                    </Btn>
                  </PendingActions>
                </PendingCard>
              ))
            )}
          </>
        )}
      </Content>

      {/* Create Team Modal */}
      {showCreateTeam && (
        <Overlay onClick={(e) => e.target === e.currentTarget && setShowCreateTeam(false)}>
          <Modal>
            <ModalHeader>Create Board</ModalHeader>
            <ModalBody>
              <FormGroup>
                <Label>Board Name *</Label>
                <Input value={newTeam.name} onChange={(e) => setNewTeam((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. EU Development" autoFocus />
              </FormGroup>
              <FormGroup>
                <Label>Office</Label>
                <Input value={newTeam.office} onChange={(e) => setNewTeam((p) => ({ ...p, office: e.target.value }))} placeholder="e.g. Sussex, Kraków" />
              </FormGroup>
            </ModalBody>
            <ModalFooter>
              <Btn onClick={() => setShowCreateTeam(false)}>Cancel</Btn>
              <Btn $primary onClick={() => createTeam.mutate({ name: newTeam.name, office: newTeam.office || undefined })} disabled={!newTeam.name.trim()}>Create</Btn>
            </ModalFooter>
          </Modal>
        </Overlay>
      )}
    </Page>
  );
}

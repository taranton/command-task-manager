import { useState, useMemo } from 'react';
import styled from 'styled-components';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  FiX,
  FiTrash2,
  FiPlus,
  FiSave,
  FiInfo,
  FiUsers,
  FiLink2,
  FiAlertOctagon,
  FiCheck,
  FiSearch,
} from 'react-icons/fi';
import { theme } from '../../styles/theme';
import { api } from '../../lib/api';
import { useRegions } from '../../hooks/useRegions';
import { useUsers } from '../../hooks/useUsers';
import { useStories } from '../../hooks/useBoardData';
import {
  useStoryDeps,
  useCreateDep,
  useDeleteDep,
  useBlockers,
  useCreateBlocker,
  useResolveBlocker,
  useDeleteBlocker,
} from '../../hooks/useEntities';
import { Avatar } from '../ui/Avatar';
import type { Team, User } from '../../types';

// ---------- layout ----------
const Backdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  z-index: 1200;
`;

const Drawer = styled.aside`
  position: fixed;
  top: 0;
  right: 0;
  bottom: 0;
  width: min(640px, 100vw);
  background: ${theme.colors.white};
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
  z-index: 1201;
  display: flex;
  flex-direction: column;
  overflow: hidden;
`;

const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid ${theme.colors.border};
  flex-shrink: 0;
`;

const Title = styled.div`
  font-family: ${theme.typography.fontFamily.primary};
  font-size: 18px;
  font-weight: 700;
  color: ${theme.colors.charcoal};
`;

const Close = styled.button`
  background: ${theme.colors.background};
  border: 1px solid ${theme.colors.border};
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  &:hover {
    background: ${theme.colors.lightGray};
  }
`;

const Tabs = styled.div`
  display: flex;
  gap: 4px;
  padding: 10px 14px 0;
  border-bottom: 1px solid ${theme.colors.border};
  flex-shrink: 0;
`;

const Tab = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  background: none;
  font-size: 13px;
  font-weight: 600;
  color: ${(p) => (p.$active ? theme.colors.charcoal : theme.colors.cadetGray)};
  border-bottom: 2px solid ${(p) => (p.$active ? theme.colors.vividOrange : 'transparent')};
  cursor: pointer;
  transition: ${theme.transitions.default};

  &:hover {
    color: ${theme.colors.charcoal};
  }

  svg {
    width: 14px;
    height: 14px;
  }
`;

const Body = styled.div`
  flex: 1;
  overflow-y: auto;
  padding: 18px 20px 28px;
`;

const Section = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 22px;
`;

const Row = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Label = styled.label`
  font-size: 11px;
  font-weight: 700;
  color: ${theme.colors.davysGray};
  letter-spacing: 0.4px;
  text-transform: uppercase;
`;

const Input = styled.input`
  padding: 9px 12px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  font-size: 13px;
  background: white;

  &:focus {
    outline: none;
    border-color: ${theme.colors.vividOrange};
  }

  &:disabled {
    background: ${theme.colors.background};
    color: ${theme.colors.cadetGray};
  }
`;

const Select = styled.select`
  padding: 9px 12px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  font-size: 13px;
  background: white;

  &:focus {
    outline: none;
    border-color: ${theme.colors.vividOrange};
  }

  &:disabled {
    background: ${theme.colors.background};
    color: ${theme.colors.cadetGray};
  }
`;

const Textarea = styled.textarea`
  padding: 9px 12px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  font-size: 13px;
  font-family: inherit;
  resize: vertical;
  min-height: 70px;

  &:focus {
    outline: none;
    border-color: ${theme.colors.vividOrange};
  }
`;

const Hint = styled.div`
  font-size: 11px;
  color: ${theme.colors.cadetGray};
`;

const PrimaryBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: ${theme.colors.vividOrange};
  color: white;
  border-radius: ${theme.borderRadius.md};
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;

  &:hover:not(:disabled) {
    background: ${theme.colors.deepOrange};
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const GhostBtn = styled.button`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: white;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  font-size: 12px;
  font-weight: 600;
  color: ${theme.colors.davysGray};
  cursor: pointer;

  &:hover {
    background: ${theme.colors.background};
  }
`;

const IconBtn = styled.button`
  background: none;
  padding: 4px 6px;
  border-radius: 6px;
  color: ${theme.colors.cadetGray};
  cursor: pointer;

  &:hover {
    color: ${theme.colors.error};
    background: ${theme.colors.error}10;
  }
`;

const ReadOnly = styled.div`
  padding: 12px 14px;
  background: ${theme.colors.background};
  border: 1px dashed ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  font-size: 12px;
  color: ${theme.colors.cadetGray};
  display: flex;
  align-items: center;
  gap: 8px;
`;

const MemberRow = styled.div`
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};

  .grow {
    flex: 1;
    min-width: 0;
  }

  .name {
    font-size: 13px;
    font-weight: 600;
    color: ${theme.colors.charcoal};
  }

  .email {
    font-size: 11px;
    color: ${theme.colors.cadetGray};
  }
`;

const SearchWrap = styled.div`
  position: relative;

  svg {
    position: absolute;
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
    color: ${theme.colors.cadetGray};
  }

  input {
    width: 100%;
    padding: 9px 10px 9px 32px;
    border: 1px solid ${theme.colors.border};
    border-radius: ${theme.borderRadius.md};
    font-size: 13px;
  }
`;

const List = styled.div`
  display: flex;
  flex-direction: column;
  gap: 6px;
`;

const Chip = styled.span<{ $bg?: string; $color?: string }>`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 10px;
  background: ${(p) => p.$bg || theme.colors.lightGray};
  color: ${(p) => p.$color || theme.colors.davysGray};
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
`;

const SectionHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;

  h4 {
    font-family: ${theme.typography.fontFamily.primary};
    font-size: 14px;
    font-weight: 700;
    color: ${theme.colors.charcoal};
    margin: 0;
  }

  .count {
    font-size: 11px;
    color: ${theme.colors.cadetGray};
    font-weight: 600;
  }
`;

const RelCard = styled.div`
  display: grid;
  grid-template-columns: auto 1fr auto;
  gap: 10px;
  align-items: center;
  padding: 10px 12px;
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};

  .text {
    font-size: 13px;
    color: ${theme.colors.charcoal};
    min-width: 0;
  }

  .meta {
    font-size: 11px;
    color: ${theme.colors.cadetGray};
    margin-top: 2px;
  }
`;

const AddForm = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  background: ${theme.colors.background};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
`;

// ---------- role colors ----------
function roleLook(role: string | null): { bg: string; color: string; label: string } {
  switch (role) {
    case 'team_lead':
      return { bg: theme.colors.vividOrange + '22', color: theme.colors.vividOrange, label: 'Lead' };
    case 'trainee':
      return { bg: '#9C27B022', color: '#7B1FA2', label: 'Trainee' };
    case 'member':
      return { bg: theme.colors.info + '22', color: theme.colors.info, label: 'Member' };
    default:
      return { bg: theme.colors.lightGray, color: theme.colors.cadetGray, label: 'None' };
  }
}

// ============================================================
interface Props {
  board: Team;
  myRole: 'team_lead' | 'member' | 'trainee' | null; // role in this board (null if non-member)
  isCLevel: boolean;
  onClose: () => void;
}

export function BoardSettings({ board, myRole, isCLevel, onClose }: Props) {
  const canEditInfo = isCLevel || myRole === 'team_lead';
  const canManageMembers = isCLevel || myRole === 'team_lead';
  const canManageRelations = isCLevel || myRole === 'team_lead';

  const [tab, setTab] = useState<'info' | 'members' | 'relations'>('info');

  return (
    <>
      <Backdrop onClick={onClose} />
      <Drawer role="dialog" aria-label="Board settings">
        <Head>
          <Title>Board settings — {board.name}</Title>
          <Close onClick={onClose} aria-label="Close">
            <FiX size={16} />
          </Close>
        </Head>
        <Tabs>
          <Tab $active={tab === 'info'} onClick={() => setTab('info')}>
            <FiInfo /> Info
          </Tab>
          <Tab $active={tab === 'members'} onClick={() => setTab('members')}>
            <FiUsers /> Members
          </Tab>
          <Tab $active={tab === 'relations'} onClick={() => setTab('relations')}>
            <FiLink2 /> Dependencies & blockers
          </Tab>
        </Tabs>
        <Body>
          {tab === 'info' && <InfoTab board={board} canEdit={canEditInfo} />}
          {tab === 'members' && (
            <MembersTab board={board} canEdit={canManageMembers} />
          )}
          {tab === 'relations' && (
            <RelationsTab board={board} canEdit={canManageRelations} />
          )}
        </Body>
      </Drawer>
    </>
  );
}

// ============================================================
function InfoTab({ board, canEdit }: { board: Team; canEdit: boolean }) {
  const qc = useQueryClient();
  const { data: regions } = useRegions();

  const [name, setName] = useState(board.name);
  const [description, setDescription] = useState(board.description || '');
  const [regionId, setRegionId] = useState<string>(board.region_id || '');
  const [office, setOffice] = useState<string>(board.office || '');

  const region = regions?.find((r) => r.id === regionId);
  const regionOffices = region?.offices || [];

  const dirty =
    name !== board.name ||
    description !== (board.description || '') ||
    regionId !== (board.region_id || '') ||
    office !== (board.office || '');

  const save = useMutation({
    mutationFn: (input: {
      name?: string;
      description?: string;
      region_id?: string;
      office?: string;
    }) => api.patch(`/api/v1/teams/${board.id}`, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['teams'] });
      qc.invalidateQueries({ queryKey: ['boards-overview'] });
    },
  });

  const onSave = () => {
    const payload: Record<string, string> = {};
    if (name !== board.name) payload.name = name.trim();
    if (description !== (board.description || '')) payload.description = description.trim();
    if (office !== (board.office || '')) payload.office = office.trim();
    if (regionId !== (board.region_id || '')) payload.region_id = regionId; // empty string clears
    save.mutate(payload);
  };

  return (
    <>
      {!canEdit && (
        <ReadOnly>
          <FiInfo size={14} />
          View-only. Ask a board lead or C-Level to change these fields.
        </ReadOnly>
      )}
      <Section style={{ marginTop: canEdit ? 0 : 18 }}>
        <Row>
          <Label>Name</Label>
          <Input
            value={name}
            disabled={!canEdit}
            onChange={(e) => setName(e.target.value)}
          />
        </Row>
        <Row>
          <Label>Description</Label>
          <Textarea
            value={description}
            disabled={!canEdit}
            placeholder="What is this board for?"
            onChange={(e) => setDescription(e.target.value)}
          />
        </Row>
        <Row>
          <Label>Region</Label>
          <Select
            value={regionId}
            disabled={!canEdit}
            onChange={(e) => {
              const rid = e.target.value;
              const r = regions?.find((x) => x.id === rid);
              setRegionId(rid);
              // If current office isn't offered by the new region, auto-pick the first one (or clear).
              if (r && r.offices && !r.offices.includes(office)) {
                setOffice(r.offices[0] || '');
              }
            }}
          >
            <option value="">— Unassigned —</option>
            {(regions || [])
              .filter((r) => r.is_active || r.id === regionId)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.code} — {r.name}
                </option>
              ))}
          </Select>
        </Row>
        <Row>
          <Label>Office</Label>
          {regionOffices.length > 0 ? (
            <Select
              value={office}
              disabled={!canEdit}
              onChange={(e) => setOffice(e.target.value)}
            >
              <option value="">— No office —</option>
              {regionOffices.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          ) : (
            <>
              <Input
                value={office}
                disabled={!canEdit}
                placeholder={regionId ? 'Region has no offices' : 'Pick a region first'}
                onChange={(e) => setOffice(e.target.value)}
              />
              {regionId && (
                <Hint>
                  No offices defined for this region. Add them in Organization → Regions.
                </Hint>
              )}
            </>
          )}
        </Row>
      </Section>

      {canEdit && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <PrimaryBtn onClick={onSave} disabled={!dirty || save.isPending || !name.trim()}>
            <FiSave size={13} /> {save.isPending ? 'Saving…' : 'Save changes'}
          </PrimaryBtn>
        </div>
      )}
    </>
  );
}

// ============================================================
function MembersTab({ board, canEdit }: { board: Team; canEdit: boolean }) {
  const qc = useQueryClient();
  const { data: allUsers } = useUsers();
  const { data: members, isLoading } = useQuery<User[]>({
    queryKey: ['team-members', board.id],
    queryFn: () => api.get(`/api/v1/teams/${board.id}/members`),
  });

  const [search, setSearch] = useState('');

  const memberIds = new Set((members || []).map((m) => m.id));

  const invitable = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (allUsers || [])
      .filter((u) => u.is_active && !memberIds.has(u.id))
      .filter((u) =>
        q
          ? u.full_name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
          : true,
      )
      .slice(0, 30);
  }, [allUsers, memberIds, search]);

  const addMember = useMutation({
    mutationFn: (userId: string) =>
      api.patch(`/api/v1/users/${userId}/team`, { team_id: board.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-members', board.id] });
      qc.invalidateQueries({ queryKey: ['boards-overview'] });
    },
  });

  const removeMember = useMutation({
    mutationFn: (userId: string) =>
      api.post(`/api/v1/users/${userId}/remove-from-board`, { board_id: board.id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-members', board.id] });
      qc.invalidateQueries({ queryKey: ['boards-overview'] });
    },
  });

  const changeRole = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.patch(`/api/v1/teams/${board.id}/members/${userId}/role`, { role }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['team-members', board.id] });
      qc.invalidateQueries({ queryKey: ['boards-overview'] });
      qc.invalidateQueries({ queryKey: ['teams'] });
    },
    onError: (e: any) => {
      alert(e?.message || 'Failed to change role');
    },
  });

  return (
    <>
      {!canEdit && (
        <ReadOnly style={{ marginBottom: 14 }}>
          <FiInfo size={14} />
          View-only. Ask a board lead or C-Level to manage members.
        </ReadOnly>
      )}

      <Section>
        <SectionHead>
          <h4>Members</h4>
          <span className="count">{members?.length || 0} people</span>
        </SectionHead>
        {isLoading && <Hint>Loading members…</Hint>}
        {!isLoading && members?.length === 0 && <Hint>No members yet.</Hint>}
        <List>
          {(members || []).map((u) => {
            const rl = roleLook((u as any).role || null);
            // The role coming back from the endpoint is the board_members role (see admin handler SELECT),
            // not the global users.role. So it's either team_lead | member | trainee | clevel.
            const currentRole = (u as any).role as string;
            return (
              <MemberRow key={u.id}>
                <Avatar name={u.full_name} size={32} />
                <div className="grow">
                  <div className="name">{u.full_name}</div>
                  <div className="email">{u.email}</div>
                </div>
                {canEdit ? (
                  <Select
                    value={currentRole === 'clevel' ? 'member' : currentRole}
                    onChange={(e) => changeRole.mutate({ userId: u.id, role: e.target.value })}
                    style={{ padding: '5px 8px', fontSize: 12 }}
                  >
                    <option value="team_lead">Lead</option>
                    <option value="member">Member</option>
                    <option value="trainee">Trainee</option>
                  </Select>
                ) : (
                  <Chip $bg={rl.bg} $color={rl.color}>
                    {rl.label}
                  </Chip>
                )}
                {canEdit && (
                  <IconBtn
                    title="Remove from board"
                    onClick={() => {
                      if (confirm(`Remove ${u.full_name} from this board?`)) {
                        removeMember.mutate(u.id);
                      }
                    }}
                  >
                    <FiTrash2 size={14} />
                  </IconBtn>
                )}
              </MemberRow>
            );
          })}
        </List>
      </Section>

      {canEdit && (
        <Section>
          <SectionHead>
            <h4>Add people</h4>
            <span className="count">{invitable.length} available</span>
          </SectionHead>
          <SearchWrap>
            <FiSearch size={14} />
            <input
              placeholder="Search by name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </SearchWrap>
          <List>
            {invitable.map((u) => (
              <MemberRow key={u.id}>
                <Avatar name={u.full_name} size={30} />
                <div className="grow">
                  <div className="name">{u.full_name}</div>
                  <div className="email">{u.email}</div>
                </div>
                <GhostBtn onClick={() => addMember.mutate(u.id)} disabled={addMember.isPending}>
                  <FiPlus size={12} /> Add
                </GhostBtn>
              </MemberRow>
            ))}
            {invitable.length === 0 && (
              <Hint>No matching users. Try a different search.</Hint>
            )}
          </List>
        </Section>
      )}
    </>
  );
}

// ============================================================
function RelationsTab({ board, canEdit }: { board: Team; canEdit: boolean }) {
  const qc = useQueryClient();
  const region = board.region_id || 'all';

  // All stories; filter to this board's stories client-side
  const { data: storiesRes } = useStories();
  const allStories = storiesRes?.data || [];
  const boardStoryIds = new Set(
    allStories.filter((s) => s.team_id === board.id).map((s) => s.id),
  );
  const boardStories = allStories.filter((s) => boardStoryIds.has(s.id));

  const { data: deps } = useStoryDeps(region);
  const { data: blockers } = useBlockers(region, false);

  // Deps where this board is involved on either end
  const boardDeps = (deps || []).filter(
    (d) => boardStoryIds.has(d.from_story) || boardStoryIds.has(d.to_story),
  );
  // Blockers where the blocked story belongs to this board
  const boardBlockers = (blockers || []).filter((b) => boardStoryIds.has(b.story_id));

  const storyTitle = (id: string) =>
    allStories.find((s) => s.id === id)?.title || 'Unknown story';
  const onThisBoard = (id: string) => boardStoryIds.has(id);

  const createDep = useCreateDep();
  const deleteDep = useDeleteDep();
  const createBlocker = useCreateBlocker();
  const resolveBlocker = useResolveBlocker();
  const deleteBlocker = useDeleteBlocker();

  const [newDep, setNewDep] = useState({ from_story: '', to_story: '', reason: '' });
  const [newBlocker, setNewBlocker] = useState({
    story_id: '',
    blocker_description: '',
    severity: 'medium',
  });

  return (
    <>
      {!canEdit && (
        <ReadOnly style={{ marginBottom: 14 }}>
          <FiInfo size={14} />
          View-only. Ask a board lead or C-Level to edit dependencies and blockers.
        </ReadOnly>
      )}

      {boardStories.length === 0 && (
        <Hint style={{ marginBottom: 18 }}>
          This board has no stories yet. Create a story first to link dependencies or blockers.
        </Hint>
      )}

      <Section>
        <SectionHead>
          <h4>
            <FiLink2 style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Dependencies
          </h4>
          <span className="count">{boardDeps.length}</span>
        </SectionHead>
        <Hint>Stories on this board that depend on — or are blocked by — other stories.</Hint>
        <List>
          {boardDeps.map((d) => {
            const fromHere = onThisBoard(d.from_story);
            return (
              <RelCard key={d.id}>
                <Chip $bg={theme.colors.info + '22'} $color={theme.colors.info}>
                  {fromHere ? 'Needs →' : 'Feeds ←'}
                </Chip>
                <div className="text">
                  <b>{storyTitle(d.from_story)}</b>
                  {' '}depends on{' '}
                  <b>{storyTitle(d.to_story)}</b>
                  {d.reason && <div className="meta">{d.reason}</div>}
                </div>
                {canEdit && (
                  <IconBtn
                    title="Remove dependency"
                    onClick={() => deleteDep.mutate(d.id)}
                  >
                    <FiTrash2 size={14} />
                  </IconBtn>
                )}
              </RelCard>
            );
          })}
          {boardDeps.length === 0 && <Hint>No dependencies yet.</Hint>}
        </List>

        {canEdit && boardStories.length > 0 && (
          <AddForm>
            <Label>Add dependency</Label>
            <Row>
              <Hint>From (story on this board)</Hint>
              <Select
                value={newDep.from_story}
                onChange={(e) => setNewDep((p) => ({ ...p, from_story: e.target.value }))}
              >
                <option value="">Select…</option>
                {boardStories.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </Select>
            </Row>
            <Row>
              <Hint>Depends on (any story)</Hint>
              <Select
                value={newDep.to_story}
                onChange={(e) => setNewDep((p) => ({ ...p, to_story: e.target.value }))}
              >
                <option value="">Select…</option>
                {allStories
                  .filter((s) => s.id !== newDep.from_story)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title}
                      {!boardStoryIds.has(s.id) ? ' (other board)' : ''}
                    </option>
                  ))}
              </Select>
            </Row>
            <Row>
              <Hint>Reason (optional)</Hint>
              <Input
                value={newDep.reason}
                onChange={(e) => setNewDep((p) => ({ ...p, reason: e.target.value }))}
                placeholder="Why does this depend?"
              />
            </Row>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <PrimaryBtn
                disabled={
                  !newDep.from_story || !newDep.to_story || createDep.isPending
                }
                onClick={() => {
                  createDep.mutate(
                    {
                      from_story: newDep.from_story,
                      to_story: newDep.to_story,
                      reason: newDep.reason || null,
                    },
                    {
                      onSuccess: () => {
                        setNewDep({ from_story: '', to_story: '', reason: '' });
                        qc.invalidateQueries({ queryKey: ['story-deps'] });
                      },
                    },
                  );
                }}
              >
                <FiPlus size={13} /> Add dependency
              </PrimaryBtn>
            </div>
          </AddForm>
        )}
      </Section>

      <Section>
        <SectionHead>
          <h4>
            <FiAlertOctagon style={{ verticalAlign: 'middle', marginRight: 4 }} />
            Blockers
          </h4>
          <span className="count">{boardBlockers.length}</span>
        </SectionHead>
        <Hint>External blockers on stories belonging to this board.</Hint>
        <List>
          {boardBlockers.map((b) => {
            const resolved = !!b.resolved_at;
            return (
              <RelCard key={b.id}>
                <Chip
                  $bg={resolved ? theme.colors.success + '22' : theme.colors.error + '22'}
                  $color={resolved ? theme.colors.success : theme.colors.error}
                >
                  {resolved ? 'Resolved' : b.severity}
                </Chip>
                <div className="text">
                  <b>{storyTitle(b.story_id)}</b>
                  <div className="meta">{b.blocker_description}</div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {canEdit && !resolved && (
                    <IconBtn
                      title="Mark resolved"
                      onClick={() => resolveBlocker.mutate(b.id)}
                      style={{ color: theme.colors.success }}
                    >
                      <FiCheck size={14} />
                    </IconBtn>
                  )}
                  {canEdit && (
                    <IconBtn
                      title="Delete blocker"
                      onClick={() => deleteBlocker.mutate(b.id)}
                    >
                      <FiTrash2 size={14} />
                    </IconBtn>
                  )}
                </div>
              </RelCard>
            );
          })}
          {boardBlockers.length === 0 && <Hint>No blockers.</Hint>}
        </List>

        {canEdit && boardStories.length > 0 && (
          <AddForm>
            <Label>Add blocker</Label>
            <Row>
              <Hint>Blocked story (on this board)</Hint>
              <Select
                value={newBlocker.story_id}
                onChange={(e) => setNewBlocker((p) => ({ ...p, story_id: e.target.value }))}
              >
                <option value="">Select…</option>
                {boardStories.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </Select>
            </Row>
            <Row>
              <Hint>Describe the blocker</Hint>
              <Input
                value={newBlocker.blocker_description}
                onChange={(e) =>
                  setNewBlocker((p) => ({ ...p, blocker_description: e.target.value }))
                }
                placeholder="What is blocking this work?"
              />
            </Row>
            <Row>
              <Hint>Severity</Hint>
              <Select
                value={newBlocker.severity}
                onChange={(e) => setNewBlocker((p) => ({ ...p, severity: e.target.value }))}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </Select>
            </Row>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <PrimaryBtn
                disabled={
                  !newBlocker.story_id ||
                  !newBlocker.blocker_description.trim() ||
                  createBlocker.isPending
                }
                onClick={() => {
                  createBlocker.mutate(
                    {
                      story_id: newBlocker.story_id,
                      blocker_description: newBlocker.blocker_description.trim(),
                      severity: newBlocker.severity,
                    },
                    {
                      onSuccess: () => {
                        setNewBlocker({
                          story_id: '',
                          blocker_description: '',
                          severity: 'medium',
                        });
                        qc.invalidateQueries({ queryKey: ['blockers'] });
                      },
                    },
                  );
                }}
              >
                <FiPlus size={13} /> Add blocker
              </PrimaryBtn>
            </div>
          </AddForm>
        )}
      </Section>
    </>
  );
}

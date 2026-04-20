import styled from 'styled-components';
import { FiTrendingUp, FiCheckSquare, FiClock, FiAlertTriangle, FiUsers } from 'react-icons/fi';
import { theme } from '../../styles/theme';
import { Sparkline, SparkEvent } from './primitives';

export type KpiKey = 'completion' | 'velocity' | 'cycle' | 'overdue' | 'utilization';

export interface KpiConfig {
  key: KpiKey;
  label: string;
  value: number | string;
  unit: string;
  delta: number;
  color: string;
  inverse: boolean;
  spark: number[];
  priorSpark: number[];
  events: SparkEvent[];
}

const HeroGrid = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(0, 2fr);
  gap: 14px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const PrimaryTile = styled.div<{ $active: boolean }>`
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, ${theme.colors.charcoal} 0%, #1a1b1a 100%);
  border-radius: ${theme.borderRadius.lg};
  padding: 22px 24px;
  color: white;
  cursor: pointer;
  border: 2px solid ${(p) => (p.$active ? theme.colors.vividOrange : 'transparent')};
  box-shadow: ${theme.shadows.card};
  transition: ${theme.transitions.default};
`;

const AccentBlob = styled.div`
  position: absolute;
  top: -40px;
  right: -40px;
  width: 180px;
  height: 180px;
  background: radial-gradient(circle, ${theme.colors.vividOrange}40 0%, transparent 70%);
`;

const MiniGrid = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 10px;
`;

const MiniTile = styled.div<{ $active: boolean }>`
  background: ${theme.colors.white};
  border: 1px solid ${(p) => (p.$active ? theme.colors.vividOrange : theme.colors.border)};
  border-radius: ${theme.borderRadius.md};
  padding: 12px 14px;
  cursor: pointer;
  position: relative;
  box-shadow: ${(p) => (p.$active ? theme.shadows.cardHover : 'none')};
  transition: ${theme.transitions.default};

  &:hover {
    box-shadow: ${theme.shadows.cardHover};
  }
`;

const iconFor = (k: KpiKey) => {
  switch (k) {
    case 'completion':
      return <FiCheckSquare size={12} />;
    case 'velocity':
      return <FiTrendingUp size={17} />;
    case 'cycle':
      return <FiClock size={12} />;
    case 'overdue':
      return <FiAlertTriangle size={12} />;
    case 'utilization':
      return <FiUsers size={12} />;
  }
};

function MiniKpi({
  k,
  active,
  onClick,
}: {
  k: KpiConfig;
  active: boolean;
  onClick: () => void;
}) {
  const deltaColor = (k.inverse ? k.delta < 0 : k.delta >= 0) ? theme.colors.success : theme.colors.error;
  const deltaSign = k.delta >= 0 ? '+' : '';
  return (
    <MiniTile $active={active} onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 8, color: k.color }}>
        {iconFor(k.key)}
        <div
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: theme.colors.cadetGray,
            textTransform: 'uppercase',
            letterSpacing: 0.2,
            whiteSpace: 'nowrap',
          }}
        >
          {k.label}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 4 }}>
        <div
          style={{
            fontFamily: theme.typography.fontFamily.primary,
            fontSize: 22,
            fontWeight: 700,
            color: theme.colors.charcoal,
            lineHeight: 1,
            letterSpacing: -0.4,
          }}
        >
          {k.value}
        </div>
        {k.unit && <div style={{ fontSize: 11, color: theme.colors.cadetGray, fontWeight: 500 }}>{k.unit}</div>}
        <div style={{ flex: 1 }} />
        <div style={{ fontSize: 10, fontWeight: 700, color: deltaColor }}>
          {deltaSign}
          {k.delta}%
        </div>
      </div>
      <Sparkline data={k.spark} prior={k.priorSpark} events={k.events} color={k.color} height={22} />
    </MiniTile>
  );
}

export function KpiHero({
  kpiConfigs,
  activeKpi,
  setActiveKpi,
  priorDays,
}: {
  kpiConfigs: KpiConfig[];
  activeKpi: KpiKey | null;
  setActiveKpi: (k: KpiKey | null) => void;
  priorDays: number;
}) {
  const primary = kpiConfigs.find((k) => k.key === 'velocity')!;
  const secondaries = kpiConfigs.filter((k) => k.key !== 'velocity');
  const deltaColor = primary.delta >= 0 ? theme.colors.success : theme.colors.error;
  const deltaSign = primary.delta >= 0 ? '+' : '';

  return (
    <HeroGrid>
      <PrimaryTile
        $active={activeKpi === primary.key}
        onClick={() => setActiveKpi(activeKpi === primary.key ? null : primary.key)}
      >
        <AccentBlob />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18, position: 'relative' }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: theme.colors.vividOrange + '28',
              color: theme.colors.vividOrange,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {iconFor('velocity')}
          </div>
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: theme.colors.vividOrange,
                textTransform: 'uppercase',
                letterSpacing: 0.8,
              }}
            >
              North star
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)', marginTop: 1 }}>
              {primary.label}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, position: 'relative' }}>
          <div
            style={{
              fontFamily: theme.typography.fontFamily.primary,
              fontSize: 56,
              fontWeight: 800,
              color: 'white',
              lineHeight: 1,
              letterSpacing: -2,
            }}
          >
            {primary.value}
          </div>
          <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>{primary.unit}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, position: 'relative' }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              fontWeight: 700,
              color: deltaColor,
              background: deltaColor + '20',
              padding: '4px 10px',
              borderRadius: 12,
            }}
          >
            <FiTrendingUp size={12} />
            {deltaSign}
            {primary.delta}%
          </div>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)' }}>vs prior {priorDays}d</span>
        </div>

        <div style={{ marginTop: 10, position: 'relative' }}>
          <Sparkline
            data={primary.spark}
            prior={primary.priorSpark}
            events={primary.events}
            color={theme.colors.vividOrange}
            height={36}
          />
        </div>

        <div style={{ marginTop: 12, fontSize: 11, color: 'rgba(255,255,255,0.55)', position: 'relative' }}>
          Click for stories contributing to velocity →
        </div>
      </PrimaryTile>

      <MiniGrid>
        {secondaries.map((k) => (
          <MiniKpi
            key={k.key}
            k={k}
            active={activeKpi === k.key}
            onClick={() => setActiveKpi(activeKpi === k.key ? null : k.key)}
          />
        ))}
      </MiniGrid>
    </HeroGrid>
  );
}

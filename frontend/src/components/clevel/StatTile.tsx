import styled from 'styled-components';
import { theme } from '../../styles/theme';

const Tile = styled.div<{ $accent?: string }>`
  background: ${theme.colors.white};
  border: 1px solid ${theme.colors.border};
  border-radius: ${theme.borderRadius.md};
  padding: 14px 18px;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 3px;
    height: 100%;
    background: ${(p) => p.$accent || theme.colors.vividOrange};
    opacity: 0.8;
  }
`;

const Label = styled.div`
  font-size: 10px;
  font-weight: 700;
  color: ${theme.colors.cadetGray};
  text-transform: uppercase;
  letter-spacing: 0.6px;
  margin-bottom: 6px;
`;

const Value = styled.div`
  font-family: ${theme.typography.fontFamily.primary};
  font-size: 24px;
  font-weight: 800;
  color: ${theme.colors.charcoal};
  line-height: 1;
  letter-spacing: -0.4px;
`;

const Hint = styled.div`
  font-size: 11px;
  color: ${theme.colors.cadetGray};
  margin-top: 6px;
`;

export function StatTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: string;
}) {
  return (
    <Tile $accent={accent}>
      <Label>{label}</Label>
      <Value>{value}</Value>
      {hint && <Hint>{hint}</Hint>}
    </Tile>
  );
}

export const StatGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
`;

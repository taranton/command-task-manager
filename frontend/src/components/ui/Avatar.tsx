import styled from 'styled-components';
import { theme } from '../../styles/theme';

const StyledAvatar = styled.div<{ $size: number }>`
  width: ${(p) => p.$size}px;
  height: ${(p) => p.$size}px;
  border-radius: ${theme.borderRadius.round};
  background: linear-gradient(135deg, ${theme.colors.vividOrange}, ${theme.colors.deepOrange});
  color: ${theme.colors.white};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: ${(p) => Math.max(p.$size * 0.4, 10)}px;
  font-weight: ${theme.typography.fontWeight.semibold};
  flex-shrink: 0;
  overflow: hidden;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

interface AvatarProps {
  name: string;
  url?: string;
  size?: number;
}

export function Avatar({ name, url, size = 28 }: AvatarProps) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <StyledAvatar $size={size} title={name}>
      {url ? <img src={url} alt={name} /> : initials}
    </StyledAvatar>
  );
}

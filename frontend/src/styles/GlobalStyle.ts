import { createGlobalStyle } from 'styled-components';
import { theme } from './theme';

export const GlobalStyle = createGlobalStyle`
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html {
    font-size: 16px;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  body {
    font-family: ${theme.typography.fontFamily.secondary};
    font-size: ${theme.typography.fontSize.md};
    font-weight: ${theme.typography.fontWeight.regular};
    color: ${theme.colors.charcoal};
    background-color: ${theme.colors.background};
    line-height: 1.5;
    overflow-x: hidden;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: ${theme.typography.fontFamily.primary};
    font-weight: ${theme.typography.fontWeight.bold};
    line-height: 1.3;
  }

  a {
    color: ${theme.colors.vividOrange};
    text-decoration: none;

    &:hover {
      color: ${theme.colors.deepOrange};
    }
  }

  button {
    font-family: ${theme.typography.fontFamily.secondary};
    cursor: pointer;
    border: none;
    outline: none;
  }

  input, textarea, select {
    font-family: ${theme.typography.fontFamily.secondary};
    font-size: ${theme.typography.fontSize.sm};
    outline: none;
  }

  /* Scrollbar styling (matching QRT portal) */
  ::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  ::-webkit-scrollbar-track {
    background: transparent;
  }

  ::-webkit-scrollbar-thumb {
    background: ${theme.colors.silver};
    border-radius: 3px;

    &:hover {
      background: ${theme.colors.cadetGray};
    }
  }

  /* Selection */
  ::selection {
    background: rgba(255, 141, 0, 0.2);
    color: ${theme.colors.charcoal};
  }
`;

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../lib/api';
import { theme } from '../../styles/theme';

const Container = styled.div`
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: ${theme.colors.background};
`;

const Card = styled.div`
  background: ${theme.colors.white};
  border-radius: ${theme.borderRadius.xl};
  box-shadow: ${theme.shadows.lg};
  padding: ${theme.spacing.xl};
  width: 100%;
  max-width: 420px;
  margin: ${theme.spacing.md};
`;

const Logo = styled.div`
  text-align: center;
  margin-bottom: ${theme.spacing.xl};

  h1 {
    font-family: ${theme.typography.fontFamily.primary};
    font-size: ${theme.typography.fontSize['2xl']};
    font-weight: ${theme.typography.fontWeight.extrabold};
    color: ${theme.colors.charcoal};
  }

  p {
    font-size: ${theme.typography.fontSize.sm};
    color: ${theme.colors.cadetGray};
    margin-top: ${theme.spacing.xs};
  }
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.md};
`;

const FormGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${theme.spacing.sm};
`;

const Label = styled.label`
  font-size: ${theme.typography.fontSize.sm};
  font-weight: ${theme.typography.fontWeight.medium};
  color: ${theme.colors.mediumGray};
`;

const Input = styled.input<{ $hasError?: boolean }>`
  padding: 14px 16px;
  border: 1px solid ${(p) => (p.$hasError ? theme.colors.error : theme.colors.border)};
  border-radius: ${theme.borderRadius.sm};
  font-size: ${theme.typography.fontSize.md};
  transition: ${theme.transitions.default};

  &:focus {
    border-color: ${(p) => (p.$hasError ? theme.colors.error : theme.colors.vividOrange)};
  }

  &::placeholder {
    color: ${theme.colors.cadetGray};
  }
`;

const SubmitButton = styled.button`
  padding: 14px 24px;
  background: ${theme.colors.vividOrange};
  color: ${theme.colors.white};
  border: none;
  border-radius: ${theme.borderRadius.md};
  font-size: ${theme.typography.fontSize.md};
  font-weight: ${theme.typography.fontWeight.semibold};
  transition: ${theme.transitions.default};

  &:hover:not(:disabled) {
    background: ${theme.colors.deepOrange};
    transform: translateY(-1px);
    box-shadow: 0 4px 8px rgba(255, 141, 0, 0.3);
  }

  &:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled.div`
  background: ${theme.colors.errorLight};
  color: ${theme.colors.error};
  padding: ${theme.spacing.sm} ${theme.spacing.md};
  border-radius: ${theme.borderRadius.sm};
  font-size: ${theme.typography.fontSize.sm};
`;

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await login({ email, password });
        navigate('/board');
      } else {
        await api.post('/api/v1/auth/register', { email, full_name: fullName, password });
        setSuccess('Registration submitted! Please wait for admin approval.');
        setMode('login');
        setFullName('');
        setPassword('');
      }
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message;
      if (mode === 'login') {
        setError(msg === 'account pending approval' ? 'Your account is pending approval.' : 'Invalid email or password');
      } else {
        setError(msg || 'Registration failed');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container>
      <Card>
        <Logo>
          <h1>Command</h1>
          <p>QRT Task Manager</p>
        </Logo>

        <Form onSubmit={handleSubmit}>
          {error && <ErrorMessage>{error}</ErrorMessage>}
          {success && (
            <div style={{
              background: '#E8F5E9', color: '#4CAF50',
              padding: '8px 16px', borderRadius: '4px', fontSize: '14px',
            }}>{success}</div>
          )}

          {mode === 'register' && (
            <FormGroup>
              <Label>Full Name</Label>
              <Input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Smith"
                required
              />
            </FormGroup>
          )}

          <FormGroup>
            <Label>Email</Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              autoFocus
            />
          </FormGroup>

          <FormGroup>
            <Label>Password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'Min 6 characters' : 'Enter password'}
              required
            />
          </FormGroup>

          <SubmitButton type="submit" disabled={loading}>
            {loading
              ? (mode === 'login' ? 'Signing in...' : 'Registering...')
              : (mode === 'login' ? 'Sign In' : 'Request Access')}
          </SubmitButton>

          <div style={{ textAlign: 'center', fontSize: '14px', color: '#666' }}>
            {mode === 'login' ? (
              <>Don&apos;t have an account?{' '}
                <span style={{ color: '#FF8D00', cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => { setMode('register'); setError(''); setSuccess(''); }}>
                  Request Access
                </span>
              </>
            ) : (
              <>Already have an account?{' '}
                <span style={{ color: '#FF8D00', cursor: 'pointer', fontWeight: 600 }}
                  onClick={() => { setMode('login'); setError(''); setSuccess(''); }}>
                  Sign In
                </span>
              </>
            )}
          </div>
        </Form>
      </Card>
    </Container>
  );
}

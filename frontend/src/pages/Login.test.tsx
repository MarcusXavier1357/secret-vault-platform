import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Login from './Login';
import * as api from '../services/api';

// Mock the apiFetch service
vi.mock('../services/api', () => ({
  apiFetch: vi.fn(),
}));

describe('Login Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders login form properly', () => {
    render(<Login onLoginSuccess={() => {}} />);
    
    expect(screen.getByLabelText(/nome_do_operador/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/senha_de_acesso/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /INICIAR CONEXÃO DO SISTEMA/i })).toBeInTheDocument();
  });

  it('shows error message on failed login request', async () => {
    // Mock apiFetch to throw an error
    vi.mocked(api.apiFetch).mockRejectedValue(new Error('Invalid credentials'));

    render(<Login onLoginSuccess={() => {}} />);
    
    fireEvent.change(screen.getByLabelText(/nome_do_operador/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/senha_de_acesso/i), { target: { value: 'wrongpass' } });
    
    fireEvent.click(screen.getByRole('button', { name: /INICIAR CONEXÃO DO SISTEMA/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });

  it('calls onLoginSuccess on successful login request', async () => {
    // Mock apiFetch to succeed
    vi.mocked(api.apiFetch).mockResolvedValue({ message: 'Login successful' });
    const handleSuccess = vi.fn();

    render(<Login onLoginSuccess={handleSuccess} />);
    
    fireEvent.change(screen.getByLabelText(/nome_do_operador/i), { target: { value: 'admin' } });
    fireEvent.change(screen.getByLabelText(/senha_de_acesso/i), { target: { value: 'senha_forte' } });
    
    fireEvent.click(screen.getByRole('button', { name: /INICIAR CONEXÃO DO SISTEMA/i }));

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalledTimes(1);
    });
  });
});


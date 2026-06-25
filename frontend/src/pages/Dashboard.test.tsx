import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import Dashboard from './Dashboard';
import * as api from '../services/api';

vi.mock('../services/api', () => ({
  apiFetch: vi.fn(),
}));

describe('Dashboard Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dashboard metrics and secrets list', async () => {
    const mockSecrets = [
      {
        id: '1',
        name: 'STRIPE_API_KEY',
        description: 'Stripe payments key',
        status: 'ACTIVE',
        version: 1,
        expires_at: null,
        created_at: '2026-06-25T12:00:00Z',
        updated_at: '2026-06-25T12:00:00Z',
      },
      {
        id: '2',
        name: 'SMTP_PASSWORD',
        description: 'SMTP mail credentials',
        status: 'REVOKED',
        version: 2,
        expires_at: null,
        created_at: '2026-06-25T12:00:00Z',
        updated_at: '2026-06-25T12:00:00Z',
      }
    ];

    const mockAuditLogs = [
      {
        id: 'log1',
        event_type: 'CREATE_SECRET',
        secret_id: '1',
        secret_name: 'STRIPE_API_KEY',
        created_at: '2026-06-25T12:05:00Z',
        metadata: null,
      }
    ];

    // Mock API calls
    vi.mocked(api.apiFetch).mockImplementation((path: string) => {
      if (path === '/api/secrets') {
        return Promise.resolve(mockSecrets);
      }
      if (path === '/api/audit-logs') {
        return Promise.resolve(mockAuditLogs);
      }
      return Promise.reject(new Error('Not found'));
    });

    render(<Dashboard username="admin" onLogout={() => {}} />);

    // Check loading indicator shows up initially
    expect(screen.getByText(/carregando segredos/i)).toBeInTheDocument();

    // Wait for the data to resolve and render
    await waitFor(() => {
      expect(screen.getAllByText('STRIPE_API_KEY')[0]).toBeInTheDocument();
      expect(screen.getByText('SMTP_PASSWORD')).toBeInTheDocument();
    });

    // Check metrics are correct
    expect(screen.getByText('Total de Segredos').nextElementSibling?.textContent).toBe('2');
    expect(screen.getByText('Ativos').nextElementSibling?.textContent).toBe('1');
    expect(screen.getByText('Revogados').nextElementSibling?.textContent).toBe('1');

    // Check audit logs render in sidebar
    expect(screen.getByText('Logs de Auditoria')).toBeInTheDocument();
    expect(screen.getByText('CREATE_SECRET')).toBeInTheDocument();
  });
});

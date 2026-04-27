import React from 'react';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockUsePermissionGuard = jest.fn();

let mockCanManage = true;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('@/lib/hooks/usePermissionGuard', () => ({
  usePermissionGuard: (...args: unknown[]) => mockUsePermissionGuard(...args),
  usePermissions: () => ({ canManage: mockCanManage }),
}));

import NewCheckPage from '@/app/dashboard/checks/new/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard checks new page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns null when user does not have checks manage permission', () => {
    mockCanManage = false;

    const { container } = renderWithQueryClient(<NewCheckPage />);

    expect(mockUsePermissionGuard).toHaveBeenCalledWith('checks:manage');
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the issuance form when user can manage checks', async () => {
    mockCanManage = true;
    (api.get as jest.Mock).mockResolvedValue({ data: [] });

    renderWithQueryClient(<NewCheckPage />);

    expect(await screen.findByRole('heading', { name: 'Emitir cheque', level: 1 })).toBeInTheDocument();
    expect(screen.getByLabelText('Numero de cheque *')).toBeInTheDocument();
    expect(screen.getByLabelText('Monto *')).toBeInTheDocument();
    expect(screen.getByLabelText('Vencimiento *')).toBeInTheDocument();
    expect(screen.getByLabelText('Librador / Tercero *')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Emitir cheque' })).toBeDisabled();
  });
});

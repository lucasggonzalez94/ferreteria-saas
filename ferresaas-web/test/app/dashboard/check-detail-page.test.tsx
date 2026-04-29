import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockRefresh = jest.fn();
const mockUsePermissionGuard = jest.fn();

jest.mock('next/navigation', () => ({
  useParams: () => ({ id: 'chk-1' }),
  useRouter: () => ({ refresh: mockRefresh }),
}));

jest.mock('@/lib/hooks/usePermissionGuard', () => ({
  usePermissionGuard: (...args: unknown[]) => mockUsePermissionGuard(...args),
  usePermissions: () => ({ canRead: true, canManage: true }),
}));

import CheckDetailPage from '@/app/dashboard/checks/[id]/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard check detail page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads detail and performs clear/bounce/cancel transitions', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: {
        id: 'chk-1',
        checkNumber: '000321',
        amount: '1500',
        currency: 'ARS',
        status: 'ISSUED',
        issuedAt: '2026-04-26T00:00:00.000Z',
        dueDate: '2026-05-26T00:00:00.000Z',
        recipientName: 'Proveedor Uno',
        notes: 'Cheque diferido',
        account: { id: 'acc-1', name: 'Banco Nacion', bankName: 'Nacion', accountNumber: '1234' },
        payable: { id: 'pay-1' },
      },
    });
    (api.post as jest.Mock).mockResolvedValue({ data: {} });

    const promptSpy = jest.spyOn(window, 'prompt').mockReturnValue('Motivo test');

    renderWithQueryClient(<CheckDetailPage />);

    expect(mockUsePermissionGuard).toHaveBeenCalledWith('checks:read');
    expect(await screen.findByText('Cheque #000321')).toBeInTheDocument();
    expect(screen.getByText('Proveedor Uno')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Refrescar' }));
    expect(mockRefresh).toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Marcar cobrado' }));
    fireEvent.click(screen.getByRole('button', { name: 'Marcar rebotado' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar cheque' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/checks/chk-1/clear', { reason: undefined });
      expect(api.post).toHaveBeenCalledWith('/checks/chk-1/bounce', { reason: 'Motivo test' });
      expect(api.post).toHaveBeenCalledWith('/checks/chk-1/cancel', { reason: 'Motivo test' });
    });

    promptSpy.mockRestore();
  });
});

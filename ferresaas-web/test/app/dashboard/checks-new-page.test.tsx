import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockUsePermissionGuard = jest.fn();
const mockPush = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

let mockCanManage = true;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
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
  beforeAll(() => {
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      writable: true,
      value: jest.fn(),
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockCanManage = true;
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

  it('emits check and redirects on successful submit', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: [{ id: 'acc-1', name: 'Banco Nación', type: 'BANK', isActive: true, bankName: 'BNA' }],
    });
    (api.post as jest.Mock).mockResolvedValue({ data: { id: 'chk-1' } });

    renderWithQueryClient(<NewCheckPage />);

    const accountTrigger = screen.getByText('Cuenta bancaria *').parentElement?.querySelector('[role="combobox"]') as HTMLElement;
    fireEvent.click(accountTrigger);
    fireEvent.click(await screen.findByRole('option', { name: 'Banco Nación - BNA' }));

    fireEvent.change(screen.getByLabelText('Numero de cheque *'), { target: { value: ' 00012345 ' } });
    fireEvent.change(screen.getByLabelText('Monto *'), { target: { value: '1200.50' } });

    const currencyTrigger = screen.getByText('Moneda *').parentElement?.querySelector('[role="combobox"]') as HTMLElement;
    fireEvent.click(currencyTrigger);
    fireEvent.click(await screen.findByRole('option', { name: 'USD' }));

    fireEvent.change(screen.getByLabelText('Vencimiento *'), { target: { value: '2026-08-15' } });
    fireEvent.change(screen.getByLabelText('Librador / Tercero *'), { target: { value: '  Proveedor Demo ' } });
    fireEvent.change(screen.getByLabelText('Observaciones'), { target: { value: '  Entrega parcial ' } });

    fireEvent.click(screen.getByRole('button', { name: 'Emitir cheque' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/checks', expect.objectContaining({
        accountId: 'acc-1',
        checkNumber: '00012345',
        amount: 1200.5,
        currency: 'USD',
        recipientName: 'Proveedor Demo',
        notes: 'Entrega parcial',
      }));
      expect(mockToastSuccess).toHaveBeenCalledWith('Cheque emitido correctamente');
      expect(mockPush).toHaveBeenCalledWith('/dashboard/checks/chk-1');
    });
  });

  it('shows validation error when amount is invalid', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: [{ id: 'acc-1', name: 'Banco Nación', type: 'BANK', isActive: true }],
    });

    renderWithQueryClient(<NewCheckPage />);

    const accountTrigger = screen.getByText('Cuenta bancaria *').parentElement?.querySelector('[role="combobox"]') as HTMLElement;
    fireEvent.click(accountTrigger);
    fireEvent.click(await screen.findByRole('option', { name: 'Banco Nación' }));

    fireEvent.change(screen.getByLabelText('Numero de cheque *'), { target: { value: '123' } });
    fireEvent.change(screen.getByLabelText('Monto *'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Vencimiento *'), { target: { value: '2026-08-15' } });
    fireEvent.change(screen.getByLabelText('Librador / Tercero *'), { target: { value: 'Proveedor Demo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Emitir cheque' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Ingresa un monto valido');
      expect(api.post).not.toHaveBeenCalled();
    });
  });

  it('shows fallback error message when mutation throws non-Error', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: [{ id: 'acc-1', name: 'Banco Nación', type: 'BANK', isActive: true }],
    });
    (api.post as jest.Mock).mockRejectedValue('boom');

    renderWithQueryClient(<NewCheckPage />);

    const accountTrigger = screen.getByText('Cuenta bancaria *').parentElement?.querySelector('[role="combobox"]') as HTMLElement;
    fireEvent.click(accountTrigger);
    fireEvent.click(await screen.findByRole('option', { name: 'Banco Nación' }));

    fireEvent.change(screen.getByLabelText('Numero de cheque *'), { target: { value: '123' } });
    fireEvent.change(screen.getByLabelText('Monto *'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('Vencimiento *'), { target: { value: '2026-08-15' } });
    fireEvent.change(screen.getByLabelText('Librador / Tercero *'), { target: { value: 'Proveedor Demo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Emitir cheque' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('No se pudo emitir el cheque');
    });
  });
});

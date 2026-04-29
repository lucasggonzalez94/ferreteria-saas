import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockPush = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
let mockUser: any = { permissions: ['cash_register:read'] };

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => ({
    user: mockUser,
  }),
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import CashRegisterPage from '@/app/dashboard/cash-register/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard cash register page', () => {
  const anchorClickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { permissions: ['cash_register:read'] };
  });

  afterAll(() => {
    anchorClickSpy.mockRestore();
  });

  it('opens cash register when there is no active session', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') {
        return Promise.resolve({ data: null });
      }
      if (url === '/cash-register/suggested-opening') {
        return Promise.resolve({ data: { suggestedAmount: 100, suggestedAmountUSD: 0 } });
      }
      if (url === '/exchange-rate/config') {
        return Promise.resolve({ data: { usdEnabled: false } });
      }
      return Promise.resolve({ data: null });
    });
    (api.post as jest.Mock).mockResolvedValue({ data: {} });

    renderWithQueryClient(<CashRegisterPage />);

    expect(await screen.findByText('Monto Inicial (ARS) *')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir Caja' }));

    const confirmButton = screen.queryByRole('button', { name: 'Confirmar y Abrir' });
    if (confirmButton) {
      fireEvent.click(confirmButton);
    }

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/cash-register/open', {
        openingAmount: 100,
        openingAmountUSD: undefined,
        sourceAccountId: undefined,
      });
    });
  });

  it('redirects to dashboard when user lacks cash register permission', async () => {
    mockUser = { permissions: [] };
    (api.get as jest.Mock).mockResolvedValue({ data: null });

    renderWithQueryClient(<CashRegisterPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('renders open session status and close action', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') {
        return Promise.resolve({
          data: {
            id: 'session-1',
            openingAmount: 500,
            openedAt: '2026-04-26T12:00:00.000Z',
            _count: { sales: 2 },
            movements: [],
          },
        });
      }
      if (url === '/cash-register/session-1/summary') {
        return Promise.resolve({
          data: {
            paymentsByMethod: { CASH_ARS: 800 },
            expectedAmount: 900,
            expectedAmountUSD: 0,
            movements: [],
          },
        });
      }
      if (url === '/exchange-rate/config') {
        return Promise.resolve({ data: { usdEnabled: false } });
      }
      return Promise.resolve({ data: null });
    });

    renderWithQueryClient(<CashRegisterPage />);

    expect(await screen.findByText('Caja Abierta')).toBeInTheDocument();
    expect(screen.getByText('Movimientos de Caja')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrar Movimiento' })).toBeInTheDocument();
  });

  it('shows difference confirmation and allows cancel on open', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') return Promise.resolve({ data: null });
      if (url === '/cash-register/suggested-opening') {
        return Promise.resolve({ data: { suggestedAmount: 100, suggestedAmountUSD: 0 } });
      }
      if (url === '/exchange-rate/config') return Promise.resolve({ data: { usdEnabled: false } });
      return Promise.resolve({ data: null });
    });

    renderWithQueryClient(<CashRegisterPage />);

    expect(await screen.findByText('Monto Inicial (ARS) *')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Monto Inicial (ARS) *'), { target: { value: '130' } });
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Caja' }));

    expect(await screen.findByText('Diferencia Detectada')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    await waitFor(() => {
      expect(screen.queryByText('Diferencia Detectada')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Monto Inicial (ARS) *')).toHaveValue(100);
    });
  });

  it('validates movement amount before submitting move mutation', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') {
        return Promise.resolve({
          data: {
            id: 'session-1',
            openingAmount: 500,
            openedAt: '2026-04-26T12:00:00.000Z',
            _count: { sales: 0 },
            movements: [],
          },
        });
      }
      if (url === '/cash-register/session-1/summary') {
        return Promise.resolve({
          data: { paymentsByMethod: {}, expectedAmount: 500, expectedAmountUSD: 0, movements: [] },
        });
      }
      if (url === '/exchange-rate/config') return Promise.resolve({ data: { usdEnabled: false } });
      return Promise.resolve({ data: null });
    });

    renderWithQueryClient(<CashRegisterPage />);

    expect(await screen.findByText('Caja Abierta')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Movimiento' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar Movimiento' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Monto inválido');
      expect(api.post).not.toHaveBeenCalledWith('/cash-register/move', expect.anything());
    });
  });

  it('validates closing amount before calling close endpoint', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') {
        return Promise.resolve({
          data: {
            id: 'session-1',
            openingAmount: 500,
            openedAt: '2026-04-26T12:00:00.000Z',
            _count: { sales: 0 },
            movements: [],
          },
        });
      }
      if (url === '/cash-register/session-1/summary') {
        return Promise.resolve({
          data: { paymentsByMethod: {}, expectedAmount: 500, expectedAmountUSD: 0, movements: [] },
        });
      }
      if (url === '/exchange-rate/config') return Promise.resolve({ data: { usdEnabled: false } });
      return Promise.resolve({ data: null });
    });

    renderWithQueryClient(<CashRegisterPage />);

    expect(await screen.findByText('Caja Abierta')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Monto Final (ARS) *'), { target: { value: '-5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar Caja' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Ingrese un monto válido para ARS');
      expect(api.post).not.toHaveBeenCalledWith('/cash-register/close', expect.anything());
    });
  });

  it('confirms difference and opens cash register', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') return Promise.resolve({ data: null });
      if (url === '/cash-register/suggested-opening') {
        return Promise.resolve({ data: { suggestedAmount: 100, suggestedAmountUSD: 0 } });
      }
      if (url === '/exchange-rate/config') return Promise.resolve({ data: { usdEnabled: false } });
      return Promise.resolve({ data: null });
    });
    (api.post as jest.Mock).mockResolvedValue({
      data: { hasDifferenceARS: true, differenceWithAccountARS: 30, hasDifferenceUSD: false },
    });

    renderWithQueryClient(<CashRegisterPage />);

    expect(await screen.findByText('Monto Inicial (ARS) *')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Monto Inicial (ARS) *'), { target: { value: '130' } });
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Caja' }));

    expect(await screen.findByText('Diferencia Detectada')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y Abrir' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/cash-register/open', {
        openingAmount: 130,
        openingAmountUSD: undefined,
        sourceAccountId: undefined,
      });
      expect(mockToastSuccess).toHaveBeenCalledWith('Caja abierta. Se registró: ingreso de $30.00 ARS', {
        duration: 5000,
      });
    });
  });

  it('validates invalid USD opening amount when USD is enabled', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') return Promise.resolve({ data: null });
      if (url === '/cash-register/suggested-opening') {
        return Promise.resolve({ data: { suggestedAmount: 100, suggestedAmountUSD: 50 } });
      }
      if (url === '/exchange-rate/config') return Promise.resolve({ data: { usdEnabled: true } });
      return Promise.resolve({ data: null });
    });

    renderWithQueryClient(<CashRegisterPage />);

    expect(await screen.findByLabelText('Monto Inicial (USD)')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Monto Inicial (USD)'), { target: { value: '-2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Abrir Caja' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Ingrese un monto válido para USD');
      expect(api.post).not.toHaveBeenCalledWith('/cash-register/open', expect.anything());
    });
  });

  it('registers movement successfully', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') {
        return Promise.resolve({
          data: {
            id: 'session-1',
            openingAmount: 500,
            openedAt: '2026-04-26T12:00:00.000Z',
            _count: { sales: 0 },
            movements: [],
          },
        });
      }
      if (url === '/cash-register/session-1/summary') {
        return Promise.resolve({
          data: { paymentsByMethod: {}, expectedAmount: 500, expectedAmountUSD: 0, movements: [] },
        });
      }
      if (url === '/exchange-rate/config') return Promise.resolve({ data: { usdEnabled: false } });
      return Promise.resolve({ data: null });
    });
    (api.post as jest.Mock).mockResolvedValue({ data: {} });

    renderWithQueryClient(<CashRegisterPage />);

    expect(await screen.findByText('Caja Abierta')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar Movimiento' }));

    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByLabelText('Monto'), { target: { value: '25' } });
    fireEvent.change(within(dialog).getByLabelText('Motivo'), { target: { value: 'Compra de insumos' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Registrar Movimiento' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/cash-register/move', {
        type: 'INCOME',
        amount: 25,
        reason: 'Compra de insumos',
      });
      expect(mockToastSuccess).toHaveBeenCalledWith('Movimiento registrado exitosamente');
    });
  });

  it('closes cash register and prints report', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') {
        return Promise.resolve({
          data: {
            id: 'session-1',
            openingAmount: 500,
            openedAt: '2026-04-26T12:00:00.000Z',
            _count: { sales: 2 },
            movements: [],
          },
        });
      }
      if (url === '/cash-register/session-1/summary') {
        return Promise.resolve({
          data: { paymentsByMethod: {}, expectedAmount: 500, expectedAmountUSD: 0, movements: [] },
        });
      }
      if (url === '/exchange-rate/config') return Promise.resolve({ data: { usdEnabled: false } });
      return Promise.resolve({ data: null });
    });
    (api.post as jest.Mock).mockResolvedValue({ data: {} });
    (api.getBlob as jest.Mock).mockResolvedValue(new Blob(['pdf']));
    const createObjectURLMock = jest.fn(() => 'blob:report');
    const revokeObjectURLMock = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', { writable: true, value: createObjectURLMock });
    Object.defineProperty(URL, 'revokeObjectURL', { writable: true, value: revokeObjectURLMock });

    renderWithQueryClient(<CashRegisterPage />);

    expect(await screen.findByText('Caja Abierta')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Monto Final (ARS) *'), { target: { value: '500' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar Caja' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/cash-register/close', {
        closingAmount: 500,
        closingAmountUSD: undefined,
        destinationAccountId: undefined,
      });
      expect(mockToastSuccess).toHaveBeenCalledWith('Caja cerrada exitosamente');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Reporte' }));

    await waitFor(() => {
      expect(api.getBlob).toHaveBeenCalledWith('/cash-register/session-1/summary/pdf');
      expect(createObjectURLMock).toHaveBeenCalled();
      expect(revokeObjectURLMock).toHaveBeenCalled();
    });
  });

  it('shows PDF generation error when report download fails', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/cash-register/status') {
        return Promise.resolve({
          data: {
            id: 'session-1',
            openingAmount: 500,
            openedAt: '2026-04-26T12:00:00.000Z',
            _count: { sales: 2 },
            movements: [],
          },
        });
      }
      if (url === '/cash-register/session-1/summary') {
        return Promise.resolve({
          data: { paymentsByMethod: {}, expectedAmount: 500, expectedAmountUSD: 0, movements: [] },
        });
      }
      if (url === '/exchange-rate/config') return Promise.resolve({ data: { usdEnabled: false } });
      return Promise.resolve({ data: null });
    });
    (api.getBlob as jest.Mock).mockRejectedValue('boom');

    renderWithQueryClient(<CashRegisterPage />);

    expect(await screen.findByText('Caja Abierta')).toBeInTheDocument();
    expect(await screen.findByText('Montos esperados')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Reporte' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Error al generar el PDF. Por favor, intenta nuevamente.');
    });
  });
});

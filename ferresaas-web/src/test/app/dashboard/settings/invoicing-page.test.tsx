import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockPush = jest.fn();
const mockToastError = jest.fn();
const mockToastSuccess = jest.fn();

let mockAuthValue: any;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

jest.mock('@/components/ui/actions-menu', () => ({
  ActionsMenu: ({ actions }: { actions: Array<{ label: string; onClick: () => void; disabled?: boolean }> }) => (
    <div>
      {actions.map((action) => (
        <button key={action.label} type="button" onClick={action.onClick} disabled={action.disabled}>
          {action.label}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => mockAuthValue,
}));

import InvoicingSettingsPage from '@/app/dashboard/settings/invoicing/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('invoicing settings page', () => {
  const createObjectURLMock = jest.fn(() => 'blob:invoice');

  beforeEach(() => {
    jest.clearAllMocks();
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: createObjectURLMock,
    });

    mockAuthValue = {
      user: {
        permissions: ['settings:read', 'settings:update', 'sales:read', 'sales:manage'],
      },
      isLoading: false,
    };

    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/business') {
        return Promise.resolve({
          data: {
            id: 'biz-1',
            invoiceProvider: 'arca_direct',
            invoicePointOfSale: 1,
          },
        });
      }

      if (url === '/business/invoicing/arca-credentials') {
        return Promise.resolve({
          data: {
            configured: false,
            cuit: '',
            isEnabled: false,
            hasCertificatePem: false,
            hasPrivateKeyPem: false,
            tokenExpiresAt: null,
            updatedAt: null,
          },
        });
      }

      if (url === '/sales/invoice-jobs/stats') {
        return Promise.resolve({
          data: {
            jobs: {
              pending: 1,
              processing: 0,
              retrying: 1,
              failed: 1,
              completed: 2,
              readyToProcess: 1,
            },
            providersLast24h: [{ provider: 'arca_direct', issued: 2 }],
          },
        });
      }

      if (url === '/sales/invoice-jobs') {
        return Promise.resolve({
          data: [
            {
              id: 'job-failed',
              saleId: 'sale-failed',
              voucherType: 'B',
              status: 'FAILED',
              attempts: 2,
              maxAttempts: 3,
              nextRetryAt: '2026-04-20T10:00:00.000Z',
              lastError: 'AFIP timeout',
              updatedAt: '2026-04-20T09:00:00.000Z',
              sale: { id: 'sale-failed', invoiceStatus: 'FAILED', total: 100 },
            },
            {
              id: 'job-ok',
              saleId: 'sale-ok',
              voucherType: 'B',
              status: 'COMPLETED',
              attempts: 1,
              maxAttempts: 3,
              nextRetryAt: '2026-04-20T10:00:00.000Z',
              lastError: null,
              updatedAt: '2026-04-20T09:00:00.000Z',
              sale: { id: 'sale-ok', invoiceStatus: 'INVOICED', total: 200 },
            },
          ],
        });
      }

      return Promise.resolve({ data: [] });
    });
  });

  it('redirects to settings index when user lacks settings:read', async () => {
    mockAuthValue = {
      user: {
        permissions: [],
      },
      isLoading: false,
    };

    renderWithQueryClient(<InvoicingSettingsPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard/settings');
    });
  });

  it('saves point-of-sale configuration when value is valid', async () => {
    (api.patch as jest.Mock).mockResolvedValue({
      data: {
        id: 'biz-1',
        invoiceProvider: 'arca_direct',
        invoicePointOfSale: 4,
      },
    });

    renderWithQueryClient(<InvoicingSettingsPage />);

    await screen.findByText('Parámetros de emisión');

    fireEvent.change(screen.getByPlaceholderText('1'), {
      target: { value: '4' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/business', {
        invoiceProvider: 'arca_direct',
        invoicePointOfSale: 4,
      });
    });
  });

  it('validates point-of-sale before saving', async () => {
    renderWithQueryClient(<InvoicingSettingsPage />);

    await screen.findByText('Parámetros de emisión');

    fireEvent.change(screen.getByPlaceholderText('1'), {
      target: { value: '0' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración' }));

    expect(api.patch).not.toHaveBeenCalled();
    expect(mockToastError).toHaveBeenCalledWith('El punto de venta debe ser un número entero mayor a 0');
  });

  it('validates ARCA credentials before saving when required fields are missing', async () => {
    renderWithQueryClient(<InvoicingSettingsPage />);

    await screen.findByText('Credenciales ARCA por negocio');
    fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración ARCA' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('El CUIT de ARCA es obligatorio');
    });
  });

  it('saves ARCA credentials and allows refreshing wsaa token', async () => {
    (api.patch as jest.Mock).mockResolvedValue({ data: { ok: true } });
    (api.post as jest.Mock).mockResolvedValue({ data: { ok: true } });

    renderWithQueryClient(<InvoicingSettingsPage />);

    await screen.findByText('Credenciales ARCA por negocio');

    fireEvent.change(screen.getByLabelText('CUIT para facturar'), {
      target: { value: '20123456789' },
    });
    fireEvent.change(screen.getByLabelText('Certificado PEM (opcional)'), {
      target: { value: '-----BEGIN CERTIFICATE-----demo' },
    });
    fireEvent.change(screen.getByLabelText('Clave privada PEM (opcional)'), {
      target: { value: '-----BEGIN PRIVATE KEY-----demo' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Guardar configuración ARCA' }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/business/invoicing/arca-credentials', {
        cuit: '20123456789',
        certificatePem: '-----BEGIN CERTIFICATE-----demo',
        privateKeyPem: '-----BEGIN PRIVATE KEY-----demo',
        isEnabled: false,
      });
      expect(mockToastSuccess).toHaveBeenCalledWith('Configuración ARCA guardada correctamente');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Renovar Token/Sign WSAA' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/business/invoicing/arca-credentials/refresh', {
        force: true,
      });
      expect(mockToastSuccess).toHaveBeenCalledWith('Token/Sign renovados con WSAA');
    });
  });

  it('hides invoice queue when user lacks sales:read permission', async () => {
    mockAuthValue = {
      user: {
        permissions: ['settings:read', 'settings:update'],
      },
      isLoading: false,
    };

    renderWithQueryClient(<InvoicingSettingsPage />);

    expect(await screen.findByText('Credenciales ARCA por negocio')).toBeInTheDocument();
    expect(
      screen.getByText('Tu usuario no tiene permiso `sales:read`, por eso no se muestran métricas ni cola de facturación.'),
    ).toBeInTheDocument();
  });

  it('renders jobs queue and supports detail, pdf and retry actions', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { ok: true } });
    (api.getBlob as jest.Mock).mockResolvedValue(new Blob(['pdf']));
    const openSpy = jest.spyOn(window, 'open').mockReturnValue({} as Window);

    (api.get as jest.Mock).mockImplementation((url: string, opts?: any) => {
      if (url === '/sales/invoices' && opts?.params?.saleId === 'sale-ok') {
        return Promise.resolve({ data: [{ id: 'inv-1', status: 'ISSUED' }] });
      }
      if (url === '/sales/invoices' && opts?.params?.saleId === 'sale-failed') {
        return Promise.resolve({ data: [{ id: 'inv-2', status: 'FAILED' }] });
      }

      if (url === '/business') {
        return Promise.resolve({ data: { id: 'biz-1', invoiceProvider: 'arca_direct', invoicePointOfSale: 1 } });
      }
      if (url === '/business/invoicing/arca-credentials') {
        return Promise.resolve({
          data: {
            configured: true,
            cuit: '20123456789',
            isEnabled: true,
            hasCertificatePem: true,
            hasPrivateKeyPem: true,
            tokenExpiresAt: null,
            updatedAt: null,
          },
        });
      }
      if (url === '/sales/invoice-jobs/stats') {
        return Promise.resolve({
          data: {
            jobs: { pending: 1, processing: 0, retrying: 1, failed: 1, completed: 2, readyToProcess: 1 },
            providersLast24h: [{ provider: 'arca_direct', issued: 2 }],
          },
        });
      }
      if (url === '/sales/invoice-jobs') {
        return Promise.resolve({
          data: [
            {
              id: 'job-failed',
              saleId: 'sale-failed',
              voucherType: 'B',
              status: 'FAILED',
              attempts: 2,
              maxAttempts: 3,
              nextRetryAt: '2026-04-20T10:00:00.000Z',
              lastError: 'AFIP timeout',
              updatedAt: '2026-04-20T09:00:00.000Z',
              sale: { id: 'sale-failed', invoiceStatus: 'FAILED', total: 100 },
            },
            {
              id: 'job-ok',
              saleId: 'sale-ok',
              voucherType: 'B',
              status: 'COMPLETED',
              attempts: 1,
              maxAttempts: 3,
              nextRetryAt: '2026-04-20T10:00:00.000Z',
              lastError: null,
              updatedAt: '2026-04-20T09:00:00.000Z',
              sale: { id: 'sale-ok', invoiceStatus: 'INVOICED', total: 200 },
            },
          ],
        });
      }

      return Promise.resolve({ data: [] });
    });

    renderWithQueryClient(<InvoicingSettingsPage />);

    expect(await screen.findByText('Cola de facturación')).toBeInTheDocument();
    expect(screen.getByText('sale-failed')).toBeInTheDocument();
    expect(screen.getByText('sale-ok')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Ver detalle' })[0]);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard/invoices/inv-2');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Descargar PDF' }));

    await waitFor(() => {
      expect(api.getBlob).toHaveBeenCalledWith('/sales/sale-ok/invoices/inv-1/pdf');
      expect(openSpy).toHaveBeenCalledWith('blob:invoice', '_blank');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/sales/invoice-jobs/job-failed/retry');
      expect(mockToastSuccess).toHaveBeenCalledWith('Reintento ejecutado');
    });

    openSpy.mockRestore();
  });
});

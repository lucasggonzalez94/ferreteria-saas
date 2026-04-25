import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockPush = jest.fn();
const mockToastError = jest.fn();

let mockAuthValue: any;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('sonner', () => ({
  toast: {
    success: jest.fn(),
    error: (...args: unknown[]) => mockToastError(...args),
  },
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
  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthValue = {
      user: {
        permissions: ['settings:read', 'settings:update'],
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
});

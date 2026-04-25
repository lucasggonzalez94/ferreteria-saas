import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockPush = jest.fn();
const mockUpdateBusiness = jest.fn();
const mockSetBusinessTimezone = jest.fn();

let mockAuthValue: any;

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    const { priority: _priority, ...rest } = props;
    return <img {...rest} alt={rest.alt || 'image'} />;
  },
}));

jest.mock('@/lib/timezone', () => ({
  COMMON_TIMEZONES: [
    { value: 'America/Buenos_Aires', label: 'America/Buenos_Aires' },
    { value: 'UTC', label: 'UTC' },
  ],
  setBusinessTimezone: (...args: unknown[]) => mockSetBusinessTimezone(...args),
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => mockAuthValue,
}));

import BusinessSettingsPage from '@/app/dashboard/settings/business/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('business settings page', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthValue = {
      user: {
        permissions: ['settings:read', 'settings:update'],
      },
      business: {
        id: 'biz-1',
        timezone: 'America/Buenos_Aires',
      },
      updateBusiness: mockUpdateBusiness,
      isLoading: false,
    };
  });

  it('saves business information with normalized optional fields', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: {
        id: 'biz-1',
        name: 'Ferreteria Central',
        cuit: '20-12345678-9',
        address: null,
        phone: null,
        email: null,
        logoUrl: null,
        timezone: 'America/Buenos_Aires',
      },
    });

    (api.patch as jest.Mock).mockResolvedValue({
      data: {
        id: 'biz-1',
        name: 'Ferreteria Central',
        cuit: '20-12345678-9',
        address: null,
        phone: null,
        email: null,
        logoUrl: null,
        timezone: 'America/Buenos_Aires',
      },
    });

    renderWithQueryClient(<BusinessSettingsPage />);

    await screen.findByDisplayValue('Ferreteria Central');

    fireEvent.change(screen.getByLabelText('Dirección Comercial'), {
      target: { value: '   ' },
    });
    fireEvent.change(screen.getByLabelText('Teléfono'), {
      target: { value: '   ' },
    });
    fireEvent.change(screen.getByLabelText('Email de Contacto'), {
      target: { value: '   ' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/business', {
        name: 'Ferreteria Central',
        cuit: '20-12345678-9',
        address: null,
        phone: null,
        email: null,
      });
    });
  });

  it('shows read-only message when user cannot update settings', async () => {
    mockAuthValue = {
      ...mockAuthValue,
      user: { permissions: ['settings:read'] },
    };

    (api.get as jest.Mock).mockResolvedValue({
      data: {
        id: 'biz-1',
        name: 'Ferreteria Central',
        cuit: '20-12345678-9',
        address: null,
        phone: null,
        email: null,
        logoUrl: null,
        timezone: 'America/Buenos_Aires',
      },
    });

    renderWithQueryClient(<BusinessSettingsPage />);

    expect(await screen.findByText('Tienes acceso de solo lectura para esta configuración.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Guardar Cambios' })).not.toBeInTheDocument();
  });

  it('redirects to settings index when user lacks read permission', async () => {
    mockAuthValue = {
      ...mockAuthValue,
      user: { permissions: [] },
    };

    renderWithQueryClient(<BusinessSettingsPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard/settings');
    });
  });
});

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockPush = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
const mockToastWarning = jest.fn();

let mockUser: any = { permissions: ['products:create'] };

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    const { priority: _priority, unoptimized: _unoptimized, ...rest } = props;
    return <img {...rest} alt={rest.alt || 'image'} />;
  },
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => ({ user: mockUser }),
}));

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
    warning: (...args: unknown[]) => mockToastWarning(...args),
  },
}));

import NewProductPage from '@/app/dashboard/products/new/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard products new page', () => {
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    mockUser = { permissions: ['products:create'] };
    (api.get as jest.Mock).mockResolvedValue({ data: [] });
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
  });

  it('redirects when user lacks create permission', async () => {
    mockUser = { permissions: [] };

    renderWithQueryClient(<NewProductPage />);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/dashboard/products');
    });
  });

  it('blocks submit when target margin is missing in margin mode', async () => {
    renderWithQueryClient(<NewProductPage />);

    fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'Taladro' } });
    fireEvent.change(screen.getByLabelText('Costo *'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('Precio de Venta *'), { target: { value: '150' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear Producto' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "Debes configurar un Margen Objetivo para el modo 'Mantener Margen'",
      );
      expect(api.post).not.toHaveBeenCalled();
    });
  });

  it('calculates suggested price and applies it to sale price', async () => {
    (api.post as jest.Mock).mockImplementation((url: string) => {
      if (url === '/products/calculate-price') {
        return Promise.resolve({ data: { suggestedPrice: 145.5 } });
      }
      return Promise.resolve({ data: {} });
    });

    renderWithQueryClient(<NewProductPage />);

    fireEvent.change(screen.getByLabelText('Costo *'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('IVA (%)'), { target: { value: '21' } });
    fireEvent.change(screen.getByLabelText('Margen (%)'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Calcular' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/products/calculate-price', {
        cost: 100,
        taxRate: 21,
        marginPercent: 20,
      });
    });

    expect(screen.getByText('$145.50')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(screen.getByLabelText('Precio de Venta *')).toHaveValue(145.5);
  });

  it('creates product and redirects to products list', async () => {
    (api.post as jest.Mock).mockImplementation((url: string, payload: any) => {
      if (url === '/products') {
        return Promise.resolve({ data: { id: 'p-1', ...payload } });
      }
      return Promise.resolve({ data: {} });
    });

    renderWithQueryClient(<NewProductPage />);

    fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'Martillo' } });
    fireEvent.change(screen.getByLabelText('Costo *'), { target: { value: '80' } });
    fireEvent.change(screen.getByLabelText('Precio de Venta *'), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText('Margen Objetivo (%)'), { target: { value: '35' } });

    fireEvent.click(screen.getByRole('button', { name: 'Crear Producto' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/products',
        expect.objectContaining({
          name: 'Martillo',
          cost: 80,
          price: 120,
          taxRate: 21,
          pricingMode: 'margin',
          targetMargin: 35,
          isFractional: false,
        }),
      );
      expect(mockToastSuccess).toHaveBeenCalledWith('Producto creado exitosamente');
      expect(mockPush).toHaveBeenCalledWith('/dashboard/products');
    });
  });
});

import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockPush = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

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

jest.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? (
      <button type="button" onClick={onConfirm}>
        Confirmar eliminar
      </button>
    ) : null,
}));

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

import EditProductPage from '@/app/dashboard/products/[id]/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard product edit page', () => {
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/categories') {
        return Promise.resolve({ data: [{ id: 'cat-1', name: 'Herramientas' }] });
      }
      if (url === '/products/p-1') {
        return Promise.resolve({
          data: {
            id: 'p-1',
            name: 'Taladro',
            barcode: '1234',
            description: 'Taladro percutor',
            categoryId: 'cat-1',
            unit: 'u',
            cost: 100,
            price: 150,
            taxRate: 21,
            marginPercent: 30,
            minStock: 2,
            stockQuantity: 7,
            isActive: true,
            pricingMode: 'margin',
            targetMargin: 35,
            priceLocked: false,
            roundingStep: 10,
            costMethod: 'avg_weighted',
            imageUrl: null,
          },
        });
      }
      return Promise.resolve({ data: [] });
    });
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
  });

  it('updates product and redirects to products list', async () => {
    (api.put as jest.Mock).mockResolvedValue({ data: { id: 'p-1' } });

    renderWithQueryClient(<EditProductPage params={{ id: 'p-1' }} />);

    expect(await screen.findByRole('heading', { name: 'Editar Producto', level: 1 })).toBeInTheDocument();
    await screen.findByDisplayValue('Taladro');

    fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'Taladro Pro' } });
    fireEvent.change(screen.getByLabelText('Stock Actual'), { target: { value: '10' } });
    fireEvent.submit(screen.getByRole('button', { name: 'Guardar Cambios' }).closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith(
        '/products/p-1',
        expect.objectContaining({
          name: 'Taladro Pro',
          stockQuantity: 10,
          pricingMode: 'margin',
          targetMargin: 35,
          isFractional: false,
        }),
      );
      expect(mockToastSuccess).toHaveBeenCalledWith('Producto actualizado exitosamente');
      expect(mockPush).toHaveBeenCalledWith('/dashboard/products');
    });
  });

  it('prints label PDF using getBlob and window.open', async () => {
    (api.getBlob as jest.Mock).mockResolvedValue(new Blob(['pdf']));
    const createObjectURLMock = jest.fn(() => 'blob:demo');
    const revokeObjectURLMock = jest.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: createObjectURLMock,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: revokeObjectURLMock,
    });
    const openSpy = jest.spyOn(window, 'open').mockReturnValue({} as Window);

    renderWithQueryClient(<EditProductPage params={{ id: 'p-1' }} />);

    expect(await screen.findByRole('heading', { name: 'Editar Producto', level: 1 })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Imprimir etiqueta' }));

    await waitFor(() => {
      expect(api.getBlob).toHaveBeenCalledWith('/products/p-1/barcode');
      expect(openSpy).toHaveBeenCalledWith('blob:demo');
      expect(createObjectURLMock).toHaveBeenCalled();
    });

    openSpy.mockRestore();
  });

  it('deletes product through confirm dialog', async () => {
    (api.delete as jest.Mock).mockResolvedValue({ data: {} });

    renderWithQueryClient(<EditProductPage params={{ id: 'p-1' }} />);

    expect(await screen.findByRole('heading', { name: 'Editar Producto', level: 1 })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar producto' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar eliminar' }));

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/products/p-1');
      expect(mockToastSuccess).toHaveBeenCalledWith('Producto eliminado exitosamente');
      expect(mockPush).toHaveBeenCalledWith('/dashboard/products');
    });
  });

  it('calculates and applies suggested price', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { suggestedPrice: 189.5 } });

    renderWithQueryClient(<EditProductPage params={{ id: 'p-1' }} />);

    expect(await screen.findByRole('heading', { name: 'Editar Producto', level: 1 })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Costo *'), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText('IVA (%)'), { target: { value: '21' } });
    fireEvent.change(screen.getByLabelText('Margen (%)'), { target: { value: '30' } });

    fireEvent.click(screen.getByRole('button', { name: 'Calcular' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/products/calculate-price', {
        cost: 120,
        taxRate: 21,
        marginPercent: 30,
      });
      expect(mockToastSuccess).toHaveBeenCalledWith('Precio sugerido: $189.50');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(screen.getByLabelText('Precio de Venta *')).toHaveValue(189.5);
  });

  it('shows error when suggested price calculation request fails', async () => {
    (api.post as jest.Mock).mockRejectedValue(new Error('Error al calcular precio'));

    renderWithQueryClient(<EditProductPage params={{ id: 'p-1' }} />);

    expect(await screen.findByRole('heading', { name: 'Editar Producto', level: 1 })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Costo *'), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText('IVA (%)'), { target: { value: '21' } });
    fireEvent.change(screen.getByLabelText('Margen (%)'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Calcular' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Error al calcular precio');
    });
  });

  it('blocks submit when target margin is empty in margin mode', async () => {
    renderWithQueryClient(<EditProductPage params={{ id: 'p-1' }} />);

    expect(await screen.findByRole('heading', { name: 'Editar Producto', level: 1 })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Margen Objetivo (%)'), { target: { value: '' } });

    fireEvent.submit(screen.getByRole('button', { name: 'Guardar Cambios' }).closest('form') as HTMLFormElement);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Por favor corrige los errores en el formulario');
      expect(api.put).not.toHaveBeenCalled();
    });
  });
});

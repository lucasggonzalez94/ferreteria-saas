import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockPush = jest.fn();
const mockToastSuccess = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ id: 'p-1' }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    const { priority: _priority, unoptimized: _unoptimized, ...rest } = props;
    return <img {...rest} alt={rest.alt || 'image'} />;
  },
}));

jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
}));

jest.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: ({ open, onConfirm }: { open: boolean; onConfirm: () => void }) =>
    open ? (
      <button type="button" onClick={onConfirm}>
        Confirmar eliminar producto
      </button>
    ) : null,
}));

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: jest.fn(),
  },
}));

import ProductDetailViewPage from '@/app/dashboard/products/[id]/view/page';

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });

  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe('dashboard product detail view page', () => {
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

  beforeEach(() => {
    jest.clearAllMocks();
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/products/p-1') return Promise.resolve({ data: null });
      if (url === '/price-suggestions/history/p-1') return Promise.resolve({ data: [] });
      if (url === '/products/p-1/sales-summary') return Promise.resolve({ data: { totalUnits: 0, totalRevenue: 0, points: [] } });
      if (url === '/products/p-1/stock-movements') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
  });

  it('shows not found state and allows returning to list', async () => {
    renderWithQueryClient(<ProductDetailViewPage />);

    expect(await screen.findByText('Producto no encontrado')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Volver al listado' }));
    expect(mockPush).toHaveBeenCalledWith('/dashboard/products');
  });

  it('renders product metrics and supports edit, toggle active, and delete', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/products/p-1') {
        return Promise.resolve({
          data: {
            id: 'p-1',
            name: 'Amoladora',
            internalSku: 'SKU-1',
            barcode: '779123',
            price: 200,
            cost: 120,
            stockQuantity: 3,
            minStock: 5,
            unit: 'u',
            isActive: true,
            category: { name: 'Herramientas' },
            brand: { name: 'Marca Demo' },
            taxRate: 21,
            isFractional: false,
            imageUrl: null,
          },
        });
      }
      if (url === '/price-suggestions/history/p-1') return Promise.resolve({ data: [] });
      if (url === '/products/p-1/sales-summary') return Promise.resolve({ data: { totalUnits: 0, totalRevenue: 0, points: [] } });
      if (url === '/products/p-1/stock-movements') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });
    (api.put as jest.Mock).mockResolvedValue({ data: {} });
    (api.delete as jest.Mock).mockResolvedValue({ data: {} });

    renderWithQueryClient(<ProductDetailViewPage />);

    expect(await screen.findByRole('heading', { name: 'Amoladora', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getByText('No hay cambios de precio en el rango seleccionado')).toBeInTheDocument();
    expect(screen.getByText('No hay ventas en el rango seleccionado')).toBeInTheDocument();
    expect(screen.getByText('No hay movimientos de stock en el rango seleccionado')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(mockPush).toHaveBeenCalledWith('/dashboard/products/p-1');

    fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/products/p-1', { isActive: false });
      expect(mockToastSuccess).toHaveBeenCalledWith('Estado actualizado');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar eliminar producto' }));

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/products/p-1');
      expect(mockPush).toHaveBeenCalledWith('/dashboard/products');
    });
  });

  it('uploads and deletes product image', async () => {
    (api.get as jest.Mock).mockImplementation((url: string) => {
      if (url === '/products/p-1') {
        return Promise.resolve({
          data: {
            id: 'p-1',
            name: 'Taladro',
            internalSku: 'SKU-2',
            price: 100,
            cost: 70,
            stockQuantity: 10,
            minStock: 2,
            unit: 'u',
            isActive: true,
            taxRate: 21,
            isFractional: false,
            imageUrl: '/uploads/taladro.png',
          },
        });
      }
      if (url === '/price-suggestions/history/p-1') return Promise.resolve({ data: [] });
      if (url === '/products/p-1/sales-summary') return Promise.resolve({ data: { totalUnits: 0, totalRevenue: 0, points: [] } });
      if (url === '/products/p-1/stock-movements') return Promise.resolve({ data: [] });
      return Promise.resolve({ data: [] });
    });
    (api.upload as jest.Mock).mockResolvedValue({ data: {} });
    (api.delete as jest.Mock).mockResolvedValue({ data: {} });

    const { container } = renderWithQueryClient(<ProductDetailViewPage />);

    expect(await screen.findByRole('heading', { name: 'Taladro', level: 1 })).toBeInTheDocument();

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['image-data'], 'taladro.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(api.upload).toHaveBeenCalledWith('/products/image/p-1', expect.any(FormData));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar imagen del producto' }));
    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/products/p-1/image');
    });
  });
});

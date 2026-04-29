import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { api } from '@/lib/api';

const mockPush = jest.fn();
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ id: 'prod-1' }),
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => <img {...props} alt={props.alt || 'image'} />,
}));

jest.mock('sonner', () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

jest.mock('@/components/ui/date-picker', () => ({
  DatePicker: ({ value = '', onChange, placeholder }: { value?: string; onChange: (v: string) => void; placeholder?: string }) => (
    <input aria-label={placeholder || 'date'} type="date" value={value} onChange={(e) => onChange(e.target.value)} />
  ),
}));

jest.mock('@/components/ui/confirm-dialog', () => ({
  ConfirmDialog: ({ open, onConfirm, onOpenChange }: { open: boolean; onConfirm: () => void; onOpenChange: (open: boolean) => void }) =>
    open ? (
      <div>
        <button type="button" onClick={onConfirm}>
          Confirmar eliminar
        </button>
        <button type="button" onClick={() => onOpenChange(false)}>
          Cancelar eliminar
        </button>
      </div>
    ) : null,
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

const baseProduct = {
  id: 'prod-1',
  name: 'Martillo Pro',
  internalSku: 'SKU-001',
  barcode: '7791234567890',
  description: 'Martillo de prueba',
  unit: 'u',
  isFractional: false,
  taxRate: 21,
  marginPercent: 30,
  suggestedPrice: 156,
  price: 150,
  cost: 100,
  stockQuantity: 3,
  minStock: 5,
  isActive: true,
  imageUrl: null,
  category: { name: 'Herramientas' },
  brand: { name: 'Acme' },
  createdAt: '2026-04-20T10:00:00.000Z',
  updatedAt: '2026-04-21T10:00:00.000Z',
};

function setupApi(productData: any) {
  (api.get as jest.Mock).mockImplementation((url: string) => {
    if (url === '/products/prod-1') return Promise.resolve({ data: productData });
    if (url === '/price-suggestions/history/prod-1') return Promise.resolve({ data: [] });
    if (url === '/products/prod-1/sales-summary') return Promise.resolve({ data: { totalUnits: 2, totalRevenue: 300, points: [] } });
    if (url === '/products/prod-1/stock-movements') return Promise.resolve({ data: [] });
    return Promise.resolve({ data: [] });
  });
}

describe('dashboard product detail view page', () => {
  const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    consoleLogSpy.mockRestore();
  });

  it('shows not found state and returns to products list', async () => {
    setupApi(null);

    renderWithQueryClient(<ProductDetailViewPage />);

    expect(await screen.findByText('Producto no encontrado')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Volver al listado' }));
    expect(mockPush).toHaveBeenCalledWith('/dashboard/products');
  });

  it('renders product details and low stock indicator', async () => {
    setupApi(baseProduct);

    renderWithQueryClient(<ProductDetailViewPage />);

    expect(await screen.findByRole('heading', { name: 'Martillo Pro', level: 1 })).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
    expect(screen.getByText('SKU: SKU-001 · Código: 7791234567890')).toBeInTheDocument();
    expect(screen.getByText('Mín: 5')).toBeInTheDocument();
    expect(screen.getByText('Herramientas')).toBeInTheDocument();
    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Sin imagen')).toBeInTheDocument();
  });

  it('toggles active state and requests product deletion', async () => {
    setupApi(baseProduct);
    (api.put as jest.Mock).mockResolvedValue({ data: {} });
    (api.delete as jest.Mock).mockResolvedValue({ data: {} });

    renderWithQueryClient(<ProductDetailViewPage />);

    expect(await screen.findByRole('heading', { name: 'Martillo Pro', level: 1 })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Desactivar' }));
    await waitFor(() => {
      expect(api.put).toHaveBeenCalledWith('/products/prod-1', { isActive: false });
      expect(mockToastSuccess).toHaveBeenCalledWith('Estado actualizado');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar eliminar' }));

    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/products/prod-1');
      expect(mockToastSuccess).toHaveBeenCalledWith('Producto eliminado');
      expect(mockPush).toHaveBeenCalledWith('/dashboard/products');
    });
  });

  it('uploads and deletes product image', async () => {
    setupApi(baseProduct);
    (api.upload as jest.Mock).mockResolvedValue({ data: {} });
    (api.delete as jest.Mock).mockResolvedValue({ data: {} });

    const { container } = renderWithQueryClient(<ProductDetailViewPage />);
    expect(await screen.findByRole('heading', { name: 'Martillo Pro', level: 1 })).toBeInTheDocument();

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img'], 'producto.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    await waitFor(() => {
      expect(api.upload).toHaveBeenCalledWith('/products/image/prod-1', expect.any(FormData));
      expect(mockToastSuccess).toHaveBeenCalledWith('Imagen subida correctamente');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Eliminar imagen del producto' }));
    await waitFor(() => {
      expect(api.delete).toHaveBeenCalledWith('/products/prod-1/image');
      expect(mockToastSuccess).toHaveBeenCalledWith('Imagen eliminada');
    });
  });
});

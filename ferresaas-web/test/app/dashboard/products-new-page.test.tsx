import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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

  beforeAll(() => {
    Object.defineProperty(Element.prototype, 'scrollIntoView', {
      writable: true,
      value: jest.fn(),
    });
  });

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

  it('shows error when suggested price calculation fails', async () => {
    (api.post as jest.Mock).mockRejectedValue(new Error('Error al calcular precio'));

    renderWithQueryClient(<NewProductPage />);

    fireEvent.change(screen.getByLabelText('Costo *'), { target: { value: '100' } });
    fireEvent.change(screen.getByLabelText('IVA (%)'), { target: { value: '21' } });
    fireEvent.change(screen.getByLabelText('Margen (%)'), { target: { value: '20' } });
    fireEvent.click(screen.getByRole('button', { name: 'Calcular' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Error al calcular precio');
    });
  });

  it('validates markup target in markup mode and blocks submit', async () => {
    renderWithQueryClient(<NewProductPage />);

    const pricingModeTrigger = screen.getByLabelText('Modo de Pricing');
    fireEvent.click(pricingModeTrigger);
    fireEvent.click(await screen.findByRole('option', { name: 'Mantener Markup' }));

    const targetInput = document.querySelector('#targetMargin') as HTMLInputElement;
    fireEvent.change(targetInput, { target: { value: '' } });

    expect(await screen.findByText('El Markup Objetivo es requerido')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'Pinza' } });
    fireEvent.change(screen.getByLabelText('Costo *'), { target: { value: '50' } });
    fireEvent.change(screen.getByLabelText('Precio de Venta *'), { target: { value: '70' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear Producto' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Por favor corrige los errores en el formulario');
      expect(api.post).not.toHaveBeenCalledWith('/products', expect.anything());
    });
  });

  it('validates category name and creates category from modal', async () => {
    (api.post as jest.Mock).mockImplementation((url: string) => {
      if (url === '/categories') {
        return Promise.resolve({ data: { id: 'cat-9', name: 'Pinturas' } });
      }
      return Promise.resolve({ data: {} });
    });

    renderWithQueryClient(<NewProductPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Nueva' }));
    const dialog = await screen.findByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText('Nombre *'), { target: { value: '   ' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Ingresa un nombre para la categoría');
    });

    fireEvent.change(within(dialog).getByLabelText('Nombre *'), { target: { value: 'Pinturas' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/categories', {
        name: 'Pinturas',
        description: undefined,
      });
      expect(mockToastSuccess).toHaveBeenCalledWith('Categoría creada');
    });
  });

  it('shows error when category creation request fails', async () => {
    (api.post as jest.Mock).mockRejectedValue(new Error('Error al crear categoría'));

    renderWithQueryClient(<NewProductPage />);

    fireEvent.click(screen.getByRole('button', { name: 'Nueva' }));
    const dialog = await screen.findByRole('dialog');

    fireEvent.change(within(dialog).getByLabelText('Nombre *'), { target: { value: 'Cerrajeria' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Crear' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Error al crear categoría');
    });
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

  it('shows error when product creation request fails', async () => {
    (api.post as jest.Mock).mockRejectedValue(new Error('Error al crear producto'));

    renderWithQueryClient(<NewProductPage />);

    fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'Martillo' } });
    fireEvent.change(screen.getByLabelText('Costo *'), { target: { value: '80' } });
    fireEvent.change(screen.getByLabelText('Precio de Venta *'), { target: { value: '120' } });
    fireEvent.change(screen.getByLabelText('Margen Objetivo (%)'), { target: { value: '35' } });
    fireEvent.click(screen.getByRole('button', { name: 'Crear Producto' }));

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Error al crear producto');
    });
  });

  it('creates product with image and uploads selected file', async () => {
    (api.post as jest.Mock).mockImplementation((url: string, payload: any) => {
      if (url === '/products') {
        return Promise.resolve({ data: { id: 'p-2', ...payload } });
      }
      return Promise.resolve({ data: {} });
    });
    (api.upload as jest.Mock).mockResolvedValue({ data: {} });

    const fileReaderMock = {
      readAsDataURL: jest.fn(function (this: any) {
        this.result = 'data:image/png;base64,mock';
        if (this.onloadend) this.onloadend();
      }),
      result: 'data:image/png;base64,mock',
      onloadend: null as null | (() => void),
    };
    const originalFileReader = (window as any).FileReader;
    (window as any).FileReader = jest.fn(() => fileReaderMock);

    const { container } = renderWithQueryClient(<NewProductPage />);

    fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'Sierra' } });
    fireEvent.change(screen.getByLabelText('Costo *'), { target: { value: '90' } });
    fireEvent.change(screen.getByLabelText('Precio de Venta *'), { target: { value: '140' } });
    fireEvent.change(screen.getByLabelText('Margen Objetivo (%)'), { target: { value: '30' } });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img'], 'foto.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByRole('button', { name: 'Crear Producto' }));

    await waitFor(() => {
      expect(api.upload).toHaveBeenCalledWith('/products/image/p-2', expect.any(FormData));
      expect(mockToastSuccess).toHaveBeenCalledWith('Producto creado y imagen subida exitosamente');
      expect(mockPush).toHaveBeenCalledWith('/dashboard/products');
    });

    (window as any).FileReader = originalFileReader;
  });

  it('removes selected image preview before submit', async () => {
    const fileReaderMock = {
      readAsDataURL: jest.fn(function (this: any) {
        this.result = 'data:image/png;base64,mock';
        if (this.onloadend) this.onloadend();
      }),
      result: 'data:image/png;base64,mock',
      onloadend: null as null | (() => void),
    };
    const originalFileReader = (window as any).FileReader;
    (window as any).FileReader = jest.fn(() => fileReaderMock);

    const { container } = renderWithQueryClient(<NewProductPage />);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img'], 'preview.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByAltText('Preview')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Eliminar imagen seleccionada' }));

    await waitFor(() => {
      expect(screen.queryByAltText('Preview')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Seleccionar imagen del producto' })).toBeInTheDocument();
    });

    (window as any).FileReader = originalFileReader;
  });

  it('shows warning when image upload fails after product creation', async () => {
    (api.post as jest.Mock).mockImplementation((url: string, payload: any) => {
      if (url === '/products') {
        return Promise.resolve({ data: { id: 'p-3', ...payload } });
      }
      return Promise.resolve({ data: {} });
    });
    (api.upload as jest.Mock).mockRejectedValue(new Error('fallo upload'));

    const fileReaderMock = {
      readAsDataURL: jest.fn(function (this: any) {
        this.result = 'data:image/png;base64,mock';
        if (this.onloadend) this.onloadend();
      }),
      result: 'data:image/png;base64,mock',
      onloadend: null as null | (() => void),
    };
    const originalFileReader = (window as any).FileReader;
    (window as any).FileReader = jest.fn(() => fileReaderMock);

    const { container } = renderWithQueryClient(<NewProductPage />);

    fireEvent.change(screen.getByLabelText('Nombre *'), { target: { value: 'Lija' } });
    fireEvent.change(screen.getByLabelText('Costo *'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('Precio de Venta *'), { target: { value: '35' } });
    fireEvent.change(screen.getByLabelText('Margen Objetivo (%)'), { target: { value: '25' } });

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['img'], 'foto2.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByRole('button', { name: 'Crear Producto' }));

    await waitFor(() => {
      expect(mockToastWarning).toHaveBeenCalledWith('Producto creado pero la imagen no se pudo subir');
      expect(mockPush).toHaveBeenCalledWith('/dashboard/products');
    });

    (window as any).FileReader = originalFileReader;
  });
});

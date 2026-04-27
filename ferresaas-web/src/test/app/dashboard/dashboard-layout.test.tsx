import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockPush = jest.fn();
const mockLogout = jest.fn();

let mockAuthValue: any;
let mockPathname = '/dashboard';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => mockPathname,
}));

jest.mock('next/image', () => ({
  __esModule: true,
  default: ({ alt = '', priority, ...props }: any) => <img alt={alt} {...props} />,
}));

jest.mock('@/lib/auth-context', () => ({
  useAuth: () => mockAuthValue,
}));

jest.mock('@/components/ui/loading-spinner', () => ({
  LoadingSpinner: ({ text }: { text?: string }) => <div>{text || 'loading'}</div>,
}));

jest.mock('@/components/ui/theme-toggle', () => ({
  ThemeToggle: () => <div>theme-toggle</div>,
}));

jest.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/components/ui/command-palette', () => ({
  COMMAND_ACTIONS: [
    { href: '/dashboard/sales', requiredPermission: 'sales:read' },
    { href: '/dashboard/products', requiredPermission: 'products:read' },
  ],
  CommandPalette: ({ isOpen }: { isOpen: boolean }) => (isOpen ? <div>command-palette-open</div> : null),
}));

jest.mock('@/lib/contexts/barcode-context', () => ({
  BarcodeProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/lib/hooks/useGlobalBarcodeListener', () => ({
  useGlobalBarcodeListener: () => undefined,
}));

jest.mock('@/components/barcode/barcode-product-modal', () => ({
  BarcodeProductModal: () => null,
}));

jest.mock('@/components/barcode/global-unknown-barcode-modal', () => ({
  GlobalUnknownBarcodeModal: () => null,
}));

import DashboardLayout from '@/app/dashboard/layout';

describe('dashboard layout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPathname = '/dashboard';
    mockAuthValue = {
      isLoading: false,
      isAuthenticated: true,
      user: { firstName: 'Ana', email: 'ana@demo.com', permissions: ['sales:read'] },
      logout: (...args: unknown[]) => mockLogout(...args),
    };
  });

  it('shows loading state while auth is loading', () => {
    mockAuthValue = {
      isLoading: true,
      isAuthenticated: false,
      user: null,
      logout: (...args: unknown[]) => mockLogout(...args),
    };

    render(<DashboardLayout><div>child</div></DashboardLayout>);
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
  });

  it('redirects to login when not authenticated', async () => {
    mockPathname = '/dashboard/reports';
    mockAuthValue = {
      isLoading: false,
      isAuthenticated: false,
      user: null,
      logout: (...args: unknown[]) => mockLogout(...args),
    };

    const { container } = render(<DashboardLayout><div>child</div></DashboardLayout>);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith('/login?returnUrl=%2Fdashboard%2Freports');
    });

    expect(container).toBeEmptyDOMElement();
  });

  it('renders shell, opens quick navigation, handles shortcuts and logout', async () => {
    render(<DashboardLayout><div>contenido</div></DashboardLayout>);

    expect(screen.getByText('contenido')).toBeInTheDocument();
    expect(screen.getByText('Ana')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Abrir navegación rápida' }));
    expect(screen.getByText('command-palette-open')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: '1', altKey: true });
    expect(mockPush).toHaveBeenCalledWith('/dashboard/sales');

    fireEvent.click(screen.getByRole('button', { name: 'Salir' }));
    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });
  });
});

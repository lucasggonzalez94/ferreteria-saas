import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { DollarSign } from 'lucide-react';

import { Pagination } from '@/components/ui/pagination';
import { StatCard } from '@/components/ui/stat-card';

describe('stat card and pagination', () => {
  it('renders stat card with icon, trend and formatted number', () => {
    const expected = (1234.5).toLocaleString('es-AR', { minimumFractionDigits: 2 });

    render(
      <StatCard
        title="Ventas"
        value={1234.5}
        icon={DollarSign}
        description="Ultimos 30 dias"
        trend={{ value: -3.5, isPositive: false }}
      />
    );

    expect(screen.getByText('Ventas')).toBeInTheDocument();
    expect(screen.getByText(expected)).toBeInTheDocument();
    expect(screen.getByText('Ultimos 30 dias')).toBeInTheDocument();
    expect(screen.getByText('↓ 3.5%')).toBeInTheDocument();
  });

  it('pagination returns null for single page and triggers page changes', () => {
    const onPageChange = jest.fn();
    const onLimitChange = jest.fn();
    const setPage = jest.fn();
    const { rerender } = render(
      <Pagination
        setPage={setPage}
        currentPage={1}
        totalPages={1}
        startIndex={1}
        endIndex={1}
        total={1}
        limit={20}
        onLimitChange={onLimitChange}
        onPageChange={onPageChange}
      />
    );

    expect(screen.queryByText(/Pagina/i)).toBeNull();

    rerender(
      <Pagination
        setPage={setPage}
        currentPage={2}
        totalPages={3}
        startIndex={21}
        endIndex={40}
        total={60}
        limit={20}
        onLimitChange={onLimitChange}
        hasMore={true}
        onPageChange={onPageChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));

    expect(onPageChange).toHaveBeenNthCalledWith(1, 1);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 3);
  });
});
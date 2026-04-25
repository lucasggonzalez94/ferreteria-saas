import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { NotificationBadge } from '@/components/ui/notification-badge';
import { SearchBar } from '@/components/ui/search-bar';
import { Textarea } from '@/components/ui/textarea';

describe('ui primitives', () => {
  it('renders alert and card compound blocks', () => {
    render(
      <div>
        <Alert variant="destructive" data-testid="alert">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>Algo salio mal</AlertDescription>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Titulo</CardTitle>
            <CardDescription>Descripcion</CardDescription>
          </CardHeader>
          <CardContent>Contenido</CardContent>
          <CardFooter>Footer</CardFooter>
        </Card>
      </div>
    );

    expect(screen.getByTestId('alert')).toHaveAttribute('role', 'alert');
    expect(screen.getByText('Titulo')).toBeInTheDocument();
    expect(screen.getByText('Footer')).toBeInTheDocument();
  });

  it('renders button, input wheel behavior, textarea and label', () => {
    const onWheel = jest.fn();
    const onWheelCapture = jest.fn();

    render(
      <div>
        <Button>Guardar</Button>
        <Button asChild>
          <a href="/x">Ir</a>
        </Button>
        <Label htmlFor="qty">Cantidad</Label>
        <Input
          id="qty"
          type="number"
          onWheel={onWheel}
          onWheelCapture={onWheelCapture}
        />
        <Textarea placeholder="Detalle" />
      </div>
    );

    fireEvent.wheel(screen.getByLabelText('Cantidad'));

    expect(screen.getByRole('button', { name: 'Guardar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir' })).toHaveAttribute('href', '/x');
    expect(onWheel).toHaveBeenCalled();
    expect(onWheelCapture).toHaveBeenCalled();
    expect(screen.getByPlaceholderText('Detalle')).toBeInTheDocument();
  });

  it('renders loading spinner, notification badge and search bar interactions', () => {
    const onChange = jest.fn();

    const { rerender } = render(
      <div>
        <LoadingSpinner size="sm" text="Cargando" />
        <NotificationBadge count={120} max={99} />
        <SearchBar value="martillo" onChange={onChange} placeholder="Buscar producto" />
      </div>
    );

    fireEvent.change(screen.getByPlaceholderText('Buscar producto'), {
      target: { value: 'clavo' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Limpiar/i }));

    expect(screen.getByText('Cargando')).toBeInTheDocument();
    expect(screen.getByText('99+')).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith('clavo');
    expect(onChange).toHaveBeenCalledWith('');

    rerender(<NotificationBadge count={0} />);
    expect(screen.queryByText('99+')).toBeNull();
  });
});

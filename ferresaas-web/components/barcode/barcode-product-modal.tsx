"use client";

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useBarcodeModal } from '@/lib/contexts/barcode-context';
import { useCartPersistence } from '@/lib/hooks/useCartPersistence';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShoppingCart } from 'lucide-react';
import { Tooltip } from '@/components/ui/tooltip';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function BarcodeProductModal() {
  const router = useRouter();
  const { isOpen, product, closeModal } = useBarcodeModal();
  const { addProductToCart } = useCartPersistence();

  const { data: cashRegisterStatus } = useQuery({
    queryKey: ['cash-register', 'status'],
    queryFn: async () => {
      const response = await api.get<any>('/cash-register/status');
      return response.data;
    },
    enabled: isOpen,
  });

  const handleAddToCart = () => {
    if (!product) return;

    if (product.stockQuantity <= 0) {
      toast.error(`${product.name} no tiene stock disponible`);
      return;
    }

    addProductToCart(product);
    toast.success(`${product.name} agregado al carrito`);
    closeModal();

    if (cashRegisterStatus === null) {
      router.push('/dashboard/cash-register');
    } else {
      router.push('/dashboard/pos');
    }
  };

  if (!product) return null;

  const hasStock = product.stockQuantity > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Producto Escaneado</span>
          </DialogTitle>
          <DialogDescription>
            Información del producto escaneado
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {product.imageUrl && (
            <div className="flex justify-center">
              <Image
                src={
                  product.imageUrl.startsWith('http')
                    ? product.imageUrl
                    : `${API_BASE}${product.imageUrl}`
                }
                alt={product.name}
                width={192}
                height={192}
                unoptimized
                className="w-48 h-48 object-cover rounded-lg border border-gray-200"
              />
            </div>
          )}

          <div className="space-y-3">
            <div>
              <p className="text-sm text-muted-foreground">Nombre</p>
              <p className="text-lg font-semibold">{product.name}</p>
            </div>

            {product.description && (
              <div>
                <p className="text-sm text-muted-foreground">Descripción</p>
                <p className="text-sm">{product.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">SKU</p>
                <p className="font-medium">{product.internalSku}</p>
              </div>

              {product.barcode && (
                <div>
                  <p className="text-sm text-muted-foreground">Código de barras</p>
                  <p className="font-medium">{product.barcode}</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Precio</p>
                <p className="text-xl font-bold text-green-600">
                  ${Number(product.price).toFixed(2)}
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">Stock</p>
                <p
                  className={`text-lg font-semibold ${
                    hasStock ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {product.stockQuantity} {product.unit}
                </p>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            {!hasStock ? (
              <Tooltip content="Este producto no tiene stock disponible">
                <Button
                  onClick={handleAddToCart}
                  disabled={true}
                  className="w-full"
                  size="lg"
                >
                  <ShoppingCart className="mr-2 h-5 w-5" />
                  Agregar al carrito
                </Button>
              </Tooltip>
            ) : (
              <Button
                onClick={handleAddToCart}
                className="w-full"
                size="lg"
              >
                <ShoppingCart className="mr-2 h-5 w-5" />
                Agregar al carrito
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
